"""Persist approved workspace fields, private account images and moderation.

Revision ID: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"


def upgrade():
    for name in (
        "areas",
        "goals",
        "milestones",
        "tasks",
        "notes",
        "habits",
        "reviews",
        "task_series",
    ):
        op.add_column(
            name,
            sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        )
    op.add_column(
        "users",
        sa.Column("profile", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    op.add_column("users", sa.Column("role", sa.String(10), nullable=False, server_default="user"))
    op.add_column(
        "users", sa.Column("email_mfa", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column(
        "note_shares", sa.Column("status", sa.String(10), nullable=False, server_default="accepted")
    )
    from planner.models import AccountFile, AdminAction, Report, SystemSetting

    for model in (AccountFile, Report, AdminAction, SystemSetting):
        model.__table__.create(op.get_bind())


def downgrade():
    raise RuntimeError("Restore a verified backup; do not discard personal workspace data")
