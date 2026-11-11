"""Index active recurrence series and unfinished Task reminders."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"


def upgrade():
    op.create_index(
        "tasks_due_reminder", "tasks", ["reminder_at", "user_id"],
        postgresql_where=sa.text("archived_at IS NULL AND status <> 'done' AND reminder_at IS NOT NULL"),
    )
    op.create_index(
        "task_series_active_owner", "task_series", ["user_id"],
        postgresql_where=sa.text("archived_at IS NULL AND state = 'active'"),
    )


def downgrade():
    op.drop_index("task_series_active_owner", table_name="task_series")
    op.drop_index("tasks_due_reminder", table_name="tasks")
