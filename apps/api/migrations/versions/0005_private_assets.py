"""Retain moderation evidence and queue account-file deletion after account removal."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"


def upgrade():
    op.add_column(
        "attachments",
        sa.Column("mime", sa.String(80), nullable=False, server_default="application/octet-stream"),
    )
    op.add_column(
        "notifications",
        sa.Column("details", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    op.alter_column("jobs", "user_id", nullable=True)
    op.alter_column("account_files", "user_id", nullable=True)
    for fk in sa.inspect(op.get_bind()).get_foreign_keys("account_files"):
        if fk["constrained_columns"] == ["user_id"]:
            op.drop_constraint(fk["name"], "account_files", type_="foreignkey")
    op.create_foreign_key(
        "account_files_owner", "account_files", "users", ["user_id"], ["id"], ondelete="SET NULL"
    )


def downgrade():
    raise RuntimeError("Restore a verified backup instead of discarding private asset metadata")
