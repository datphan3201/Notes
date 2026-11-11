"""Inspect or retire old periodic jobs after the replacement scheduler is stable."""
import argparse
import hashlib
import json
import re
import subprocess
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import and_, delete, func, or_, select, text
from sqlalchemy.engine import make_url

from planner.config import settings
from planner.db import session_factory
from planner.models import Job, SystemSetting, now


def legacy_candidates(cutoff):
    minute = cutoff.astimezone(UTC).strftime("%Y-%m-%dT%H:%M")
    hour = cutoff.astimezone(UTC).strftime("%Y-%m-%dT%H")
    minute_pattern = r"^(recurrence|reminders):[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$"
    hour_pattern = r"^retention:[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$"
    return and_(
        Job.status == "completed",
        Job.kind.in_(["recurrence", "reminders", "retention"]),
        Job.user_id.is_not(None),
        Job.key.like(Job.kind + ":" + Job.user_id + ":%"),
        Job.available_at <= cutoff,
        or_(
            and_(Job.key.op("~")(minute_pattern), func.right(Job.key, 16) <= minute),
            and_(Job.key.op("~")(hour_pattern), func.right(Job.key, 13) <= hour),
        ),
    )


def legacy_waiting(db):
    return db.scalar(select(Job.id).where(
        Job.status.in_(["queued", "running"]),
        or_(
            Job.kind == "reminders",
            and_(Job.kind == "recurrence", Job.key.not_like("recurrence:v2:%")),
            and_(Job.kind == "retention", Job.key.not_like("retention:v2:%")),
        ),
    ).limit(1)) is not None


def require_stable_scheduler(db):
    desired = db.scalar(select(SystemSetting).where(
        SystemSetting.key == "scheduler:desired"
    ).with_for_update())
    if desired is None or desired.value.get("mode") != "due":
        raise ValueError("Scheduler is not set to due mode")
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == "scheduler:mode").with_for_update())
    state = row.value if row else {}
    try:
        since = datetime.fromisoformat(state["since"])
        drained = datetime.fromisoformat(state["legacy_drained_at"])
        last_tick = datetime.fromisoformat(state["last_tick"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("Scheduler has no recorded stable due-mode interval") from None
    if (state.get("mode") != "due" or max(since, drained) > now() - timedelta(hours=48)
            or not timedelta(0) <= now() - last_tick <= timedelta(seconds=180) or legacy_waiting(db)):
        raise ValueError("Scheduler must run in due mode with legacy work drained for at least 48 hours")
    for lane, seconds in (("scheduler", 180), ("fast", 180), ("slow", 360)):
        heartbeat = db.get(SystemSetting, "worker:heartbeat:" + lane)
        try:
            age = now() - datetime.fromisoformat(heartbeat.value["at"])
        except (AttributeError, KeyError, TypeError, ValueError):
            raise ValueError("Worker heartbeat is unavailable") from None
        if not timedelta(0) <= age <= timedelta(seconds=seconds):
            raise ValueError("Worker heartbeat is stale")


def verify_backup(directory: Path, key: Path, project: str):
    result = subprocess.run(
        ["openssl", "enc", "-d", "-aes-256-cbc", "-pbkdf2", "-iter", "200000",
         "-pass", f"file:{key}", "-in", str(directory / "manifest.json.enc")],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30, check=False,
    )
    if result.returncode:
        raise ValueError("Cannot decrypt backup manifest")
    manifest = json.loads(result.stdout)
    created = datetime.strptime(manifest["created_at"], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
    if manifest.get("project") != project or not timedelta(0) <= now() - created <= timedelta(minutes=30):
        raise ValueError("A recent verified backup of the selected project is required")
    with (directory / "database.dump.enc").open("rb") as file:
        digest = hashlib.file_digest(file, "sha256").hexdigest()
    if digest != manifest.get("encrypted_database_sha256"):
        raise ValueError("Backup database checksum mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expect-project", required=True)
    parser.add_argument("--backup", type=Path)
    parser.add_argument("--backup-key", type=Path, default=Path.home() / ".config/planner-backup/archive.key")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--max-batches", type=int, default=10, choices=range(1, 101))
    args = parser.parse_args()
    config = settings()
    url = make_url(config.database_url)
    if (not re.fullmatch(r"[a-z0-9]{20}", args.expect_project)
            or config.database_schema != "planner" or url.database != "postgres"
            or not url.host or not url.host.endswith(".pooler.supabase.com")
            or url.username != "postgres." + args.expect_project):
        raise SystemExit("Refusing unexpected database identity")
    factory = session_factory()
    cutoff = now() - timedelta(hours=48)
    with factory() as db:
        if tuple(db.execute(text("SELECT current_database(), current_schema()")).one()) != ("postgres", "planner"):
            raise SystemExit("Refusing unexpected connected database/schema")
        count = db.scalar(select(func.count()).select_from(Job).where(legacy_candidates(cutoff)))
        print(f"Eligible completed legacy jobs: {count}")
    if not args.execute:
        return
    if args.backup is None:
        raise SystemExit("An explicit recent backup is required")
    verify_backup(args.backup, args.backup_key, args.expect_project)
    removed = 0
    for _ in range(args.max_batches):
        with factory() as db:
            require_stable_scheduler(db)
            ids = db.scalars(select(Job.id).where(legacy_candidates(cutoff)).order_by(Job.id)
                             .with_for_update(skip_locked=True).limit(1000)).all()
            if not ids:
                break
            result = db.execute(delete(Job).where(Job.id.in_(ids), legacy_candidates(cutoff)))
            removed += result.rowcount
            db.commit()
    print(f"Removed {removed} completed legacy jobs in bounded batches")


if __name__ == "__main__":
    main()
