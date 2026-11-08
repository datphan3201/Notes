import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url

os.environ["PLANNER_ENVIRONMENT"] = "testing"
os.environ.setdefault(
    "PLANNER_DATABASE_URL",
    "postgresql+psycopg://planner_test:isolated-test-only@127.0.0.1:5434/planner_test",
)
os.environ["PLANNER_WEB_ORIGIN"] = "http://localhost:3000"
# Keep ordinary tests disconnected from configured development providers.
os.environ["PLANNER_AI_API_KEY"] = ""
os.environ["PLANNER_AI_MODEL"] = ""
os.environ["PLANNER_EMBEDDING_MODEL"] = ""
os.environ["PLANNER_SMTP_HOST"] = ""
os.environ["PLANNER_SMTP_PASSWORD"] = ""
os.environ["PLANNER_RESEND_API_KEY"] = ""
os.environ["PLANNER_BREVO_API_KEY"] = ""
os.environ["PLANNER_SUPABASE_URL"] = ""
os.environ["PLANNER_SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["PLANNER_SUPABASE_STORAGE_BUCKET"] = ""
os.environ["PLANNER_DATABASE_SCHEMA"] = "public"
os.environ["PLANNER_WORKER_MODE"] = "cloud_tasks"
os.environ["PLANNER_RUN_WORKER"] = "false"
os.environ["PLANNER_MIGRATE_ON_START"] = "false"
os.environ["PLANNER_CLOUD_TASKS_QUEUE"] = ""

from planner.db import Base, engine, session_factory  # noqa: E402
from planner.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrated_database():
    from alembic import command
    from alembic.config import Config

    from planner.config import settings

    config = settings()
    if config.environment != "testing" or make_url(config.database_url).database != "planner_test":
        raise RuntimeError("Refusing schema changes outside planner_test")
    with engine().connect() as connection:
        if connection.scalar(text("SELECT current_database()")) != "planner_test":
            raise RuntimeError("Actual database is not planner_test")
    root = Path(__file__).resolve().parents[1]
    migration = Config(str(root / "alembic.ini"))
    migration.set_main_option("script_location", str(root / "migrations"))
    command.upgrade(migration, "head")


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    from planner.config import settings

    config = settings()
    url = make_url(config.database_url)
    if config.environment != "testing" or url.database != "planner_test":
        raise RuntimeError("Refusing destructive cleanup outside planner_test")
    with engine().begin() as connection:
        if connection.scalar(text("SELECT current_database()")) != "planner_test":
            raise RuntimeError("Actual database is not planner_test")
        tables = ", ".join('"' + table.name + '"' for table in Base.metadata.sorted_tables)
        connection.execute(text("TRUNCATE " + tables + " CASCADE"))
    monkeypatch.setattr(config, "storage_root", tmp_path / "files")
    yield


@pytest.fixture
def db():
    with session_factory()() as session:
        yield session


@pytest.fixture
def client():
    with TestClient(app, headers={"origin": "http://localhost:3000"}) as client:
        result = client.post(
            "/api/v1/auth/register",
            json={
                "email": "owner@example.com",
                "password": "a-long-test-password",
                "name": "Owner",
            },
        )
        assert result.status_code == 201, result.text
        client.headers["x-csrf-token"] = result.json()["csrf"]
        yield client


@pytest.fixture
def stranger():
    with TestClient(app, headers={"origin": "http://localhost:3000"}) as client:
        result = client.post(
            "/api/v1/auth/register",
            json={
                "email": "other@example.com",
                "password": "a-long-test-password",
                "name": "Other",
            },
        )
        assert result.status_code == 201, result.text
        client.headers["x-csrf-token"] = result.json()["csrf"]
        yield client
