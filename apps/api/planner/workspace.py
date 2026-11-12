"""Authenticated workspace reads and atomic multi-record UI actions."""

from datetime import date, datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from pydantic import Field
from sqlalchemy import Date, cast, delete, func, literal, or_, select, tuple_, union_all
from sqlalchemy.dialects.postgresql import JSONB, JSONPATH, insert
from sqlalchemy.orm import defer

from planner import planning, schemas
from planner.auth import DB, Auth, lock_owner, public_user
from planner.models import (
    AccountFile,
    Activity,
    Attachment,
    Dependency,
    Focus,
    Goal,
    Habit,
    HabitDay,
    Milestone,
    Note,
    NoteShare,
    NoteUnlock,
    Task,
    TaskSelection,
    TaskSeries,
    User,
    now,
)
from planner.timezones import zone as ZoneInfo

router = APIRouter(prefix="/api/v1/workspace")


class Change(schemas.Strict):
    action: Literal[
        "create",
        "update",
        "archive",
        "restore",
        "delete",
        "selection",
        "focus",
        "checkin",
        "prerequisites",
        "review-refresh",
    ]
    kind: str = "tasks"
    id: str | None = None
    client_id: str | None = Field(default=None, max_length=100)
    version: int | None = Field(default=None, ge=1)
    fields: dict = Field(default_factory=dict)
    acknowledgements: list[Literal["unchecked", "unfinished", "reopen_parents"]] = Field(
        default_factory=list
    )


class Changes(schemas.Strict):
    changes: list[Change] = Field(min_length=1, max_length=200)


def selected_task(db, user_id, task_id, values):
    body = schemas.SelectTask.model_validate(values)
    planning.owned(db, "tasks", task_id, user_id, active=True)
    if body.period == "weekly" and body.day.weekday() != 0:
        raise HTTPException(422, "Weekly selections use Monday")
    values = [(body.period, body.day)]
    if body.period == "daily" and body.selected:
        values.append(("weekly", body.day - timedelta(days=body.day.weekday())))
    for period, day in values:
        if body.selected:
            db.execute(
                insert(TaskSelection)
                .values(user_id=user_id, task_id=task_id, period=period, day=day)
                .on_conflict_do_nothing()
            )
        else:
            db.execute(
                delete(TaskSelection).where(
                    TaskSelection.user_id == user_id,
                    TaskSelection.task_id == task_id,
                    TaskSelection.period == period,
                    TaskSelection.day == day,
                )
            )


def review_snapshot(db, user_id, period, first):
    user = db.get(User, user_id)
    end = (
        first
        if period == "daily"
        else first + timedelta(days=6)
        if period == "weekly"
        else (first.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    )
    zone = ZoneInfo(user.timezone)
    lower = datetime.combine(first, time.min, zone)
    upper = datetime.combine(end + timedelta(days=1), time.min, zone)
    tasks = db.scalars(
        select(Task).where(
            Task.user_id == user_id,
            Task.series_id.is_(None),
            or_(Task.due_date.between(first, end), Task.completed_at.between(lower, upper)),
        )
    ).all()
    facts = db.scalars(
        select(Activity)
        .where(
            Activity.user_id == user_id, Activity.created_at >= lower, Activity.created_at < upper
        )
        .order_by(Activity.created_at, Activity.id)
    ).all()
    habits = db.scalars(
        select(HabitDay)
        .join(planning.MODELS["habits"])
        .where(
            planning.MODELS["habits"].user_id == user_id,
            HabitDay.day.between(first, end),
            HabitDay.state == "done",
        )
    ).all()
    titles = {
        row.id: row.title
        for model in (Task, planning.MODELS["habits"])
        for row in db.scalars(select(model).where(model.user_id == user_id))
    }
    return {
        "done": sum(row.status == "done" for row in tasks),
        "total": len(tasks),
        "habits": len(habits),
        "actions": len(facts),
        "wins": sum(row.kind.endswith("completed") for row in facts),
        "days": [
            {
                "date": (first + timedelta(days=i)).isoformat(),
                "count": sum(
                    row.created_at.astimezone(zone).date() == first + timedelta(days=i)
                    for row in facts
                ),
            }
            for i in range((end - first).days + 1)
        ],
        "facts": [
            {
                "id": row.id,
                "title": [titles.get(row.entity_id, row.kind)] * 2,
                "kind": "habit" if row.kind.startswith("habit.") else "task",
                "target": row.entity_id,
                "date": row.created_at.astimezone(zone).date().isoformat(),
                "at": row.created_at.isoformat(),
                "reversed": "reopened" in row.kind or "undone" in row.kind,
            }
            for row in facts
        ],
    }


def remove_record(db, auth, kind, entity_id, version):
    row = (
        planning.access_note(db, entity_id, auth, owner_only=True)
        if kind == "notes"
        else planning.owned(db, kind, entity_id, auth.user.id)
    )
    if row.version != version:
        raise HTTPException(409, "This item changed. Reload before deleting.")
    if kind not in ("notes", "reviews") and not row.archived_at:
        raise HTTPException(422, "Archive this item before permanently deleting it")
    user_id = auth.user.id
    goals = list(db.scalars(select(Goal).where(Goal.user_id == user_id)))
    gids = (
        {entity_id}
        if kind == "goals"
        else {g.id for g in goals if g.area_id == entity_id}
        if kind == "areas"
        else set()
    )
    while True:
        more = gids | {g.id for g in goals if g.parent_goal_id in gids}
        if more == gids:
            break
        gids = more
    mids = set(
        db.scalars(
            select(Milestone.id).where(Milestone.user_id == user_id, Milestone.goal_id.in_(gids))
        )
    ) | ({entity_id} if kind == "milestones" else set())
    tids = set(
        db.scalars(
            select(Task.id).where(
                Task.user_id == user_id, or_(Task.goal_id.in_(gids), Task.milestone_id.in_(mids))
            )
        )
    ) | ({entity_id} if kind == "tasks" else set())
    series_ids = {
        series.id
        for series in db.scalars(select(TaskSeries).where(TaskSeries.user_id == user_id))
        if (series.details.get("template") or {}).get("goal_id") in gids
        or (series.details.get("template") or {}).get("milestone_id") in mids
    } | ({entity_id} if kind == "task-series" else set())
    habit_ids = {
        habit.id
        for habit in db.scalars(select(Habit).where(Habit.user_id == user_id))
        if habit.details.get("primary_goal_id") in gids
    } | ({entity_id} if kind == "habits" else set())
    affected = {
        "goals": gids,
        "milestones": mids,
        "tasks": tids,
        "habits": habit_ids,
        "task-series": series_ids,
        kind: (
            gids
            if kind == "goals"
            else mids
            if kind == "milestones"
            else tids
            if kind == "tasks"
            else {entity_id}
        ),
    }
    for entity_kind, ids in affected.items():
        for target in db.scalars(
            select(planning.model_for(entity_kind)).where(
                planning.model_for(entity_kind).user_id == user_id,
                planning.model_for(entity_kind).id.in_(ids),
            )
        ):
            if entity_kind not in ("notes", "reviews") and not target.archived_at:
                raise HTTPException(422, "Archive the complete group before permanent deletion")
    from planner.models import Document

    for entity_kind, ids in affected.items():
        db.execute(
            delete(Document).where(
                Document.user_id == user_id,
                Document.source_kind == entity_kind,
                Document.source_id.in_(ids),
            )
        )
    if kind == "notes":
        for file in db.scalars(
            select(Attachment).where(Attachment.note_id == entity_id, Attachment.user_id == user_id)
        ):
            planning.enqueue(
                db, user_id, "delete-file", "delete-file:" + file.id, {"key": file.storage_key}
            )
        db.execute(delete(Attachment).where(Attachment.note_id == entity_id))
    db.execute(
        delete(Dependency).where(
            Dependency.user_id == user_id,
            or_(Dependency.milestone_id.in_(mids), Dependency.prerequisite_id.in_(mids)),
        )
    )
    db.execute(
        delete(TaskSelection).where(
            TaskSelection.user_id == user_id, TaskSelection.task_id.in_(tids)
        )
    )
    for note in db.scalars(
        select(Note).where(
            Note.user_id == user_id, or_(Note.goal_id.in_(gids), Note.task_id.in_(tids))
        )
    ):
        note.goal_id = None if note.goal_id in gids else note.goal_id
        note.task_id = None if note.task_id in tids else note.task_id
        note.version += 1
    focus = db.get(Focus, user_id)
    if focus and focus.goal_id in gids:
        focus.goal_id = None
    for entity_kind, model in planning.MODELS.items():
        for item in db.scalars(select(model).where(model.user_id == user_id)):
            details = dict(item.details or {})
            if kind == "notes" and "resource_note_ids" in details:
                details["resource_note_ids"] = [value for value in details["resource_note_ids"] if value != entity_id]
            if "related" in details:
                details["related"] = [value for value in details["related"] if value not in gids]
            if details.get("primary_goal_id") in gids:
                details["primary_goal_id"] = None
            if details.get("template"):
                template = dict(details["template"])
                template["related"] = [
                    goal_id for goal_id in template.get("related", []) if goal_id not in gids
                ]
                if kind == "notes" and "resource_note_ids" in template:
                    template["resource_note_ids"] = [value for value in template["resource_note_ids"] if value != entity_id]
                details["template"] = template
            if details != item.details:
                item.details = details
                item.version += 1
                if kind == "notes" and entity_kind in ("tasks", "task-series"):
                    item.updated_at = now()
                    planning.invalidate(db, entity_kind, item)
    for task in db.scalars(
        select(Task).where(
            Task.user_id == user_id, Task.series_id.in_(series_ids), Task.id.not_in(tids)
        )
    ):
        task.series_id, task.occurrence_date = None, None
        task.version += 1
        planning.invalidate(db, "tasks", task)
    db.flush()
    for task in db.scalars(select(Task).where(Task.user_id == user_id, Task.id.in_(tids))):
        db.delete(task)
    db.flush()
    for model, ids in ((TaskSeries, series_ids), (Habit, habit_ids)):
        for target in db.scalars(select(model).where(model.user_id == user_id, model.id.in_(ids))):
            db.delete(target)
    db.flush()
    for mid in mids:
        target = db.get(Milestone, mid)
        if target:
            db.delete(target)
    db.flush()
    pending = set(gids)
    while pending:
        leaves = {
            gid
            for gid in pending
            if not any(g.parent_goal_id == gid and g.id in pending for g in goals)
        }
        for gid in leaves:
            db.delete(db.get(Goal, gid))
        db.flush()
        pending -= leaves
    if kind not in ("goals", "milestones", "tasks", "habits", "task-series"):
        db.delete(row)
    db.flush()


def activity_counts(db, user, start, end):
    zone = ZoneInfo(user.timezone)
    lower = datetime.combine(start, time.min, zone)
    upper = datetime.combine(end + timedelta(days=1), time.min, zone)
    day = cast(func.timezone(user.timezone, Activity.created_at), Date)
    kind = func.split_part(Activity.kind, ".", 1)
    rows = db.execute(select(day, kind, func.count()).where(
        Activity.user_id == user.id,
        Activity.created_at >= lower,
        Activity.created_at < upper,
        kind.in_(["task", "habit", "checklist"]),
        Activity.kind.not_like("%reopened%"),
        Activity.kind.not_like("%undone%"),
        Activity.kind.not_like("%cleared%"),
    ).group_by(day, kind).order_by(day, kind)).all()
    return [{"date": day, "kind": kind, "count": count} for day, kind, count in rows]


@router.get("/activity/summary")
def activity_summary(auth: Auth, db: DB, start: date, end: date):
    if end == date.max or end < start or (end - start).days > 365:
        raise HTTPException(422, "Activity summary must cover at most 366 days")
    return {"items": activity_counts(db, auth.user, start, end)}


@router.get("/activity")
def activity_page(
    auth: Auth, db: DB, before: str | None = None, start: datetime | None = None,
    end: datetime | None = None, day: date | None = None,
    size: int = Query(default=50, ge=1, le=200),
):
    if day:
        if start or end or day == date.max:
            raise HTTPException(422, "Use either a local day or instant bounds")
        zone = ZoneInfo(auth.user.timezone)
        start = datetime.combine(day, time.min, zone)
        end = datetime.combine(day + timedelta(days=1), time.min, zone)
    for value in (start, end):
        if value is not None and (value.tzinfo is None or value.utcoffset() is None):
            raise HTTPException(422, "Activity bounds must include a timezone")
    if start and end and start >= end:
        raise HTTPException(422, "Activity start must precede end")
    statement = select(Activity).where(Activity.user_id == auth.user.id)
    if start:
        statement = statement.where(Activity.created_at >= start)
    if end:
        statement = statement.where(Activity.created_at < end)
    if before:
        cursor = db.scalar(select(Activity).where(
            Activity.id == before, Activity.user_id == auth.user.id
        ))
        if cursor is None:
            raise HTTPException(404, "Not found")
        statement = statement.where(or_(
            Activity.created_at < cursor.created_at,
            (Activity.created_at == cursor.created_at) & (Activity.id < cursor.id),
        ))
    rows = db.scalars(statement.order_by(Activity.created_at.desc(), Activity.id.desc()).limit(size + 1)).all()
    return {
        "items": [
            {"id": row.id, "kind": row.kind, "entity_id": row.entity_id, "created_at": row.created_at}
            for row in rows[:size]
        ],
        "next_cursor": rows[size - 1].id if len(rows) > size else None,
    }


@router.get("/archive/{kind}")
def archive_page(auth: Auth, db: DB, kind: str, before: str | None = None,
                 size: int = Query(default=50, ge=1, le=200)):
    model = planning.model_for(kind)
    statement = select(model).where(model.user_id == auth.user.id, model.archived_at.is_not(None))
    if before:
        cursor = db.scalar(select(model).where(
            model.id == before, model.user_id == auth.user.id, model.archived_at.is_not(None)
        ))
        if cursor is None:
            raise HTTPException(404, "Not found")
        statement = statement.where(or_(
            model.archived_at < cursor.archived_at,
            (model.archived_at == cursor.archived_at) & (model.id < cursor.id),
        ))
    rows = db.scalars(statement.order_by(model.archived_at.desc(), model.id.desc()).limit(size + 1)).all()
    unlocked = set()
    if kind == "notes":
        note_ids = [row.id for row in rows[:size] if row.lock_hash]
        unlocks = db.scalars(select(NoteUnlock).where(
            NoteUnlock.token_hash == auth.session.token_hash, NoteUnlock.note_id.in_(note_ids)
        ))
        unlocked = {(row.note_id, row.lock_hash) for row in unlocks}
    items = [planning.serialize(row, mask_note=(
        kind == "notes" and bool(row.lock_hash) and (row.id, row.lock_hash) not in unlocked
    )) for row in rows[:size]]
    return {"items": items, "next_cursor": rows[size - 1].id if len(rows) > size else None}


def archive_roots(user_id):
    parents = {
        "goals": [(Goal, "parent_goal_id"), (planning.MODELS["areas"], "area_id")],
        "milestones": [(Goal, "goal_id")],
        "tasks": [(Goal, "goal_id"), (Milestone, "milestone_id")],
        "notes": [(Goal, "goal_id"), (Task, "task_id")], "reviews": [], "areas": [],
        "habits": [(Goal, "primary_goal_id")],
        "task-series": [(Goal, "goal_id"), (Milestone, "milestone_id")],
    }
    statements = []
    from sqlalchemy.orm import aliased
    for kind, model in planning.MODELS.items():
        title = (func.coalesce(model.details["template"]["title"].as_string(), model.title)
                 if kind == "task-series" else model.title)
        statement = select(literal(kind).label("kind"), model.id, model.version,
                           model.archived_at, title.label("title"),
                           (model.lock_hash.is_not(None) if kind == "notes" else literal(False)).label("locked"))
        for parent_model, field in parents[kind]:
            parent = aliased(parent_model)
            reference = (model.details["template"][field].as_string() if kind == "task-series"
                         else model.details[field].as_string() if kind == "habits"
                         else getattr(model, field))
            statement = statement.where(~select(parent.id).where(
                parent.user_id == user_id, parent.id == reference,
                parent.archived_at == model.archived_at,
            ).exists())
        statements.append(statement.where(model.user_id == user_id, model.archived_at.is_not(None)))
    return union_all(*statements).subquery()


@router.get("/archived")
def archived_roots(auth: Auth, db: DB, before_kind: str | None = None, before_id: str | None = None,
                   kind: str | None = None, q: str = Query(default="", max_length=200),
                   size: int = Query(default=50, ge=1, le=200)):
    roots = archive_roots(auth.user.id)
    statement = select(roots)
    if kind:
        planning.model_for(kind)
        statement = statement.where(roots.c.kind == kind)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(~roots.c.locked, roots.c.title.ilike("%" + escaped + "%"))
    if before_id:
        model = planning.model_for(before_kind or "")
        cursor = db.scalar(select(model).where(model.user_id == auth.user.id, model.id == before_id,
                                               model.archived_at.is_not(None)))
        if cursor is None:
            raise HTTPException(404, "Not found")
        statement = statement.where(tuple_(roots.c.archived_at, roots.c.kind, roots.c.id) <
                                    tuple_(cursor.archived_at, before_kind, before_id))
    rows = db.execute(statement.order_by(roots.c.archived_at.desc(), roots.c.kind.desc(), roots.c.id.desc()).limit(size + 1)).mappings().all()
    return {"items": [{**row, "title": "Locked Note" if row["locked"] else row["title"]} for row in rows[:size]],
            "next_cursor": {"kind": rows[size - 1]["kind"], "id": rows[size - 1]["id"]} if len(rows) > size else None}


class ArchiveDeletion(schemas.Strict):
    items: list[Change] = Field(min_length=1, max_length=20000)


@router.post("/archived/delete")
def delete_archived(body: ArchiveDeletion, auth: Auth, db: DB):
    lock_owner(db, auth.user.id)
    for item in body.items:
        row = planning.owned(db, item.kind, item.id, auth.user.id)
        if not row.archived_at or row.version != item.version:
            raise HTTPException(409, "Archive changed. Review before deleting.")
    for item in body.items:
        row = db.get(planning.model_for(item.kind), item.id)
        if row is not None:
            remove_record(db, auth, item.kind, item.id, row.version)
    db.commit()
    return {"deleted_roots": len(body.items)}


@router.get("/snapshot")
def snapshot(auth: Auth, db: DB, activity: Literal["all", "summary"] = "all"):
    return workspace_snapshot(auth, db, activity)


class Refresh(schemas.Strict):
    known: dict[str, dict[str, int]]
    compact: bool = False
    note_details: list[str] = Field(default_factory=list, max_length=200)


@router.post("/refresh")
def refresh_workspace(body: Refresh, auth: Auth, db: DB):
    if set(body.known) - set(planning.MODELS) or sum(map(len, body.known.values())) > 20000:
        raise HTTPException(422, "Invalid workspace version inventory")
    return workspace_snapshot(auth, db, "summary", body.known, compact=body.compact,
                              note_details=set(body.note_details))


@router.get("/bootstrap")
def bootstrap(auth: Auth, db: DB):
    """Identity/summaries without historical entities or Note bodies."""
    return workspace_snapshot(auth, db, "summary", only=set(), compact=True)


@router.get("/calendar-state/{kind}")
def calendar_state(auth: Auth, db: DB, kind: Literal["habit_days", "selections"],
                   page: int = Query(default=0, ge=0, le=1000000),
                   size: int = Query(default=200, ge=1, le=200)):
    if kind == "selections":
        statement = select(TaskSelection).where(TaskSelection.user_id == auth.user.id).order_by(
            TaskSelection.day, TaskSelection.period, TaskSelection.task_id)
    else:
        statement = select(HabitDay).join(Habit).where(Habit.user_id == auth.user.id).order_by(
            HabitDay.day, HabitDay.habit_id)
    rows = list(db.scalars(statement.offset(page * size).limit(size + 1)))
    return {"items": [({"task_id": row.task_id, "period": row.period, "day": row.day}
                       if kind == "selections" else {"habit_id": row.habit_id, "day": row.day, "state": row.state})
                      for row in rows[:size]], "has_more": len(rows) > size}


@router.get("/page/{kind}")
def workspace_page(auth: Auth, db: DB, kind: str, after: str | None = None,
                   size: int = Query(default=100, ge=1, le=200)):
    model = planning.model_for(kind)
    statement = select(model.id).where(model.user_id == auth.user.id, model.archived_at.is_(None))
    if kind == "notes":
        statement = select(Note.id).where(Note.archived_at.is_(None), or_(
            Note.user_id == auth.user.id,
            Note.id.in_(select(NoteShare.note_id).join(User, User.id == NoteShare.user_id).where(
                NoteShare.user_id == auth.user.id, NoteShare.status == "accepted",
                Note.user_id.in_(select(User.id).where(User.locked_at.is_(None))),
            )),
        ))
    # Stable UUID keyset; cursor is only a boundary and grants no access.
    if after:
        statement = statement.where(model.id > after)
    ids = list(db.scalars(statement.order_by(model.id).limit(size + 1)))
    result = workspace_snapshot(auth, db, "summary", only={kind}, selected=set(ids[:size]), compact=True)
    return {"items": result[kind], "next_cursor": ids[size - 1] if len(ids) > size else None}


@router.get("/note/{note_id}")
def workspace_note(auth: Auth, db: DB, note_id: str):
    planning.access_note(db, note_id, auth)
    return workspace_snapshot(auth, db, only={"notes"}, selected={note_id})["notes"][0]


@router.get("/note-search")
def search_notes(auth: Auth, db: DB, q: str = Query(min_length=1, max_length=200),
                 after: str | None = None, size: int = Query(default=200, ge=1, le=200)):
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    statement = select(Note.id).where(
        Note.archived_at.is_(None),
        or_(Note.user_id == auth.user.id, Note.id.in_(
            select(NoteShare.note_id).where(NoteShare.user_id == auth.user.id,
                NoteShare.status == "accepted", Note.user_id.in_(
                    select(User.id).where(User.locked_at.is_(None)))))),
        or_(Note.lock_hash.is_(None), Note.id.in_(select(NoteUnlock.note_id).where(
            NoteUnlock.token_hash == auth.session.token_hash, NoteUnlock.lock_hash == Note.lock_hash))),
        or_(Note.title.ilike("%" + escaped + "%"), Note.content.ilike("%" + escaped + "%")),
    )
    if after:
        statement = statement.where(Note.id > after)
    ids = list(db.scalars(statement.order_by(Note.id).limit(size + 1)))
    return {"ids": ids[:size], "next_cursor": ids[size - 1] if len(ids) > size else None}


@router.get("/note-sync")
def sync_notes(auth: Auth, db: DB, after: str | None = None,
               size: int = Query(default=10, ge=1, le=20)):
    statement = select(Note.id).where(
        Note.user_id == auth.user.id, Note.archived_at.is_(None), Note.lock_hash.is_(None),
        ~select(NoteShare.note_id).where(NoteShare.note_id == Note.id).exists(),
    )
    if after:
        statement = statement.where(Note.id > after)
    ids = list(db.scalars(statement.order_by(Note.id).limit(size + 1)))
    result = workspace_snapshot(auth, db, only={"notes"}, selected=set(ids[:size]))
    return {"items": result["notes"], "next_cursor": ids[size - 1] if len(ids) > size else None}


def preview_nodes(kind):
    nodes = func.jsonb_path_query(
        cast(Note.details, JSONB), cast(f'strict $.document.** ? (@.type == "{kind}")', JSONPATH),
        cast(literal("{}"), JSONB), True,
    ).table_valued("value").render_derived()
    limited = select(nodes.c.value).select_from(nodes).limit(4).correlate(Note).subquery()
    return select(func.coalesce(func.jsonb_agg(limited.c.value), cast(literal("[]"), JSONB))).scalar_subquery()


def note_state(auth, db, ids):
    """Attachment/share changes do not increment the editable Note version."""
    state = {}
    unlocks = dict(db.execute(select(NoteUnlock.note_id, NoteUnlock.lock_hash).where(
        NoteUnlock.token_hash == auth.session.token_hash, NoteUnlock.note_id.in_(ids))).all())
    for row in db.execute(select(Note.id, Note.user_id, Note.lock_hash,
        Note.details["summary"].as_string(), Note.details["summary_version"].as_integer()).where(Note.id.in_(ids))):
        readable = not row.lock_hash or unlocks.get(row.id) == row.lock_hash
        state[row.id] = {"files": [], "shares": [], "summary": row[3] if readable else "",
                         "summary_version": row[4] if readable else None}
        if not readable:
            state[row.id]["unlocked"] = False
    readable = [id for id, values in state.items() if values.get("unlocked") is not False]
    for file in db.scalars(select(Attachment).where(Attachment.note_id.in_(readable))):
        state[file.note_id]["files"].append({"id": file.id, "name": file.filename,
            "type": file.mime, "size": file.size, "url": "/api/v1/files/" + file.id})
    for shared, recipient in db.execute(select(NoteShare, User).join(User, User.id == NoteShare.user_id).where(
        NoteShare.note_id.in_(select(Note.id).where(Note.user_id == auth.user.id, Note.id.in_(readable))))):
        state[shared.note_id]["shares"].append({"id": recipient.id, "email": recipient.email,
            "permission": "edit" if shared.can_edit else "read", "status": shared.status})
    return state


def workspace_snapshot(auth, db, activity="all", known=None, *, only=None, selected=None,
                       compact=False, note_details=None):
    user_id = auth.user.id
    result = {}
    if known is not None:
        result["manifest"] = {}
    for kind, model in planning.MODELS.items():
        if only is not None and kind not in only:
            result[kind] = []
            continue
        statement = select(model).where(model.user_id == user_id)
        if kind == "notes":
            statement = select(Note).where(
                or_(
                    Note.user_id == user_id,
                    Note.id.in_(
                        select(NoteShare.note_id)
                        .join(User, User.id == NoteShare.user_id)
                        .where(NoteShare.user_id == user_id, NoteShare.status == "accepted")
                    ),
                )
            )
        if compact:
            statement = statement.where(model.archived_at.is_(None))
        if selected is not None:
            statement = statement.where(model.id.in_(selected))
        if known is not None:
            statement = statement.order_by(model.created_at, model.id)
            if kind == "notes":
                statement = statement.where(or_(
                    Note.user_id == user_id,
                    (Note.archived_at.is_(None)) & Note.user_id.in_(
                        select(User.id).where(User.locked_at.is_(None))
                    ),
                ))
                inventory = db.execute(statement.with_only_columns(
                    Note.id, Note.version, Note.user_id, Note.lock_hash
                )).all()
                changed = [row.id for row in inventory if known.get(kind, {}).get(row.id)
                           != row.version or row.user_id != user_id or row.lock_hash]
            else:
                inventory = db.execute(statement.with_only_columns(model.id, model.version)).all()
                changed = [row.id for row in inventory if known.get(kind, {}).get(row.id) != row.version]
            result["manifest"][kind] = [row.id for row in inventory]
            statement = statement.where(model.id.in_(changed))
        previews = {}
        if compact and kind == "notes":
            # Do not transfer rich documents/plain-text bodies from PostgreSQL for cards.
            previews = {row.id: (row.preview, row.metadata, row.headings, row.checkboxes) for row in db.execute(
                statement.with_only_columns(Note.id, func.left(Note.content, 2048).label("preview"),
                    cast(Note.details, JSONB).op("-")("document").op("-")("summary").label("metadata"),
                    preview_nodes("heading").label("headings"),
                    preview_nodes("taskItem").label("checkboxes"))
            )}
            statement = statement.options(defer(Note.content), defer(Note.details))
        rows = list(db.scalars(statement.order_by(model.created_at, model.id)))
        result[kind] = []
        if kind == "notes":
            owners = {
                owner.id: owner
                for owner in db.scalars(
                    select(User).where(User.id.in_({row.user_id for row in rows}))
                )
            }
            rows = [
                row
                for row in rows
                if row.user_id in owners
                and (
                    row.user_id == user_id
                    or (not owners[row.user_id].locked_at and not row.archived_at)
                )
            ]
            unlocks = {
                unlock.note_id: unlock.lock_hash
                for unlock in db.scalars(
                    select(NoteUnlock).where(
                        NoteUnlock.token_hash == auth.session.token_hash,
                        NoteUnlock.note_id.in_([row.id for row in rows]),
                    )
                )
            }
            readable = [
                row.id for row in rows if not row.lock_hash or unlocks.get(row.id) == row.lock_hash
            ]
            files, shares, permissions = {}, {}, {}
            for file in db.scalars(select(Attachment).where(Attachment.note_id.in_(readable))):
                files.setdefault(file.note_id, []).append(
                    {
                        "id": file.id,
                        "name": file.filename,
                        "type": file.mime,
                        "size": file.size,
                        "url": "/api/v1/files/" + file.id,
                    }
                )
            for share in db.scalars(
                select(NoteShare).where(
                    NoteShare.user_id == user_id, NoteShare.note_id.in_([row.id for row in rows])
                )
            ):
                permissions[share.note_id] = share.can_edit
            for shared, recipient in db.execute(
                select(NoteShare, User)
                .join(User, User.id == NoteShare.user_id)
                .where(
                    NoteShare.note_id.in_(
                        [row.id for row in rows if row.user_id == user_id and row.id in readable]
                    )
                )
            ):
                shares.setdefault(shared.note_id, []).append(
                    {
                        "id": recipient.id,
                        "email": recipient.email,
                        "permission": "edit" if shared.can_edit else "read",
                        "status": shared.status,
                    }
                )
        for row in rows:
            masked = kind == "notes" and row.id not in readable
            if compact and kind == "notes" and row.id not in (note_details or set()):
                preview, metadata, headings, checkboxes = previews[row.id]
                values = {column.name: getattr(row, column.name) for column in row.__table__.columns
                          if column.name not in ("user_id", "lock_hash", "content", "details")}
                values.update(metadata or {})
                values.update(content=preview, locked=bool(row.lock_hash), body_loaded=False)
                if headings or checkboxes:
                    # A bounded preview document keeps the existing heading/checkbox
                    # hierarchy. It is never editable before the full detail read.
                    nodes = []
                    for node in (headings or checkboxes)[:4]:
                        source = node if headings else (node.get("content") or [{}])[0]
                        texts = []
                        def text_nodes(value):
                            if value.get("type") == "text":
                                texts.append(value.get("text", ""))
                            for child in value.get("content", []):
                                text_nodes(child)
                        text_nodes(source)
                        paragraph = {"type": "paragraph", "content": [{"type": "text", "text": "".join(texts)[:512]}]}
                        nodes.append({**node, "content": paragraph["content"]} if headings else {
                            "type": "taskItem", "attrs": node.get("attrs", {}), "content": [paragraph]})
                    values["document"] = {"type": "doc", "content": nodes}
                if masked:
                    values.update(title="Locked Note", content="", tags=[])
                    for field in ("summary_version", "background_id", "goal_id", "task_id", "document"):
                        values.pop(field, None)
            else:
                values = planning.serialize(row, mask_note=masked)
                if kind == "notes":
                    values["body_loaded"] = True
            if kind == "notes":
                values.update(
                    shared=row.user_id != user_id,
                    can_edit=row.user_id == user_id or permissions.get(row.id, False),
                    unlocked=not masked,
                )
                if not masked:
                    values["files"] = files.get(row.id, [])
                    if row.user_id == user_id:
                        values["shares"] = shares.get(row.id, [])
            result[kind].append(values)
    if only is not None and only:
        if "tasks" in only:
            task_notes = {}
            for task_id, note_id in db.execute(select(Note.task_id, Note.id).where(
                Note.user_id == user_id, Note.task_id.in_(selected or []), Note.archived_at.is_(None),
            )):
                task_notes.setdefault(task_id, []).append(note_id)
            for task in result["tasks"]:
                task["note_ids"] = task_notes.get(task["id"], [])
        return result
    # Owner-only linkage lets Task surfaces list locked Notes without exposing their body.
    task_notes = {}
    for task_id, note_id in db.execute(select(Note.task_id, Note.id).where(
        Note.user_id == user_id, Note.task_id.is_not(None), Note.archived_at.is_(None),
    )):
        task_notes.setdefault(task_id, []).append(note_id)
    for task in result["tasks"]:
        task["note_ids"] = task_notes.get(task["id"], [])
    if known is not None:
        result["task_notes"] = task_notes
        result["note_state"] = note_state(auth, db, result["manifest"]["notes"])
    result["account_files"] = [
        {"id": f.id, "purpose": f.purpose, "url": "/api/v1/account-files/" + f.id}
        for f in db.scalars(select(AccountFile).where(AccountFile.user_id == user_id))
    ]
    from planner.note_features import invitations

    result["invitations"] = invitations(auth, db)
    result["identity"] = {"user": public_user(auth.user), "csrf": auth.session.csrf}
    result["selections"] = [
        {"task_id": row.task_id, "period": row.period, "day": row.day}
        for row in ([] if only == set() else db.scalars(select(TaskSelection).where(TaskSelection.user_id == user_id)))
    ]
    result["habit_days"] = [
        {"habit_id": row.habit_id, "day": row.day, "state": row.state}
        for row in ([] if only == set() else db.scalars(
            select(HabitDay)
            .join(planning.MODELS["habits"])
            .where(planning.MODELS["habits"].user_id == user_id)
        ))
    ]
    result["dependencies"] = [
        {"milestone_id": row.milestone_id, "prerequisite_id": row.prerequisite_id}
        for row in db.scalars(select(Dependency).where(Dependency.user_id == user_id))
    ]
    result["activity"] = [
        {"id": row.id, "kind": row.kind, "entity_id": row.entity_id, "created_at": row.created_at}
        for row in db.scalars(
            select(Activity)
            .where(Activity.user_id == user_id)
            .order_by(Activity.created_at, Activity.id)
        )
    ] if activity == "all" else []
    if activity == "summary":
        today = now().astimezone(ZoneInfo(auth.user.timezone)).date()
        result["activity_counts"] = activity_counts(db, auth.user, today - timedelta(days=364), today)
    focus = db.get(Focus, user_id)
    result["focus"] = focus.goal_id if focus else None
    return result


@router.post("/changes")
def change_workspace(body: Changes, auth: Auth, db: DB):
    result = apply_changes(body, auth, db)
    db.commit()
    return result


def apply_changes(body: Changes, auth, db):
    """Apply an owned batch inside the caller's transaction; never commit here."""
    lock_owner(db, auth.user.id)
    aliases, results = {}, []

    def resolve(values, field=""):
        if isinstance(values, dict):
            return {key: resolve(value, key) for key, value in values.items()}
        if isinstance(values, list):
            return [resolve(value, field) for value in values]
        if isinstance(values, str) and (field.endswith("_id") or field in ("related", "ids")):
            return aliases.get(values, values)
        return values

    try:
        # Validate original versions before deletion unlinks resources or cascades
        # into another selected root. The owner lock covers the entire batch.
        delete_batch = all(change.action == "delete" for change in body.changes)
        if delete_batch:
            for change in body.changes:
                row = (planning.access_note(db, change.id, auth, owner_only=True)
                       if change.kind == "notes"
                       else planning.owned(db, change.kind, change.id, auth.user.id))
                if row.version != change.version:
                    raise HTTPException(409, "This item changed. Reload before deleting.")
        for change in body.changes:
            kind, entity_id, fields = (
                change.kind,
                aliases.get(change.id, change.id),
                resolve(change.fields),
            )
            if change.action == "create":
                model = planning.model_for(kind)
                row = (
                    db.scalar(
                        select(model).where(
                            model.user_id == auth.user.id,
                            model.details["client_key"].as_string() == change.client_id,
                        )
                    )
                    if change.client_id
                    else None
                )
                if row is None:
                    row = planning.create(db, kind, auth.user.id, fields)
                    if change.client_id:
                        row.details = {**row.details, "client_key": change.client_id}
                elif any(
                    jsonable_encoder(planning.serialize(row)).get(key) != value
                    for key, value in fields.items()
                ):
                    raise HTTPException(
                        409,
                        "This draft was already saved with different content. Reload before retrying.",
                    )
                if kind == "reviews":
                    row.snapshot = review_snapshot(db, auth.user.id, row.period, row.period_date)
                if change.client_id:
                    aliases[change.client_id] = row.id
            elif change.action == "update":
                row = planning.update(
                    db,
                    kind,
                    auth.user.id,
                    entity_id,
                    change.version,
                    fields,
                    auth,
                    change.acknowledgements,
                )
            elif change.action in ("archive", "restore"):
                row = planning.archive(
                    db,
                    kind,
                    auth.user.id,
                    entity_id,
                    change.version,
                    change.action == "archive",
                    fields.get("include_contents", False),
                )
            elif change.action == "delete":
                current = db.get(planning.model_for(kind), entity_id) if delete_batch else None
                if not delete_batch or current is not None:
                    remove_record(db, auth, kind, entity_id, current.version if delete_batch else change.version)
                row = None
            elif change.action == "selection":
                selected_task(db, auth.user.id, entity_id, fields)
                row = None
            elif change.action == "focus":
                body = schemas.SelectFocus.model_validate(fields)
                if body.goal_id:
                    planning.owned(db, "goals", body.goal_id, auth.user.id, active=True)
                focus = db.get(Focus, auth.user.id)
                if focus:
                    focus.goal_id = body.goal_id
                else:
                    db.add(Focus(user_id=auth.user.id, goal_id=body.goal_id))
                row = None
            elif change.action == "checkin":
                body = schemas.Checkin.model_validate(fields)
                planning.checkin(db, auth.user.id, entity_id, body.day, body.state)
                row = None
            elif change.action == "prerequisites":
                row = planning.prerequisites(
                    db, auth.user.id, entity_id, change.version, fields["ids"]
                )
            else:
                row = planning.owned(db, "reviews", entity_id, auth.user.id, active=True)
                if row.version != change.version:
                    raise HTTPException(409, "This Review changed")
                if row.details.get("finalized"):
                    raise HTTPException(422, "Reopen the Review before refreshing")
                row.snapshot = review_snapshot(db, auth.user.id, row.period, row.period_date)
                row.version += 1
            if row is not None:
                results.append({"kind": kind, **planning.serialize(row, mask_note=kind == "notes" and change.action == "restore")})
    except (ValueError, KeyError) as exc:
        db.rollback()
        raise HTTPException(422, "Check the workspace fields") from exc
    except Exception:
        db.rollback()
        raise
    return {"aliases": aliases, "items": results}
