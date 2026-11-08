from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from planner.config import settings


class Base(DeclarativeBase):
    pass


@lru_cache
def engine():
    config = settings()
    return create_engine(
        config.database_url,
        pool_pre_ping=True,
        pool_size=config.pool_size,
        max_overflow=config.pool_overflow,
        pool_timeout=10,
        hide_parameters=True,
        connect_args={
            "options": f"-c timezone=UTC -c statement_timeout=15000 -c search_path={config.database_schema},extensions,public"
        },
    )


def session_factory():
    return sessionmaker(engine(), expire_on_commit=False)


def database():
    with Session(engine(), expire_on_commit=False) as db:
        yield db
