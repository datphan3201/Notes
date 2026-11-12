import logging
import queue
import signal
import threading
import time
from datetime import UTC, timedelta

from sqlalchemy import Date, and_, cast, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from planner.ai import index_source, run_assistant
from planner.auth import lock_owner
from planner.config import settings
from planner.db import session_factory
from planner.domain import next_materialization, recurrence_dates
from planner.models import (
    AIRun,
    Job,
    Notification,
    SystemSetting,
    Task,
    TaskSeries,
    User,
    new_id,
    now,
)
from planner.provider import CompatibleProvider

logger = logging.getLogger("planner.jobs")


def claim(factory, job_id=None, *, slow=None):
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
        if slow is not None:
            slow_kinds = ("assistant", "index")
            statement = statement.where(Job.kind.in_(slow_kinds) if slow else Job.kind.not_in(slow_kinds))
        if slow is not False:
            # Keep optional indexing queued without another polling round trip.
            pressure = select(SystemSetting.key).where(
                SystemSetting.key == "capacity:pressure",
                SystemSetting.value["pause_index"].as_boolean().is_(True),
            ).exists()
            statement = statement.where(or_(Job.kind != "index", ~pressure))
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
    from datetime import datetime

    from planner.timezones import zone as ZoneInfo

    lock_owner(db, job.user_id)
    if db.get(User, job.user_id).locked_at:
        db.commit()
        return
    query = select(TaskSeries).where(
            TaskSeries.user_id == job.user_id,
            TaskSeries.state == "active",
            TaskSeries.archived_at.is_(None),
        )
    payload = getattr(job, "payload", {})
    series_id = payload.get("series_id")
    if series_id:
        query = query.where(
            TaskSeries.id == series_id,
            TaskSeries.next_materialize_at == datetime.fromisoformat(payload["checkpoint"]),
        )
    series_rows = db.scalars(query).all()
    for series in series_rows:
        today = now().astimezone(ZoneInfo(series.timezone)).date()
        horizon = today + timedelta(days=7)
        cursor = series.cursor
        dates = recurrence_dates(series, cursor, horizon, limit=35)
        for day in dates:
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
        series.next_materialize_at = next_materialization(series)
    db.commit()


def pending_reminders(db, user, limit=200, *, task_id=None, reminder_at=None):
    from planner.timezones import zone as ZoneInfo

    if user.locked_at or not user.preferences.get("show_reminders", True):
        return []
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
    statement = (
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
        .limit(limit)
    )
    if task_id is not None:
        statement = statement.where(Task.id == task_id, Task.reminder_at == reminder_at)
    return db.scalars(statement).all()


def reminders(db, job):
    from datetime import datetime

    from planner.planning import enqueue

    lock_owner(db, job.user_id)
    user = db.get(User, job.user_id)
    payload = getattr(job, "payload", {})
    task_id = payload.get("task_id")
    reminder_at = datetime.fromisoformat(payload["reminder_at"]) if task_id else None
    tasks = pending_reminders(db, user, task_id=task_id, reminder_at=reminder_at)
    for task in tasks:
        instant = task.reminder_at.astimezone(UTC)
        stamp = f"{instant.year:04d}{instant.month:02d}{instant.day:02d}{instant.hour:02d}{instant.minute:02d}{instant.second:02d}{instant.microsecond:06d}"
        key = f"reminder:v2:{task.id}:{stamp}"
        details = {"destination": "tasks", "task_id": task.id, "reminder_at": instant.isoformat()}
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
            and (
                settings().smtp_host
                or settings().resend_api_key.get_secret_value()
                or settings().brevo_api_key.get_secret_value()
            )
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


def process_one(factory=None, provider=None, job_id=None, *, slow=None):
    factory = factory or session_factory()
    job = claim(factory, job_id, slow=slow)
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
                elif job.kind in ("reminders", "reminder-dispatch"):
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


def schedule_due_reminders(db, *, limit=200, compare=False):
    """Enqueue bounded actual reminder work; legacy reminder handlers remain valid."""
    from planner.planning import enqueue

    stamp = func.to_char(func.timezone("UTC", Task.reminder_at), "YYYYMMDDHH24MISSUS")
    receipt_key = "reminder:v2:" + Task.id + ":" + stamp
    job_key = "reminder-dispatch:" + Task.id + ":" + stamp
    sent = select(Notification.id).where(
        Notification.user_id == Task.user_id, Notification.key == receipt_key
    ).exists()
    queued = select(Job.id).where(Job.key == job_key).exists()
    overdue_days = func.coalesce(User.preferences["history_overdue_days"].as_integer(), 3)
    local_today = cast(func.timezone(User.timezone, now()), Date)
    rows = db.execute(
        select(Task.id, Task.user_id, Task.reminder_at)
        .join(User, User.id == Task.user_id)
        .where(
            User.locked_at.is_(None),
            func.coalesce(User.preferences["show_reminders"].as_boolean(), True),
            Task.archived_at.is_(None),
            Task.status != "done",
            Task.reminder_at <= now(),
            or_(Task.due_date.is_(None), Task.due_date > local_today - overdue_days),
            ~sent,
            ~queued,
        )
        .order_by(Task.reminder_at, Task.id)
        .limit(limit)
    ).all()
    if compare:
        return rows
    for task_id, owner_id, instant in rows:
        utc = instant.astimezone(UTC)
        key = f"reminder-dispatch:{task_id}:{utc:%Y%m%d%H%M%S%f}"
        enqueue(db, owner_id, "reminder-dispatch", key, {
            "task_id": task_id, "reminder_at": instant.isoformat(),
        })
    return len(rows)


def schedule_due_series(db, *, limit=200, compare=False):
    from planner.planning import enqueue

    stamp = func.to_char(func.timezone("UTC", TaskSeries.next_materialize_at), "YYYYMMDDHH24MISSUS")
    key = "recurrence:v2:" + TaskSeries.id + ":" + stamp
    existing = select(Job.id).where(Job.key == key).exists()
    rows = db.execute(
        select(TaskSeries.id, TaskSeries.user_id, TaskSeries.next_materialize_at)
        .join(User, User.id == TaskSeries.user_id)
        .where(
            User.locked_at.is_(None),
            TaskSeries.archived_at.is_(None),
            TaskSeries.state == "active",
            TaskSeries.next_materialize_at <= now(),
            ~existing,
        )
        .order_by(TaskSeries.next_materialize_at, TaskSeries.id)
        .limit(limit)
    ).all()
    if compare:
        return rows
    for series_id, owner_id, checkpoint in rows:
        stamp = checkpoint.astimezone(UTC).strftime("%Y%m%d%H%M%S%f")
        enqueue(db, owner_id, "recurrence", f"recurrence:v2:{series_id}:{stamp}", {
            "series_id": series_id, "checkpoint": checkpoint.isoformat(),
        })
    return len(rows)


def schedule_due_retention(db, *, limit=200):
    """Advance a bounded hourly account scan, enqueueing only real archival work."""
    from datetime import datetime

    from planner.planning import enqueue
    from planner.timezones import zone

    key = "scheduler:retention"
    db.execute(insert(SystemSetting).values(key=key, value={}).on_conflict_do_nothing())
    checkpoint = db.scalar(select(SystemSetting).where(SystemSetting.key == key).with_for_update(
        skip_locked=True
    ))
    if checkpoint is None:
        return 0
    stamp = now()
    state = checkpoint.value or {}
    if state.get("next_at") and datetime.fromisoformat(state["next_at"]) > stamp:
        return 0
    cursor = state.get("cursor", "")
    slot = state.get("slot") or stamp.strftime("%Y-%m-%dT%H")
    owners = db.scalars(
        select(User).where(User.id > cursor, User.locked_at.is_(None)).order_by(User.id).limit(limit)
    ).all()
    policy = db.get(SystemSetting, "history_limit")
    cap = policy.value.get("limit", 1000) if policy else 1000
    enqueued = 0
    for owner in owners:
        completed = stamp - timedelta(hours=owner.preferences.get("history_completed_hours", 24))
        overdue = stamp.astimezone(zone(owner.timezone)).date() - timedelta(
            days=owner.preferences.get("history_overdue_days", 3)
        )
        eligible = (
            Task.user_id == owner.id,
            Task.archived_at.is_(None),
            or_(
                and_(Task.status == "done", Task.completed_at <= completed),
                and_(Task.status != "done", Task.due_date <= overdue),
            ),
        )
        past_cap = db.scalar(select(Task.id).where(*eligible).offset(cap).limit(1)) is not None
        days = owner.preferences.get("history_retention_days")
        expired = days is not None and db.scalar(
            select(Task.id).where(
                *eligible,
                or_(
                    and_(Task.status == "done", Task.completed_at <= completed - timedelta(days=days)),
                    and_(Task.status != "done", Task.due_date <= overdue - timedelta(days=days)),
                ),
            ).limit(1)
        ) is not None
        if past_cap or expired:
            enqueue(db, owner.id, "retention", f"retention:v2:{owner.id}:{slot}", {})
            enqueued += 1
    if len(owners) == limit:
        checkpoint.value = {"cursor": owners[-1].id, "slot": slot}
    else:
        checkpoint.value = {"next_at": (stamp + timedelta(hours=1)).isoformat()}
    return enqueued


def compare_scheduler(db):
    """Compare bounded candidate identifiers without publishing account data."""
    from planner.timezones import zone

    due_reminders = schedule_due_reminders(db, limit=201, compare=True)
    due_series = schedule_due_series(db, limit=201, compare=True)
    old_reminders = set()
    old_series = set()
    cursor = ""
    while True:
        owners = db.scalars(select(User).where(
            User.id > cursor, User.locked_at.is_(None)
        ).order_by(User.id).limit(200)).all()
        if not owners:
            break
        for owner in owners:
            if len(old_reminders) < 201:
                for task in pending_reminders(db, owner, limit=201 - len(old_reminders)):
                    old_reminders.add(task.id)
        for series in db.scalars(select(TaskSeries).where(
            TaskSeries.user_id.in_([owner.id for owner in owners]),
            TaskSeries.state == "active",
            TaskSeries.archived_at.is_(None),
        )):
            if len(old_series) < 201 and recurrence_dates(
                series, series.cursor,
                now().astimezone(zone(series.timezone)).date() + timedelta(days=7), limit=1,
            ):
                old_series.add(series.id)
        cursor = owners[-1].id
    new_reminders = {row[0] for row in due_reminders}
    new_series = {row[0] for row in due_series}
    limited = max(len(old_reminders), len(old_series), len(due_reminders), len(due_series)) > 200
    logger.info("scheduler_comparison", extra={
        "reminder_mismatches": len(old_reminders ^ new_reminders),
        "series_mismatches": len(old_series ^ new_series),
        "batch_limited": limited,
    })
    return not limited and old_reminders == new_reminders and old_series == new_series


def record_scheduler_mode(db, mode):
    from datetime import datetime

    key = "scheduler:mode"
    db.execute(insert(SystemSetting).values(key=key, value={}).on_conflict_do_nothing())
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == key).with_for_update())
    state = dict(row.value or {})
    stamp = now()
    try:
        last_tick = datetime.fromisoformat(state["last_tick"]) if state.get("last_tick") else None
    except (TypeError, ValueError):
        last_tick = None
    interrupted = mode == "due" and (
        last_tick is None or not timedelta(0) <= stamp - last_tick <= timedelta(seconds=180)
    )
    if state.get("mode") != mode or interrupted:
        state = {"mode": mode, "since": stamp.isoformat()}
    if mode == "due":
        state["last_tick"] = stamp.isoformat()
        legacy_waiting = db.scalar(select(Job.id).where(
            Job.status.in_(["queued", "running"]),
            or_(
                Job.kind == "reminders",
                and_(Job.kind == "recurrence", Job.key.not_like("recurrence:v2:%")),
                and_(Job.kind == "retention", Job.key.not_like("retention:v2:%")),
            ),
        ).limit(1))
        if legacy_waiting:
            state.pop("legacy_drained_at", None)
        elif "legacy_drained_at" not in state:
            state["legacy_drained_at"] = stamp.isoformat()
    if state != row.value:
        row.value = state


def record_comparison(db, matched):
    from datetime import datetime

    key = "scheduler:comparison"
    db.execute(insert(SystemSetting).values(key=key, value={}).on_conflict_do_nothing())
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == key).with_for_update())
    mode_row = db.get(SystemSetting, "scheduler:mode")
    state = dict(row.value or {})
    stamp = now()
    try:
        last = datetime.fromisoformat(state["last_at"])
    except (KeyError, TypeError, ValueError):
        last = None
    continuous = last is not None and timedelta(0) <= stamp - last <= timedelta(seconds=180)
    generation = (mode_row.value or {}).get("since") if mode_row else None
    if not matched:
        state = {"matched": False, "last_at": stamp.isoformat(), "mode_since": generation}
    else:
        if not continuous or not state.get("matched") or state.get("mode_since") != generation:
            state = {"since": stamp.isoformat()}
        state.update(matched=True, last_at=stamp.isoformat(), mode_since=generation)
    row.value = state


def schedule(factory=None):
    """Serialize scheduler ticks and mode changes through one database row."""
    factory = factory or session_factory()
    with factory() as gate:
        key = "scheduler:desired"
        gate.execute(insert(SystemSetting).values(
            key=key, value={"mode": settings().scheduler_mode}
        ).on_conflict_do_nothing())
        row = gate.scalar(select(SystemSetting).where(SystemSetting.key == key).with_for_update())
        mode = (row.value or {}).get("mode")
        if mode not in ("legacy", "compare", "due"):
            raise ValueError("Invalid stored scheduler mode")
        _schedule_mode(factory, mode)
        gate.commit()


def _schedule_mode(factory, mode):
    from planner.models import User
    from planner.planning import enqueue
    from planner.timezones import zone as ZoneInfo

    with factory() as db:
        record_scheduler_mode(db, mode)
        db.commit()
    if mode == "compare":
        with factory() as db:
            matched = compare_scheduler(db)
            record_comparison(db, matched)
            db.commit()
    if mode == "due":
        with factory() as db:
            schedule_due_reminders(db)
            schedule_due_series(db)
            schedule_due_retention(db)
            db.commit()
        return
    # Bounded owner pages avoid loading every account at once.
    cursor = ""
    while True:
        with factory() as db:
            owners = db.scalars(
                select(User)
                .where(User.id > cursor, User.locked_at.is_(None))
                .order_by(User.id)
                .limit(200)
            ).all()
            if not owners:
                break
            slot = now().strftime("%Y-%m-%dT%H:%M")
            owner_ids = [owner.id for owner in owners]
            due_series = set()
            for series in db.scalars(select(TaskSeries).where(
                TaskSeries.user_id.in_(owner_ids),
                TaskSeries.state == "active",
                TaskSeries.archived_at.is_(None),
            )):
                if recurrence_dates(
                    series,
                    series.cursor,
                    now().astimezone(ZoneInfo(series.timezone)).date() + timedelta(days=7),
                    limit=1,
                ):
                    due_series.add(series.user_id)
            reminder_owners = set(db.scalars(select(Task.user_id).where(
                Task.user_id.in_(owner_ids),
                Task.archived_at.is_(None),
                Task.status != "done",
                Task.reminder_at <= now(),
            ).distinct()))
            for owner in owners:
                if owner.id in due_series:
                    enqueue(db, owner.id, "recurrence", f"recurrence:{owner.id}:{slot}", {})
                if owner.id in reminder_owners and pending_reminders(db, owner, limit=1):
                    enqueue(db, owner.id, "reminders", f"reminders:{owner.id}:{slot}", {})
                enqueue(
                    db, owner.id, "retention", f"retention:{owner.id}:{now().strftime('%Y-%m-%dT%H')}", {}
                )
            db.commit()
            cursor = owners[-1].id


def heartbeat(lane, factory=None):
    factory = factory or session_factory()
    with factory() as db:
        statement = insert(SystemSetting).values(
            key="worker:heartbeat:" + lane, value={"at": now().isoformat()}
        )
        db.execute(statement.on_conflict_do_update(
            index_elements=[SystemSetting.key], set_={"value": statement.excluded.value}
        ))
        db.commit()


def _scheduler_loop(stop):
    while not stop.is_set():
        schedule()
        heartbeat("scheduler")
        stop.wait(60)


def _poll_lane(stop, *, slow):
    idle_delay = 1.0
    last_heartbeat = float("-inf")
    while not stop.is_set():
        if time.monotonic() - last_heartbeat >= 60:
            heartbeat("slow" if slow else "fast")
            last_heartbeat = time.monotonic()
        if process_one(slow=slow):
            idle_delay = 1.0
        else:
            stop.wait(idle_delay)
            idle_delay = min(5.0, idle_delay * 2)


def worker():
    from planner.observability import configure_logging

    configure_logging()
    # Background shells can inherit ignored SIGINT; watchers must be able to stop us.
    signal.signal(signal.SIGINT, signal.default_int_handler)
    signal.signal(signal.SIGTERM, signal.default_int_handler)
    stop = threading.Event()
    errors = queue.SimpleQueue()

    def supervise(target):
        try:
            target()
        except BaseException as error:
            errors.put(error)
            stop.set()

    threads = [
        threading.Thread(target=supervise, args=(lambda: _scheduler_loop(stop),), daemon=True),
        threading.Thread(target=supervise, args=(lambda: _poll_lane(stop, slow=True),), daemon=True),
    ]
    for thread in threads:
        thread.start()
    try:
        _poll_lane(stop, slow=False)
        if not errors.empty():
            raise errors.get()
    finally:
        stop.set()
        for thread in threads:
            thread.join(timeout=1)


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
