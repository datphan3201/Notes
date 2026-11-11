"""Track the next recurrence materialization checkpoint."""

import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"


def upgrade():
    op.add_column(
        "task_series",
        sa.Column("next_materialize_at", sa.DateTime(timezone=True), nullable=False,
                  server_default=sa.text("now()")),
    )
    op.create_index(
        "task_series_materialize_due", "task_series", ["next_materialize_at", "id"],
        postgresql_where=sa.text("archived_at IS NULL AND state = 'active'"),
    )


def downgrade():
    op.drop_index("task_series_materialize_due", table_name="task_series")
    op.drop_column("task_series", "next_materialize_at")
