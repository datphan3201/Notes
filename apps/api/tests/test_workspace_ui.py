from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select

from planner.config import settings
from planner.jobs import reminders
from planner.models import Activity, Job, Notification, User, now


def make(client, kind, **fields):
    response = client.post("/api/v1/" + kind, json={"title": "Baseline " + kind, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def test_workspace_preferences_persist_and_reject_invalid_values(client):
    user = client.get("/api/v1/auth/me").json()["user"]
    values = {key: user[key] for key in ("name", "timezone", "locale", "theme")}
    values["preferences"] = {
        "visual_theme": "forest",
        "show_quote": False,
        "notes_view": "list",
        "history_overdue_days": 5,
    }
    assert client.put("/api/v1/preferences", json=values).status_code == 200
    saved = client.get("/api/v1/auth/me").json()["user"]["preferences"]
    assert saved["visual_theme"] == "forest" and saved["notes_view"] == "list"
    assert saved["show_quote"] is False and saved["history_overdue_days"] == 5
    values["preferences"]["visual_theme"] = "../private"
    assert client.put("/api/v1/preferences", json=values).status_code == 422
    assert client.get("/api/v1/auth/me").json()["user"]["preferences"] == saved


def test_manual_plan_read_is_owned_and_keeps_dates_unchanged(client, stranger):
    task = make(client, "tasks")
    day = "2026-11-07"
    assert (
        client.put(
            "/api/v1/plan/tasks/" + task["id"], json={"day": day, "selected": True}
        ).status_code
        == 200
    )
    assert client.get("/api/v1/plan/tasks?day=" + day).json() == {
        "daily": [task["id"]],
        "weekly": [task["id"]],
    }
    assert stranger.get("/api/v1/plan/tasks?day=" + day).json() == {"daily": [], "weekly": []}
    assert client.get("/api/v1/tasks/" + task["id"]).json()["due_date"] is None


def test_prerequisite_picker_reads_owned_edges_only(client, stranger):
    area = make(client, "areas")
    goal = make(client, "goals", area_id=area["id"])
    first = make(client, "milestones", goal_id=goal["id"])
    second = make(client, "milestones", goal_id=goal["id"])
    url = "/api/v1/milestones/" + second["id"] + "/prerequisites"
    assert client.put(url, json={"version": 1, "ids": [first["id"]]}).status_code == 200
    assert client.get(url).json() == [first["id"]]
    assert stranger.get(url).status_code == 404


def test_note_color_and_shared_filter_are_real_data(client, stranger):
    note = make(client, "notes", color="mint")
    assert client.get("/api/v1/notes").json()["items"][0]["color"] == "mint"
    assert client.get("/api/v1/notes").json()["items"][0]["shared"] is False
    assert (
        client.put(
            "/api/v1/notes/" + note["id"] + "/share",
            json={"email": "other@example.com", "can_edit": False},
        ).status_code
        == 200
    )
    assert stranger.get("/api/v1/notes").json()["items"][0]["shared"] is True

    url = "/api/v1/notes/" + note["id"]
    assert client.get(url + "/share").json()[0]["can_edit"] is False
    assert stranger.get(url + "/share").status_code == 404
    assert stranger.get(url).json()["can_edit"] is False
    assert (
        client.put(
            url + "/share", json={"email": "other@example.com", "can_edit": True}
        ).status_code
        == 200
    )
    assert stranger.get(url).json()["can_edit"] is True
    assert (
        stranger.patch(
            url, json={"version": 1, "fields": {"content": "Recipient edit"}}
        ).status_code
        == 200
    )
    assert stranger.patch(url, json={"version": 2, "fields": {"pinned": True}}).status_code == 404
    assert client.get(url).json()["pinned"] is False


def test_notifications_read_all_never_changes_another_account(client, stranger, db):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    other = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    db.add_all(
        [
            Notification(user_id=owner, key="owner", message="One"),
            Notification(user_id=other, key="other", message="Two"),
        ]
    )
    db.commit()
    assert client.post("/api/v1/notifications/read").status_code == 204
    assert client.get("/api/v1/notifications").json()[0]["read"] is True
    assert stranger.get("/api/v1/notifications").json()[0]["read"] is False


def test_activity_range_is_owned_and_uses_account_local_dates(client, stranger, db):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    db.add(
        Activity(
            user_id=owner,
            kind="task.completed",
            entity_id="task",
            created_at=datetime(2026, 11, 6, 18, tzinfo=UTC),
        )
    )
    db.commit()
    url = "/api/v1/activity?start=2026-11-07&end=2026-11-07"
    assert len(client.get(url).json()) == 1
    assert stranger.get(url).json() == []
    assert client.get("/api/v1/activity?start=2026-11-08&end=2026-11-07").status_code == 422


def test_schedule_interval_and_completion_history_have_authoritative_timestamps(client):
    assert (
        client.post(
            "/api/v1/tasks", json={"title": "Invalid", "scheduled_end": "2026-11-07T12:00:00Z"}
        ).status_code
        == 422
    )
    task = make(
        client, "tasks", scheduled_at="2026-11-07T10:00:00Z", scheduled_end="2026-11-07T12:00:00Z"
    )
    completed = client.patch(
        "/api/v1/tasks/" + task["id"], json={"version": 1, "fields": {"status": "done"}}
    ).json()
    assert completed["completed_at"] is not None
    reopened = client.patch(
        "/api/v1/tasks/" + task["id"], json={"version": 2, "fields": {"status": "todo"}}
    ).json()
    assert reopened["completed_at"] is None
    assert datetime.fromisoformat(reopened["scheduled_end"]) == datetime(
        2026, 11, 7, 12, tzinfo=UTC
    )


@pytest.mark.parametrize("provider", ["smtp", "brevo"])
def test_reminder_email_setting_and_replay_do_not_duplicate_delivery(client, db, monkeypatch, provider):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    if provider == "smtp":
        monkeypatch.setattr(settings(), "smtp_host", "fake.smtp.invalid")
    else:
        from pydantic import SecretStr

        monkeypatch.setattr(settings(), "brevo_api_key", SecretStr("synthetic-brevo"))
    reminders(db, SimpleNamespace(user_id=owner))
    reminders(db, SimpleNamespace(user_id=owner))
    emails = db.scalar(
        select(func.count()).select_from(Job).where(Job.key.like("reminder-email:%"))
    )
    assert emails == 1
    user = db.get(User, owner)
    user.preferences = {"email_notifications": False, "notifications_enabled": False}
    db.commit()
    make(client, "tasks", reminder_at=(now() - timedelta(minutes=1)).isoformat())
    reminders(db, SimpleNamespace(user_id=owner))
    assert (
        db.scalar(select(func.count()).select_from(Job).where(Job.key.like("reminder-email:%")))
        == 1
    )
    assert client.get("/api/v1/notifications").json() == []


def test_task_capture_and_manual_plan_are_one_authoritative_transaction(client):
    from zoneinfo import ZoneInfo

    user = client.get("/api/v1/auth/me").json()["user"]
    today = now().astimezone(ZoneInfo(user["timezone"])).date().isoformat()
    task = make(client, "tasks", plan_for="daily")
    plan = client.get("/api/v1/plan/tasks?day=" + today).json()
    assert task["id"] in plan["daily"] and task["id"] in plan["weekly"]
    assert task["due_date"] is None and task["status"] == "todo"
    before = client.get("/api/v1/tasks").json()
    invalid = client.post(
        "/api/v1/tasks",
        json={"title": "Invalid parent", "goal_id": "not-owned", "plan_for": "daily"},
    )
    assert invalid.status_code == 404
    assert client.get("/api/v1/tasks").json() == before
    assert client.get("/api/v1/plan/tasks?day=" + today).json() == plan


def test_habit_activity_records_only_real_transitions_and_stays_owned(client, stranger):
    from zoneinfo import ZoneInfo

    habit = make(client, "habits", timezone="Asia/Ho_Chi_Minh")
    day = now().astimezone(ZoneInfo(habit["timezone"])).date().isoformat()
    path = "/api/v1/habits/" + habit["id"] + "/checkin"
    for state in ("done", "done", "clear", "clear", "done"):
        assert client.put(path, json={"day": day, "state": state}).status_code == 200
    facts = client.get(f"/api/v1/activity?start={day}&end={day}").json()
    assert sorted(row["kind"] for row in facts) == [
        "habit.completed",
        "habit.completed",
        "habit.undone",
    ]
    assert all(row["entity_id"] == habit["id"] for row in facts)
    assert stranger.put(path, json={"day": day, "state": "clear"}).status_code == 404
    assert stranger.get(f"/api/v1/activity?start={day}&end={day}").json() == []
    invalid = (now() + timedelta(days=10)).date().isoformat()
    assert client.put(path, json={"day": invalid, "state": "done"}).status_code == 422
    assert len(client.get(f"/api/v1/activity?start={day}&end={day}").json()) == 3
