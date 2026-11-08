"""Private account assets, profile, email changes and email MFA."""

import io
import secrets
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Form, HTTPException, Response, UploadFile
from pydantic import EmailStr, Field
from sqlalchemy import delete, func, select

from planner import accounts, planning, schemas, storage
from planner.auth import (
    DB,
    Auth,
    digest,
    limit,
    lock_owner,
    password_matches,
    passwords,
    public_user,
)
from planner.config import settings
from planner.models import AccountFile, Attachment, AuthToken, LoginSession, User, new_id, now

router = APIRouter(prefix="/api/v1")


def clean_image(file: UploadFile):
    from PIL import Image, ImageOps, UnidentifiedImageError

    data = file.file.read(5 * 1024 * 1024 + 1)
    if not data or len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Choose an image up to 5 MB")
    try:
        with Image.open(io.BytesIO(data), formats=("JPEG", "PNG", "WEBP")) as source:
            if (
                source.width > 4096
                or source.height > 4096
                or source.width * source.height > 16_777_216
            ):
                raise HTTPException(422, "Image dimensions must be at most 4096 × 4096")
            source.load()
            pixels = ImageOps.exif_transpose(source).convert(
                "RGBA" if "A" in source.getbands() else "RGB"
            )
            output = io.BytesIO()
            pixels.save(output, format="WEBP", quality=90)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise HTTPException(422, "Choose a valid JPEG, PNG or WebP image") from exc
    return UploadFile(
        filename=Path(file.filename or "image").stem + ".webp", file=io.BytesIO(output.getvalue())
    )


class Profile(schemas.Strict):
    bio: str | None = Field(default=None, max_length=2000)
    avatar_id: str | None = None
    remove_avatar: bool = False


@router.put("/profile")
def update_profile(body: Profile, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    values = dict(auth.user.profile)
    if body.bio is not None:
        values["bio"] = body.bio
    if body.avatar_id:
        asset = db.scalar(
            select(AccountFile).where(
                AccountFile.id == body.avatar_id,
                AccountFile.user_id == auth.user.id,
                AccountFile.purpose == "avatar",
            )
        )
        if asset is None:
            raise HTTPException(404, "Not found")
        values["avatar_id"] = asset.id
    if body.remove_avatar:
        values.pop("avatar_id", None)
    auth.user.profile = values
    db.commit()
    return public_user(auth.user)


@router.get("/account-files")
def account_files(auth: Auth, db: DB):
    return [
        {
            "id": row.id,
            "purpose": row.purpose,
            "url": "/api/v1/account-files/" + row.id,
            "mime": row.mime,
            "size": row.size,
        }
        for row in db.scalars(select(AccountFile).where(AccountFile.user_id == auth.user.id))
    ]


@router.post("/account-files", status_code=201)
def upload_account_file(
    auth: Auth,
    db: DB,
    file: UploadFile,
    purpose: Literal["avatar", "background", "evidence"] = Form("background"),
):
    limit(db, "account-upload:" + auth.user.id, 30, 3600)
    sanitized = clean_image(file)
    key = "account/" + new_id()
    db.rollback()
    size, checksum = storage.upload(sanitized, key)
    try:
        lock_owner(db, auth.user.id)
        total = db.scalar(
            select(func.coalesce(func.sum(AccountFile.size), 0)).where(
                AccountFile.user_id == auth.user.id
            )
        )
        total += db.scalar(
            select(func.coalesce(func.sum(Attachment.size), 0)).where(
                Attachment.user_id == auth.user.id
            )
        )
        if total + size > settings().max_user_storage_bytes:
            raise HTTPException(413, "Account image allowance is full")
        row = AccountFile(
            user_id=auth.user.id, purpose=purpose, storage_key=key, size=size, mime="image/webp"
        )
        db.add(row)
        db.commit()
    except Exception:
        storage.remove(key)
        raise
    return {
        "id": row.id,
        "url": "/api/v1/account-files/" + row.id,
        "mime": row.mime,
        "size": row.size,
    }


@router.get("/account-files/{file_id}")
def account_file(file_id: str, auth: Auth, db: DB):
    row = db.get(AccountFile, file_id)
    if row is None:
        raise HTTPException(404, "Not found")
    if row.user_id != auth.user.id:
        from planner.models import Report

        allowed = auth.user.role == "admin" and any(
            file_id in report.evidence for report in db.scalars(select(Report))
        )
        if not allowed:
            raise HTTPException(404, "Not found")
    key, mime = row.storage_key, row.mime
    db.rollback()
    return Response(
        storage.read(key),
        media_type=mime,
        headers={"Content-Disposition": "inline", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/account-files/{file_id}", status_code=204)
def delete_account_file(file_id: str, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    row = db.scalar(
        select(AccountFile).where(AccountFile.id == file_id, AccountFile.user_id == auth.user.id)
    )
    if row is None:
        raise HTTPException(404, "Not found")
    from planner.models import Report

    if any(file_id in report.evidence for report in db.scalars(select(Report))):
        raise HTTPException(422, "This evidence is retained with its report")
    auth.user.profile = {key: value for key, value in auth.user.profile.items() if value != file_id}
    auth.user.preferences = {
        key: value for key, value in auth.user.preferences.items() if value != file_id
    }
    planning.enqueue(
        db, auth.user.id, "delete-file", "delete-file:" + row.id, {"key": row.storage_key}
    )
    db.delete(row)
    db.commit()


class EmailChange(schemas.Strict):
    email: EmailStr
    current_password: str = Field(min_length=1, max_length=128)


class EmailCode(schemas.Strict):
    code: str = Field(pattern=r"^[0-9]{6}$")


@router.post("/auth/email/change", status_code=202)
def change_email(body: EmailChange, auth: Auth, db: DB):
    limit(db, "email-change:" + auth.user.id, 3, 3600)
    lock_owner(db, auth.user.id)
    if not password_matches(body.current_password, auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    email = str(body.email).lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(422, "This email cannot be used")
    code = str(secrets.randbelow(1_000_000)).zfill(6)
    token = accounts.issue_token(
        db,
        auth.user,
        "email-change",
        30,
        {"email": email, "previous": auth.user.email, "code_hash": passwords.hash(code)},
    )
    auth.user.profile = {**auth.user.profile, "pending_email": email}
    planning.enqueue(
        db,
        auth.user.id,
        "email",
        "email-change:" + digest(token),
        {
            "to": email,
            "subject": "Planner — Confirm email change",
            "body": "Code: "
            + code
            + "\nExpires in 30 minutes.\n"
            + settings().web_origin
            + "/confirm-email#token="
            + quote(token),
        },
    )
    db.commit()
    return {"pending_email": email}


def finish_email(db, record):
    user = db.get(User, record.user_id)
    if user.locked_at or user.email != record.payload["previous"]:
        raise HTTPException(422, "This email change expired")
    if db.scalar(select(User.id).where(User.email == record.payload["email"])):
        raise HTTPException(422, "This email cannot be used")
    user.email, user.email_verified_at = record.payload["email"], now()
    user.profile = {k: v for k, v in user.profile.items() if k != "pending_email"}
    db.delete(record)
    # Existing sessions must sign in again using the new address.
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.commit()


@router.post("/auth/email/confirm", status_code=204)
def confirm_email_code(body: EmailCode, auth: Auth, db: DB):
    limit(db, "email-confirm:" + auth.user.id, 5, 300)
    lock_owner(db, auth.user.id)
    record = db.scalar(
        select(AuthToken)
        .where(AuthToken.user_id == auth.user.id, AuthToken.purpose == "email-change")
        .with_for_update()
    )
    if (
        record is None
        or record.expires_at <= now()
        or not passwords.verify(body.code, record.payload["code_hash"])
    ):
        raise HTTPException(422, "Incorrect or expired verification code")
    finish_email(db, record)


@router.post("/auth/confirm-email", status_code=204)
def confirm_email_link(body: accounts.Token, request: accounts.Request, db: DB):
    accounts.verify_origin(request)
    record = accounts.token_record(db, body.token, "email-change")
    finish_email(db, record)


class EmailMFA(accounts.CurrentPassword):
    enabled: bool = True


@router.post("/auth/two-factor/email/setup", status_code=202)
def setup_email_mfa(body: EmailMFA, auth: Auth, db: DB):
    limit(db, "email-mfa:" + auth.user.id, 3, 300)
    if not password_matches(body.current_password, auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    code = str(secrets.randbelow(1_000_000)).zfill(6)
    token = accounts.issue_token(
        db, auth.user, "email-mfa", 10, {"enabled": body.enabled, "code_hash": passwords.hash(code)}
    )
    planning.enqueue(
        db,
        auth.user.id,
        "email",
        "email-mfa:" + digest(token),
        {
            "to": auth.user.email,
            "subject": "Planner — Verification code",
            "body": "Code: " + code + "\nExpires in ten minutes.",
        },
    )
    db.commit()
    return {"message": "Check your email for the verification code"}


@router.post("/auth/two-factor/email/confirm", status_code=204)
def confirm_email_mfa(body: accounts.ConfirmMFA, auth: Auth, db: DB):
    limit(db, "email-mfa-confirm:" + auth.user.id, 5, 300)
    lock_owner(db, auth.user.id)
    record = db.scalar(
        select(AuthToken)
        .where(AuthToken.user_id == auth.user.id, AuthToken.purpose == "email-mfa")
        .with_for_update()
    )
    if (
        record is None
        or record.expires_at <= now()
        or not password_matches(body.password, auth.user.password_hash)
        or not passwords.verify(body.code, record.payload["code_hash"])
    ):
        raise HTTPException(422, "Password or verification code is incorrect")
    auth.user.email_mfa = record.payload["enabled"]
    if auth.user.email_mfa:
        auth.user.totp_secret = None
        auth.user.email_verified_at = auth.user.email_verified_at or now()
    db.delete(record)
    db.execute(
        delete(LoginSession).where(
            LoginSession.user_id == auth.user.id, LoginSession.token_hash != auth.session.token_hash
        )
    )
    db.commit()


@router.delete("/auth/email/change", status_code=204)
def cancel_email_change(auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    db.execute(
        delete(AuthToken).where(
            AuthToken.user_id == auth.user.id, AuthToken.purpose == "email-change"
        )
    )
    auth.user.profile = {
        key: value for key, value in auth.user.profile.items() if key != "pending_email"
    }
    db.commit()
