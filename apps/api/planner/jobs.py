import logging
import signal
import time
from datetime import timedelta

from sqlalchemy import and_, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from planner.ai import index_source, run_assistant
from planner.auth import lock_owner
from planner.config import settings
from planner.db import session_factory
from planner.domain import recurrence_dates
from planner.models import AIRun, Job, Notification, Task, TaskSeries, User, new_id, now
from planner.provider import CompatibleProvider

logger = logging.getLogger("planner.jobs")


def claim(factory, job_id=None):
    with factory() as db:
        statement = (
            select(Job)
            .where(
                or_(
                    and_(Job.status == "queued", Job.available_at <= now()),
                    and_(Job.status == "running", Job.lease_until < now()),
                )
            )
            .order_by(Job.available_at, Job.id)
            .with_for_update(skip_locked=True)
            .limit(1)
        )
        if job_id:
            statement = statement.where(Job.id == job_id)
        job = db.scalar(statement)
        if job is None:
            return None
        if job.attempts >= 5:
            job.status, job.error_code = "dead", "RETRY_EXHAUSTED"
            db.commit()
            return None
        job.status, job.attempts = "running", job.attempts + 1
        job.lease_until, job.lease_token = now() + timedelta(minutes=10), new_id()
        db.commit()
        return job


def finish(factory, job, error=None):
    with factory() as db:
        values = {"status": "completed", "lease_until": None, "error_code": None}
        if not error and job.kind == "email":
            values["payload"] = {}
        if error:
            values.update(
                status="dead" if job.attempts >= 5 else "queued",
                error_code=type(error).__name__,
                dispatched_at=None,
                available_at=now() + timedelta(seconds=min(300, 2**job.attempts)),
            )
        db.execute(
            update(Job).where(Job.id == job.id, Job.lease_token == job.lease_token).values(**values)
        )
        if error and job.kind == "assistant":
            run = db.get(AIRun, job.payload["id"])
            if run and run.status not in ("completed", "rejected"):
                run.status, run.error_code = (
                    ("failed" if job.attempts >= 5 else "queued"),
                    type(error).__name__,
                )
        db.commit()


def materialize(db, job):
    from planner.timezones import zone as ZoneInfo

    lock_owner(db, job.user_id)
    if db.get(User, job.user_id).locked_at:
        db.commit()
        return
    series_rows = db.scalars(
        select(TaskSeries).where(
            TaskSeries.user_id == job.user_id,
            TaskSeries.state == "active",
            TaskSeries.archived_at.is_(None),
        )
    ).all()
    for series in series_rows:
        today = now().astimezone(ZoneInfo(series.timezone)).date()
        horizon = today + timedelta(days=7)
        cursor = series.cursor or series.start_date - timedelta(days=1)
        dates = recurrence_dates(series, cursor, horizon, limit=35)
        for day in dates:
            from datetime import datetime

            from planner import planning

            template = dict((series.details or {}).get("template") or {})
            if template:
                planning.validate_relations(db, "tasks", job.user_id, template)
            payload = {
                "title": series.title,
                "content": series.content,
                "importance": series.importance,
                **template,
                "status": "todo",
                "series_id": series.id,
                "occurrence_date": day,
            }
            offset = day - series.start_date
            for name in ("start_date", "due_date"):
                value = template.get(name)
                payload[name] = (
                    datetime.fromisoformat(value).date() + offset
                    if value
                    else (day if name == "due_date" and not template else None)
                )
            for name in ("scheduled_at", "scheduled_end", "reminder_at"):
                value = template.get(name)
                if value:
                    local = datetime.fromisoformat(value).astimezone(ZoneInfo(series.timezone))
                    payload[name] = datetime.combine(
                        local.date() + offset, local.timetz(), ZoneInfo(series.timezone)
                    )
            columns = set(Task.__table__.columns.keys())
            payload["details"] = {
                key: value for key, value in payload.items() if key not in columns
            }
            payload = {key: value for key, value in payload.items() if key in columns}
            db.execute(
                insert(Task)
                .values(user_id=job.user_id, **payload)
                .on_conflict_do_nothing(index_elements=[Task.series_id, Task.occurrence_date])
            )
        if dates:
            series.cursor = dates[-1]
    db.commit()


def reminders(db, job):
    from planner.models import User
    from planner.planning import enqueue

    lock_owner(db, job.user_id)
    user = db.get(User, job.user_id)
    if user.locked_at or not user.preferences.get("show_reminders", True):
        db.commit()
        return
    from datetime import UTC

    from sqlalchemy import func

    from planner.timezones import zone as ZoneInfo

    cutoff = now().astimezone(ZoneInfo(user.timezone)).date() - timedelta(
        days=user.preferences.get("history_overdue_days", 3)
    )
    key_expression = (
        "reminder:v2:"
        + Task.id
        + ":"
        + func.to_char(func.timezone("UTC", Task.reminder_at), "YYYYMMDDHH24MISSUS")
    )
    already_sent = (
        select(Notification.id)
        .where(Notification.user_id == user.id, Notification.key == key_expression)
        .exists()
    )
    tasks = db.scalars(
        select(Task)
        .where(
            Task.user_id == user.id,
            Task.archived_at.is_(None),
            Task.status != "done",
            Task.reminder_at <= now(),
            or_(Task.due_date.is_(None), Task.due_date > cutoff),
            ~already_sent,
        )
        .order_by(Task.reminder_at, Task.id)
        .limit(200)
    ).all()
    for task in tasks:
        instant = task.reminder_at.astimezone(UTC)
        stamp = f"{instant.year:04d}{instant.month:02d}{instant.day:02d}{instant.hour:02d}{instant.minute:02d}{instant.second:02d}{instant.microsecond:06d}"
        key = f"reminder:v2:{task.id}:{stamp}"
        details = {"destination": "tasks", "task_id": task.id}
        legacy = db.scalar(
            select(Notification).where(
                Notification.user_id == user.id,
                Notification.key == f"reminder:{task.id}:{task.reminder_at.isoformat()}",
            )
        )
        if legacy:
            legacy.key, legacy.details = key, details
            continue
        inserted = db.scalar(
            insert(Notification)
            .values(user_id=user.id, key=key, message=task.title, details=details)
            .on_conflict_do_nothing(index_elements=[Notification.key])
            .returning(Notification.id)
        )
        if (
            inserted
            and user.preferences.get("email_notifications", True)
            and (settings().smtp_host or settings().resend_api_key.get_secret_value())
        ):
            enqueue(
                db,
                user.id,
                "email",
                f"reminder-email:{task.id}:{task.reminder_at.isoformat()}",
                {
                    "to": user.email,
                    "subject": "Planner — " + task.title,
                    "body": task.title + "\n" + settings().web_origin + "/tasks/" + task.id,
                    "category": "reminder",
                },
            )
    db.commit()


def process_one(factory=None, provider=None, job_id=None):
    factory = factory or session_factory()
    job = claim(factory, job_id)
    if job is None:
        return False
    try:
        if job.kind != "delete-file":
            with factory() as db:
                owner = db.get(User, job.user_id) if job.user_id else None
                category = job.payload.get("category") if job.kind == "email" else None
                muted = (
                    owner
                    and category
                    and (
                        not owner.preferences.get("email_notifications", True)
                        or (
                            category == "reminder"
                            and not owner.preferences.get("show_reminders", True)
                        )
                        or (
                            category == "sharing" and not owner.preferences.get("show_shares", True)
                        )
                    )
                )
                unavailable = owner is None or owner.locked_at
                if unavailable and job.kind == "assistant":
                    run = db.get(AIRun, job.payload["id"])
                    if run:
                        run.status, run.error_code = "failed", "ACCOUNT_UNAVAILABLE"
                        db.commit()
                if unavailable or muted:
                    finish(factory, job)
                    return True
        if job.kind == "assistant":
            run_assistant(job, factory, provider or CompatibleProvider())
        else:
            with factory() as db:
                if job.kind == "index":
                    configured = bool(
                        settings().ai_api_key.get_secret_value() and settings().ai_model
                    )
                    index_source(
                        db, job, provider or (CompatibleProvider() if configured else None)
                    )
                elif job.kind == "recurrence":
                    materialize(db, job)
                elif job.kind == "reminders":
                    reminders(db, job)
                elif job.kind == "retention":
                    retain_history(db, job)
                elif job.kind == "delete-file":
                    from planner.storage import remove

                    remove(job.payload["key"])
                elif job.kind == "email":
                    from planner.accounts import send_email

                    db.rollback()
                    send_email(job.payload, delivery_key=job.id)
                else:
                    raise ValueError("Unknown job kind")
        finish(factory, job)
    except (KeyboardInterrupt, SystemExit) as exc:
        finish(factory, job, exc)
        raise
    except Exception as exc:
        logger.warning("job_failed", extra={"job_id": job.id, "error_code": type(exc).__name__})
        finish(factory, job, exc)
    return True


def schedule(factory=None):
    from planner.models import User
    from planner.planning import enqueue

    factory = factory or session_factory()
    # Bounded owner pages avoid loading every account at once.
    cursor = ""
    while True:
        with factory() as db:
            owners = db.scalars(
                select(User.id)
                .where(User.id > cursor, User.locked_at.is_(None))
                .order_by(User.id)
                .limit(200)
            ).all()
            if not owners:
                break
            slot = now().strftime("%Y-%m-%dT%H:%M")
            for owner in owners:
                for kind in ("recurrence", "reminders"):
                    enqueue(db, owner, kind, f"{kind}:{owner}:{slot}", {})
                enqueue(
                    db, owner, "retention", f"retention:{owner}:{now().strftime('%Y-%m-%dT%H')}", {}
                )
            db.commit()
            cursor = owners[-1]


def worker():
    from planner.observability import configure_logging

    configure_logging()
    # Background shells can inherit ignored SIGINT; watchers must be able to stop us.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    last_schedule = 0.0
    while True:
        if time.monotonic() - last_schedule >= 60:
            schedule()
            last_schedule = time.monotonic()
        if not process_one():
            time.sleep(1)


def retain_history(db, job):
    """Archive history after its retention window or cap, preserving Tasks and facts."""
    from datetime import datetime
    from datetime import time as day_time

    from sqlalchemy import delete

    from planner.models import Document, SystemSetting, User
    from planner.timezones import zone as ZoneInfo

    lock_owner(db, job.user_id)
    user = db.get(User, job.user_id)
    if user.locked_at:
        db.commit()
        return
    stamp = now()
    zone = ZoneInfo(user.timezone)
    completed = stamp - timedelta(hours=user.preferences.get("history_completed_hours", 24))
    overdue = stamp.astimezone(zone).date() - timedelta(
        days=user.preferences.get("history_overdue_days", 3)
    )
    retention = user.preferences.get("history_retention_days")
    policy = db.get(SystemSetting, "history_limit")
    cap = policy.value.get("limit", 1000) if policy else 1000
    rows = list(
        db.scalars(
            select(Task).where(
                Task.user_id == user.id,
                Task.archived_at.is_(None),
                or_(
                    and_(Task.status == "done", Task.completed_at <= completed),
                    and_(Task.status != "done", Task.due_date <= overdue),
                ),
            )
        )
    )
    rows.sort(
        key=lambda task: (
            task.completed_at or datetime.combine(task.due_date, day_time.min, zone),
            task.id,
        ),
        reverse=True,
    )
    expired = [
        task.id
        for index, task in enumerate(rows)
        if index >= cap
        or (
            retention is not None
            and (
                (
                    task.status == "done"
                    and task.completed_at <= completed - timedelta(days=retention)
                )
                or (task.status != "done" and task.due_date <= overdue - timedelta(days=retention))
            )
        )
    ]
    if expired:
        db.execute(
            update(Task)
            .where(Task.user_id == user.id, Task.id.in_(expired))
            .values(archived_at=stamp, updated_at=stamp, version=Task.version + 1)
        )
        db.execute(
            delete(Document).where(
                Document.user_id == user.id,
                Document.source_kind == "tasks",
                Document.source_id.in_(expired),
            )
        )
    db.commit()


if __name__ == "__main__":
    worker()
