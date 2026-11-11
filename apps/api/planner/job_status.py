"""Print aggregate scheduler, worker and queue status without account data."""
import argparse
import json
import re

from sqlalchemy import func, select, text
from sqlalchemy.engine import make_url

from planner.config import settings
from planner.db import session_factory
from planner.models import Job, SystemSetting, now


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expect-project", required=True)
    args = parser.parse_args()
    config = settings()
    url = make_url(config.database_url)
    if (not re.fullmatch(r"[a-z0-9]{20}", args.expect_project)
            or config.database_schema != "planner" or url.database != "postgres"
            or not url.host or not url.host.endswith(".pooler.supabase.com")
            or url.username != "postgres." + args.expect_project):
        raise SystemExit("Refusing unexpected database identity")
    with session_factory()() as db:
        if tuple(db.execute(text("SELECT current_database(), current_schema()")).one()) != ("postgres", "planner"):
            raise SystemExit("Refusing unexpected connected database/schema")
        rows = db.execute(select(Job.kind, Job.status, func.count())
                          .group_by(Job.kind, Job.status).order_by(Job.kind, Job.status)).all()
        oldest = db.scalar(select(func.min(Job.available_at)).where(
            Job.status == "queued", Job.available_at <= now()
        ))
        settings_rows = db.scalars(select(SystemSetting).where(SystemSetting.key.in_([
            "scheduler:mode", "worker:heartbeat:scheduler", "worker:heartbeat:fast", "worker:heartbeat:slow"
        ]))).all()
        data = {
            "database_bytes": db.scalar(text("SELECT pg_database_size(current_database())")),
            "oldest_due_job_seconds": max(0, int((now() - oldest).total_seconds())) if oldest else None,
            "jobs": [{"kind": kind, "status": status, "count": count} for kind, status, count in rows],
            "worker": {row.key: row.value for row in settings_rows},
        }
        print(json.dumps(data, sort_keys=True))


if __name__ == "__main__":
    main()
