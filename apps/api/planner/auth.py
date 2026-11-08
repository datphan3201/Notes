import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher
from sqlalchemy import case, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from planner.config import settings
from planner.db import database
from planner.models import LoginSession, RateBucket, User, now

passwords = PasswordHash((Argon2Hasher(), BcryptHasher()))
DUMMY_HASH = passwords.hash("unused timing-equalization credential")
DB = Annotated[Session, Depends(database, scope="function")]


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def password_matches(password: str, encoded: str):
    # PHP bcrypt compares the first 72 bytes, including for multibyte passwords.
    candidate = password.encode()[:72] if encoded.startswith(("$2a$", "$2b$", "$2y$")) else password
    return passwords.verify(candidate, encoded)


def check_and_rehash_password(password: str, encoded: str):
    if encoded.startswith(("$2a$", "$2b$", "$2y$")):
        valid = password_matches(password, encoded)
        return valid, passwords.hash(password) if valid else None
    return passwords.verify_and_update(password, encoded)


def limit(db: Session, key: str, maximum: int, seconds: int = 60):
    stamp = now()
    stmt = insert(RateBucket).values(
        key=digest(key), count=1, expires_at=stamp + timedelta(seconds=seconds)
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=[RateBucket.key],
        set_={
            "count": case((RateBucket.expires_at <= stamp, 1), else_=RateBucket.count + 1),
            "expires_at": case(
                (RateBucket.expires_at <= stamp, stamp + timedelta(seconds=seconds)),
                else_=RateBucket.expires_at,
            ),
        },
    ).returning(RateBucket.count)
    count = db.execute(stmt).scalar_one()
    db.commit()
    if count > maximum:
        raise HTTPException(
            429, "Too many attempts. Try again later.", headers={"Retry-After": str(seconds)}
        )


def verify_origin(request: Request):
    config = settings()
    allowed = {config.web_origin}
    if config.environment == "development":
        allowed.update(config.development_origins)
    if request.headers.get("origin") not in allowed:
        raise HTTPException(403, "Untrusted request origin")


@dataclass
class Identity:
    user: User
    session: LoginSession


def identity(request: Request, db: DB) -> Identity:
    token = request.cookies.get("planner_session", "")
    record = (
        db.execute(
            select(User, LoginSession)
            .join(LoginSession, LoginSession.user_id == User.id)
            .where(
                LoginSession.token_hash == digest(token),
                LoginSession.expires_at > now(),
                User.locked_at.is_(None),
            )
        ).one_or_none()
        if token
        else None
    )
    if record is None:
        raise HTTPException(401, "Sign in to continue")
    user, session = record
    if settings().environment == "production" and not user.email_verified_at:
        allowed = ("/api/v1/auth/me", "/api/v1/auth/logout", "/api/v1/auth/verification")
        if request.url.path not in allowed:
            raise HTTPException(403, "Verify your email before using the workspace")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        verify_origin(request)
        if not secrets.compare_digest(request.headers.get("x-csrf-token", ""), session.csrf):
            raise HTTPException(403, "Invalid CSRF token")
        limit(db, "write:" + user.id, 120)
    else:
        # Release the authentication connection before dispatching the sync endpoint.
        # expire_on_commit=False keeps the request identity loaded without a second query.
        db.commit()
    return Identity(user, session)


Auth = Annotated[Identity, Depends(identity)]


def start_session(db: Session, user: User, response: Response, origin: str | None = None):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    session = LoginSession(
        token_hash=digest(token),
        user_id=user.id,
        csrf=csrf,
        expires_at=now() + timedelta(days=settings().session_days),
    )
    db.add(session)
    db.commit()
    response.set_cookie(
        "planner_session",
        token,
        httponly=True,
        secure=settings().environment == "production"
        or (origin or settings().web_origin).startswith("https://"),
        samesite="lax",
        max_age=settings().session_days * 86400,
        path="/",
    )
    return {"user": public_user(user), "csrf": csrf}


def public_user(user: User):
    return {
        **{k: getattr(user, k) for k in ("id", "email", "name", "timezone", "locale", "theme")},
        "email_verified": user.email_verified_at is not None,
        "two_factor_enabled": user.totp_secret is not None or user.email_mfa,
        "mfa_method": "app" if user.totp_secret else "email" if user.email_mfa else "none",
        "role": user.role,
        "profile": user.profile,
        "preferences": user.preferences,
    }


def lock_owner(db: Session, user_id: str):
    # Serialize owner writes without blocking unrelated FK references to this account.
    row = db.execute(
        select(User.id).where(User.id == user_id).with_for_update(key_share=True)
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Not found")
