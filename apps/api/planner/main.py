import asyncio
import json
import logging
import time
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from starlette.background import BackgroundTask

from planner import accounts, ai, planning, schemas, storage
from planner.auth import (
    DB,
    DUMMY_HASH,
    Auth,
    check_and_rehash_password,
    limit,
    lock_owner,
    password_matches,
    passwords,
    public_user,
    start_session,
    verify_origin,
)
from planner.config import settings
from planner.db import engine, session_factory
from planner.models import (
    AccountFile,
    AIRun,
    Area,
    Attachment,
    LoginSession,
    Note,
    NoteShare,
    NoteUnlock,
    Notification,
    SystemSetting,
    User,
    new_id,
    now,
)
from planner.moderation import router as moderation_router
from planner.note_features import router as note_features_router
from planner.observability import instrument
from planner.personal import router as personal_router
from planner.timezones import zone as ZoneInfo
from planner.workspace import router as workspace_router

app = FastAPI(
    title="Personal AI Planner",
    version="0.1.0",
    docs_url=None if settings().environment == "production" else "/docs",
)
logger = logging.getLogger("planner.http")
app.include_router(accounts.router)

app.include_router(workspace_router)

app.include_router(personal_router)

app.include_router(moderation_router)

app.include_router(note_features_router)
instrument(app, engine())


@app.middleware("http")
async def request_context(request: Request, call_next):
    trace_id = str(uuid4())
    started = time.monotonic()
    response = await call_next(request)
    response.headers.update(
        {
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "same-origin",
            "X-Request-ID": trace_id,
        }
    )
    route = request.scope.get("route")
    logger.info(
        "request",
        extra={
            "trace_id": trace_id,
            "route": getattr(route, "path", "unmatched"),
            "status": response.status_code,
            "latency_ms": int((time.monotonic() - started) * 1000),
            "user_agent": request.headers.get("user-agent", ""),
        },
    )
    return response


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return JSONResponse(
        {"detail": "This change conflicts with an existing record or relationship"}, status_code=409
    )


@app.get("/")
@app.head("/")
@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
@app.get("/api/v1/health")
def ready(db: DB):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get("/health/worker")
def worker_health(db: DB):
    limits = {"scheduler": 180, "fast": 180, "slow": 360}
    rows = db.scalars(select(SystemSetting).where(
        SystemSetting.key.in_(["worker:heartbeat:" + lane for lane in limits])
    )).all()
    timestamps = {row.key.removeprefix("worker:heartbeat:"): row.value.get("at") for row in rows}
    try:
        healthy = all(
            timestamps.get(lane)
            and -timedelta(seconds=60) <= now() - datetime.fromisoformat(timestamps[lane])
            <= timedelta(seconds=seconds)
            for lane, seconds in limits.items()
        )
    except (TypeError, ValueError):
        healthy = False
    if not healthy:
        raise HTTPException(503, "Worker unavailable")
    return {"status": "ready"}


@app.post("/api/v1/auth/register", status_code=201)
def register(body: schemas.Register, request: Request, response: Response, db: DB):
    verify_origin(request)
    limit(db, "register:" + request.client.host, 10, 3600)
    email = str(body.email).lower()
    from planner.models import SystemSetting

    policy = db.scalar(
        select(SystemSetting).where(SystemSetting.key == "registration").with_for_update()
    )
    if policy:
        mode = policy.value.get("mode", "open")
        if mode == "closed" or (
            mode == "invitation" and email not in policy.value.get("invitations", [])
        ):
            raise HTTPException(403, "Registration is not available for this account")
        if email in policy.value.get("invitations", []):
            policy.value = {
                **policy.value,
                "invitations": [value for value in policy.value["invitations"] if value != email],
            }
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Unable to create an account with these details")
    user = User(
        email=email,
        name=body.name.strip(),
        password_hash=passwords.hash(body.password),
        locale=body.locale,
    )
    db.add(user)
    db.flush()
    area_name = "Lĩnh vực" if body.locale == "vi" else "Area"
    db.add_all(Area(user_id=user.id, title=f"{area_name} {index}") for index in range(1, 4))
    accounts.queue_email(db, user, "verify")
    return start_session(db, user, response, request.headers.get("origin"))


@app.post("/api/v1/auth/login")
def login(body: schemas.Login, request: Request, response: Response, db: DB):
    verify_origin(request)
    limit(db, "login:" + request.client.host + ":" + str(body.email).lower(), 10, 300)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    valid, replacement = check_and_rehash_password(
        body.password, user.password_hash if user else DUMMY_HASH
    )
    if not valid or user is None or user.locked_at:
        raise HTTPException(401, "Email or password is incorrect")
    if replacement:
        user.password_hash = replacement
    if user.requires_mfa_reset:
        raise HTTPException(
            403, "This migrated account requires assisted MFA recovery before login"
        )
    if user.totp_secret or user.email_mfa:
        challenge = accounts.issue_token(db, user, "login", 5)
        db.commit()
        if user.email_mfa:
            accounts.email_login_code(accounts.Challenge(challenge=challenge), request, db)
        return {"requires_2fa": True, "challenge": challenge}
    return start_session(db, user, response, request.headers.get("origin"))


@app.get("/api/v1/auth/me")
def me(auth: Auth):
    return {"user": public_user(auth.user), "csrf": auth.session.csrf}


@app.post("/api/v1/auth/logout", status_code=204)
def logout(auth: Auth, db: DB, response: Response):
    db.delete(auth.session)
    db.commit()
    response.delete_cookie("planner_session", path="/")


@app.put("/api/v1/preferences")
def preferences(body: schemas.Preferences, auth: Auth, db: DB):
    if body.preferences and body.preferences.background_id:
        from planner.models import AccountFile

        if (
            db.scalar(
                select(AccountFile.id).where(
                    AccountFile.id == body.preferences.background_id,
                    AccountFile.user_id == auth.user.id,
                    AccountFile.purpose == "background",
                )
            )
            is None
        ):
            raise HTTPException(404, "Not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(auth.user, field, value)
    db.commit()
    return public_user(auth.user)


@app.get("/api/v1/dashboard")
def dashboard(auth: Auth, db: DB):
    today = now().astimezone(ZoneInfo(auth.user.timezone)).date()
    return planning.dashboard(db, auth.user.id, today, auth.user.timezone)


@app.get("/api/v1/calendar")
def calendar(auth: Auth, db: DB, start: date, end: date):
    from sqlalchemy import or_

    if start > end or (end - start).days > 93:
        raise HTTPException(422, "Choose a calendar range up to 93 days")
    result = {}
    for kind in ("goals", "milestones", "tasks"):
        model = planning.MODELS[kind]
        predicates = [model.due_date.between(start, end), model.start_date.between(start, end)]
        if kind == "tasks":
            from sqlalchemy import func

            predicates.append(
                func.date(func.timezone(auth.user.timezone, model.scheduled_at)).between(start, end)
            )
        rows = db.scalars(
            select(model)
            .where(model.user_id == auth.user.id, model.archived_at.is_(None), or_(*predicates))
            .order_by(model.due_date, model.id)
            .limit(500)
        ).all()
        result[kind] = [planning.serialize(row) for row in rows]
    return result


@app.get("/api/v1/plan/tasks")
def task_plan(day: date, auth: Auth, db: DB):
    from datetime import timedelta

    from planner.models import TaskSelection

    monday = day - timedelta(days=day.weekday())
    rows = db.scalars(
        select(TaskSelection).where(
            TaskSelection.user_id == auth.user.id, TaskSelection.day.in_([day, monday])
        )
    ).all()
    return {
        "daily": [row.task_id for row in rows if row.period == "daily" and row.day == day],
        "weekly": [row.task_id for row in rows if row.period == "weekly" and row.day == monday],
    }


@app.put("/api/v1/plan/tasks/{task_id}")
def select_task(task_id: str, body: schemas.SelectTask, auth: Auth, db: DB):
    from datetime import timedelta

    from sqlalchemy.dialects.postgresql import insert

    from planner.models import TaskSelection

    lock_owner(db, auth.user.id)
    planning.owned(db, "tasks", task_id, auth.user.id, active=True)
    selections = [(body.period, body.day)]
    if body.period == "daily" and body.selected:
        selections.append(("weekly", body.day - timedelta(days=body.day.weekday())))
    if body.period == "weekly" and body.day.weekday() != 0:
        raise HTTPException(422, "Weekly selections use the Monday date")
    for period, day in selections:
        if body.selected:
            db.execute(
                insert(TaskSelection)
                .values(user_id=auth.user.id, task_id=task_id, period=period, day=day)
                .on_conflict_do_nothing()
            )
        else:
            db.execute(
                delete(TaskSelection).where(
                    TaskSelection.user_id == auth.user.id,
                    TaskSelection.task_id == task_id,
                    TaskSelection.period == period,
                    TaskSelection.day == day,
                )
            )
    db.commit()
    return {"selected": body.selected}


@app.put("/api/v1/focus")
def select_focus(body: schemas.SelectFocus, auth: Auth, db: DB):
    from planner.models import Focus

    lock_owner(db, auth.user.id)
    if body.goal_id:
        planning.owned(db, "goals", body.goal_id, auth.user.id, active=True)
    focus = db.get(Focus, auth.user.id)
    if focus:
        focus.goal_id = body.goal_id
    else:
        db.add(Focus(user_id=auth.user.id, goal_id=body.goal_id))
    db.commit()
    return {"goal_id": body.goal_id}


@app.post("/api/v1/notes/{note_id}/password")
def note_password(note_id: str, body: schemas.NotePassword, auth: Auth, db: DB):
    limit(db, f"note-password:{auth.user.id}:{note_id}", 10, 300)
    lock_owner(db, auth.user.id)
    note = planning.owned(db, "notes", note_id, auth.user.id)
    if note.lock_hash and not password_matches(body.current_password, note.lock_hash):
        raise HTTPException(403, "Current password is incorrect")
    note.lock_hash = passwords.hash(body.new_password) if body.new_password else None
    if body.new_password:
        note.details = {
            key: value
            for key, value in note.details.items()
            if key not in ("summary", "summary_version")
        }
    note.version, note.updated_at = note.version + 1, now()
    db.execute(delete(NoteUnlock).where(NoteUnlock.note_id == note_id))
    planning.invalidate(db, "notes", note)
    db.commit()
    return {"locked": bool(note.lock_hash)}


@app.post("/api/v1/notes/{note_id}/unlock")
def note_unlock(note_id: str, body: schemas.Unlock, auth: Auth, db: DB):
    limit(db, f"note-unlock:{auth.user.id}:{note_id}", 10, 300)
    note = db.get(Note, note_id)
    share = db.get(NoteShare, (note_id, auth.user.id)) if note else None
    owner = db.get(User, note.user_id) if note else None
    if note is None or (
        note.user_id != auth.user.id
        and (
            share is None
            or share.status != "accepted"
            or owner is None
            or owner.locked_at
            or note.archived_at
        )
    ):
        raise HTTPException(404, "Not found")
    if note.lock_hash and not password_matches(body.password, note.lock_hash):
        raise HTTPException(403, "Incorrect password")
    if note.lock_hash:
        unlock = db.get(NoteUnlock, (auth.session.token_hash, note_id))
        if unlock:
            unlock.lock_hash = note.lock_hash
        else:
            db.add(
                NoteUnlock(
                    token_hash=auth.session.token_hash, note_id=note_id, lock_hash=note.lock_hash
                )
            )
        db.commit()
    return planning.serialize(note)


@app.put("/api/v1/notes/{note_id}/share")
def note_share(note_id: str, body: schemas.Share, auth: Auth, db: DB):
    planning.access_note(db, note_id, auth, owner_only=True)
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    if user is None or user.id == auth.user.id:
        raise HTTPException(422, "Choose another registered account")
    share = db.get(NoteShare, (note_id, user.id))
    if share:
        share.can_edit = body.can_edit
    else:
        db.add(NoteShare(note_id=note_id, user_id=user.id, can_edit=body.can_edit))
    db.commit()
    return {"shared": True}


@app.get("/api/v1/notes/{note_id}/share")
def note_shares(note_id: str, auth: Auth, db: DB):
    planning.access_note(db, note_id, auth, owner_only=True)
    rows = db.execute(
        select(User.id, User.name, User.email, NoteShare.can_edit)
        .join(NoteShare, NoteShare.user_id == User.id)
        .where(NoteShare.note_id == note_id)
        .order_by(User.name, User.id)
        .limit(100)
    ).all()
    return [
        {"id": row.id, "name": row.name, "email": row.email, "can_edit": row.can_edit}
        for row in rows
    ]


@app.delete("/api/v1/notes/{note_id}/share/{recipient_id}", status_code=204)
def revoke_share(note_id: str, recipient_id: str, auth: Auth, db: DB):
    planning.access_note(db, note_id, auth, owner_only=True)
    db.execute(
        delete(NoteShare).where(NoteShare.note_id == note_id, NoteShare.user_id == recipient_id)
    )
    db.commit()


@app.get("/api/v1/notes/{note_id}/attachments")
def attachments(note_id: str, auth: Auth, db: DB):
    planning.access_note(db, note_id, auth)
    rows = db.scalars(select(Attachment).where(Attachment.note_id == note_id).limit(100)).all()
    return [
        {"id": row.id, "filename": row.filename, "size": row.size, "mime": row.mime} for row in rows
    ]


@app.post("/api/v1/notes/{note_id}/attachments", status_code=201)
def upload_attachment(note_id: str, file: UploadFile, auth: Auth, db: DB):
    note = planning.access_note(db, note_id, auth, write=True)
    owner_id, key = note.user_id, new_id()
    mime = "application/octet-stream"
    if (file.content_type or "").startswith("image/") or Path(
        file.filename or ""
    ).suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        from planner.personal import clean_image

        file = clean_image(file)
        mime = "image/webp"
    db.rollback()
    size, checksum = storage.upload(file, key)
    try:
        lock_owner(db, owner_id)
        db.expire_all()
        planning.access_note(db, note_id, auth, write=True)
        from sqlalchemy import func

        total = db.scalar(
            select(func.coalesce(func.sum(Attachment.size), 0)).where(
                Attachment.user_id == owner_id
            )
        )
        total += db.scalar(
            select(func.coalesce(func.sum(AccountFile.size), 0)).where(
                AccountFile.user_id == owner_id
            )
        )
        if total + size > settings().max_user_storage_bytes:
            raise HTTPException(413, "This account's storage allowance is full")
        row = Attachment(
            user_id=owner_id,
            note_id=note_id,
            storage_key=key,
            filename=Path(file.filename or "attachment").name[:200],
            size=size,
            checksum=checksum,
            mime=mime,
        )
        db.add(row)
        db.commit()
    except Exception:
        storage.remove(key)
        raise
    return {"id": row.id, "filename": row.filename, "size": size}


@app.get("/api/v1/files/{attachment_id}")
def download(attachment_id: str, auth: Auth, db: DB):
    row = db.get(Attachment, attachment_id)
    if row is None:
        raise HTTPException(404, "File not found")
    planning.access_note(db, row.note_id, auth)
    key, mime, filename = row.storage_key, row.mime, row.filename
    db.rollback()
    chunks, close = storage.open_download(key)
    return StreamingResponse(
        chunks, media_type=mime, background=BackgroundTask(close),
        headers={
            "Content-Disposition": ("inline" if mime == "image/webp" else "attachment")
            + "; filename*=UTF-8''"
            + quote(filename, safe="")
        },
    )


@app.put("/api/v1/habits/{habit_id}/checkin")
def checkin(habit_id: str, body: schemas.Checkin, auth: Auth, db: DB):
    result = planning.checkin(db, auth.user.id, habit_id, body.day, body.state)
    db.commit()
    return result


@app.get("/api/v1/habits/{habit_id}/days")
def habit_days(habit_id: str, start: date, end: date, auth: Auth, db: DB):
    return planning.habit_days(db, auth.user.id, habit_id, start, end)


@app.put("/api/v1/milestones/{milestone_id}/prerequisites")
def prerequisites(milestone_id: str, body: schemas.Prerequisites, auth: Auth, db: DB):
    row = planning.prerequisites(db, auth.user.id, milestone_id, body.version, body.ids)
    db.commit()
    return planning.serialize(row)


@app.get("/api/v1/milestones/{milestone_id}/prerequisites")
def get_prerequisites(milestone_id: str, auth: Auth, db: DB):
    from planner.models import Dependency

    planning.owned(db, "milestones", milestone_id, auth.user.id)
    return list(
        db.scalars(
            select(Dependency.prerequisite_id).where(
                Dependency.user_id == auth.user.id, Dependency.milestone_id == milestone_id
            )
        )
    )


@app.post("/api/v1/notifications/read", status_code=204)
def read_notifications(auth: Auth, db: DB, body: schemas.NotificationRead | None = None):
    from sqlalchemy import update

    statement = update(Notification).where(Notification.user_id == auth.user.id)
    if body and body.id:
        statement = statement.where(Notification.id == body.id)
    db.execute(statement.values(read=True))
    db.commit()


@app.get("/api/v1/activity")
def activity(auth: Auth, db: DB, start: date, end: date, page: int = Query(1, ge=1)):
    from datetime import UTC, datetime, timedelta

    from planner.models import Activity

    if start > end or (end - start).days > 366:
        raise HTTPException(422, "Choose a date range up to 366 days")
    lower = datetime.combine(start, datetime.min.time(), ZoneInfo(auth.user.timezone)).astimezone(
        UTC
    )
    upper = datetime.combine(
        end + timedelta(days=1), datetime.min.time(), ZoneInfo(auth.user.timezone)
    ).astimezone(UTC)
    rows = db.scalars(
        select(Activity)
        .where(
            Activity.user_id == auth.user.id,
            Activity.created_at >= lower,
            Activity.created_at < upper,
        )
        .order_by(Activity.created_at.desc(), Activity.id.desc())
        .offset((page - 1) * 1000)
        .limit(1000)
    ).all()
    return [
        {"id": row.id, "kind": row.kind, "entity_id": row.entity_id, "created_at": row.created_at}
        for row in rows
    ]


@app.get("/api/v1/notifications")
def notifications(auth: Auth, db: DB):
    if not auth.user.preferences.get("notifications_enabled", True):
        return []
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == auth.user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": row.id,
            "message": row.message,
            "read": row.read,
            "created_at": row.created_at,
            **(row.details or {}),
        }
        for row in rows
    ]


@app.post("/api/v1/assistant/runs", status_code=202)
def ask(body: schemas.Ask, auth: Auth, db: DB):
    limit(db, "ai:" + auth.user.id, 6)
    run = ai.start_run(db, auth.user.id, body.prompt, [turn.model_dump() for turn in body.history])
    db.commit()
    return {"id": run.id, "status": run.status}


def run_result(run, db=None):
    if db is not None:
        for source in run.sources:
            item = planning.owned(db, source["kind"], source["id"], run.user_id, active=True)
            if isinstance(item, Note) and item.lock_hash:
                raise HTTPException(423, "An answer source is now locked")
    preview = []
    if db is not None and run.proposal and not run.applied_at:
        for operation in run.proposal["operations"]:
            before = None
            if operation.get("id") and operation["id"] not in {
                op.get("ref") for op in run.proposal["operations"]
            }:
                item = planning.owned(db, operation["kind"], operation["id"], run.user_id)
                if isinstance(item, Note) and item.lock_hash:
                    raise HTTPException(423, "A proposed Note is now locked")
                before = planning.serialize(item)
            preview.append(before)
    return {
        "preview": preview,
        **{
            field: getattr(run, field)
            for field in (
                "id",
                "answer",
                "status",
                "sources",
                "proposal",
                "proposal_hash",
                "applied_at",
                "model",
                "input_tokens",
                "output_tokens",
                "cost_usd",
                "error_code",
            )
        },
    }


@app.get("/api/v1/assistant/runs")
def assistant_history(auth: Auth, db: DB, before: str | None = None):
    statement = select(AIRun).where(AIRun.user_id == auth.user.id)
    cleared = db.get(User, auth.user.id).profile.get("assistant_history_cleared_at")
    if cleared:
        statement = statement.where(AIRun.created_at > datetime.fromisoformat(cleared))
    if before:
        cursor = db.scalar(select(AIRun).where(AIRun.id == before, AIRun.user_id == auth.user.id))
        if cursor is None:
            raise HTTPException(404, "Not found")
        statement = statement.where(
            (AIRun.created_at < cursor.created_at)
            | ((AIRun.created_at == cursor.created_at) & (AIRun.id < cursor.id))
        )
    rows = db.scalars(statement.order_by(AIRun.created_at.desc(), AIRun.id.desc()).limit(31)).all()
    items = []
    for row in reversed(rows[:30]):
        try:
            result = {**run_result(row, db), "prompt": row.prompt}
        except HTTPException as exc:
            if exc.status_code not in (404, 423):
                raise
            result = {
                "id": row.id,
                "prompt": None,
                "answer": "",
                "status": "failed",
                "proposal": None,
                "proposal_hash": None,
                "applied_at": None,
                "sources": [],
                "error_code": "SOURCE_UNAVAILABLE",
            }
        items.append(result)
    return {"items": items, "next_cursor": rows[29].id if len(rows) > 30 else None}


@app.delete("/api/v1/assistant/runs", status_code=204)
def clear_assistant_history(auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    account = db.get(User, auth.user.id)
    account.profile = {**account.profile, "assistant_history_cleared_at": now().isoformat()}
    # Retain durable runs, usage reservations and approvals; clearing chat cannot reset budgets.
    db.commit()


@app.get("/api/v1/assistant/runs/{run_id}")
def get_run(run_id: str, auth: Auth, db: DB):
    run = db.scalar(select(AIRun).where(AIRun.id == run_id, AIRun.user_id == auth.user.id))
    if run is None:
        raise HTTPException(404, "Not found")
    return run_result(run, db)


@app.get("/api/v1/assistant/runs/{run_id}/events")
def events(run_id: str, auth: Auth, db: DB):
    run = db.scalar(select(AIRun).where(AIRun.id == run_id, AIRun.user_id == auth.user.id))
    if run is None:
        raise HTTPException(404, "Not found")
    owner_id, session_hash = auth.user.id, auth.session.token_hash
    db.rollback()

    def read_event():
        with session_factory()() as current:
            session = current.get(LoginSession, session_hash)
            if session is None or session.expires_at <= now():
                return None
            row = current.scalar(
                select(AIRun).where(AIRun.id == run_id, AIRun.user_id == owner_id)
            )
            if row is None:
                return None
            try:
                return jsonable_encoder(run_result(row, current)), row.status
            except HTTPException:
                return {
                    "id": run_id,
                    "status": "failed",
                    "answer": "",
                    "sources": [],
                    "error_code": "SOURCE_UNAVAILABLE",
                }, "failed"

    async def stream():
        # Each read gets a short transaction outside the event loop.
        for _ in range(240):
            event = await asyncio.to_thread(read_event)
            if event is None:
                break
            payload, status = event
            yield "data: " + json.dumps(payload) + "\n\n"
            if status in ("completed", "failed", "rejected"):
                break
            await asyncio.sleep(0.5)

    return StreamingResponse(
        stream(), media_type="text/event-stream", headers={"X-Accel-Buffering": "no"}
    )


@app.post("/api/v1/assistant/runs/{run_id}/apply")
def apply(run_id: str, body: schemas.Approve, auth: Auth, db: DB):
    run = ai.apply_proposal(db, auth, run_id, body.proposal_hash, body.acknowledgements)
    db.commit()
    return run_result(run)


@app.post("/api/v1/assistant/runs/{run_id}/reject", status_code=204)
def reject_proposal(run_id: str, body: schemas.Approve, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    run = db.scalar(
        select(AIRun).where(AIRun.id == run_id, AIRun.user_id == auth.user.id).with_for_update()
    )
    if run is None:
        raise HTTPException(404, "Not found")
    if (
        run.applied_at
        or run.status not in ("completed", "rejected")
        or run.proposal_hash != body.proposal_hash
    ):
        raise HTTPException(409, "This proposal cannot be rejected")
    run.status, run.proposal_expires = "rejected", now()
    db.commit()


@app.get("/api/v1/{kind}")
def list_items(
    kind: str,
    auth: Auth,
    db: DB,
    page: int = Query(1, ge=1, le=10000),
    size: int = Query(50, ge=1, le=100),
    q: str = Query("", max_length=200),
    archived: bool = False,
):
    return planning.list_items(db, kind, auth.user.id, page, size, q, archived)


@app.post("/api/v1/{kind}", status_code=201)
def create_item(kind: str, body: dict, auth: Auth, db: DB):
    plan_for = "none"
    if kind == "tasks":
        from pydantic import ValidationError

        try:
            capture = schemas.TaskCapture.model_validate(body)
        except ValidationError as exc:
            raise HTTPException(422, "Check the Task fields and plan selection") from exc
        plan_for = capture.plan_for
        body = capture.model_dump(exclude={"plan_for"})
    row = planning.create(db, kind, auth.user.id, body)
    if plan_for != "none":
        from datetime import timedelta

        from planner.models import TaskSelection

        today = now().astimezone(ZoneInfo(auth.user.timezone)).date()
        week = today - timedelta(days=today.weekday())
        db.add(TaskSelection(user_id=auth.user.id, task_id=row.id, period="weekly", day=week))
        if plan_for == "daily":
            db.add(TaskSelection(user_id=auth.user.id, task_id=row.id, period="daily", day=today))
    db.commit()
    return planning.serialize(row)


@app.get("/api/v1/{kind}/{entity_id}")
def get_item(kind: str, entity_id: str, auth: Auth, db: DB):
    row = (
        planning.access_note(db, entity_id, auth)
        if kind == "notes"
        else planning.owned(db, kind, entity_id, auth.user.id)
    )
    result = planning.serialize(row)
    if kind == "notes":
        share = db.get(NoteShare, (row.id, auth.user.id)) if row.user_id != auth.user.id else None
        result["shared"] = row.user_id != auth.user.id
        result["can_edit"] = row.user_id == auth.user.id or bool(share and share.can_edit)
    return result


@app.patch("/api/v1/{kind}/{entity_id}")
def update_item(kind: str, entity_id: str, body: schemas.Mutation, auth: Auth, db: DB):
    row = planning.update(
        db, kind, auth.user.id, entity_id, body.version, body.fields, auth, body.acknowledgements
    )
    db.commit()
    return planning.serialize(row)


@app.post("/api/v1/{kind}/{entity_id}/archive")
def archive_item(kind: str, entity_id: str, body: schemas.Archive, auth: Auth, db: DB):
    if kind == "notes" and body.archived:
        planning.access_note(db, entity_id, auth, owner_only=True)
    row = planning.archive(
        db, kind, auth.user.id, entity_id, body.version, body.archived, body.include_contents
    )
    db.commit()
    return planning.serialize(row, mask_note=kind == "notes")
