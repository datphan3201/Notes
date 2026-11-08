from alembic import context
from sqlalchemy.schema import CreateSchema

from planner import models  # noqa: F401
from planner.config import settings
from planner.db import Base, engine

with engine().connect() as connection:
    schema = settings().database_schema
    connection.execute(CreateSchema(schema, if_not_exists=True))
    connection.commit()
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        version_table_schema=schema,
        # Reflection normalizes the search-path schema to None; this is Alembic's own table.
        include_name=lambda name, type_, parents: type_ != "table" or name != "alembic_version",
    )
    with context.begin_transaction():
        context.run_migrations()
