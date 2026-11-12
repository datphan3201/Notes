#!/usr/bin/env python3
"""Record bounded, private aggregate health without another cloud service."""
import datetime as dt
import json
import os
import pathlib
import re
import urllib.parse
import urllib.request

import planner_backup
import psycopg
from rollout_when_verified import render_token, request


def level(used, limit):
    used = int(used)
    percent = 100 * used / limit
    return {"used_bytes": used, "limit_bytes": limit, "percent": round(percent, 2),
            "level": "critical" if percent >= 95 else "urgent" if percent >= 85 else "warning" if percent >= 70 else "ok"}


def collect(config):
    url = config["PLANNER_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(url, options="-c search_path=planner,extensions,public", connect_timeout=20) as db:
        with db.cursor() as cur:
            cur.execute("SELECT current_database(), current_schema(), now(), pg_database_size(current_database())")
            database, schema, stamp, size = cur.fetchone()
            if (database, schema) != ("postgres", "planner"):
                raise ValueError("Unexpected database identity")
            cur.execute("SELECT coalesce(sum((metadata->>'size')::bigint), 0) FROM storage.objects")
            storage = cur.fetchone()[0]
            cur.execute("SELECT status, count(*), max(attempts) FROM jobs GROUP BY status")
            jobs = [{"status": status, "count": count, "max_attempts": attempts} for status, count, attempts in cur.fetchall()]
            cur.execute("SELECT extract(epoch FROM now() - min(available_at)) FROM jobs WHERE status='queued' AND available_at <= now()")
            oldest = cur.fetchone()[0]
            cur.execute("SELECT count(*) FILTER (WHERE attempts > 1), count(*) FILTER (WHERE attempts > 0) FROM jobs")
            retries, attempted = cur.fetchone()
            cur.execute("SELECT wait_event_type, count(*) FROM pg_stat_activity WHERE datname=current_database() GROUP BY wait_event_type")
            waits = [{"wait_event_type": event, "count": count} for event, count in cur.fetchall()]
            cur.execute("""SELECT count(*), percentile_cont(0.95) WITHIN GROUP
                (ORDER BY extract(epoch FROM created_at - (details->>'reminder_at')::timestamptz))
                FROM notifications WHERE created_at >= now() - interval '24 hours'
                AND key LIKE 'reminder:v2:%%' AND details->>'reminder_at' IS NOT NULL""")
            notification_count, notification_p95 = cur.fetchone()
            cur.execute("SELECT key, value FROM system_settings WHERE key LIKE 'worker:heartbeat:%%' OR key IN ('scheduler:mode', 'scheduler:retention')")
            worker = dict(cur.fetchall())
            # User confirmed Free; conservative decimal MB/GB match the published allowance.
            quotas = {"database": level(size, 500_000_000), "storage": level(storage, 1_000_000_000)}
            pressure = {"at": stamp.isoformat(), "pause_index": quotas["database"]["level"] in ("urgent", "critical")}
            cur.execute("INSERT INTO system_settings(key,value) VALUES ('capacity:pressure',%s) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (json.dumps(pressure),))
    root = pathlib.Path.home() / ".local/share/planner-backups/automated"
    stamps = [dt.datetime.strptime(p.name[7:23], "%Y%m%dT%H%M%SZ").replace(tzinfo=dt.UTC)
              for p in root.glob("backup-*") if p.is_dir() and re.fullmatch(r"backup-\d{8}T\d{6}Z-[0-9a-f]{6}", p.name)
              and (p / "manifest.json.enc").is_file() and (p / "database.dump.enc").is_file()]
    age = max(0, int((stamp - max(stamps)).total_seconds())) if stamps else None
    health = {}
    for name, path in (("api", "/ready"), ("worker", "/health/worker")):
        try:
            with urllib.request.urlopen("https://planner-api-sg.onrender.com" + path, timeout=30) as response:
                health[name] = response.status == 200
        except Exception:
            health[name] = False
    memory = None
    try:
        token = render_token(planner_backup.ROOT / ".cloud")
        query = urllib.parse.urlencode({"resource": planner_backup.SERVICE,
            "startTime": (stamp - dt.timedelta(minutes=15)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endTime": stamp.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "resolutionSeconds": 60})
        readings = request("https://api.render.com/v1/metrics/memory?" + query, token)
        limits = request("https://api.render.com/v1/metrics/memory-limit?" + query, token)
        used = [point["value"] for series in readings if series.get("unit") == "bytes" for point in series.get("values", [])]
        maximum = [point["value"] for series in limits if series.get("unit") == "bytes" for point in series.get("values", []) if point.get("value")]
        if used and maximum:
            memory = level(max(used), min(maximum))
    except Exception:
        pass  # An unavailable provider metric must not hide database/worker health.
    return {"at": stamp.isoformat(), "quotas": quotas, "jobs": jobs,
            "render_memory_peak_15m": memory,
            "retry_fraction": retries / attempted if attempted else 0,
            "database_waits": waits, "reminder_samples_24h": notification_count,
            "reminder_delay_p95_seconds": float(notification_p95) if notification_p95 is not None else None,
            "oldest_due_job_seconds": float(oldest) if oldest is not None else None,
            "worker": worker, "health": health, "backup_age_seconds": age,
            "backup_overdue": age is None or age > 26 * 3600,
            "unavailable_metrics": ["provider_bandwidth", "render_monthly_hours", "vercel_build_allowance"]}


def main():
    try:
        config, _, _ = planner_backup.configuration(planner_backup.ROOT / ".cloud")
        report = collect(config)
        root = pathlib.Path.home() / ".local/state/planner-monitor"
        root.mkdir(parents=True, exist_ok=True, mode=0o700)
        temporary = root / "latest.json.partial"
        temporary.write_text(json.dumps(report, sort_keys=True) + "\n")
        os.chmod(temporary, 0o600)
        temporary.replace(root / "latest.json")
        print(json.dumps(report, sort_keys=True))
        return 0
    except Exception as exc:
        print(f"Planner monitoring failed: {type(exc).__name__}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
