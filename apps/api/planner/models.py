from datetime import UTC, date, datetime
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    text as sql_text,
)
from sqlalchemy.orm import Mapped, mapped_column

from planner.db import Base
from planner.timezones import DEFAULT_TIMEZONE


def now():
    return datetime.now(UTC)


def new_id():
    return str(uuid4())


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(80), default=DEFAULT_TIMEZONE)
    locale: Mapped[str] = mapped_column(String(5), default="vi")
    theme: Mapped[str] = mapped_column(String(20), default="light")
    preferences: Mapped[dict] = mapped_column(JSON, default=dict)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    role: Mapped[str] = mapped_column(String(10), default="user")
    email_mfa: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    totp_secret: Mapped[str | None] = mapped_column(Text)
    totp_last_step: Mapped[int] = mapped_column(Integer, default=0)
    requires_mfa_reset: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    csrf: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuthToken(Base):
    __tablename__ = "auth_tokens"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    purpose: Mapped[str] = mapped_column(String(20))
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Owned:
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text, default="")
    importance: Mapped[int] = mapped_column(Integer, default=3)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


def owned_constraints(table):
    return (
        UniqueConstraint("user_id", "id"),
        CheckConstraint("importance BETWEEN 1 AND 5"),
        Index(f"{table}_owner_page", "user_id", "archived_at", "updated_at", "id"),
    )


class Area(Owned, Base):
    __tablename__ = "areas"
    __table_args__ = (
        *owned_constraints("areas"),
        Index("areas_owner_name_unique", "user_id",
              sql_text(r"lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))"), unique=True),
    )


class Goal(Owned, Base):
    __tablename__ = "goals"
    area_id: Mapped[str | None] = mapped_column(String(36))
    parent_goal_id: Mapped[str | None] = mapped_column(String(36))
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="active")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    completion_criteria: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        *owned_constraints("goals"),
        ForeignKeyConstraint(["user_id", "area_id"], ["areas.user_id", "areas.id"]),
        ForeignKeyConstraint(["user_id", "parent_goal_id"], ["goals.user_id", "goals.id"]),
        CheckConstraint("(area_id IS NULL) <> (parent_goal_id IS NULL)"),
    )


class Milestone(Owned, Base):
    __tablename__ = "milestones"
    goal_id: Mapped[str] = mapped_column(String(36))
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    completion_criteria: Mapped[str] = mapped_column(Text, default="")
    __table_args__ = (
        *owned_constraints("milestones"),
        ForeignKeyConstraint(["user_id", "goal_id"], ["goals.user_id", "goals.id"]),
    )


class Dependency(Base):
    __tablename__ = "milestone_dependencies"
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    milestone_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    prerequisite_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    __table_args__ = (
        ForeignKeyConstraint(["user_id", "milestone_id"], ["milestones.user_id", "milestones.id"]),
        ForeignKeyConstraint(
            ["user_id", "prerequisite_id"], ["milestones.user_id", "milestones.id"]
        ),
        CheckConstraint("milestone_id <> prerequisite_id"),
    )


class Task(Owned, Base):
    __tablename__ = "tasks"
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    goal_id: Mapped[str | None] = mapped_column(String(36))
    milestone_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(20), default="todo")
    start_date: Mapped[date | None] = mapped_column(Date)
    due_date: Mapped[date | None] = mapped_column(Date)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminder_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimated_minutes: Mapped[int | None] = mapped_column(Integer)
    checklist: Mapped[list] = mapped_column(JSON, default=list)
    working_note: Mapped[str] = mapped_column(Text, default="")
    expected_result: Mapped[str] = mapped_column(Text, default="")
    completion_criteria: Mapped[str] = mapped_column(Text, default="")
    series_id: Mapped[str | None] = mapped_column(ForeignKey("task_series.id"))
    occurrence_date: Mapped[date | None] = mapped_column(Date)
    __table_args__ = (
        *owned_constraints("tasks"),
        ForeignKeyConstraint(["user_id", "goal_id"], ["goals.user_id", "goals.id"]),
        ForeignKeyConstraint(["user_id", "milestone_id"], ["milestones.user_id", "milestones.id"]),
        CheckConstraint("goal_id IS NULL OR milestone_id IS NULL"),
        CheckConstraint("status IN ('todo','done')", name="tasks_binary_status"),
        CheckConstraint(
            "scheduled_end IS NULL OR (scheduled_at IS NOT NULL AND scheduled_end > scheduled_at)"
        ),
        UniqueConstraint("series_id", "occurrence_date"),
        Index("tasks_owner_due", "user_id", "due_date"),
        Index(
            "tasks_due_reminder", "reminder_at", "user_id",
            postgresql_where=sql_text("archived_at IS NULL AND status <> 'done' AND reminder_at IS NOT NULL"),
        ),
    )


class Note(Owned, Base):
    __tablename__ = "notes"
    color: Mapped[str] = mapped_column(String(20), default="neutral")
    lock_hash: Mapped[str | None] = mapped_column(Text)
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[list] = mapped_column(JSON, default=list)
    goal_id: Mapped[str | None] = mapped_column(String(36))
    task_id: Mapped[str | None] = mapped_column(String(36))
    __table_args__ = (
        *owned_constraints("notes"),
        UniqueConstraint("task_id", name="notes_one_per_task"),
        ForeignKeyConstraint(["user_id", "goal_id"], ["goals.user_id", "goals.id"]),
        ForeignKeyConstraint(["user_id", "task_id"], ["tasks.user_id", "tasks.id"]),
        CheckConstraint("goal_id IS NULL OR task_id IS NULL"),
    )


class NoteUnlock(Base):
    __tablename__ = "note_unlocks"
    token_hash: Mapped[str] = mapped_column(
        ForeignKey("login_sessions.token_hash", ondelete="CASCADE"), primary_key=True
    )
    note_id: Mapped[str] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    lock_hash: Mapped[str] = mapped_column(Text)


class NoteShare(Base):
    __tablename__ = "note_shares"
    note_id: Mapped[str] = mapped_column(
        ForeignKey("notes.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    can_edit: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(10), default="accepted")


class Habit(Owned, Base):
    __tablename__ = "habits"
    timezone: Mapped[str] = mapped_column(String(80), default=DEFAULT_TIMEZONE)
    frequency: Mapped[str] = mapped_column(String(10), default="daily")
    target: Mapped[int] = mapped_column(Integer, default=1)
    first_check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        *owned_constraints("habits"),
        CheckConstraint("frequency IN ('daily','weekly')"),
    )


class HabitDay(Base):
    __tablename__ = "habit_days"
    habit_id: Mapped[str] = mapped_column(
        ForeignKey("habits.id", ondelete="CASCADE"), primary_key=True
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    state: Mapped[str] = mapped_column(String(10))
    __table_args__ = (CheckConstraint("state IN ('done','rest')"),)


class Review(Owned, Base):
    __tablename__ = "reviews"
    period: Mapped[str] = mapped_column(String(10), default="daily")
    period_date: Mapped[date] = mapped_column(Date)
    snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    __table_args__ = (
        *owned_constraints("reviews"),
        UniqueConstraint("user_id", "period", "period_date"),
    )


class TaskSeries(Owned, Base):
    __tablename__ = "task_series"
    frequency: Mapped[str] = mapped_column(String(10))
    interval_count: Mapped[int] = mapped_column(Integer, default=1)
    weekdays: Mapped[list] = mapped_column(JSON, default=list)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    cursor: Mapped[date | None] = mapped_column(Date)
    next_materialize_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now, server_default=sql_text("now()")
    )
    state: Mapped[str] = mapped_column(String(10), default="active")
    timezone: Mapped[str] = mapped_column(String(80), default=DEFAULT_TIMEZONE)
    __table_args__ = (
        *owned_constraints("task_series"),
        CheckConstraint("state IN ('active','paused','ended')"),
        Index(
            "task_series_active_owner", "user_id",
            postgresql_where=sql_text("archived_at IS NULL AND state = 'active'"),
        ),
        Index(
            "task_series_materialize_due", "next_materialize_at", "id",
            postgresql_where=sql_text("archived_at IS NULL AND state = 'active'"),
        ),
    )


class Activity(Base):
    __tablename__ = "activities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    entity_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("activities_owner_cursor", "user_id", "created_at", "id"),)


class Attachment(Base):
    mime: Mapped[str] = mapped_column(String(80), default="application/octet-stream")
    __tablename__ = "attachments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    note_id: Mapped[str] = mapped_column(String(36))
    filename: Mapped[str] = mapped_column(String(200))
    storage_key: Mapped[str] = mapped_column(String(100), unique=True)
    size: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    __table_args__ = (ForeignKeyConstraint(["user_id", "note_id"], ["notes.user_id", "notes.id"]),)


class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    kind: Mapped[str] = mapped_column(String(30))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(200), unique=True)
    payload: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(10), default="queued")
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    lease_token: Mapped[str | None] = mapped_column(String(36))
    error_code: Mapped[str | None] = mapped_column(String(100))
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dispatch_generation: Mapped[int] = mapped_column(Integer, default=0)
    __table_args__ = (Index("jobs_claim", "status", "available_at"),)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    source_kind: Mapped[str] = mapped_column(String(20))
    source_id: Mapped[str] = mapped_column(String(36))
    source_version: Mapped[int] = mapped_column(Integer)
    chunk: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    content_hash: Mapped[str] = mapped_column(String(64))
    embedding: Mapped[list | None] = mapped_column(Vector(1536))
    embedding_model: Mapped[str | None] = mapped_column(String(100))
    __table_args__ = (
        UniqueConstraint("source_kind", "source_id", "chunk"),
        Index(
            "documents_fts",
            sql_text("to_tsvector('simple'::regconfig, text)"),
            postgresql_using="gin",
        ),
    )


class AIRun(Base):
    __tablename__ = "ai_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    prompt: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(15), default="queued")
    sources: Mapped[list] = mapped_column(JSON, default=list)
    proposal: Mapped[dict | None] = mapped_column(JSON)
    proposal_hash: Mapped[str | None] = mapped_column(String(64))
    proposal_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    model: Mapped[str] = mapped_column(String(100), default="")
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    reserved_tokens: Mapped[int] = mapped_column(Integer, default=16000)
    cost_usd: Mapped[float] = mapped_column(Float, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    error_code: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    __table_args__ = (Index("ai_runs_owner_date", "user_id", "created_at"),)


class Notification(Base):
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    __tablename__ = "notifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    key: Mapped[str] = mapped_column(String(200), unique=True)
    message: Mapped[str] = mapped_column(String(500))
    read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class RateBucket(Base):
    __tablename__ = "rate_buckets"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LegacyRecord(Base):
    """Immutable raw staging archive; never exposed through personal API routes."""

    __tablename__ = "legacy_records"
    source_table: Mapped[str] = mapped_column(String(100), primary_key=True)
    source_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON)
    checksum: Mapped[str] = mapped_column(String(64))


class ImportReceipt(Base):
    __tablename__ = "import_receipts"
    snapshot_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    report: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Focus(Base):
    __tablename__ = "focus_goals"
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    goal_id: Mapped[str | None] = mapped_column(String(36))
    __table_args__ = (ForeignKeyConstraint(["user_id", "goal_id"], ["goals.user_id", "goals.id"]),)


class TaskSelection(Base):
    __tablename__ = "task_selections"
    user_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    period: Mapped[str] = mapped_column(String(10), primary_key=True)
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    __table_args__ = (
        ForeignKeyConstraint(["user_id", "task_id"], ["tasks.user_id", "tasks.id"]),
        CheckConstraint("period IN ('daily','weekly')"),
    )


class AccountFile(Base):
    __tablename__ = "account_files"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    purpose: Mapped[str] = mapped_column(String(20))
    storage_key: Mapped[str] = mapped_column(String(500))
    mime: Mapped[str] = mapped_column(String(80))
    size: Mapped[int] = mapped_column(Integer)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    target_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    note_id: Mapped[str | None] = mapped_column(String(36))
    kind: Mapped[str] = mapped_column(String(10))
    target: Mapped[str] = mapped_column(String(320))
    snapshot: Mapped[str] = mapped_column(Text, default="")
    reason: Mapped[str] = mapped_column(Text)
    evidence: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(12), default="open")
    actions: Mapped[list] = mapped_column(JSON, default=list)
    reply: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AdminAction(Base):
    __tablename__ = "admin_actions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    action: Mapped[str] = mapped_column(String(100))
    subject: Mapped[str] = mapped_column(String(320))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SystemSetting(Base):
    __tablename__ = "system_settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
