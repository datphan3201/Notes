"""Persist baseline appearance, note colors and completion instants.

Revision ID: 0002
"""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade():
    op.add_column("users", sa.Column("preferences", sa.JSON(), nullable=False, server_default="{}"))
    op.add_column(
        "notes", sa.Column("color", sa.String(20), nullable=False, server_default="neutral")
    )
    op.add_column("tasks", sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True))
    connection = op.get_bind()
    # Restore only supported settings from the immutable archive, without replacing other data.
    allowed = {
        "visual_theme",
        "show_background",
        "show_illustrations",
        "show_quote",
        "custom_quote",
        "background_color",
        "notes_view",
        "history_completed_hours",
        "history_overdue_days",
    }
    users = sa.table("users", sa.column("id"), sa.column("preferences", sa.JSON()))
    for record in connection.execute(
        sa.text("SELECT payload FROM legacy_records WHERE source_table = 'user_preferences'")
    ):
        row = record[0]
        preferences = {
            key: value for key, value in row.items() if key in allowed and value is not None
        }
        for key in ("show_background", "show_illustrations", "show_quote"):
            if key in preferences:
                preferences[key] = bool(preferences[key])
        owner = str(uuid5(NAMESPACE_URL, f"datphan3201/Notes:user:{row['user_id']}"))
        connection.execute(
            users.update().where(users.c.id == owner).values(preferences=preferences)
        )
    for record in connection.execute(
        sa.text("SELECT payload FROM legacy_records WHERE source_table = 'notes'")
    ):
        row = record[0]
        if row.get("color") in ("neutral", "lemon", "mint", "sky", "rose"):
            connection.execute(
                sa.text("UPDATE notes SET color = :color WHERE id = :id"),
                {"color": row["color"], "id": row["id"]},
            )
    for record in connection.execute(
        sa.text("SELECT payload FROM legacy_records WHERE source_table = 'tasks'")
    ):
        row = record[0]
        if row.get("completed_at"):
            stamp = datetime.fromisoformat(row["completed_at"])
            stamp = stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)
            connection.execute(
                sa.text("UPDATE tasks SET completed_at = :stamp WHERE id = :id"),
                {"stamp": stamp, "id": row["id"]},
            )


def downgrade():
    raise RuntimeError("Restore a verified backup rather than destroying user preferences")
