"""Authenticated workspace reads and atomic multi-record UI actions."""

from datetime import datetime, time, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import Field
from sqlalchemy import delete, or_, select
from sqlalchemy.dialects.postgresql import insert

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


@router.get("/snapshot")
def snapshot(auth: Auth, db: DB):
    user_id = auth.user.id
    result = {}
    for kind, model in planning.MODELS.items():
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
            values = planning.serialize(row, mask_note=masked)
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
    # Owner-only linkage lets Task surfaces list locked Notes without exposing their body.
    task_notes = {}
    for task_id, note_id in db.execute(select(Note.task_id, Note.id).where(
        Note.user_id == user_id, Note.task_id.is_not(None), Note.archived_at.is_(None),
    )):
        task_notes.setdefault(task_id, []).append(note_id)
    for task in result["tasks"]:
        task["note_ids"] = task_notes.get(task["id"], [])
    result["account_files"] = [
        {"id": f.id, "purpose": f.purpose, "url": "/api/v1/account-files/" + f.id}
        for f in db.scalars(select(AccountFile).where(AccountFile.user_id == user_id))
    ]
    from planner.note_features import invitations

    result["invitations"] = invitations(auth, db)
    result["identity"] = {"user": public_user(auth.user), "csrf": auth.session.csrf}
    result["selections"] = [
        {"task_id": row.task_id, "period": row.period, "day": row.day}
        for row in db.scalars(select(TaskSelection).where(TaskSelection.user_id == user_id))
    ]
    result["habit_days"] = [
        {"habit_id": row.habit_id, "day": row.day, "state": row.state}
        for row in db.scalars(
            select(HabitDay)
            .join(planning.MODELS["habits"])
            .where(planning.MODELS["habits"].user_id == user_id)
        )
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
    ]
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
