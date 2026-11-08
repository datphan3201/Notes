"""Prepare only the disposable PostgreSQL fixture, then start the browser-test API."""

from pathlib import Path
from tempfile import TemporaryDirectory

import uvicorn
from alembic import command
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url

from planner import models  # noqa: F401
from planner.config import settings
from planner.db import Base, engine

config = settings()
if config.environment != "testing" or make_url(config.database_url).database != "planner_test":
    raise RuntimeError("Browser tests refuse a non-test database")
with engine().connect() as connection:
    if connection.scalar(text("SELECT current_database()")) != "planner_test":
        raise RuntimeError("Actual database is not planner_test")
root = Path(__file__).resolve().parents[1]
command.upgrade(Config(str(root / "alembic.ini")), "head")
with engine().begin() as connection:
    names = ", ".join('"' + table.name + '"' for table in Base.metadata.sorted_tables)
    connection.execute(text("TRUNCATE " + names + " CASCADE"))
engine().dispose()
with TemporaryDirectory(prefix="planner-browser-storage-") as directory:
    config.storage_root = Path(directory)
    config.storage_bucket = ""
    uvicorn.run("planner.main:app", host="127.0.0.1", port=8101, access_log=False)
