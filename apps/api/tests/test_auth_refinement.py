import base64
import re
from datetime import timedelta

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import select

from planner.auth import digest
from planner.config import settings
from planner.main import app
from planner.models import Area, AuthToken, Job, User, now


def recovery(client, db):
    assert (
        client.post("/api/v1/auth/recover", json={"email": "owner@example.com"}).status_code == 202
    )
    job = db.scalar(select(Job).where(Job.key.like("reset:%")).order_by(Job.available_at.desc()))
    return re.search(r"Code: ([0-9]{6})", job.payload["body"])[1], job.payload["body"].split(
        "#token="
    )[1]


@pytest.mark.parametrize("locale,prefix", [("en", "Area"), ("vi", "Lĩnh vực")])
def test_signup_preserves_guest_locale_and_default_areas_atomically(db, locale, prefix):
    with TestClient(app, headers={"origin": "http://localhost:3000"}) as browser:
        payload = {
            "email": "new@example.com",
            "password": "a-long-test-password",
            "name": "  New  ",
            "locale": locale,
            "password_confirmation": "does-not-match",
        }
        assert browser.post("/api/v1/auth/register", json=payload).status_code == 422
        assert db.scalar(select(User.id)) is None
        assert db.scalar(select(Area.id)) is None
        assert db.scalar(select(Job.id)) is None
        payload["password_confirmation"] = payload["password"]
        response = browser.post("/api/v1/auth/register", json=payload)
        assert response.status_code == 201
        assert response.json()["user"]["locale"] == locale
        assert response.json()["user"]["name"] == "New"
        assert sorted(db.scalars(select(Area.title)).all()) == [
            f"{prefix} {n}" for n in range(1, 4)
        ]
        record = db.scalar(select(AuthToken).where(AuthToken.purpose == "verify"))
        assert timedelta(hours=23) < record.expires_at - now() <= timedelta(hours=24)


def test_recovery_code_rotates_link_confirms_email_and_revokes_session(client, db):
    code, link = recovery(client, db)
    response = client.post(
        "/api/v1/auth/recover/code", json={"email": "OWNER@example.com", "code": code}
    )
    assert response.status_code == 200
    replacement = response.json()["token"]
    record = db.get(AuthToken, digest(replacement))
    assert timedelta(minutes=29) < record.expires_at - now() <= timedelta(minutes=30)
    assert replacement != link
    assert (
        client.post(
            "/api/v1/auth/recover/code", json={"email": "owner@example.com", "code": code}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/reset", json={"token": link, "password": "new-long-password"}
        ).status_code
        == 422
    )
    payload = {
        "token": replacement,
        "email": "owner@example.com",
        "password": "new-long-password",
        "password_confirmation": "does-not-match",
    }
    assert client.post("/api/v1/auth/reset", json=payload).status_code == 422
    assert client.get("/api/v1/auth/me").status_code == 200
    payload["password_confirmation"] = payload["password"]
    payload["email"] = "other@example.com"
    assert client.post("/api/v1/auth/reset", json=payload).status_code == 422
    payload["email"] = "owner@example.com"
    assert client.post("/api/v1/auth/reset", json=payload).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.post("/api/v1/auth/reset", json=payload).status_code == 422


def test_five_bad_recovery_codes_block_code_but_keep_full_link(client, db):
    code, link = recovery(client, db)
    wrong = str((int(code) + 1) % 1_000_000).zfill(6)
    for _ in range(5):
        assert (
            client.post(
                "/api/v1/auth/recover/code", json={"email": "owner@example.com", "code": wrong}
            ).status_code
            == 422
        )
    assert (
        client.post(
            "/api/v1/auth/recover/code", json={"email": "owner@example.com", "code": code}
        ).status_code
        == 422
    )
    db.expire_all()
    record = db.get(AuthToken, digest(link))
    assert record.payload["attempts"] == 5
    assert record.payload["code_hash"] is None
    assert (
        client.post(
            "/api/v1/auth/reset", json={"token": link, "password": "new-long-password"}
        ).status_code
        == 204
    )


def test_unknown_and_expired_recovery_return_generic_responses(client, db):
    assert client.post("/api/v1/auth/recover", json={"email": "missing@example.com"}).json() == {
        "message": "If the account is eligible, a recovery email will arrive shortly."
    }
    code, link = recovery(client, db)
    record = db.get(AuthToken, digest(link))
    record.expires_at = now() - timedelta(seconds=1)
    db.commit()
    responses = [
        client.post("/api/v1/auth/recover/code", json={"email": email, "code": code})
        for email in ["owner@example.com", "missing@example.com"]
    ]
    assert all(r.status_code == 422 for r in responses)
    assert responses[0].json() == responses[1].json()
    user = db.scalar(select(User))
    user.locked_at = now()
    db.commit()
    assert client.post("/api/v1/auth/recover", json={"email": user.email}).status_code == 202
    assert (
        client.post(
            "/api/v1/auth/reset", json={"token": link, "password": "new-long-password"}
        ).status_code
        == 422
    )


def test_email_fallback_preserves_pending_mfa_expiry_latest_code_and_single_use(
    client, db, monkeypatch
):
    key = Fernet.generate_key()
    monkeypatch.setattr(settings(), "encryption_key", SecretStr(key.decode()))
    secret = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
    user = db.scalar(select(User))
    user.totp_secret = Fernet(key).encrypt(secret.encode()).decode()
    db.commit()
    assert client.post("/api/v1/auth/logout").status_code == 204
    challenge = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a-long-test-password"},
    ).json()["challenge"]
    assert client.get("/api/v1/tasks").status_code == 401
    codes = []
    for number in [12345, 67890]:
        monkeypatch.setattr("planner.accounts.secrets.randbelow", lambda maximum, n=number: n)
        assert (
            client.post("/api/v1/auth/two-factor/email", json={"challenge": challenge}).status_code
            == 202
        )
        codes.append(str(number).zfill(6))
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": codes[0]}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": codes[1]}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": codes[1]}
        ).status_code
        == 422
    )
    identity = client.get("/api/v1/auth/me").json()
    client.headers["x-csrf-token"] = identity["csrf"]
    assert client.post("/api/v1/auth/logout").status_code == 204
    challenge = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "a-long-test-password"},
    ).json()["challenge"]
    db.expire_all()
    record = db.get(AuthToken, digest(challenge))
    record.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert (
        client.post("/api/v1/auth/two-factor/email", json={"challenge": challenge}).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/auth/two-factor", json={"challenge": challenge, "code": codes[1]}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/auth/me").status_code == 401
