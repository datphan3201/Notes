from datetime import timedelta

import pytest
from sqlalchemy import select

from planner.job_cleanup import legacy_candidates, require_stable_scheduler
from planner.models import Job, SystemSetting, User, now


def test_cleanup_selects_only_old_completed_legacy_periodic_jobs(client, db):
    owner = db.query(User).filter_by(email="owner@example.com").one().id
    old = now() - timedelta(days=5)
    recent = now() - timedelta(hours=1)
    rows = [
        Job(kind="recurrence", user_id=owner, key=f"recurrence:{owner}:{old:%Y-%m-%dT%H:%M}", payload={}, status="completed", available_at=old),
        Job(kind="reminders", user_id=owner, key=f"reminders:{owner}:{old:%Y-%m-%dT%H:%M}", payload={}, status="queued", available_at=old),
        Job(kind="retention", user_id=owner, key=f"retention:{owner}:{recent:%Y-%m-%dT%H}", payload={}, status="completed", available_at=recent),
        Job(kind="recurrence", user_id=owner, key=f"recurrence:v2:{owner}:old", payload={}, status="completed", available_at=old),
        Job(kind="email", user_id=owner, key="email:receipt", payload={}, status="completed", available_at=old),
    ]
    db.add_all(rows)
    db.commit()
    selected = list(db.scalars(select(Job).where(legacy_candidates(now() - timedelta(hours=48)))))
    assert [job.id for job in selected] == [rows[0].id]


def test_cleanup_requires_48_hours_since_legacy_queue_drained(client, db):
    owner = db.query(User).filter_by(email="owner@example.com").one().id
    past = (now() - timedelta(hours=49)).isoformat()
    state = SystemSetting(key="scheduler:mode", value={"mode": "due", "since": past, "legacy_drained_at": past, "last_tick": now().isoformat()})
    db.add(state)
    db.add(SystemSetting(key="scheduler:desired", value={"mode": "due"}))
    db.add_all([SystemSetting(key="worker:heartbeat:" + lane, value={"at": now().isoformat()})
                for lane in ("scheduler", "fast", "slow")])
    db.commit()
    require_stable_scheduler(db)
    desired = db.get(SystemSetting, "scheduler:desired")
    desired.value = {"mode": "legacy"}
    db.commit()
    with pytest.raises(ValueError):
        require_stable_scheduler(db)
    db.rollback()
    desired = db.get(SystemSetting, "scheduler:desired")
    desired.value = {"mode": "due"}
    db.commit()
    db.add(Job(kind="reminders", user_id=owner, key="legacy-pending", payload={}, status="queued"))
    db.commit()
    with pytest.raises(ValueError):
        require_stable_scheduler(db)
    db.rollback()
    db.query(Job).filter_by(key="legacy-pending").delete()
    db.commit()
    state = db.get(SystemSetting, "scheduler:mode")
    state.value = {"mode": "due", "since": past, "legacy_drained_at": now().isoformat(), "last_tick": now().isoformat()}
    db.commit()
    with pytest.raises(ValueError):
        require_stable_scheduler(db)


def test_scheduler_interruption_resets_the_cleanup_observation_window(db, monkeypatch):
    from planner import jobs

    first = now() - timedelta(days=3)
    last = first + timedelta(hours=49)
    state = SystemSetting(key="scheduler:mode", value={
        "mode": "due", "since": first.isoformat(),
        "legacy_drained_at": first.isoformat(), "last_tick": last.isoformat(),
    })
    db.add(state)
    db.commit()
    monkeypatch.setattr(jobs, "now", lambda: last + timedelta(minutes=4))
    jobs.record_scheduler_mode(db, "due")
    db.commit()
    assert state.value["since"] == (last + timedelta(minutes=4)).isoformat()
    assert state.value["legacy_drained_at"] == state.value["since"]
