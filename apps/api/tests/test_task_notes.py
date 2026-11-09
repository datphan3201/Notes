import importlib.util
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import select, text

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
    # Recreate revision 0006 inside this isolated test transaction; rollback restores the constraint.
    db.execute(text("ALTER TABLE notes DROP CONSTRAINT notes_one_per_task"))
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


def test_one_attached_note_and_many_independent_resources(client, stranger):
    task = client.post("/api/v1/tasks", json={"title": "One attached note"}).json()
    first = client.post("/api/v1/notes", json={"title": "Attached", "task_id": task["id"]}).json()
    assert client.post("/api/v1/notes", json={"title": "Second", "task_id": task["id"]}).status_code == 409
    resources = [client.post("/api/v1/notes", json={"title": f"Resource {i}", "content": "Keep body"}).json() for i in range(2)]
    path = f'/api/v1/tasks/{task["id"]}'
    updated = client.patch(path, json={"version": task["version"], "fields": {"resource_note_ids": [r["id"] for r in resources]}})
    assert updated.status_code == 200, updated.text
    assert updated.json()["resource_note_ids"] == [r["id"] for r in resources]
    for resource in resources:
        row = client.get(f'/api/v1/notes/{resource["id"]}').json()
        assert row["task_id"] is None and row["content"] == "Keep body"
    other_task = client.post("/api/v1/tasks", json={"title": "Reuse resource", "resource_note_ids": [resources[0]["id"]]}).json()
    assert other_task["resource_note_ids"] == [resources[0]["id"]]
    foreign = stranger.post("/api/v1/notes", json={"title": "Private"}).json()
    denied = client.patch(path, json={"version": updated.json()["version"], "fields": {"title": "Must roll back", "resource_note_ids": [foreign["id"]]}})
    assert denied.status_code == 404
    assert client.get(path).json()["title"] == "One attached note"
    self_link = client.patch(path, json={"version": updated.json()["version"], "fields": {"resource_note_ids": [first["id"]]}})
    assert self_link.status_code == 422
    extra = client.post("/api/v1/notes", json={"title": "Unattached"}).json()
    assert client.patch(f'/api/v1/notes/{extra["id"]}', json={"version": extra["version"], "fields": {"task_id": task["id"]}}).status_code == 409
    removed = client.post("/api/v1/workspace/changes", json={"changes": [{"action": "delete", "kind": "notes", "id": resources[0]["id"], "version": resources[0]["version"]}]})
    assert removed.status_code == 200, removed.text
    assert resources[0]["id"] not in client.get(path).json()["resource_note_ids"]
    assert client.get(f'/api/v1/tasks/{other_task["id"]}').json()["resource_note_ids"] == []


def test_single_note_migration_preserves_extras_as_resources(client, db):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    db.execute(text("ALTER TABLE notes DROP CONSTRAINT notes_one_per_task"))
    db.add(Task(id="multi-task", user_id=owner, title="Task", working_note="Original task text", details={"other_setting": True}))
    db.flush()
    db.add_all([
        Note(id="old-resource", user_id=owner, task_id="multi-task", title="Keep resource", content="Other text", lock_hash="keep-lock", details={"document": {"type": "doc"}}),
        Note(id="working-copy", user_id=owner, task_id="multi-task", title="Working", content="Original task text"),
    ])
    db.flush()
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0007_single_task_note.py"
    spec = importlib.util.spec_from_file_location("single_note_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    migration.op = Operations(MigrationContext.configure(db.connection()))
    migration.upgrade()
    db.expire_all()
    assert db.get(Note, "working-copy").task_id == "multi-task"
    preserved = db.get(Note, "old-resource")
    assert preserved.task_id is None and preserved.content == "Other text"
    assert preserved.lock_hash == "keep-lock" and preserved.details["document"] == {"type": "doc"}
    assert db.get(Task, "multi-task").details == {"other_setting": True, "resource_note_ids": ["old-resource"]}
