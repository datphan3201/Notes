import base64
import hashlib
import hmac
import json
import secrets
import smtplib
import ssl
import struct
from datetime import timedelta
from email.message import EmailMessage
from urllib.parse import quote

import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import EmailStr, Field, model_validator
from sqlalchemy import delete, select

from planner.auth import (
    DB,
    DUMMY_HASH,
    Auth,
    digest,
    limit,
    lock_owner,
    password_matches,
    passwords,
    start_session,
    verify_origin,
)
from planner.config import settings
from planner.models import AuthToken, LoginSession, User, now
from planner.planning import enqueue
from planner.schemas import Strict

router = APIRouter(prefix="/api/v1/auth")


def cipher():
    key = settings().encryption_key.get_secret_value()
    if not key:
        raise HTTPException(503, "Account encryption is not configured")
    return Fernet(key.encode())


def totp_code(secret: str, timestamp: int):
    key = base64.b32decode(secret + "=" * ((-len(secret)) % 8))
    hashed = hmac.new(key, struct.pack(">Q", timestamp // 30), hashlib.sha1).digest()
    offset = hashed[-1] & 15
    value = (struct.unpack(">I", hashed[offset : offset + 4])[0] & 0x7FFFFFFF) % 1_000_000
    return str(value).zfill(6)


def verify_totp(user: User, code: str):
    secret = cipher().decrypt(user.totp_secret.encode()).decode()
    stamp = int(now().timestamp())
    for drift in (-30, 0, 30):
        step = (stamp + drift) // 30
        if step > user.totp_last_step and hmac.compare_digest(
            totp_code(secret, stamp + drift), code
        ):
            user.totp_last_step = step
            return True
    return False


def issue_token(db, user: User, purpose: str, minutes=30, payload=None):
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id, AuthToken.purpose == purpose))
    token = secrets.token_urlsafe(32)
    db.add(
        AuthToken(
            token_hash=digest(token),
            user_id=user.id,
            purpose=purpose,
            expires_at=now() + timedelta(minutes=minutes),
            payload=payload or {},
        )
    )
    return token


def token_record(db, value: str, purpose: str):
    owner = db.scalar(
        select(AuthToken.user_id).where(
            AuthToken.token_hash == digest(value), AuthToken.purpose == purpose
        )
    )
    if owner is None:
        raise HTTPException(422, "This link or challenge expired. Request a new one.")
    lock_owner(db, owner)
    record = db.scalar(
        select(AuthToken)
        .where(AuthToken.token_hash == digest(value), AuthToken.purpose == purpose)
        .with_for_update()
    )
    if record is None or record.expires_at <= now():
        raise HTTPException(422, "This link or challenge expired. Request a new one.")
    return record


def queue_email(db, user: User, purpose: str):
    code = str(secrets.randbelow(1_000_000)).zfill(6) if purpose == "reset" else None
    token = issue_token(
        db,
        user,
        purpose,
        30 if purpose == "reset" else 24 * 60,
        {"code_hash": passwords.hash(code), "attempts": 0} if code else {},
    )
    route = "/reset-password" if purpose == "reset" else "/verify-email"
    url = settings().web_origin + route + "#token=" + quote(token)
    enqueue(
        db,
        user.id,
        "email",
        f"{purpose}:{digest(token)}",
        {
            "to": user.email,
            "subject": "Planner — "
            + ("Verify your email" if purpose == "verify" else "Reset your password"),
            "body": ("Use the latest email. Code: " + code + "\n" if code else "")
            + (
                "Open this single-use link within 30 minutes:\n"
                if purpose == "reset"
                else "Open this single-use link within 24 hours:\n"
            )
            + url,
        },
    )


def send_email(payload, delivery_key=None):
    config = settings()
    if config.resend_api_key.get_secret_value():
        if not config.smtp_from:
            raise RuntimeError("EMAIL_NOT_CONFIGURED")
        delivery = hashlib.sha256(
            (delivery_key or json.dumps(payload, sort_keys=True)).encode()
        ).hexdigest()
        with httpx.Client(timeout=20) as client:
            response = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": "Bearer " + config.resend_api_key.get_secret_value(),
                    "Idempotency-Key": "planner:" + delivery,
                },
                json={
                    "from": config.smtp_from,
                    "to": [payload["to"]],
                    "subject": payload["subject"],
                    "text": payload["body"],
                },
            )
        if not response.is_success:
            raise RuntimeError("EMAIL_DELIVERY_FAILED")
        return
    if not config.smtp_host or not config.smtp_from:
        raise RuntimeError("EMAIL_NOT_CONFIGURED")
    message = EmailMessage()
    message["To"], message["From"], message["Subject"] = (
        payload["to"],
        config.smtp_from,
        payload["subject"],
    )
    message.set_content(payload["body"])
    with smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=20) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        if config.smtp_user:
            smtp.login(config.smtp_user, config.smtp_password.get_secret_value())
        smtp.send_message(message)


class Recover(Strict):
    email: EmailStr


class Token(Strict):
    token: str = Field(min_length=20, max_length=100)


class Reset(Token):
    email: EmailStr | None = None
    password: str = Field(min_length=12, max_length=128)
    password_confirmation: str | None = Field(default=None, max_length=128)

    @model_validator(mode="after")
    def confirmed_password(self):
        if self.password_confirmation is not None and self.password_confirmation != self.password:
            raise ValueError("Passwords do not match")
        return self


class RecoveryCode(Recover):
    code: str = Field(pattern=r"^[0-9]{6}$")


class Challenge(Strict):
    challenge: str = Field(min_length=20, max_length=100)


class PasswordChange(Strict):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class CurrentPassword(Strict):
    current_password: str = Field(min_length=1, max_length=128)


class MFA(Strict):
    challenge: str = Field(min_length=20, max_length=100)
    code: str = Field(pattern=r"^[0-9]{6}$")


class ConfirmMFA(Strict):
    code: str = Field(pattern=r"^[0-9]{6}$")
    password: str = Field(min_length=1, max_length=128)


@router.post("/recover", status_code=202)
def recover(body: Recover, request: Request, db: DB):
    verify_origin(request)
    limit(db, "recover-ip:" + request.client.host, 10, 3600)
    limit(db, "recover-email:" + str(body.email).lower(), 3, 3600)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user and not user.locked_at:
        lock_owner(db, user.id)
        db.refresh(user)
        if not user.locked_at:
            queue_email(db, user, "reset")
            db.commit()
    return {"message": "If the account is eligible, a recovery email will arrive shortly."}


@router.post("/reset", status_code=204)
def reset(body: Reset, request: Request, db: DB):
    verify_origin(request)
    limit(db, "reset:" + request.client.host, 10, 300)
    record = token_record(db, body.token, "reset")
    user = db.get(User, record.user_id)
    if user.locked_at or (body.email is not None and str(body.email).lower() != user.email):
        raise HTTPException(422, "This link or challenge expired. Request a new one.")
    user.password_hash = passwords.hash(body.password)
    # A recovery email proves mailbox access, but does not bypass existing MFA.
    user.email_verified_at = user.email_verified_at or now()
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    db.execute(delete(AuthToken).where(AuthToken.user_id == user.id))
    db.commit()


@router.post("/recover/code")
def recover_code(body: RecoveryCode, request: Request, db: DB):
    verify_origin(request)
    limit(db, "recovery-code:" + request.client.host, 10, 300)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    record = None
    if user:
        lock_owner(db, user.id)
        db.refresh(user)
        record = db.scalar(
            select(AuthToken)
            .where(AuthToken.user_id == user.id, AuthToken.purpose == "reset")
            .with_for_update()
        )
    payload = record.payload if record else {}
    eligible = bool(
        record
        and user
        and not user.locked_at
        and record.expires_at > now()
        and payload.get("attempts", 0) < 5
    )
    valid = passwords.verify(body.code, payload.get("code_hash") or DUMMY_HASH)
    if not eligible or not valid:
        if eligible:
            attempts = payload.get("attempts", 0) + 1
            record.payload = {
                **payload,
                "attempts": attempts,
                "code_hash": payload.get("code_hash") if attempts < 5 else None,
            }
            db.commit()
        raise HTTPException(422, "Code is invalid or has expired. Request a new one.")
    token = secrets.token_urlsafe(32)
    record.token_hash = digest(token)
    record.payload = {}
    db.commit()
    return {"token": token}


@router.post("/verification", status_code=202)
def request_verification(auth: Auth, db: DB):
    limit(db, "verify-email:" + auth.user.id, 3, 3600)
    if not auth.user.email_verified_at:
        queue_email(db, auth.user, "verify")
        db.commit()
    return {"message": "Check your email for the verification link."}


@router.post("/verify", status_code=204)
def verify_email(body: Token, request: Request, db: DB):
    verify_origin(request)
    record = token_record(db, body.token, "verify")
    db.get(User, record.user_id).email_verified_at = now()
    db.delete(record)
    db.commit()


@router.post("/password", status_code=204)
def change_password(body: PasswordChange, auth: Auth, db: DB):
    limit(db, "change-password:" + auth.user.id, 5, 300)
    lock_owner(db, auth.user.id)
    if not password_matches(body.current_password, auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    auth.user.password_hash = passwords.hash(body.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == auth.user.id))
    db.execute(delete(AuthToken).where(AuthToken.user_id == auth.user.id))
    db.commit()


@router.post("/two-factor")
def complete_login(body: MFA, request: Request, response: Response, db: DB):
    verify_origin(request)
    limit(db, "mfa:" + digest(body.challenge), 5, 300)
    record = token_record(db, body.challenge, "login")
    user = db.get(User, record.user_id)
    lock_owner(db, user.id)
    email_hash = record.payload.get("email_code_hash")
    email_valid = bool(email_hash and passwords.verify(body.code, email_hash))
    if (
        user.locked_at
        or not (user.totp_secret or user.email_mfa)
        or not (email_valid or (user.totp_secret and verify_totp(user, body.code)))
    ):
        raise HTTPException(401, "Incorrect verification code")
    db.delete(record)
    return start_session(db, user, response, request.headers.get("origin"))


@router.post("/two-factor/email", status_code=202)
def email_login_code(body: Challenge, request: Request, db: DB):
    verify_origin(request)
    limit(db, "mfa-email:" + digest(body.challenge), 3, 300)
    record = token_record(db, body.challenge, "login")
    user = db.get(User, record.user_id)
    if user.locked_at or not (user.totp_secret or user.email_mfa):
        raise HTTPException(422, "This challenge expired. Sign in again.")
    code = str(secrets.randbelow(1_000_000)).zfill(6)
    record.payload = {**record.payload, "email_code_hash": passwords.hash(code)}
    enqueue(
        db,
        user.id,
        "email",
        f"mfa-email:{digest(body.challenge)}:{secrets.token_hex(8)}",
        {
            "to": user.email,
            "subject": "Planner — Verification code",
            "body": "Use the latest email. Code: "
            + code
            + "\nThis code expires with your five-minute sign-in challenge.",
        },
    )
    db.commit()
    return {"message": "Check your email for the verification code."}


@router.post("/two-factor/setup")
def setup_mfa(body: CurrentPassword, auth: Auth, db: DB):
    limit(db, "mfa-setup:" + auth.user.id, 5, 300)
    if not password_matches(body.current_password, auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    if auth.user.totp_secret:
        raise HTTPException(409, "Two-factor authentication is already enabled")
    secret = base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")
    issue_token(
        db, auth.user, "mfa-setup", 10, {"secret": cipher().encrypt(secret.encode()).decode()}
    )
    db.commit()
    return {
        "secret": secret,
        "uri": f"otpauth://totp/Planner:{quote(auth.user.email)}?secret={secret}&issuer=Planner&digits=6&period=30",
    }


@router.post("/two-factor/enable", status_code=204)
def enable_mfa(body: ConfirmMFA, auth: Auth, db: DB):
    limit(db, "mfa-enable:" + auth.user.id, 5, 300)
    lock_owner(db, auth.user.id)
    if not password_matches(body.password, auth.user.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    record = db.scalar(
        select(AuthToken)
        .where(AuthToken.user_id == auth.user.id, AuthToken.purpose == "mfa-setup")
        .with_for_update()
    )
    if record is None or record.expires_at <= now():
        raise HTTPException(422, "Restart two-factor setup")
    auth.user.totp_secret = record.payload["secret"]
    if not verify_totp(auth.user, body.code):
        raise HTTPException(422, "Incorrect verification code")
    auth.user.email_mfa = False
    db.delete(record)
    db.execute(
        delete(LoginSession).where(
            LoginSession.user_id == auth.user.id, LoginSession.token_hash != auth.session.token_hash
        )
    )
    db.commit()


@router.post("/two-factor/disable", status_code=204)
def disable_mfa(body: ConfirmMFA, auth: Auth, db: DB):
    limit(db, "mfa-disable:" + auth.user.id, 5, 300)
    lock_owner(db, auth.user.id)
    if (
        not password_matches(body.password, auth.user.password_hash)
        or not auth.user.totp_secret
        or not verify_totp(auth.user, body.code)
    ):
        raise HTTPException(403, "Password or verification code is incorrect")
    auth.user.totp_secret = None
    db.execute(
        delete(LoginSession).where(
            LoginSession.user_id == auth.user.id, LoginSession.token_hash != auth.session.token_hash
        )
    )
    db.commit()
