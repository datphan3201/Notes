from datetime import timedelta

import pytest
from sqlalchemy import select

from planner.models import Note, now


def make(client, kind, **fields):
    result = client.post("/api/v1/" + kind, json={"title": "Test " + kind, **fields})
    assert result.status_code == 201, result.text
    return result.json()


@pytest.mark.parametrize(
    "kind,fields",
    [
        ("notes", {}),
        ("tasks", {}),
        ("areas", {}),
        ("habits", {}),
        ("reviews", {"period_date": "2026-11-07"}),
    ],
)
def test_owned_read_and_mutations_are_404(client, stranger, kind, fields):
    row = make(client, kind, **fields)
    url = f"/api/v1/{kind}/{row['id']}"
    assert stranger.get(url).status_code == 404
    assert (
        stranger.patch(url, json={"version": 1, "fields": {"title": "Stolen"}}).status_code == 404
    )
    assert stranger.post(url + "/archive", json={"version": 1}).status_code == 404


def test_csrf_origin_and_logout(client):
    assert (
        client.post(
            "/api/v1/tasks", json={"title": "x"}, headers={"origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/tasks", json={"title": "x"}, headers={"x-csrf-token": "forged"}
        ).status_code
        == 403
    )
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert client.get("/api/v1/tasks").status_code == 401


def test_unknown_fields_versions_and_date_validation(client):
    assert client.post("/api/v1/tasks", json={"title": "x", "user_id": "forged"}).status_code == 422
    assert (
        client.post(
            "/api/v1/tasks",
            json={"title": "x", "start_date": "2026-11-08", "due_date": "2026-11-07"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/v1/tasks", json={"title": "x", "scheduled_at": "2026-11-07T09:00:00"}
        ).status_code
        == 422
    )
    task = make(client, "tasks")
    url = "/api/v1/tasks/" + task["id"]
    assert client.patch(url, json={"version": 1, "fields": {"status": "done"}}).status_code == 200
    assert client.patch(url, json={"version": 1, "fields": {"title": "Stale"}}).status_code == 409
    assert client.get(url).json()["title"] == task["title"]


def test_graph_cycle_cross_owner_and_atomic_archive(client, stranger):
    area = make(client, "areas")
    root = make(client, "goals", area_id=area["id"])
    child = make(client, "goals", parent_goal_id=root["id"])
    foreign = make(stranger, "areas")
    assert (
        client.post("/api/v1/goals", json={"title": "bad", "area_id": foreign["id"]}).status_code
        == 404
    )
    url = "/api/v1/goals/" + root["id"]
    assert (
        client.patch(
            url, json={"version": 1, "fields": {"area_id": None, "parent_goal_id": child["id"]}}
        ).status_code
        == 422
    )
    assert client.post(url + "/archive", json={"version": 1}).status_code == 422
    assert client.get(url).json()["archived_at"] is None
    assert (
        client.post(url + "/archive", json={"version": 1, "include_contents": True}).status_code
        == 200
    )
    assert client.get("/api/v1/goals/" + child["id"]).json()["archived_at"]
    assert client.post(url + "/archive", json={"version": 2, "archived": False}).status_code == 200
    assert client.get("/api/v1/goals/" + child["id"]).json()["archived_at"] is None


def test_locked_note_search_ai_and_files(client, stranger, db):
    note = make(client, "notes", content="secret-needle")
    url = "/api/v1/notes/" + note["id"]
    upload = client.post(url + "/attachments", files={"file": ("secret.txt", b"private")})
    assert upload.status_code == 201, upload.text
    download = "/api/v1/files/" + upload.json()["id"]
    assert stranger.get(download).status_code == 404
    assert client.post(url + "/password", json={"new_password": "note-password"}).status_code == 200
    assert client.get(url).status_code == 423
    assert client.get(download).status_code == 423
    assert client.get("/api/v1/notes?q=secret-needle").json()["items"] == []
    assert client.get("/api/v1/notes").json()["items"][0]["content"] == ""
    assert client.post(url + "/unlock", json={"password": "wrong"}).status_code == 403
    assert client.post(url + "/unlock", json={"password": "note-password"}).status_code == 200
    assert client.get(download).content == b"private"
    from planner.ai import eligible_sources

    assert db.execute(select(eligible_sources(db.scalar(select(Note.user_id))).c.id)).all() == []


def test_simple_sharing_and_revocation(client, stranger):
    note = make(client, "notes", content="shared")
    url = "/api/v1/notes/" + note["id"]
    assert client.put(url + "/share", json={"email": "other@example.com"}).status_code == 200
    assert stranger.get(url).status_code == 200
    assert stranger.patch(url, json={"version": 1, "fields": {"title": "x"}}).status_code == 404
    assert (
        client.put(
            url + "/share", json={"email": "other@example.com", "can_edit": True}
        ).status_code
        == 200
    )
    assert (
        stranger.patch(url, json={"version": 1, "fields": {"title": "Together"}}).status_code == 200
    )
    recipient = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    assert client.delete(url + "/share/" + recipient).status_code == 204
    assert stranger.get(url).status_code == 404


def test_expired_session_is_rejected(client, db):
    from planner.models import LoginSession

    session = db.scalar(select(LoginSession))
    session.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401


def test_manual_daily_selection_adds_week_without_changing_task_dates(client):
    task = make(client, "tasks")
    day = client.get("/api/v1/dashboard").json()["date"]
    assert client.put(f"/api/v1/plan/tasks/{task['id']}", json={"day": day}).status_code == 200
    dashboard = client.get("/api/v1/dashboard").json()
    assert task["id"] in [row["id"] for row in dashboard["today"]]
    assert task["id"] in [row["id"] for row in dashboard["week"]]
    current = client.get(f"/api/v1/tasks/{task['id']}").json()
    assert current["due_date"] is None and current["status"] == "todo"


def test_habit_timezone_remains_fixed_after_checkin_is_cleared(client):
    habit = make(client, "habits")
    day = client.get("/api/v1/dashboard").json()["date"]
    url = f"/api/v1/habits/{habit['id']}"
    assert client.put(url + "/checkin", json={"day": day, "state": "done"}).status_code == 200
    assert client.put(url + "/checkin", json={"day": day, "state": "clear"}).status_code == 200
    assert client.patch(url, json={"version": 1, "fields": {"timezone": "UTC"}}).status_code == 422
