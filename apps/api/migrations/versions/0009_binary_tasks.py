"""Collapse open Task states while retaining completion, content and relationships."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"


def upgrade():
    connection = op.get_bind()
    # Task checks were unnamed in the initial schema: inspect their generated name.
    for constraint in sa.inspect(connection).get_check_constraints("tasks"):
        if "status" in constraint["sqltext"]:
            op.drop_constraint(constraint["name"], "tasks", type_="check")
    # Open-state normalization preserves completion and existing document/job versions.
    connection.execute(sa.text("UPDATE tasks SET status = 'todo' WHERE status IN ('doing', 'blocked')"))
    series = sa.table("task_series", sa.column("id"), sa.column("details", sa.JSON))
    for row in connection.execute(sa.select(series)).mappings():
        details = dict(row["details"] or {})
        template = details.get("template")
        if template and template.get("status") in ("doing", "blocked"):
            details["template"] = {**template, "status": "todo"}
            connection.execute(series.update().where(series.c.id == row["id"]).values(details=details))
    op.create_check_constraint("tasks_binary_status", "tasks", "status IN ('todo','done')")


def downgrade():
    op.drop_constraint("tasks_binary_status", "tasks", type_="check")
    op.create_check_constraint("tasks_status_check", "tasks", "status IN ('todo','doing','blocked','done')")
    # Retain the user's current completion state; never invent previous open states.
