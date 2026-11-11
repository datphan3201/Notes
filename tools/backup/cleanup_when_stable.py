#!/usr/bin/env python3
"""Retire legacy jobs only after the recorded stability and backup gates pass."""
import argparse
import datetime as dt
import fcntl
import os
import pathlib
import subprocess

import planner_backup
import psycopg


def ready(config):
    url = config["PLANNER_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(url, options="-c search_path=planner,extensions,public", connect_timeout=20) as db:
        with db.cursor() as cur:
            cur.execute("SELECT current_database(), current_schema(), now()")
            database, schema, stamp = cur.fetchone()
            if (database, schema) != ("postgres", "planner"):
                raise ValueError("Unexpected database identity")
            cur.execute("SELECT key, value FROM system_settings WHERE key IN (%s, %s, %s, %s, %s)", (
                "scheduler:desired", "scheduler:mode", "worker:heartbeat:scheduler", "worker:heartbeat:fast", "worker:heartbeat:slow",
            ))
            rows = dict(cur.fetchall())
            state = rows.get("scheduler:mode", {})
            try:
                since = dt.datetime.fromisoformat(state["since"])
                drained = dt.datetime.fromisoformat(state["legacy_drained_at"])
                last_tick = dt.datetime.fromisoformat(state["last_tick"])
                if (rows.get("scheduler:desired", {}).get("mode") != "due" or state.get("mode") != "due" or max(since, drained) > stamp - dt.timedelta(hours=48)
                        or not dt.timedelta(0) <= stamp - last_tick <= dt.timedelta(seconds=180)):
                    return False
                for lane, seconds in (("scheduler", 180), ("fast", 180), ("slow", 360)):
                    age = stamp - dt.datetime.fromisoformat(rows["worker:heartbeat:" + lane]["at"])
                    if not dt.timedelta(0) <= age <= dt.timedelta(seconds=seconds):
                        return False
            except (KeyError, TypeError, ValueError):
                return False
            cur.execute("""SELECT EXISTS (
                SELECT 1 FROM jobs WHERE status IN ('queued', 'running') AND
                (kind='reminders' OR (kind='recurrence' AND key NOT LIKE 'recurrence:v2:%')
                 OR (kind='retention' AND key NOT LIKE 'retention:v2:%')))
            """)
            return not cur.fetchone()[0]


def main():
    root = pathlib.Path(__file__).resolve().parents[2]
    args = argparse.Namespace(
        cloud=root / ".cloud", output=pathlib.Path.home() / ".local/share/planner-backups/automated",
        key=pathlib.Path.home() / ".config/planner-backup/archive.key",
    )
    try:
        config, _, ref = planner_backup.configuration(args.cloud)
        if not ready(config):
            print("Legacy cleanup skipped: scheduler stability gate not yet satisfied")
            return 0
        args.output.mkdir(parents=True, exist_ok=True, mode=0o700)
        with (args.output / ".backup.lock").open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            backup = planner_backup.backup(args)
            api = root / "apps/api"
            result = subprocess.run(
                [str(api / ".venv/bin/python"), "-m", "planner.job_cleanup", "--expect-project", ref,
                 "--backup", str(backup), "--backup-key", str(args.key), "--execute"],
                cwd=api, env={**os.environ, **config}, capture_output=True, text=True, timeout=600,
            )
            if result.returncode:
                raise RuntimeError("Guarded cleanup failed")
            print(result.stdout.strip())
        return 0
    except Exception as exc:
        print(f"Legacy cleanup failed: {type(exc).__name__}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
