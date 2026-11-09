"""Enforce owner-scoped Area names without changing existing user titles."""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"

# Keep this expression identical to the model index and service normalization.
NAME_KEY = r"lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))"


def upgrade():
    connection = op.get_bind()
    duplicates = connection.execute(sa.text(f"""
        SELECT user_id, array_agg(id ORDER BY id) AS ids
        FROM areas GROUP BY user_id, {NAME_KEY} HAVING count(*) > 1
    """)).mappings().all()
    if duplicates:
        # Fail before any schema mutation. An operator must let the owner choose
        # which names to change; never merge, rename or delete their records.
        details = "; ".join(f"owner={row['user_id']} area_ids={','.join(row['ids'])}" for row in duplicates)
        raise RuntimeError("Duplicate Area names: rename these Areas before retrying migration 0008: " + details)
    op.create_index("areas_owner_name_unique", "areas", ["user_id", sa.text(NAME_KEY)], unique=True)


def downgrade():
    op.drop_index("areas_owner_name_unique", table_name="areas")
