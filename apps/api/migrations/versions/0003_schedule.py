"""Keep scheduled intervals and imported notification preferences.

Revision ID: 0003
"""

from datetime import UTC, datetime
from uuid import NAMESPACE_URL, uuid5

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"


def upgrade():
    op.add_column("tasks", sa.Column("scheduled_end", sa.DateTime(timezone=True), nullable=True))
    connection = op.get_bind()
    for record in connection.execute(
        sa.text("SELECT payload FROM legacy_records WHERE source_table = 'tasks'")
    ):
        row = record[0]
        if row.get("scheduled_end"):
            stamp = datetime.fromisoformat(row["scheduled_end"])
            stamp = stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)
            connection.execute(
                sa.text("UPDATE tasks SET scheduled_end = :stamp WHERE id = :id"),
                {"stamp": stamp, "id": row["id"]},
            )
    connection.execute(
        sa.text(
            "ALTER TABLE tasks ADD CONSTRAINT tasks_schedule_interval CHECK (scheduled_end IS NULL OR (scheduled_at IS NOT NULL AND scheduled_end > scheduled_at))"
        )
    )
    # These settings were retained in the raw export, never reset to a guessed value.
    users = sa.table("users", sa.column("id"), sa.column("preferences", sa.JSON()))
    for record in connection.execute(
        sa.text("SELECT payload FROM legacy_records WHERE source_table = 'user_preferences'")
    ):
        row = record[0]
        owner = str(uuid5(NAMESPACE_URL, f"datphan3201/Notes:user:{row['user_id']}"))
        current = connection.scalar(sa.select(users.c.preferences).where(users.c.id == owner))
        if current is None:
            continue
        values = {
            key: bool(row[key])
            for key in ("notifications_enabled", "email_notifications")
            if row.get(key) is not None
        }
        connection.execute(
            users.update().where(users.c.id == owner).values(preferences={**current, **values})
        )


def downgrade():
    raise RuntimeError("Restore a verified backup rather than losing scheduling data")
