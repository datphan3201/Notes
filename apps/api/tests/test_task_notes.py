import importlib.util
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import select

from planner.models import Note, Task


def test_task_notes_are_canonical_and_owner_links_include_masked_notes(client, stranger):
    task = client.post("/api/v1/tasks", json={"title": "Task context"}).json()
    document = {"type": "doc", "content": [{"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "One document"}]}]}
    row = client.post("/api/v1/notes", json={"title": "Task note", "task_id": task["id"], "document": document}).json()
    assert row["content"] == "One document" and row["task_id"] == task["id"]
    assert client.patch(f'/api/v1/tasks/{task["id"]}', json={"version": task["version"], "fields": {"working_note": "Separate copy"}}).status_code == 422
    assert "working_note" not in client.get(f'/api/v1/tasks/{task["id"]}').json()
    assert stranger.post("/api/v1/notes", json={"title": "Foreign", "task_id": task["id"]}).status_code == 404
    assert client.post(f'/api/v1/notes/{row["id"]}/password', json={"new_password": "note-password"}).status_code == 200
    snapshot = client.get("/api/v1/workspace/snapshot").json()
    assert snapshot["tasks"][0]["note_ids"] == [row["id"]]
    assert snapshot["notes"][0]["content"] == "" and "document" not in snapshot["notes"][0]
    assert "task_id" not in snapshot["notes"][0]
    other = stranger.get("/api/v1/workspace/snapshot").json()
    assert not other["tasks"] and not other["notes"]


def test_backfill_preserves_existing_notes_archives_and_is_idempotent(client, db):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    for key, archived in [("old-task", False), ("archived-task", True), ("duplicate-task", False)]:
        from planner.models import now
        db.add(Task(id=key, user_id=owner, title=key, working_note="Legacy checkbox\n- [ ] Next", archived_at=now() if archived else None))
    db.flush()
    db.add(Note(id="existing-match", user_id=owner, task_id="duplicate-task", title="Keep title", content="Legacy checkbox\n- [ ] Next", details={"document": {"type": "doc"}}))
    db.add(Note(id="existing-different", user_id=owner, task_id="old-task", title="Keep other", content="Different", lock_hash="keep-lock"))
    db.flush()
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0006_task_notes.py"
    spec = importlib.util.spec_from_file_location("task_notes_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    migration.op = SimpleNamespace(get_bind=lambda: db.connection())
    migration.upgrade()
    migration.upgrade()
    db.expire_all()
    notes = list(db.scalars(select(Note).where(Note.user_id == owner)))
    assert len(notes) == 4
    assert len([n for n in notes if n.task_id == "duplicate-task"]) == 1
    assert db.get(Note, "existing-match").title == "Keep title"
    assert db.get(Note, "existing-match").details["document"] == {"type": "doc"}
    assert db.get(Note, "existing-different").lock_hash == "keep-lock"
    assert next(n for n in notes if n.task_id == "archived-task").archived_at
    assert next(n for n in notes if n.task_id == "old-task" and n.id != "existing-different").content == "Legacy checkbox\n- [ ] Next"
