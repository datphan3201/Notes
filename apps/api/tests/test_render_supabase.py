"""Cloud adapter contracts and private-schema rehearsal; never contact a cloud account."""

import hashlib
import io
import json
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException, UploadFile
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.engine import make_url
from test_boundaries import make

from planner import accounts, storage
from planner.config import Settings, settings


@pytest.fixture
def supabase(monkeypatch):
    config = settings()
    monkeypatch.setattr(config, "supabase_url", "https://storage.example.com")
    monkeypatch.setattr(config, "supabase_storage_bucket", "planner-private")
    monkeypatch.setattr(config, "supabase_service_role_key", SecretStr("synthetic-service-role"))
    objects, requests = {}, []

    def respond(request):
        requests.append(request)
        assert request.headers["Authorization"] == "Bearer synthetic-service-role"
        assert request.headers["apikey"] == "synthetic-service-role"
        assert "/public/" not in request.url.path
        path = request.url.path
        if request.method == "POST":
            assert request.headers["x-upsert"] == "false"
            if path in objects:
                return httpx.Response(409, json={"code": "ResourceAlreadyExists"})
            objects[path] = request.content
            return httpx.Response(200, json={"Key": path})
        if request.method == "GET":
            path = path.replace("/authenticated/", "/")
            if path not in objects:
                return httpx.Response(400, json={"message": "Object not found"})
            return httpx.Response(200, content=objects[path])
        assert request.method == "DELETE"
        for key in json.loads(request.content)["prefixes"]:
            objects.pop(path + "/" + key, None)
        return httpx.Response(200, json=[])

    original = httpx.Client
    monkeypatch.setattr(
        storage.httpx,
        "Client",
        lambda **kwargs: original(
            **kwargs,
            transport=httpx.MockTransport(respond),
        ),
    )
    return objects, requests, original


def test_private_storage_roundtrip_is_create_only_and_delete_is_idempotent(supabase):
    data = b"Private bytes"
    assert storage.upload(UploadFile(io.BytesIO(data)), "account/asset") == (
        len(data),
        hashlib.sha256(data).hexdigest(),
    )
    assert storage.read("account/asset") == data
    with pytest.raises(HTTPException) as duplicate:
        storage.upload(UploadFile(io.BytesIO(b"overwrite")), "account/asset")
    assert duplicate.value.status_code == 409
    assert storage.read("account/asset") == data
    storage.remove("account/asset")
    storage.remove("account/asset")
    with pytest.raises(HTTPException) as missing:
        storage.read("account/asset")
    assert missing.value.status_code == 404


def test_remote_files_still_require_owned_api_access(client, stranger, supabase):
    note = make(client, "notes")
    response = client.post(
        f"/api/v1/notes/{note['id']}/attachments",
        files={"file": ("private.txt", b"Only the owner may read this", "text/plain")},
    )
    assert response.status_code == 201, response.text
    file_id = response.json()["id"]
    objects, requests, _ = supabase
    before = len(requests)
    assert stranger.get("/api/v1/files/" + file_id).status_code == 404
    assert len(requests) == before
    assert client.get("/api/v1/files/" + file_id).content == b"Only the owner may read this"
    assert len(objects) == 1


def test_remote_upload_size_limit_and_failure_do_not_create_metadata(client, monkeypatch, supabase):
    note = make(client, "notes")
    monkeypatch.setattr(settings(), "max_upload_bytes", 2)
    response = client.post(
        f"/api/v1/notes/{note['id']}/attachments",
        files={"file": ("large.txt", b"too big")},
    )
    assert response.status_code == 413
    assert not supabase[1]
    assert client.get(f"/api/v1/notes/{note['id']}/attachments").json() == []


def test_storage_errors_do_not_disclose_provider_body_or_key(monkeypatch, supabase):
    original = supabase[2]
    monkeypatch.setattr(
        storage.httpx,
        "Client",
        lambda **kwargs: original(
            **kwargs,
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    403,
                    json={"message": "synthetic-service-role internal details"},
                )
            ),
        ),
    )
    with pytest.raises(HTTPException) as failure:
        storage.read("account/asset")
    assert failure.value.status_code == 502
    assert "synthetic-service-role" not in failure.value.detail


def production(**values):
    defaults = dict(
        _env_file=None,
        environment="production",
        web_origin="https://planner.vercel.app",
        database_schema="planner",
        worker_mode="poll",
        supabase_url="https://project.supabase.co",
        supabase_storage_bucket="planner-private",
        supabase_service_role_key="synthetic-service-role",
        encryption_key=Fernet.generate_key().decode(),
        smtp_from="Planner <planner@example.com>",
        resend_api_key="synthetic-resend",
    )
    defaults.update(values)
    return Settings(**defaults)


def test_production_polling_and_private_storage_need_no_google_delivery_identity():
    config = production(run_worker=True)
    assert not config.worker_audience and not config.worker_service_account
    assert config.run_worker and config.supabase_storage_bucket
    assert "synthetic-service-role" not in repr(config)


def test_production_accepts_brevo_without_resend_or_smtp():
    config = production(brevo_api_key="synthetic-brevo", resend_api_key="", smtp_host="")
    assert config.brevo_api_key.get_secret_value() == "synthetic-brevo"
    assert "synthetic-brevo" not in repr(config)


@pytest.mark.parametrize(
    "values",
    [
        {"supabase_url": "http://project.example"},
        {"supabase_url": "https://user:password@project.example"},
        {"supabase_storage_bucket": "../private"},
        {"database_schema": "public"},
        {"database_schema": "storage"},
        {"database_schema": "planner;drop schema public"},
        {"worker_mode": "poll", "cloud_tasks_queue": "projects/x/locations/x/queues/x"},
    ],
)
def test_invalid_cloud_configuration_is_rejected_without_secret_disclosure(values):
    base = production().model_dump()
    base.update(values)
    with pytest.raises(ValueError) as failure:
        Settings(_env_file=None, **base)
    assert "synthetic-service-role" not in str(failure.value)


def test_config_auto_normalizes_urls_and_database_schemes():
    config = production(
        web_origin="  https://planner.vercel.app/  ",
        supabase_url="  https://project.supabase.co/  ",
        database_url="postgres://user:pass@aws.supabase.com:5432/postgres",
    )
    assert config.web_origin == "https://planner.vercel.app"
    assert config.supabase_url == "https://project.supabase.co"
    assert config.database_url == "postgresql+psycopg://user:pass@aws.supabase.com:5432/postgres"

    config2 = production(
        database_url="postgresql://user:pass@aws.supabase.com:5432/postgres",
    )
    assert config2.database_url == "postgresql+psycopg://user:pass@aws.supabase.com:5432/postgres"


def test_config_normalizes_encryption_keys():
    # 1. 32-character random string (e.g. from Render generateValue: true)
    render_generated = "aB3dE5gH7iJ9kL1mN3oP5qR7sT9uV1wX"
    config = production(encryption_key=render_generated)
    fernet_key = config.encryption_key.get_secret_value()
    # Must be valid 32-byte urlsafe base64 Fernet key
    cipher = Fernet(fernet_key.encode("ascii"))
    token = cipher.encrypt(b"secret payload")
    assert cipher.decrypt(token) == b"secret payload"

    # 2. Too short key must be rejected
    with pytest.raises(ValueError, match="at least 32 characters"):
        production(encryption_key="too-short")


def test_production_reports_all_missing_settings_in_single_error():
    with pytest.raises(ValueError) as failure:
        Settings(
            _env_file=None,
            environment="production",
            web_origin="http://localhost:3000",
            encryption_key="",
            smtp_from="",
            supabase_storage_bucket="planner-private",
            supabase_url="",
            supabase_service_role_key="",
        )
    msg = str(failure.value)
    assert "Production configuration incomplete" in msg
    assert "PLANNER_ENCRYPTION_KEY" in msg
    assert "PLANNER_SUPABASE_URL" in msg
    assert "PLANNER_SUPABASE_SERVICE_ROLE_KEY" in msg
    assert "PLANNER_SMTP_FROM" in msg


def test_https_email_retries_keep_job_identity_and_failures_are_retried(monkeypatch):
    monkeypatch.setattr(settings(), "resend_api_key", SecretStr("synthetic-resend"))
    monkeypatch.setattr(settings(), "smtp_from", "planner@example.com")
    requests = []
    status = 200

    def respond(request):
        requests.append(request)
        assert request.url == "https://api.resend.com/emails"
        assert request.headers["Authorization"] == "Bearer synthetic-resend"
        return httpx.Response(status, json={"id": "synthetic-email"})

    original = httpx.Client
    monkeypatch.setattr(
        accounts.httpx,
        "Client",
        lambda **kwargs: original(
            **kwargs,
            transport=httpx.MockTransport(respond),
        ),
    )
    payload = {"to": "user@example.com", "subject": "Verify", "body": "Synthetic test link"}
    accounts.send_email(payload, delivery_key="job1")
    accounts.send_email(payload, delivery_key="job1")
    accounts.send_email(payload, delivery_key="job2")
    assert requests[0].headers["Idempotency-Key"] == requests[1].headers["Idempotency-Key"]
    assert requests[0].headers["Idempotency-Key"] != requests[2].headers["Idempotency-Key"]
    assert json.loads(requests[0].content)["text"] == payload["body"]
    status = 429
    with pytest.raises(RuntimeError, match="EMAIL_DELIVERY_FAILED"):
        accounts.send_email(payload, delivery_key="job3")


def test_private_schema_migrates_without_using_public_accounts(client, db):
    config = settings()
    assert (
        config.environment == "testing" and make_url(config.database_url).database == "planner_test"
    )
    assert db.scalar(text("SELECT current_database()")) == "planner_test"
    db.rollback()
    schema = "planner_test_cloud"
    # Only this disposable test database/schema may be dropped.
    db.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
    db.commit()
    root = Path(__file__).resolve().parents[1]
    env = {**os.environ, "PLANNER_DATABASE_SCHEMA": schema}
    try:
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, result.stderr
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "check"],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=30,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from planner.db import engine; from sqlalchemy import text; "
                "c=engine().connect(); "
                "assert c.scalar(text('SELECT current_database()')) == 'planner_test'; "
                "assert c.scalar(text('SELECT current_schema()')) == 'planner_test_cloud'; "
                "assert c.scalar(text('SELECT version_num FROM alembic_version')) == '0009'; "
                "assert c.scalar(text('SELECT count(*) FROM users')) == 0; "
                "c.close()",
            ],
            cwd=root,
            env=env,
            capture_output=True,
            text=True,
            timeout=20,
        )
        assert result.returncode == 0, result.stderr
        assert db.scalar(text("SELECT to_regclass('public.users')")) == "users"
        assert db.scalar(text("SELECT count(*) FROM public.users")) == 1
    finally:
        db.rollback()
        db.execute(text(f"DROP SCHEMA IF EXISTS {schema} CASCADE"))
        db.commit()


@pytest.mark.parametrize("crash", [False, True])
def test_container_supervisor_stops_siblings_on_signal_or_worker_exit(tmp_path, crash):
    marker = tmp_path / "children"
    child = (
        "import os,time; from pathlib import Path; "
        f"p=Path({str(marker)!r}); "
        "f=p.open('a'); f.write(str(os.getpid())+'\\n'); f.close(); time.sleep(60)"
    )
    commands = [
        [sys.executable, "-c", child],
        [
            sys.executable,
            "-c",
            "import time; time.sleep(0.5); raise SystemExit(2)" if crash else child,
        ],
    ]
    process = subprocess.Popen(
        [
            sys.executable,
            "-c",
            "from planner.serve import supervise; raise SystemExit(supervise("
            + repr(commands)
            + "))",
        ]
    )
    try:
        deadline = time.monotonic() + 10
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert marker.exists()
        if not crash:
            process.send_signal(signal.SIGTERM)
        assert process.wait(timeout=20) == (1 if crash else 0)
        for pid in marker.read_text().splitlines():
            with pytest.raises(ProcessLookupError):
                os.kill(int(pid), 0)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()


def test_brevo_email_payload_retry_identity_and_provider_priority(monkeypatch):
    monkeypatch.setattr(settings(), "brevo_api_key", SecretStr("synthetic-brevo"))
    monkeypatch.setattr(settings(), "resend_api_key", SecretStr("synthetic-resend"))
    monkeypatch.setattr(settings(), "smtp_from", "Planner <planner@example.com>")
    requests = []
    status, result = 201, {"messageId": "synthetic-email"}

    def respond(request):
        requests.append(request)
        assert request.url == "https://api.brevo.com/v3/smtp/email"
        assert request.headers["api-key"] == "synthetic-brevo"
        return httpx.Response(status, json=result)

    original = httpx.Client
    monkeypatch.setattr(accounts.httpx, "Client", lambda **kwargs: original(
        **kwargs, transport=httpx.MockTransport(respond),
    ))
    payload = {"to": "user@example.com", "subject": "Verify", "body": "Synthetic test link"}
    for job_id in ["job1", "job1", "job2"]:
        accounts.send_email(payload, delivery_key=job_id)
    bodies = [json.loads(request.content) for request in requests]
    assert bodies[0]["sender"] == {"name": "Planner", "email": "planner@example.com"}
    assert bodies[0]["to"] == [{"email": "user@example.com"}]
    assert bodies[0]["textContent"] == payload["body"]
    assert "htmlContent" in bodies[0] and payload["body"] in bodies[0]["htmlContent"]
    assert bodies[0]["headers"] == bodies[1]["headers"]
    assert bodies[0]["headers"] != bodies[2]["headers"]
    status, result = 400, {"code": "duplicate_parameter", "message": "Email for the idempotency key has already been processed"}
    accounts.send_email(payload, delivery_key="job1")
    result = {"code": "duplicate_parameter", "message": "Duplicate sender"}
    with pytest.raises(RuntimeError, match="EMAIL_DELIVERY_FAILED"):
        accounts.send_email(payload, delivery_key="job3")
    status, result = 429, {"code": "rate_limit"}
    with pytest.raises(RuntimeError, match="EMAIL_DELIVERY_FAILED"):
        accounts.send_email(payload, delivery_key="job3")
    monkeypatch.setattr(settings(), "smtp_from", "")
    with pytest.raises(RuntimeError, match="EMAIL_NOT_CONFIGURED"):
        accounts.send_email(payload, delivery_key="job4")
