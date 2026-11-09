from datetime import date, timedelta

import pytest
from sqlalchemy import func, select

from planner import planning
from planner.auth import password_matches
from planner.demo_seed import history_start, seed_account, verify_target
from planner.models import Activity, Document, HabitDay, Job, Milestone, Note, Review, Task, User

EMAIL = "roadmap.demo@example.com"
PASSWORD = "isolated-demo-password"
AS_OF = date(2026, 11, 8)


@pytest.mark.parametrize(
    "day,expected",
    [
        (AS_OF, date(2026, 9, 8)),
        (date(2024, 4, 30), date(2024, 2, 29)),
        (date(2026, 1, 31), date(2025, 11, 30)),
    ],
)
def test_two_calendar_month_window_handles_leap_and_year_boundaries(day, expected):
    assert history_start(day) == expected


def test_demo_history_is_scoped_consistent_and_login_works(client, db):
    original = db.scalar(select(User).where(User.email == "owner@example.com"))
    original_hash = original.password_hash
    verify_target(db, "planner_test", "public")
    report = seed_account(db, EMAIL, PASSWORD, AS_OF)
    db.commit()
    user_id = report["user_id"]
    assert report["history_first"] == "2026-09-08"
    assert report["history_last"] == "2026-11-07"
    assert report["counts"]["areas"] == 3
    assert report["counts"]["goals"] == 4
    assert report["counts"]["milestones"] == 8
    assert report["counts"]["tasks"] > 120
    linked_count = db.scalar(select(func.count()).select_from(Note).where(Note.user_id == user_id, Note.task_id.is_not(None)))
    assert linked_count > 100
    assert report["counts"]["notes"] == 10 + linked_count
    user = db.get(User, user_id)
    assert user.role == "user" and user.email_verified_at
    assert user.profile["demo_fixture"]["version"] == "two-month-roadmap-v1"
    assert password_matches(PASSWORD, user.password_hash)
    assert db.get(User, original.id).password_hash == original_hash
    assert db.scalar(select(func.count()).select_from(Job).where(Job.user_id == user_id)) == 0
    tasks = db.scalars(select(Task).where(Task.user_id == user_id)).all()
    assert {row.status for row in tasks} == {"todo", "doing", "blocked", "done"}
    assert any(row.archived_at for row in tasks)
    assert all(not row.due_date or date(2026, 9, 8) <= row.due_date < AS_OF for row in tasks)
    for row in tasks:
        if row.milestone_id:
            parent = db.get(Milestone, row.milestone_id)
            assert parent.start_date <= row.due_date <= parent.due_date
            if parent.status == "done":
                assert row.status == "done"
    reviews = db.scalars(select(Review).where(Review.user_id == user_id)).all()
    assert {row.period for row in reviews} == {"daily", "weekly", "monthly"}
    assert any(row.snapshot["done"] for row in reviews)
    assert any(row.snapshot["habits"] for row in reviews)
    assert all(row.snapshot["done"] <= row.snapshot["total"] for row in reviews)
    assert db.scalar(select(func.max(HabitDay.day))) == AS_OF - timedelta(days=1)
    assert db.scalar(select(func.max(Activity.created_at))).date() < AS_OF
    locked = db.scalar(select(Note).where(Note.user_id == user_id, Note.lock_hash.is_not(None)))
    assert locked and password_matches(PASSWORD, locked.lock_hash)
    assert not db.scalar(select(Document.id).where(Document.source_id == locked.id))
    assert db.scalar(select(Document.id).where(Document.user_id == user_id))
    assert (
        client.get(
            f"/api/v1/goals/{db.scalar(select(planning.MODELS['goals'].id).where(planning.MODELS['goals'].user_id == user_id))}"
        ).status_code
        == 404
    )
    login = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.status_code == 200, login.text
    client.headers["x-csrf-token"] = login.json()["csrf"]
    snapshot = client.get("/api/v1/workspace/snapshot")
    assert snapshot.status_code == 200
    assert len(snapshot.json()["tasks"]) == report["counts"]["tasks"]
    assert len(snapshot.json()["habit_days"]) > 90


def test_existing_email_is_never_reset(db):
    report = seed_account(db, EMAIL, PASSWORD, AS_OF)
    db.commit()
    with pytest.raises(ValueError, match="already exists"):
        seed_account(db, EMAIL.upper(), "another-test-password", AS_OF)
    db.rollback()
    assert (
        db.scalar(select(func.count()).select_from(User).where(User.id == report["user_id"])) == 1
    )
    assert password_matches(PASSWORD, db.get(User, report["user_id"]).password_hash)


def test_failed_seed_rolls_back_the_entire_new_account(db, monkeypatch):
    real_validate = planning.validated

    def reject_notes(kind, fields):
        if kind == "notes":
            raise ValueError("synthetic interrupted creation")
        return real_validate(kind, fields)

    monkeypatch.setattr(planning, "validated", reject_notes)
    with pytest.raises(ValueError, match="interrupted creation"), db.begin():
        seed_account(db, EMAIL, PASSWORD, AS_OF)
    assert db.scalar(select(func.count()).select_from(User)) == 0
    assert db.scalar(select(func.count()).select_from(Task)) == 0
    assert db.scalar(select(func.count()).select_from(Activity)) == 0


def test_target_mismatch_refuses_before_fixture_writes(db):
    with pytest.raises(ValueError, match="does not match"):
        verify_target(db, "postgres", "planner")
    assert db.scalar(select(func.count()).select_from(User)) == 0
