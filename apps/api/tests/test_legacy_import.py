import hashlib
import json

import pytest
from sqlalchemy import func, select

from planner.migrate_legacy import canonical, import_snapshot, user_id
from planner.models import Activity, ImportReceipt, Job, LegacyRecord, Note, User


def snapshot(tmp_path, **tables):
    root = tmp_path / "snapshot"
    root.mkdir()
    manifest = {"format": 1, "tables": {}, "files": {}}
    for name, rows in tables.items():
        path = root / (name + ".jsonl")
        data = "".join(canonical(row) + "\n" for row in rows).encode()
        path.write_bytes(data)
        manifest["tables"][name] = {
            "path": path.name,
            "rows": len(rows),
            "sha256": hashlib.sha256(data).hexdigest(),
        }
    (root / "manifest.json").write_text(json.dumps(manifest))
    return root


def legacy_user():
    return {
        "id": 1,
        "email": "legacy@example.com",
        "display_name": "Legacy",
        "password": "$2y$opaque-legacy-bcrypt",
        "created_at": "2026-11-01T12:00:00",
        "updated_at": "2026-11-01T12:00:00",
    }


def test_import_preserves_unknown_and_team_rows_and_replays(tmp_path, db):
    note = {
        "id": "a9ceef9d-bd66-49df-a243-9cbe50e4d49",
        "user_id": 1,
        "title": "Original",
        "content": "Private content",
        "created_at": "2026-11-01T12:00:00",
        "updated_at": "2026-11-01T12:00:00",
        "version": 7,
        "color": "mint",
        "lock_hash": "$2y$legacy-lock",
    }
    root = snapshot(
        tmp_path,
        users=[legacy_user()],
        notes=[note],
        team_messages=[{"id": "team-row", "body": "Preserve this team conversation"}],
    )
    first = import_snapshot(root, "planner_test")
    second = import_snapshot(root, "planner_test")
    assert not first["cutover_ready"] and second["replayed"]
    assert db.scalar(select(func.count()).select_from(User)) == 1
    migrated = db.scalar(select(Note))
    assert migrated.version == 7 and migrated.lock_hash == "$2y$legacy-lock"
    assert migrated.created_at.isoformat() == "2026-11-01T12:00:00+00:00"
    archived = db.scalar(select(LegacyRecord).where(LegacyRecord.source_table == "notes"))
    assert archived.payload["color"] == "mint"
    assert (
        db.scalar(select(LegacyRecord).where(LegacyRecord.source_table == "team_messages"))
        .payload["body"]
        .startswith("Preserve")
    )


def test_corrupt_snapshot_is_rejected_before_writes(tmp_path, db):
    root = snapshot(tmp_path, users=[legacy_user()])
    (root / "users.jsonl").write_text("{}\n")
    with pytest.raises(ValueError, match="checksum"):
        import_snapshot(root, "planner_test")
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_cross_owner_fk_aborts_the_entire_import(tmp_path, db):
    area = {
        "id": "area",
        "user_id": 1,
        "name": "Area",
        "description": "",
        "created_at": "2026-11-01T12:00:00",
        "updated_at": "2026-11-01T12:00:00",
    }
    goal = {
        **area,
        "id": "goal",
        "area_id": "missing-area",
        "parent_goal_id": None,
        "status": "Active",
    }
    root = snapshot(tmp_path, users=[legacy_user()], areas=[area], goals=[goal])
    from sqlalchemy.exc import IntegrityError

    with pytest.raises(IntegrityError):
        import_snapshot(root, "planner_test")
    assert db.scalar(select(func.count()).select_from(User)) == 0
    assert db.scalar(select(func.count()).select_from(LegacyRecord)) == 0


def test_import_rejects_live_database_name(tmp_path):
    root = snapshot(tmp_path, users=[])
    with pytest.raises(ValueError, match="restricted"):
        import_snapshot(root, "planner_dev")


def test_merge_preserves_existing_data_and_imports_activity_without_ai_jobs(tmp_path, db):
    db.add(User(id="existing", email="existing@example.com", name="Existing", password_hash="hash"))
    db.flush()
    db.add(
        Note(id="existing-note", user_id="existing", title="Keep", content="Original", version=9)
    )
    db.commit()
    root = snapshot(
        tmp_path,
        users=[legacy_user()],
        notes=[
            {
                "id": "legacy-note",
                "user_id": 1,
                "title": "Imported",
                "content": "Private",
                "created_at": "2026-11-01T12:00:00",
                "updated_at": "2026-11-01T12:00:00",
            }
        ],
        activities=[
            {
                "id": "legacy-activity",
                "user_id": 1,
                "source_type": "task",
                "source_id": "task",
                "action": "reversed",
                "occurred_at": "2026-11-01T12:00:00",
                "effective_date": "2026-11-01",
                "reversal_of_id": "original-completion",
            }
        ],
    )
    report = import_snapshot(root, "planner_test", merge_existing=True)
    assert report["existing"]["users"] == 1 and report["total_after"]["users"] == 2
    assert report["imported"]["users"] == report["imported"]["notes"] == 1
    assert report["imported"]["activities"] == 1
    assert db.get(Note, "existing-note").version == 9
    assert db.get(Note, "existing-note").content == "Original"
    assert db.get(Note, "legacy-note").user_id == user_id(1)
    activity = db.get(Activity, "legacy-activity")
    assert activity.kind == "task.reversed"
    assert activity.created_at.isoformat() == "2026-11-01T12:00:00+00:00"
    assert db.scalar(select(func.count()).select_from(Job)) == 0
    assert not report["indexing_queued"]
    assert import_snapshot(root, "planner_test", merge_existing=True)["replayed"]


def test_merge_email_collision_rejects_without_partial_writes(tmp_path, db):
    db.add(User(id="existing", email="LEGACY@example.com", name="Existing", password_hash="hash"))
    db.commit()
    root = snapshot(tmp_path, users=[legacy_user()])
    with pytest.raises(ValueError, match="conflicts"):
        import_snapshot(root, "planner_test", merge_existing=True)
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(func.count()).select_from(LegacyRecord)) == 0
    assert db.scalar(select(func.count()).select_from(ImportReceipt)) == 0


def test_merge_relation_failure_keeps_existing_data(tmp_path, db):
    from sqlalchemy.exc import IntegrityError

    db.add(User(id="existing", email="existing@example.com", name="Existing", password_hash="hash"))
    db.commit()
    root = snapshot(
        tmp_path,
        users=[legacy_user()],
        notes=[
            {
                "id": "bad-note",
                "user_id": 1,
                "goal_id": "missing-goal",
                "title": "Bad",
                "created_at": "2026-11-01T12:00:00",
                "updated_at": "2026-11-01T12:00:00",
            }
        ],
        note_links=[{"note_id": "bad-note", "goal_id": "missing-goal"}],
    )
    with pytest.raises(IntegrityError):
        import_snapshot(root, "planner_test", merge_existing=True)
    assert db.scalar(select(func.count()).select_from(User)) == 1
    assert db.scalar(select(func.count()).select_from(LegacyRecord)) == 0


def test_merge_flag_does_not_bypass_configured_database_guard(tmp_path):
    root = snapshot(tmp_path, users=[])
    with pytest.raises(ValueError, match="restricted"):
        import_snapshot(root, "planner_dev", merge_existing=True)


def test_legacy_task_working_text_becomes_a_linked_note(tmp_path, db):
    from planner.models import Task

    common = {"user_id": 1, "created_at": "2026-11-01T12:00:00", "updated_at": "2026-11-02T12:00:00"}
    root = snapshot(tmp_path, users=[legacy_user()],
        tasks=[{**common, "id": "legacy-task", "title": "Task title", "status": "NotStarted"}],
        task_notes=[{"task_id": "legacy-task", "body": "- [ ] Legacy task content"}],
        notes=[{**common, "id": "linked-note", "title": "Keep existing", "content": "Other content"}],
        note_links=[{"note_id": "linked-note", "task_id": "legacy-task", "goal_id": None}],
    )
    import_snapshot(root, "planner_test")
    notes = list(db.scalars(select(Note).where(Note.task_id == "legacy-task")))
    assert len(notes) == 1
    assert notes[0].content == "- [ ] Legacy task content"
    assert db.get(Task, "legacy-task").details["resource_note_ids"] == ["linked-note"]
    assert db.get(Note, "linked-note").task_id is None
    assert db.get(Task, "legacy-task").working_note == ""
    assert db.get(Note, "linked-note").title == "Keep existing"
