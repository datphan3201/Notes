from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import select, text

from planner.models import Task, TaskSeries


@pytest.mark.parametrize("status", ["doing", "blocked"])
def test_tasks_and_repeating_templates_reject_removed_states(client, status):
    assert client.post("/api/v1/tasks", json={"title": "Task", "status": status}).status_code == 422
    row = client.post("/api/v1/tasks", json={"title": "Task"}).json()
    response = client.patch(f'/api/v1/tasks/{row["id"]}', json={"version": row["version"], "fields": {"status": status}})
    assert response.status_code == 422
    assert client.get(f'/api/v1/tasks/{row["id"]}').json()["status"] == "todo"
    response = client.post("/api/v1/task-series", json={"title": "Series", "frequency": "daily", "start_date": "2026-11-01", "template": {"title": "Task", "status": status}})
    assert response.status_code == 422


def test_binary_migration_preserves_completion_and_normalizes_templates(client, db):
    rows = [client.post("/api/v1/tasks", json={"title": status, "status": "done" if status == "done" else "todo"}).json() for status in ["doing", "blocked", "done"]]
    series = client.post("/api/v1/task-series", json={"title": "Series", "frequency": "daily", "start_date": "2026-11-01", "template": {"title": "Occurrence"}}).json()
    done = db.get(Task, rows[2]["id"])
    completed_at = done.completed_at
    db.execute(text("ALTER TABLE tasks DROP CONSTRAINT tasks_binary_status"))
    db.execute(text("ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','doing','blocked','done'))"))
    for row, status in zip(rows, ["doing", "blocked", "done"], strict=True):
        db.execute(text("UPDATE tasks SET status=:status WHERE id=:id"), {"status": status, "id": row["id"]})
    record = db.get(TaskSeries, series["id"])
    record.details = {**record.details, "template": {**record.details["template"], "status": "blocked"}}
    db.flush()
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0009_binary_tasks.py"
    spec = spec_from_file_location("binary_tasks_migration", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    with Operations.context(MigrationContext.configure(db.connection())):
        migration.upgrade()
    db.expire_all()
    tasks = [db.get(Task, row["id"]) for row in rows]
    assert [task.status for task in tasks] == ["todo", "todo", "done"]
    assert [task.version for task in tasks] == [row["version"] for row in rows]
    assert tasks[2].completed_at == completed_at
    assert [task.title for task in tasks] == ["doing", "blocked", "done"]
    assert db.get(TaskSeries, series["id"]).details["template"]["status"] == "todo"
    assert len(db.scalars(select(Task)).all()) == 3
    constraints = db.execute(text("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='tasks'::regclass AND conname='tasks_binary_status'")).scalars().all()
    assert len(constraints) == 1 and "doing" not in constraints[0] and "blocked" not in constraints[0]
    db.commit()
