"""Controlled scheduler comparison against the previously deployed revision."""
import subprocess
from datetime import timedelta
from pathlib import Path

import pytest
from sqlalchemy import delete, func, select

from planner import jobs
from planner.config import settings
from planner.db import session_factory
from planner.models import Job, User, now


def test_idle_scheduler_against_deployed_baseline(client, db, monkeypatch):
    root = Path(__file__).resolve().parents[3]
    source = subprocess.run(
        ["git", "show", "6094212:apps/api/planner/jobs.py"],
        cwd=root, capture_output=True, text=True, check=False,
    )
    if source.returncode:
        pytest.skip("baseline revision is not available in this checkout")
    baseline = {"__name__": "planner_scheduler_baseline"}
    exec(compile(source.stdout, "baseline_jobs.py", "exec"), baseline)
    for index in range(7):
        db.add(User(email=f"baseline-{index}@example.com", name="Fixture", password_hash="test"))
    db.commit()
    start = now().replace(minute=0, second=0, microsecond=0)
    for minute in range(10):
        baseline["now"] = lambda minute=minute: start + timedelta(minutes=minute)
        baseline["schedule"](session_factory())
    baseline_count = db.scalar(select(func.count()).select_from(Job).where(
        Job.kind.in_(["recurrence", "reminders", "retention"])
    ))
    db.execute(delete(Job))
    db.commit()
    monkeypatch.setattr(settings(), "scheduler_mode", "due")
    for minute in range(10):
        monkeypatch.setattr(jobs, "now", lambda minute=minute: start + timedelta(minutes=minute))
        jobs.schedule(session_factory())
    optimized_count = db.scalar(select(func.count()).select_from(Job).where(
        Job.kind.in_(["recurrence", "reminders", "reminder-dispatch", "retention"])
    ))
    assert baseline_count == 168
    assert optimized_count == 0
