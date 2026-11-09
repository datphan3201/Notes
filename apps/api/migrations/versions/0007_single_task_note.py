"""Keep one attached Note per Task and preserve additional Notes as resource links."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"


def upgrade():
    connection = op.get_bind()
    tasks = sa.table("tasks", sa.column("id"), sa.column("details", sa.JSON))
    notes = sa.table("notes", sa.column("id"), sa.column("task_id"))
    rows = connection.execute(sa.text("""
        SELECT n.id, n.task_id, t.details
        FROM notes n JOIN tasks t ON t.id = n.task_id AND t.user_id = n.user_id
        ORDER BY n.task_id, (n.archived_at IS NOT NULL),
            CASE WHEN t.working_note <> '' AND n.content = t.working_note THEN 0 ELSE 1 END,
            n.created_at, n.id
    """)).mappings()
    groups = {}
    for row in rows:
        groups.setdefault(row["task_id"], []).append(row)
    for task_id, linked in groups.items():
        details = dict(linked[0]["details"] or {})
        resources = [note_id for note_id in details.get("resource_note_ids", []) if note_id != linked[0]["id"]]
        for row in linked[1:]:
            if row["id"] not in resources:
                resources.append(row["id"])
            connection.execute(notes.update().where(notes.c.id == row["id"]).values(task_id=None))
        if resources or "resource_note_ids" in details:
            details["resource_note_ids"] = resources
            connection.execute(tasks.update().where(tasks.c.id == task_id).values(details=details))
    op.create_unique_constraint("notes_one_per_task", "notes", ["task_id"])


def downgrade():
    op.drop_constraint("notes_one_per_task", "notes", type_="unique")
    # Resource links remain intact; never duplicate or overwrite user-edited Notes.
