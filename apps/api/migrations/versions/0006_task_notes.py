"""Move legacy Task working text into canonical linked Notes without overwriting Notes."""

from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade():
    connection = op.get_bind()
    tasks = sa.table("tasks", sa.column("id"), sa.column("user_id"), sa.column("title"),
                     sa.column("working_note"), sa.column("created_at"), sa.column("updated_at"),
                     sa.column("archived_at"))
    notes = sa.table("notes", sa.column("id"), sa.column("user_id"), sa.column("title"),
                     sa.column("content"), sa.column("importance"), sa.column("version"),
                     sa.column("created_at"), sa.column("updated_at"), sa.column("archived_at"),
                     sa.column("details", sa.JSON), sa.column("color"), sa.column("pinned"),
                     sa.column("tags", sa.JSON), sa.column("task_id"))
    for task in connection.execute(sa.select(tasks).where(tasks.c.working_note != "")).mappings():
        exists = connection.scalar(sa.select(notes.c.id).where(
            notes.c.user_id == task["user_id"], notes.c.task_id == task["id"],
            notes.c.content == task["working_note"],
        ).limit(1))
        if exists:
            continue
        connection.execute(notes.insert().values(
            id=str(uuid5(NAMESPACE_URL, "planner:task-note:" + task["id"])),
            user_id=task["user_id"], task_id=task["id"], title=task["title"],
            content=task["working_note"], importance=3, version=1,
            created_at=task["created_at"], updated_at=task["updated_at"],
            archived_at=task["archived_at"], details={}, color="neutral", pinned=False, tags=[],
        ))


def downgrade():
    # User edits may have happened since conversion. Keep both Notes and legacy text.
    pass
