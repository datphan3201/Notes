"""Index owner-scoped Activity cursor queries."""

from alembic import op

revision = "0012"
down_revision = "0011"


def upgrade():
    op.create_index("activities_owner_cursor", "activities", ["user_id", "created_at", "id"])


def downgrade():
    op.drop_index("activities_owner_cursor", table_name="activities")
