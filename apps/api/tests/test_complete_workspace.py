import io
import re
from datetime import timedelta
from types import SimpleNamespace

from PIL import Image
from sqlalchemy import select

from planner.jobs import materialize
from planner.models import AccountFile, Job, Report, Task, User, now

PASSWORD = "a-long-test-password"


def create(client, kind, **fields):
    response = client.post("/api/v1/" + kind, json={"title": "A " + kind, **fields})
    assert response.status_code == 201, response.text
    return response.json()


def batch(client, changes, status=200):
    result = client.post("/api/v1/workspace/changes", json={"changes": changes})
    assert result.status_code == status, result.text
    return result.json()


def code_for(db, user_id, prefix):
    db.expire_all()
    job = db.scalars(
        select(Job)
        .where(Job.user_id == user_id, Job.key.like(prefix + "%"))
        .order_by(Job.available_at.desc())
    ).first()
    assert job
    return re.search(r"(?:Code: |code: )(\d{6})", job.payload["body"]).group(1)


def image():
    output = io.BytesIO()
    Image.new("RGB", (10, 20), "blue").save(output, format="PNG")
    return output.getvalue()


def test_batch_aliases_complete_graph_and_rolls_back_every_write(client, stranger):
    changes = [
        {
            "action": "create",
            "kind": "areas",
            "client_id": "new-area",
            "fields": {"title": "Wellbeing", "icon": "leaf", "accent": "#abcdef"},
        },
        {
            "action": "create",
            "kind": "goals",
            "client_id": "new-goal",
            "fields": {"title": "Run", "area_id": "new-area", "strategy": "Build steadily"},
        },
        {
            "action": "create",
            "kind": "milestones",
            "client_id": "new-milestone",
            "fields": {"title": "First week", "goal_id": "new-goal"},
        },
        {
            "action": "create",
            "kind": "tasks",
            "client_id": "new-task",
            "fields": {
                "title": "Start",
                "milestone_id": "new-milestone",
                "related": ["new-goal"],
                "tags": ["health"],
            },
        },
    ]
    aliases = batch(client, changes)["aliases"]
    snapshot = client.get("/api/v1/workspace/snapshot").json()
    assert snapshot["goals"][0]["strategy"] == "Build steadily"
    assert snapshot["tasks"][0]["related"] == [aliases["new-goal"]]
    assert stranger.get("/api/v1/workspace/snapshot").json()["tasks"] == []
    batch(
        client,
        [
            {
                "action": "update",
                "kind": "tasks",
                "id": aliases["new-task"],
                "version": 1,
                "fields": {"title": "Should roll back"},
            },
            {
                "action": "update",
                "kind": "goals",
                "id": aliases["new-goal"],
                "version": 99,
                "fields": {"title": "Stale"},
            },
        ],
        409,
    )
    assert client.get("/api/v1/tasks/" + aliases["new-task"]).json()["title"] == "Start"
    batch(
        stranger,
        [
            {
                "action": "update",
                "kind": "tasks",
                "id": aliases["new-task"],
                "version": 1,
                "fields": {"title": "Forbidden"},
            }
        ],
        404,
    )


def test_acknowledged_transitions_reopen_parents_atomically(client):
    area = client.get("/api/v1/areas").json()["items"][0]
    goal = create(client, "goals", area_id=area["id"])
    milestone = create(client, "milestones", goal_id=goal["id"])
    task = create(
        client,
        "tasks",
        milestone_id=milestone["id"],
        checklist=[{"text": "A step", "checked": False}],
    )
    path = "/api/v1/tasks/" + task["id"]
    assert client.patch(path, json={"version": 1, "fields": {"status": "done"}}).status_code == 422
    assert (
        client.patch(
            path,
            json={"version": 1, "fields": {"status": "done"}, "acknowledgements": ["unchecked"]},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/api/v1/milestones/" + milestone["id"],
            json={"version": 1, "fields": {"status": "done"}},
        ).status_code
        == 200
    )
    assert (
        client.patch(
            "/api/v1/goals/" + goal["id"], json={"version": 1, "fields": {"status": "completed"}}
        ).status_code
        == 200
    )
    assert client.patch(path, json={"version": 2, "fields": {"status": "todo"}}).status_code == 422
    assert (
        client.patch(
            path,
            json={
                "version": 2,
                "fields": {"status": "todo"},
                "acknowledgements": ["reopen_parents"],
            },
        ).status_code
        == 200
    )
    snapshot = client.get("/api/v1/workspace/snapshot").json()
    assert snapshot["goals"][0]["status"] == snapshot["milestones"][0]["status"] == "doing"
    assert snapshot["tasks"][0]["checklist"][0]["checked"] is False


def test_note_invitations_password_and_private_media(client, stranger):
    note = create(client, "notes", content="private body", tags=["personal"])
    path = "/api/v1/notes/" + note["id"]
    assert (
        client.post(
            path + "/invitations", json={"email": "other@example.com", "can_edit": True}
        ).status_code
        == 201
    )
    assert stranger.get(path).status_code == 404
    assert len(stranger.get("/api/v1/notes/invitations").json()) == 1
    assert stranger.post(path + "/invitations/accept").status_code == 204
    file = client.post(
        path + "/attachments", files={"file": ("photo.png", image(), "image/png")}
    ).json()
    download = "/api/v1/files/" + file["id"]
    assert stranger.get(download).headers["content-type"] == "image/webp"
    assert (
        client.post(path + "/password", json={"new_password": "note-password"}).status_code == 200
    )
    snapshot = stranger.get("/api/v1/workspace/snapshot").json()["notes"][0]
    assert snapshot["content"] == "" and not snapshot.get("files") and not snapshot.get("summary")
    assert stranger.get(download).status_code == 423
    assert stranger.post(path + "/unlock", json={"password": "wrong"}).status_code == 403
    assert stranger.post(path + "/unlock", json={"password": "note-password"}).status_code == 200
    assert stranger.get(download).status_code == 200
    assert client.post(path + "/unlock", json={"password": "note-password"}).status_code == 200
    assert client.post(path + "/summary").status_code == 403
    assert (
        client.delete(
            path + "/share/" + stranger.get("/api/v1/auth/me").json()["user"]["id"]
        ).status_code
        == 204
    )
    assert stranger.get(download).status_code == 404


def test_email_change_verifies_latest_code_and_revokes_sessions(client, db):
    user_id = client.get("/api/v1/auth/me").json()["user"]["id"]
    assert (
        client.post(
            "/api/v1/auth/email/change",
            json={"email": "new@example.com", "current_password": "wrong"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            "/api/v1/auth/email/change",
            json={"email": "new@example.com", "current_password": PASSWORD},
        ).status_code
        == 202
    )
    code = code_for(db, user_id, "email-change:")
    assert client.post("/api/v1/auth/email/confirm", json={"code": code}).status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "new@example.com", "password": PASSWORD}
        ).status_code
        == 200
    )
    assert client.post("/api/v1/auth/email/confirm", json={"code": code}).status_code in (403, 422)


def test_email_mfa_is_actual_single_use_login_challenge(client, db):
    user_id = client.get("/api/v1/auth/me").json()["user"]["id"]
    assert (
        client.post(
            "/api/v1/auth/two-factor/email/setup",
            json={"current_password": PASSWORD, "enabled": True},
        ).status_code
        == 202
    )
    code = code_for(db, user_id, "email-mfa:")
    assert (
        client.post(
            "/api/v1/auth/two-factor/email/confirm", json={"password": PASSWORD, "code": code}
        ).status_code
        == 204
    )
    client.post("/api/v1/auth/logout")
    login = client.post(
        "/api/v1/auth/login", json={"email": "owner@example.com", "password": PASSWORD}
    ).json()
    assert login["requires_2fa"]
    code = code_for(db, user_id, "mfa-email:")
    payload = {"challenge": login["challenge"], "code": code}
    assert client.post("/api/v1/auth/two-factor", json=payload).status_code == 200
    assert client.post("/api/v1/auth/two-factor", json=payload).status_code == 422


def test_moderation_evidence_and_deletion_keep_roles_and_private_files_scoped(client, stranger, db):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    other = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    assert stranger.get("/api/v1/admin/state").status_code == 404
    upload = stranger.post(
        "/api/v1/account-files",
        data={"purpose": "evidence"},
        files={"file": ("proof.png", image(), "image/png")},
    )
    assert upload.status_code == 201, upload.text
    asset = upload.json()
    assert client.get(asset["url"]).status_code == 404
    report = stranger.post(
        "/api/v1/reports",
        json={
            "target": "owner@example.com",
            "reason": "A concrete concern for review",
            "evidence": [asset["id"]],
        },
    )
    assert report.status_code == 201
    db.get(User, owner).role = "admin"
    db.commit()
    assert client.get(asset["url"]).status_code == 200
    assert client.get("/api/v1/admin/state").json()["reports"][0]["evidence"] == [asset["url"]]
    assert (
        stranger.request(
            "DELETE",
            "/api/v1/auth/account",
            json={"confirm_email": "other@example.com", "current_password": PASSWORD},
        ).status_code
        == 204
    )
    db.expire_all()
    assert db.get(User, other) is None
    assert db.get(AccountFile, asset["id"]).user_id is None
    assert db.get(Report, report.json()["id"]).reporter_id is None
    assert client.get(asset["url"]).status_code == 200


def test_recurring_template_materializes_metadata_and_dates(client, db):
    user_id = client.get("/api/v1/auth/me").json()["user"]["id"]
    day = now().date()
    series = create(
        client,
        "task-series",
        frequency="daily",
        start_date=day.isoformat(),
        timezone="UTC",
        template={
            "title": "Practice",
            "due_date": (day + timedelta(days=1)).isoformat(),
            "checklist": [{"text": "Warm up", "checked": False}],
            "tags": ["health"],
            "estimated_minutes": 20,
        },
    )
    materialize(db, SimpleNamespace(user_id=user_id))
    tasks = db.scalars(
        select(Task).where(Task.series_id == series["id"]).order_by(Task.occurrence_date)
    ).all()
    assert tasks and tasks[0].checklist[0]["text"] == "Warm up"
    assert tasks[0].details["tags"] == ["health"]
    assert all(task.due_date == task.occurrence_date + timedelta(days=1) for task in tasks)


def test_archive_group_permanent_delete_includes_templates_and_keeps_unrelated_work(client, db):
    area = client.get("/api/v1/areas").json()["items"][0]
    goal = create(client, "goals", area_id=area["id"])
    milestone = create(client, "milestones", goal_id=goal["id"])
    task = create(client, "tasks", milestone_id=milestone["id"])
    habit = create(client, "habits", primary_goal_id=goal["id"])
    series = create(
        client,
        "task-series",
        frequency="daily",
        start_date=now().date().isoformat(),
        template={"title": "Recurring", "goal_id": goal["id"]},
    )
    linked = create(client, "notes", goal_id=goal["id"], content="Keep this research")
    unrelated = create(client, "tasks", title="Unrelated")
    batch(
        client,
        [
            {
                "action": "archive",
                "kind": "goals",
                "id": goal["id"],
                "version": 1,
                "fields": {"include_contents": True},
            }
        ],
    )
    batch(client, [{"action": "delete", "kind": "goals", "id": goal["id"], "version": 2}])
    for kind, row in (
        ("goals", goal),
        ("milestones", milestone),
        ("tasks", task),
        ("habits", habit),
        ("task-series", series),
    ):
        assert client.get("/api/v1/" + kind + "/" + row["id"]).status_code == 404
    note = client.get("/api/v1/notes/" + linked["id"]).json()
    assert note["goal_id"] is None and note["content"] == "Keep this research"
    assert client.get("/api/v1/tasks/" + unrelated["id"]).status_code == 200


def test_review_snapshot_finalization_refresh_and_delete_are_versioned(client):
    day = now().astimezone(__import__("zoneinfo").ZoneInfo("Asia/Ho_Chi_Minh")).date().isoformat()
    task = create(client, "tasks", due_date=day)
    review = create(client, "reviews", period="daily", period_date=day)
    assert review["snapshot"]["total"] == 1
    url = "/api/v1/reviews/" + review["id"]
    assert (
        client.patch(
            url,
            json={
                "version": 1,
                "fields": {"finalized": True, "reflection": "Keep this reflection"},
            },
        ).status_code
        == 200
    )
    assert (
        client.patch(url, json={"version": 2, "fields": {"reflection": "Blocked edit"}}).status_code
        == 422
    )
    batch(
        client,
        [{"action": "review-refresh", "kind": "reviews", "id": review["id"], "version": 2}],
        422,
    )
    assert client.patch(url, json={"version": 2, "fields": {"finalized": False}}).status_code == 200
    batch(client, [{"action": "delete", "kind": "reviews", "id": review["id"], "version": 3}])
    assert client.get(url).status_code == 404
    assert client.get("/api/v1/tasks/" + task["id"]).status_code == 200


def test_retried_workspace_creation_is_idempotent_and_does_not_replace_literal_text(client):
    change = {
        "action": "create",
        "kind": "tasks",
        "client_id": "literal-client-key",
        "fields": {"title": "literal-client-key", "due_date": "2026-11-08"},
    }
    first = batch(client, [change])
    again = batch(client, [change])
    assert first["aliases"] == again["aliases"]
    assert len(client.get("/api/v1/tasks").json()["items"]) == 1
    assert client.get("/api/v1/tasks").json()["items"][0]["title"] == "literal-client-key"


def test_history_worker_archives_by_retention_and_cap_without_deleting_facts(client, stranger, db):
    from planner.jobs import retain_history
    from planner.models import Activity, SystemSetting

    user = client.get("/api/v1/auth/me").json()["user"]["id"]
    other = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    tasks = [create(client, "tasks", status="done") for _ in range(3)]
    foreign = create(stranger, "tasks", status="done")
    for index, row in enumerate(tasks):
        db.get(Task, row["id"]).completed_at = now() - timedelta(days=index + 3)
    db.get(Task, foreign["id"]).completed_at = now() - timedelta(days=20)
    db.add(SystemSetting(key="history_limit", value={"limit": 2}))
    db.add(Activity(user_id=user, kind="task.completed", entity_id=tasks[-1]["id"]))
    db.commit()
    retain_history(db, SimpleNamespace(user_id=user))
    assert db.get(Task, tasks[-1]["id"]).archived_at
    assert db.get(Task, tasks[0]["id"]).archived_at is None
    assert db.get(Task, foreign["id"]).archived_at is None
    db.get(User, user).preferences = {"history_retention_days": 1}
    db.commit()
    retain_history(db, SimpleNamespace(user_id=user))
    assert all(db.get(Task, row["id"]).archived_at for row in tasks)
    assert db.scalar(select(Activity.id).where(Activity.user_id == user))
    assert db.get(User, other)


def test_rest_planning_is_future_only_cancelable_and_never_creates_activity(client):
    from zoneinfo import ZoneInfo

    habit = create(client, "habits", timezone="Asia/Ho_Chi_Minh")
    today = now().astimezone(ZoneInfo(habit["timezone"])).date()
    url = "/api/v1/habits/" + habit["id"] + "/checkin"
    assert client.put(url, json={"day": today.isoformat(), "state": "rest"}).status_code == 422
    for state in ("rest", "rest", "clear", "clear"):
        assert (
            client.put(
                url, json={"day": (today + timedelta(days=1)).isoformat(), "state": state}
            ).status_code
            == 200
        )
    assert client.get(f"/api/v1/activity?start={today}&end={today}").json() == []
    assert client.put(url, json={"day": today.isoformat(), "state": "done"}).status_code == 200
    assert (
        client.patch(
            "/api/v1/habits/" + habit["id"], json={"version": 1, "fields": {"frequency": "weekly"}}
        ).status_code
        == 422
    )
    alias = client.patch(
        "/api/v1/habits/" + habit["id"], json={"version": 1, "fields": {"timezone": "Asia/Saigon"}}
    )
    assert alias.status_code == 200 and alias.json()["timezone"] == "Asia/Ho_Chi_Minh"


def test_missing_admin_target_is_404_and_an_invitation_is_consumed_once(client, stranger, db):
    user = client.get("/api/v1/auth/me").json()["user"]["id"]
    db.get(User, user).role = "admin"
    db.commit()
    assert client.put("/api/v1/admin/users/missing/lock", json={"locked": True}).status_code == 404
    assert stranger.put("/api/v1/admin/history", json={"limit": 1}).status_code == 404
    assert (
        client.put(
            "/api/v1/admin/registration",
            json={"mode": "invitation", "invitations": ["invited@example.com"]},
        ).status_code
        == 200
    )
    from fastapi.testclient import TestClient

    from planner.main import app

    with TestClient(app, headers={"origin": "http://localhost:3000"}) as invited:
        assert (
            invited.post(
                "/api/v1/auth/register",
                json={"email": "blocked@example.com", "password": PASSWORD, "name": "Blocked"},
            ).status_code
            == 403
        )
        assert (
            invited.post(
                "/api/v1/auth/register",
                json={"email": "invited@example.com", "password": PASSWORD, "name": "Invited"},
            ).status_code
            == 201
        )
    assert client.get("/api/v1/admin/state").json()["invitations"] == []


def test_reminders_progress_beyond_a_full_sent_page_and_silence_history(client, db, monkeypatch):
    from zoneinfo import ZoneInfo

    from planner.config import settings
    from planner.jobs import reminders
    from planner.models import Notification

    user_id = client.get("/api/v1/auth/me").json()["user"]["id"]
    timestamp = now() - timedelta(minutes=5)
    rows = [
        Task(user_id=user_id, title=f"Reminder {index}", reminder_at=timestamp)
        for index in range(205)
    ]
    db.add_all(rows)
    db.flush()
    for row in sorted(rows, key=lambda row: row.id)[:200]:
        db.add(
            Notification(
                user_id=user_id, key=f"reminder:{row.id}:{timestamp.isoformat()}", message=row.title
            )
        )
    cutoff = now().astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date() - timedelta(days=10)
    historical = Task(
        user_id=user_id, title="Historical overdue", due_date=cutoff, reminder_at=timestamp
    )
    db.add(historical)
    db.commit()
    monkeypatch.setattr(settings(), "smtp_host", "fake.smtp.invalid")
    for _ in range(3):
        reminders(db, SimpleNamespace(user_id=user_id))
    notices = list(db.scalars(select(Notification).where(Notification.user_id == user_id)))
    assert len(notices) == 205
    assert all(row.details.get("task_id") != historical.id for row in notices)
    assert (
        len(
            list(
                db.scalars(
                    select(Job).where(Job.user_id == user_id, Job.key.like("reminder-email:%"))
                )
            )
        )
        == 5
    )


def test_two_administrators_cannot_resolve_the_same_report_twice(client, stranger, db):
    from concurrent.futures import ThreadPoolExecutor

    from fastapi.testclient import TestClient

    from planner.main import app
    from planner.models import AdminAction

    first = client.get("/api/v1/auth/me").json()["user"]["id"]
    second = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    db.get(User, first).role = db.get(User, second).role = "admin"
    db.commit()
    with TestClient(app, headers={"origin": "http://localhost:3000"}) as reporter:
        account = reporter.post(
            "/api/v1/auth/register",
            json={"email": "reporter@example.com", "password": PASSWORD, "name": "Reporter"},
        ).json()
        reporter.headers["x-csrf-token"] = account["csrf"]
        result = reporter.post(
            "/api/v1/reports",
            json={"target": "owner@example.com", "reason": "A concrete concern needing review"},
        )
        assert result.status_code == 201
    path = "/api/v1/admin/reports/" + result.json()["id"] + "/resolve"

    def resolve(actor):
        return actor.post(path, json={"state": "dismissed"}).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(resolve, [client, stranger]))
    assert sorted(results) == [200, 409]
    assert (
        len(list(db.scalars(select(AdminAction).where(AdminAction.action == "Reviewed report"))))
        == 1
    )


def test_workspace_note_metadata_reads_are_batched_instead_of_per_note(client, db):
    from sqlalchemy import event

    from planner.db import engine
    from planner.models import Note

    user_id = client.get("/api/v1/auth/me").json()["user"]["id"]

    def add(count):
        db.add_all(Note(user_id=user_id, title=f"Owned note {index}") for index in range(count))
        db.commit()

    def read_count():
        calls = []

        def record(*args):
            calls.append(1)

        event.listen(engine(), "before_cursor_execute", record)
        try:
            result = client.get("/api/v1/workspace/snapshot")
            assert result.status_code == 200
            return len(calls), len(result.json()["notes"])
        finally:
            event.remove(engine(), "before_cursor_execute", record)

    add(5)
    small, _ = read_count()
    add(75)
    large, count = read_count()
    assert count == 80 and large <= small + 2


def test_cross_goal_prerequisites_complete_guard_and_archive_cleanup(client, stranger):
    area = create(client, "areas")
    first = create(client, "goals", area_id=area["id"])
    second = create(client, "goals", area_id=area["id"])
    before = create(client, "milestones", goal_id=first["id"])
    after = create(client, "milestones", goal_id=second["id"])
    url = f"/api/v1/milestones/{after['id']}/prerequisites"
    assert client.put(url, json={"version": 1, "ids": [before["id"]]}).status_code == 200
    assert (
        client.patch(
            f"/api/v1/milestones/{after['id']}",
            json={
                "version": 2,
                "fields": {"status": "done"},
            },
        ).status_code
        == 422
    )
    assert stranger.put(url, json={"version": 2, "ids": []}).status_code == 404
    assert (
        client.post(
            f"/api/v1/milestones/{before['id']}/archive",
            json={
                "version": 1,
                "include_contents": True,
            },
        ).status_code
        == 200
    )
    assert client.get(url).json() == []
    current = client.get(f"/api/v1/milestones/{after['id']}").json()
    assert current["version"] == 3
    completed = client.patch(
        f"/api/v1/milestones/{after['id']}",
        json={
            "version": 3,
            "fields": {"status": "done"},
        },
    )
    assert completed.status_code == 200
    another = create(client, "milestones", goal_id=first["id"])
    assert client.put(url, json={"version": 4, "ids": [another["id"]]}).status_code == 422


def test_notification_read_validates_identifiers_without_broadening_scope(client, stranger, db):
    from planner.models import Notification

    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    foreign = stranger.get("/api/v1/auth/me").json()["user"]["id"]
    mine, theirs = (
        Notification(user_id=owner, key="notice-mine", message="Mine"),
        Notification(user_id=foreign, key="notice-other", message="Other"),
    )
    db.add_all([mine, theirs])
    db.commit()
    assert client.post("/api/v1/notifications/read", json={"id": []}).status_code == 422
    assert client.post("/api/v1/notifications/read", json={"id": theirs.id}).status_code == 204
    db.expire_all()
    assert not db.get(Notification, theirs.id).read
    assert not db.get(Notification, mine.id).read
    assert client.post("/api/v1/notifications/read", json={"id": mine.id}).status_code == 204
    db.expire_all()
    assert db.get(Notification, mine.id).read


def test_goal_contribution_cycles_are_atomic_and_milestone_links_persist(client, stranger):
    area = create(client, "areas")
    first = create(client, "goals", area_id=area["id"])
    second = create(client, "goals", area_id=area["id"], related=[first["id"]])
    failed = client.patch(
        f"/api/v1/goals/{first['id']}",
        json={
            "version": 1,
            "fields": {"title": "Must roll back", "related": [second["id"]]},
        },
    )
    assert failed.status_code == 422
    kept = client.get(f"/api/v1/goals/{first['id']}").json()
    assert kept["title"] == first["title"] and kept["version"] == 1
    milestone = create(client, "milestones", goal_id=first["id"], related=[second["id"]])
    assert client.get(f"/api/v1/milestones/{milestone['id']}").json()["related"] == [second["id"]]
    assert stranger.get(f"/api/v1/milestones/{milestone['id']}").status_code == 404
