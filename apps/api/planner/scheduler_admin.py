"""Backfill recurrence checkpoints without logging account data."""
import argparse
import re

from sqlalchemy import select, text
from sqlalchemy.engine import make_url

from planner.auth import lock_owner
from planner.config import settings
from planner.db import session_factory
from planner.domain import next_materialization
from planner.models import TaskSeries


def backfill(factory, *, execute=False, batch_size=100):
    cursor = ""
    scanned = 0
    changed = 0
    while True:
        with factory() as db:
            rows = db.execute(
                select(TaskSeries.id, TaskSeries.user_id)
                .where(TaskSeries.id > cursor, TaskSeries.archived_at.is_(None), TaskSeries.state == "active")
                .order_by(TaskSeries.id)
                .limit(batch_size)
            ).all()
            if not rows:
                break
            for series_id, owner_id in rows:
                if execute:
                    lock_owner(db, owner_id)
                statement = select(TaskSeries).where(
                    TaskSeries.id == series_id, TaskSeries.user_id == owner_id
                )
                series = db.scalar(statement.with_for_update() if execute else statement)
                if series is None or series.archived_at or series.state != "active":
                    continue
                checkpoint = next_materialization(series)
                scanned += 1
                if checkpoint != series.next_materialize_at:
                    changed += 1
                    if execute:
                        series.next_materialize_at = checkpoint
            if execute:
                db.commit()
            cursor = rows[-1].id
    return scanned, changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expect-project", required=True)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    config = settings()
    url = make_url(config.database_url)
    if (not re.fullmatch(r"[a-z0-9]{20}", args.expect_project)
            or config.database_schema != "planner" or url.database != "postgres"
            or not url.host or not url.host.endswith(".pooler.supabase.com")
            or url.username != "postgres." + args.expect_project):
        raise SystemExit("Refusing unexpected database identity")
    factory = session_factory()
    with factory() as db:
        actual = db.execute(text("SELECT current_database(), current_schema() ")).one()
        revision = db.scalar(text("SELECT version_num FROM alembic_version"))
        if tuple(actual) != ("postgres", "planner") or revision != "0012":
            raise SystemExit("Refusing unexpected connected database/schema/revision")
    scanned, changed = backfill(factory, execute=args.execute)
    print(f"{'Updated' if args.execute else 'Would update'} {changed} of {scanned} active recurrence checkpoints")


if __name__ == "__main__":
    main()
