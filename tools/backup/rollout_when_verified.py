#!/usr/bin/env python3
"""Switch a continuously verified shadow scheduler to due mode, or do nothing."""
import argparse
import datetime as dt
import json
import os
import pathlib
import re
import subprocess
import urllib.parse
import urllib.request

import planner_backup
import psycopg

SERVICE = "srv-dbo21jp5efls73clvcp0"


def samples_cover_window(timestamps, start, end, max_gap):
    points = sorted({point for point in timestamps if start <= point <= end})
    if not points or points[0] > start + max_gap or points[-1] < end - max_gap:
        return False
    return all(right - left <= max_gap for left, right in zip(points, points[1:]))


def request(url, token):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"Authorization": "Bearer " + token}), timeout=30) as response:
        return json.load(response)


def render_token(path):
    for line in path.read_text().splitlines():
        if line.startswith("RENDER_TOKEN="):
            return line.split("=", 1)[1].strip().strip("\"'")
    raise ValueError("Render token is unavailable")


def observed_uptime(token, owner, start, end):
    cursor = start
    points = []
    while cursor < end:
        until = min(cursor + dt.timedelta(hours=1), end)
        query = urllib.parse.urlencode({
            "ownerId": owner, "resource": SERVICE, "text": "UptimeRobot", "limit": 100,
            "startTime": cursor.isoformat(), "endTime": until.isoformat(), "direction": "forward",
        })
        data = request("https://api.render.com/v1/logs?" + query, token)
        if data.get("hasMore"):
            return False
        for entry in data.get("logs", []):
            try:
                message = json.loads(entry["message"])
                if "uptimerobot" in message.get("user_agent", "").lower() and message.get("status") == 200:
                    points.append(dt.datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00")))
            except (KeyError, ValueError, TypeError):
                continue
        cursor = until
    return samples_cover_window(points, start, end, dt.timedelta(minutes=10))


def memory_safe(token, start, end):
    query = urllib.parse.urlencode({
        "resource": SERVICE, "startTime": start.isoformat(), "endTime": end.isoformat(),
        "resolutionSeconds": 300,
    })
    readings = request("https://api.render.com/v1/metrics/memory?" + query, token)
    limits = request("https://api.render.com/v1/metrics/memory-limit?" + query, token)
    values, points = [], []
    for series in readings:
        if series.get("unit") != "bytes":
            return False
        for sample in series.get("values", []):
            if isinstance(sample.get("value"), (int, float)):
                values.append(sample["value"])
                points.append(dt.datetime.fromisoformat(sample["timestamp"].replace("Z", "+00:00")))
    ceilings = [sample["value"] for series in limits if series.get("unit") == "bytes"
                for sample in series.get("values", []) if sample.get("value")]
    return bool(values and ceilings and max(values) < min(ceilings) * 0.8
                and samples_cover_window(points, start, end, dt.timedelta(minutes=15)))


def clean_comparison(config):
    url = config["PLANNER_DATABASE_URL"].replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(url, options="-c search_path=planner,extensions,public", connect_timeout=20) as db:
        with db.cursor() as cur:
            cur.execute("SELECT current_database(), current_schema(), now()")
            database, schema, stamp = cur.fetchone()
            if (database, schema) != ("postgres", "planner"):
                raise ValueError("Unexpected database identity")
            cur.execute("SELECT key, value FROM system_settings WHERE key IN (%s,%s,%s,%s,%s,%s)", (
                "scheduler:desired", "scheduler:mode", "scheduler:comparison",
                "worker:heartbeat:scheduler", "worker:heartbeat:fast", "worker:heartbeat:slow",
            ))
            rows = dict(cur.fetchall())
            desired, mode, comparison = (rows.get(key, {}) for key in (
                "scheduler:desired", "scheduler:mode", "scheduler:comparison"
            ))
            try:
                since = dt.datetime.fromisoformat(comparison["since"])
                last = dt.datetime.fromisoformat(comparison["last_at"])
                if (desired.get("mode") != "compare" or mode.get("mode") != "compare"
                        or comparison.get("matched") is not True
                        or comparison.get("mode_since") != mode.get("since")
                        or since > stamp - dt.timedelta(hours=24)
                        or not dt.timedelta(0) <= stamp - last <= dt.timedelta(seconds=180)):
                    return None
                for lane, seconds in (("scheduler", 180), ("fast", 180), ("slow", 360)):
                    age = stamp - dt.datetime.fromisoformat(rows["worker:heartbeat:" + lane]["at"])
                    if not dt.timedelta(0) <= age <= dt.timedelta(seconds=seconds):
                        return None
            except (KeyError, TypeError, ValueError):
                return None
            return stamp


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected-commit", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{40}", args.expected_commit):
        print("Due-mode rollout failed: invalid expected commit")
        return 1
    root = pathlib.Path(__file__).resolve().parents[2]
    cloud = root / ".cloud"
    try:
        config, _, ref = planner_backup.configuration(cloud)
        stamp = clean_comparison(config)
        if stamp is None:
            print("Due-mode rollout skipped: comparison or worker-health gate is not satisfied")
            return 0
        token = render_token(cloud)
        service = request(f"https://api.render.com/v1/services/{SERVICE}", token)
        deployments = request(f"https://api.render.com/v1/services/{SERVICE}/deploys?limit=10", token)
        live = [item["deploy"] for item in deployments if item["deploy"].get("status") == "live"]
        pending = {"created", "queued", "build_in_progress", "pre_deploy_in_progress", "update_in_progress"}
        if (len(live) != 1 or live[0].get("commit", {}).get("id") != args.expected_commit
                or any(item["deploy"].get("status") in pending for item in deployments)):
            print("Due-mode rollout skipped: backend deployment changed or is in progress")
            return 0
        end = stamp - dt.timedelta(minutes=5)
        start = end - dt.timedelta(hours=24)
        if not observed_uptime(token, service["ownerId"], start, end) or not memory_safe(token, start, end):
            print("Due-mode rollout skipped: uptime or memory evidence is insufficient")
            return 0
        api = root / "apps/api"
        result = subprocess.run(
            [str(api / ".venv/bin/python"), "-m", "planner.scheduler_admin", "--expect-project", ref,
             "--set-mode", "due", "--expect-mode", "compare", "--execute"],
            cwd=api, env={**os.environ, **config}, capture_output=True, text=True, timeout=120,
        )
        if result.returncode:
            raise RuntimeError("Guarded scheduler switch failed")
        print("Due-mode scheduler enabled after 24 hours of clean comparison and capacity checks")
        return 0
    except Exception as exc:
        print(f"Due-mode rollout failed: {type(exc).__name__}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
