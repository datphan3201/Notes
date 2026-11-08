"""Personal planner schema and full-text index.

Revision ID: 0001
"""

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    ddl = Path(__file__).with_name("0001_schema.sql").read_text()
    for statement in ddl.split(";"):
        if statement.strip():
            op.execute(statement)


def downgrade():
    raise RuntimeError("Restore a verified backup; this migration does not destroy personal data")
