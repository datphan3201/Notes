import base64

from cryptography.fernet import Fernet
from sqlalchemy import select

from planner.accounts import totp_code
from planner.config import settings
from planner.models import Job, User, now


def test_totp_matches_legacy_rfc_vectors():
    secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
    assert totp_code(secret, 59) == "287082"
    assert totp_code(secret, 1111111109) == "081804"
    assert totp_code(secret, 1234567890) == "005924"


def test_php_bcrypt_password_rehashes_to_argon2_on_login(client, db):
    from pwdlib.hashers.bcrypt import BcryptHasher

    user = db.scalar(select(User))
    user.password_hash = BcryptHasher().hash("legacy-password").replace("$2b$", "$2y$", 1)
    db.commit()
    result = client.post(
        "/api/v1/auth/login", json={"email": user.email, "password": "legacy-password"}
    )
    assert result.status_code == 200
    db.refresh(user)
    assert user.password_hash.startswith("$argon2id$")


def test_migrated_bcrypt_keeps_php_72_byte_behavior_then_hashes_full_password(client, db):
    from pwdlib.hashers.bcrypt import BcryptHasher

    from planner.auth import passwords

    original = "đ" * 50
    user = db.scalar(select(User))
    user.password_hash = BcryptHasher().hash(original.encode()[:72]).replace("$2b$", "$2y$", 1)
    db.commit()
    result = client.post("/api/v1/auth/login", json={"email": user.email, "password": original})
    assert result.status_code == 200
    db.refresh(user)
    assert passwords.verify(original, user.password_hash)
    assert not passwords.verify(original[:36], user.password_hash)


def test_recovery_single_use_and_session_revocation(client, db):
    assert (
        client.post("/api/v1/auth/recover", json={"email": "owner@example.com"}).status_code == 202
    )
    job = db.scalar(select(Job).where(Job.kind == "email", Job.key.like("reset:%")))
    assert job
    token = job.payload["body"].split("#token=")[1]
    assert (
        client.post(
            "/api/v1/auth/reset", json={"token": token, "password": "new-long-password"}
        ).status_code
        == 204
    )
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/reset", json={"token": token, "password": "another-long-password"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "a-long-test-password"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": "owner@example.com", "password": "new-long-password"},
        ).status_code
        == 200
    )


def test_verification_token_is_single_use(client, db):
    job = db.scalar(select(Job).where(Job.kind == "email", Job.key.like("verify:%")))
    token = job.payload["body"].split("#token=")[1]
    assert client.post("/api/v1/auth/verify", json={"token": token}).status_code == 204
    assert client.get("/api/v1/auth/me").json()["user"]["email_verified"] is True
    assert client.post("/api/v1/auth/verify", json={"token": token}).status_code == 422


def test_totp_pending_login_is_not_a_session_and_replay_is_rejected(client, db, monkeypatch):
    key = Fernet.generate_key()
    from pydantic import SecretStr

    monkeypatch.setattr(settings(), "encryption_key", SecretStr(key.decode()))
    secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
    user = db.scalar(select(User))
    user.totp_secret = Fernet(key).encrypt(secret.encode()).decode()
    db.commit()
    client.post("/api/v1/auth/logout")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a-long-test-password"},
    )
    challenge = response.json()["challenge"]
    assert client.get("/api/v1/tasks").status_code == 401
    code = totp_code(secret, int(now().timestamp()))
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": "bad"}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": code}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": code}
        ).status_code
        == 422
    )
