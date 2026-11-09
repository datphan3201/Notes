from datetime import date, timedelta

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from planner.auth import Identity, lock_owner
from planner.domain import assert_acyclic, daily_streak, goal_progress, weekly_streak
from planner.models import (
    Activity,
    Area,
    Dependency,
    Document,
    Focus,
    Goal,
    Habit,
    HabitDay,
    Job,
    Milestone,
    Note,
    NoteShare,
    NoteUnlock,
    Review,
    Task,
    TaskSelection,
    TaskSeries,
    User,
    now,
)
from planner.schemas import (
    AreaInput,
    GoalInput,
    HabitInput,
    MilestoneInput,
    NoteInput,
    ReviewInput,
    SeriesInput,
    TaskInput,
)
from planner.timezones import zone as ZoneInfo

MODELS = {
    "areas": Area,
    "goals": Goal,
    "milestones": Milestone,
    "tasks": Task,
    "notes": Note,
    "habits": Habit,
    "reviews": Review,
    "task-series": TaskSeries,
}
INPUTS = {
    "areas": AreaInput,
    "goals": GoalInput,
    "milestones": MilestoneInput,
    "tasks": TaskInput,
    "notes": NoteInput,
    "habits": HabitInput,
    "reviews": ReviewInput,
    "task-series": SeriesInput,
}


def model_for(kind: str):
    if kind not in MODELS:
        raise HTTPException(404, "Not found")
    return MODELS[kind]


def owned(db: Session, kind: str, entity_id: str, user_id: str, active=False):
    model = model_for(kind)
    item = db.scalar(select(model).where(model.id == entity_id, model.user_id == user_id))
    if item is None or (active and item.archived_at):
        raise HTTPException(404, "Not found")
    return item


def access_note(db: Session, note_id: str, auth: Identity, write=False, owner_only=False):
    note = db.get(Note, note_id)
    if note is None:
        raise HTTPException(404, "Not found")
    if note.user_id != auth.user.id:
        share = db.get(NoteShare, (note_id, auth.user.id))
        owner = db.get(User, note.user_id)
        if (
            owner_only
            or share is None
            or share.status != "accepted"
            or note.archived_at
            or owner is None
            or owner.locked_at
            or (write and not share.can_edit)
        ):
            raise HTTPException(404, "Not found")
    if note.lock_hash:
        unlock = db.get(NoteUnlock, (auth.session.token_hash, note.id))
        if unlock is None or unlock.lock_hash != note.lock_hash:
            raise HTTPException(423, "Unlock this Note first")
    return note


def serialize(item, mask_note=False):
    result = {
        column.name: getattr(item, column.name)
        for column in item.__table__.columns
        if column.name not in ("user_id", "lock_hash")
    }
    result.update(result.pop("details", {}) or {})
    if isinstance(item, Task):
        # Retained only for legacy migration; canonical working content lives in Notes.
        result.pop("working_note", None)
    if isinstance(item, Note):
        result["locked"] = item.lock_hash is not None
        if mask_note and item.lock_hash:
            result["title"], result["content"], result["tags"] = "Locked Note", "", []
            for field in ("summary", "summary_version", "background_id", "goal_id", "task_id", "document"):
                result.pop(field, None)
    return result


def enqueue(db: Session, user_id: str, kind: str, key: str, payload: dict):
    db.execute(
        insert(Job)
        .values(user_id=user_id, kind=kind, key=key, payload=payload)
        .on_conflict_do_nothing(index_elements=[Job.key])
    )


def invalidate(db: Session, kind: str, item):
    db.execute(delete(Document).where(Document.source_kind == kind, Document.source_id == item.id))
    if kind in ("notes", "goals", "milestones", "tasks", "habits"):
        enqueue(
            db,
            item.user_id,
            "index",
            f"index:{kind}:{item.id}:{item.version}",
            {"kind": kind, "id": item.id, "version": item.version},
        )


def validate_relations(db: Session, kind: str, user_id: str, values: dict, entity_id=None):
    references = {
        "area_id": "areas",
        "parent_goal_id": "goals",
        "goal_id": "goals",
        "milestone_id": "milestones",
        "task_id": "tasks",
    }
    for field, target in references.items():
        if values.get(field):
            previous_note = db.get(Note, entity_id) if kind == "notes" and entity_id else None
            unchanged_note_link = (
                previous_note is not None and getattr(previous_note, field, None) == values[field]
            )
            owned(db, target, values[field], user_id, active=not unchanged_note_link)
    for goal_id in values.get("related", []):
        if kind == "goals" and goal_id == entity_id:
            raise HTTPException(422, "A Goal cannot relate to itself")
        owned(db, "goals", goal_id, user_id, active=True)
    if values.get("primary_goal_id"):
        owned(db, "goals", values["primary_goal_id"], user_id, active=True)
    if values.get("background_id"):
        from planner.models import Attachment

        background = db.scalar(
            select(Attachment).where(
                Attachment.id == values["background_id"],
                Attachment.user_id == user_id,
                Attachment.note_id == entity_id,
            )
        )
        if background is None:
            raise HTTPException(404, "Not found")
    if kind == "task-series" and values.get("template"):
        validate_relations(db, "tasks", user_id, values["template"])
    if kind == "goals" and entity_id:
        edges = {
            row.id: ([row.parent_goal_id] if row.parent_goal_id else [])
            for row in db.scalars(select(Goal).where(Goal.user_id == user_id))
        }
        edges[entity_id] = [values["parent_goal_id"]] if values.get("parent_goal_id") else []
        contributions = {
            row.id: row.details.get("related", [])
            for row in db.scalars(select(Goal).where(Goal.user_id == user_id))
        }
        contributions[entity_id] = values.get("related", [])
        try:
            assert_acyclic(contributions)
            assert_acyclic(edges)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc


def validated(kind: str, fields: dict):
    try:
        parsed = INPUTS[kind].model_validate(fields)
        values = parsed.model_dump(mode="json")
        for field in (
            "start_date",
            "due_date",
            "scheduled_at",
            "scheduled_end",
            "reminder_at",
            "period_date",
            "end_date",
        ):
            if hasattr(parsed, field):
                values[field] = getattr(parsed, field)
        if "checklist" in values:
            values["checklist"] = [item.model_dump() for item in parsed.checklist]
        return values
    except ValidationError as exc:
        raise HTTPException(422, str(exc)) from exc


def create(db: Session, kind: str, user_id: str, fields: dict):
    model = model_for(kind)
    values = validated(kind, fields)
    lock_owner(db, user_id)
    validate_relations(db, kind, user_id, values)
    if (
        kind == "areas"
        and db.scalar(
            select(func.count())
            .select_from(Area)
            .where(Area.user_id == user_id, Area.archived_at.is_(None))
        )
        >= 4
    ):
        raise HTTPException(422, "Keep at most four active Areas")
    columns = set(model.__table__.columns.keys())
    item = model(
        user_id=user_id,
        details={key: value for key, value in values.items() if key not in columns},
        **{key: value for key, value in values.items() if key in columns},
    )
    if kind == "tasks" and values.get("status") == "done":
        item.completed_at = now()
    if kind == "reviews":
        from planner.workspace import review_snapshot

        item.snapshot = review_snapshot(db, user_id, values["period"], values["period_date"])
    db.add(item)
    db.flush()
    invalidate(db, kind, item)
    return item


def update(
    db: Session,
    kind: str,
    user_id: str,
    entity_id: str,
    version: int,
    fields: dict,
    auth: Identity | None = None,
    acknowledgements: list[str] | None = None,
):
    if kind == "notes" and auth:
        # Shared editors serialize against the same owner as ordinary Note edits.
        authorized = access_note(db, entity_id, auth, write=True)
        if authorized.user_id != user_id and set(fields) - {"title", "content", "document"}:
            raise HTTPException(404, "Not found")
        user_id = authorized.user_id
    lock_owner(db, user_id)
    db.expire_all()
    item = (
        access_note(db, entity_id, auth, write=True)
        if kind == "notes" and auth
        else owned(db, kind, entity_id, user_id)
    )
    if kind == "notes" and auth is None and item.lock_hash:
        raise HTTPException(404, "Not found")
    if item.archived_at:
        raise HTTPException(422, "Restore this item before editing")
    if item.version != version:
        raise HTTPException(
            409, "This item changed. Your draft has been kept; reload before saving."
        )
    acknowledgements = acknowledgements or []
    if isinstance(item, Task) and fields.get("status") == "done" and item.status != "done":
        if (
            any(not value["checked"] for value in item.checklist)
            and "unchecked" not in acknowledgements
        ):
            raise HTTPException(422, "Acknowledge the unchecked checklist items")
    if (
        isinstance(item, Review)
        and item.details.get("finalized")
        and fields.get("finalized") is not False
    ):
        raise HTTPException(422, "Reopen the Review before editing")
    if (
        isinstance(item, Goal)
        and fields.get("status") == "completed"
        and item.status != "completed"
    ):
        unfinished = (
            db.scalar(
                select(Goal.id)
                .where(
                    Goal.user_id == user_id,
                    Goal.parent_goal_id == item.id,
                    Goal.archived_at.is_(None),
                    Goal.status != "completed",
                )
                .limit(1)
            )
            or db.scalar(
                select(Milestone.id)
                .where(
                    Milestone.user_id == user_id,
                    Milestone.goal_id == item.id,
                    Milestone.archived_at.is_(None),
                    Milestone.status != "done",
                )
                .limit(1)
            )
            or db.scalar(
                select(Task.id)
                .where(
                    Task.user_id == user_id,
                    Task.goal_id == item.id,
                    Task.archived_at.is_(None),
                    Task.series_id.is_(None),
                    Task.status != "done",
                )
                .limit(1)
            )
        )
        if unfinished and "unfinished" not in acknowledgements:
            raise HTTPException(422, "Acknowledge unfinished finite child work")
    existing = {
        field: getattr(item, field)
        if field in item.__table__.columns
        else (item.details or {}).get(field, definition.get_default(call_default_factory=True))
        for field, definition in INPUTS[kind].model_fields.items()
    }
    if kind == "notes" and "content" in fields and "document" not in fields:
        fields = {**fields, "document": None}
    values = validated(kind, {**existing, **fields})
    validate_relations(db, kind, item.user_id, values, item.id)
    if isinstance(item, Habit) and item.first_check_in_at:
        if values["timezone"] != item.timezone:
            from planner.timezones import canonical_name

            if canonical_name(values["timezone"]) != canonical_name(item.timezone):
                raise HTTPException(422, "Habit timezone is fixed after the first check-in")
            values["timezone"] = item.timezone
        if values["frequency"] != item.frequency:
            raise HTTPException(422, "Habit period is fixed after the first check-in")
    if isinstance(item, Milestone) and values["status"] == "done" and item.status != "done":
        prerequisites = db.scalars(
            select(Milestone)
            .join(Dependency, Milestone.id == Dependency.prerequisite_id)
            .where(
                Dependency.user_id == user_id,
                Dependency.milestone_id == item.id,
                Milestone.status != "done",
            )
        ).all()
        if prerequisites:
            raise HTTPException(422, "Complete the prerequisite Milestones first")
        if "unfinished" not in acknowledgements and db.scalar(
            select(func.count())
            .select_from(Task)
            .where(
                Task.user_id == user_id,
                Task.milestone_id == item.id,
                Task.series_id.is_(None),
                Task.archived_at.is_(None),
                Task.status != "done",
            )
        ):
            raise HTTPException(422, "Complete or move this Milestone's finite Tasks first")
    if isinstance(item, Milestone) and item.status == "done" and values["status"] != "done":
        completed_dependant = db.scalar(
            select(Milestone.id)
            .join(Dependency, Dependency.milestone_id == Milestone.id)
            .where(
                Dependency.user_id == user_id,
                Dependency.prerequisite_id == item.id,
                Milestone.status == "done",
                Milestone.archived_at.is_(None),
            )
            .limit(1)
        )
        if completed_dependant:
            raise HTTPException(422, "Reopen dependent Milestones first")
    if (
        isinstance(item, Task)
        and fields.get("status") == "todo"
        and item.status == "done"
        and item.due_date
    ):
        today = now().astimezone(ZoneInfo(db.get(User, user_id).timezone)).date()
        if item.due_date < today and (
            "due_date" not in fields or (values["due_date"] and values["due_date"] < today)
        ):
            raise HTTPException(
                422, "Choose a new due date or explicitly clear the overdue deadline"
            )
    was_finished = isinstance(item, (Task, Milestone, Goal)) and item.status in (
        "done",
        "completed",
    )
    if was_finished and values["status"] not in ("done", "completed"):
        ancestors = []
        milestone = (
            db.get(Milestone, values.get("milestone_id")) if values.get("milestone_id") else None
        )
        if milestone:
            ancestors.append(("milestones", milestone))
        goal_id = (
            values.get("parent_goal_id")
            or values.get("goal_id")
            or (milestone.goal_id if milestone else None)
        )
        while goal_id:
            goal = owned(db, "goals", goal_id, user_id, active=True)
            ancestors.append(("goals", goal))
            goal_id = goal.parent_goal_id
        completed = [
            (entity_kind, parent)
            for entity_kind, parent in ancestors
            if parent.status in ("done", "completed")
        ]
        if completed and "reopen_parents" not in acknowledgements:
            raise HTTPException(422, "Acknowledge reopening completed parents")
        for entity_kind, parent in completed:
            if entity_kind == "milestones" and db.scalar(
                select(Milestone.id)
                .join(Dependency, Dependency.milestone_id == Milestone.id)
                .where(
                    Dependency.user_id == user_id,
                    Dependency.prerequisite_id == parent.id,
                    Milestone.status == "done",
                    Milestone.archived_at.is_(None),
                )
                .limit(1)
            ):
                raise HTTPException(422, "Reopen dependent Milestones before reopening this Task")
            parent.status, parent.updated_at = "doing", now()
            parent.version += 1
            invalidate(db, entity_kind, parent)
    if isinstance(item, TaskSeries) and item.state == "ended" and values["state"] != "ended":
        raise HTTPException(422, "Ended series cannot resume. Create a new series.")
    if isinstance(item, Task) and values["status"] != item.status:
        item.completed_at = now() if values["status"] == "done" else None
        if values["status"] == "done" or item.status == "done":
            db.add(
                Activity(
                    user_id=user_id,
                    entity_id=item.id,
                    kind="task.completed" if values["status"] == "done" else "task.reopened",
                )
            )
    if isinstance(item, Task):
        for index, value in enumerate(values.get("checklist", [])):
            old = item.checklist[index] if index < len(item.checklist) else None
            if old and old.get("text") == value["text"] and old.get("checked") != value["checked"]:
                db.add(
                    Activity(
                        user_id=user_id,
                        entity_id=item.id,
                        kind="checklist.completed" if value["checked"] else "checklist.undone",
                    )
                )
    if isinstance(item, TaskSeries) and item.state != values["state"]:
        today = now().astimezone(ZoneInfo(item.timezone)).date()
        if values["state"] == "active" and item.state == "paused":
            item.cursor = max(
                item.cursor or item.start_date - timedelta(days=1), today - timedelta(days=1)
            )
        if values["state"] == "ended" and values.get("archive_future"):
            for task in db.scalars(
                select(Task).where(
                    Task.user_id == user_id,
                    Task.series_id == item.id,
                    Task.status == "todo",
                    Task.occurrence_date > today,
                    Task.archived_at.is_(None),
                )
            ):
                task.archived_at, task.updated_at = now(), now()
                task.version += 1
                invalidate(db, "tasks", task)
    extra = dict(item.details or {})
    for field, value in values.items():
        if field in item.__table__.columns:
            setattr(item, field, value)
        else:
            extra[field] = value
    item.details = extra
    item.version += 1
    item.updated_at = now()
    db.flush()
    invalidate(db, kind, item)
    return item


def list_items(db: Session, kind: str, user_id: str, page=1, size=50, query="", archived=False):
    model = model_for(kind)
    statement = select(model).where(model.user_id == user_id)
    if kind == "notes" and not archived:
        statement = select(Note).where(
            or_(
                Note.user_id == user_id,
                Note.id.in_(
                    select(NoteShare.note_id).where(
                        NoteShare.user_id == user_id,
                        NoteShare.status == "accepted",
                        NoteShare.note_id.in_(
                            select(Note.id)
                            .join(User, User.id == Note.user_id)
                            .where(User.locked_at.is_(None))
                        ),
                    )
                ),
            )
        )
    statement = statement.where(
        model.archived_at.is_not(None) if archived else model.archived_at.is_(None)
    )
    if query:
        escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        statement = statement.where(
            or_(model.title.ilike(f"%{escaped}%"), model.content.ilike(f"%{escaped}%"))
        )
        if kind == "notes":
            statement = statement.where(Note.lock_hash.is_(None))
    rows = db.scalars(
        statement.order_by(model.updated_at.desc(), model.id)
        .offset((page - 1) * size)
        .limit(size + 1)
    ).all()
    progress = progress_for_user(db, user_id) if kind == "goals" and rows else {}
    return {
        "items": [
            {
                **serialize(item, mask_note=True),
                **({"shared": item.user_id != user_id} if kind == "notes" else {}),
                **({"progress": round(progress.get(item.id, 0), 2)} if kind == "goals" else {}),
            }
            for item in rows[:size]
        ],
        "page": page,
        "has_more": len(rows) > size,
    }


def archive(
    db: Session,
    kind: str,
    user_id: str,
    entity_id: str,
    version: int,
    archived=True,
    include_contents=False,
):
    lock_owner(db, user_id)
    db.expire_all()
    item = owned(db, kind, entity_id, user_id)
    if item.version != version:
        raise HTTPException(409, "This item changed")
    if bool(item.archived_at) == archived:
        return item
    descendants = []
    if kind in ("areas", "goals", "milestones"):
        goals = list(db.scalars(select(Goal).where(Goal.user_id == user_id)))
        goal_ids = {entity_id} if kind == "goals" else set()
        if kind == "areas":
            goal_ids = {g.id for g in goals if g.area_id == entity_id}
        while True:
            expanded = goal_ids | {g.id for g in goals if g.parent_goal_id in goal_ids}
            if expanded == goal_ids:
                break
            goal_ids = expanded
        milestones = (
            list(
                db.scalars(
                    select(Milestone).where(
                        Milestone.user_id == user_id, Milestone.goal_id.in_(goal_ids)
                    )
                )
            )
            if goal_ids
            else []
        )
        milestone_ids = {m.id for m in milestones} | (
            {entity_id} if kind == "milestones" else set()
        )
        tasks = list(
            db.scalars(
                select(Task).where(
                    Task.user_id == user_id,
                    or_(Task.goal_id.in_(goal_ids), Task.milestone_id.in_(milestone_ids)),
                )
            )
        )
        descendants = [("goals", g) for g in goals if g.id in goal_ids and g.id != entity_id]
        descendants += [("milestones", m) for m in milestones] + [("tasks", t) for t in tasks]
        descendants += [
            ("habits", h)
            for h in db.scalars(select(Habit).where(Habit.user_id == user_id))
            if h.details.get("primary_goal_id") in goal_ids
        ]
        descendants += [
            ("task-series", series)
            for series in db.scalars(select(TaskSeries).where(TaskSeries.user_id == user_id))
            if (series.details.get("template") or {}).get("goal_id") in goal_ids
            or (series.details.get("template") or {}).get("milestone_id") in milestone_ids
        ]
        if (
            archived
            and any(row.archived_at is None for _, row in descendants)
            and not include_contents
        ):
            raise HTTPException(422, "Confirm include_contents to archive this item's contents")
    if not archived:
        values = {
            field: getattr(item, field)
            if field in item.__table__.columns
            else (item.details or {}).get(field, definition.get_default(call_default_factory=True))
            for field, definition in INPUTS[kind].model_fields.items()
        }
        validate_relations(db, kind, user_id, values, item.id)
        if (
            kind == "areas"
            and db.scalar(
                select(func.count())
                .select_from(Area)
                .where(Area.user_id == user_id, Area.archived_at.is_(None))
            )
            >= 4
        ):
            raise HTTPException(422, "Keep at most four active Areas")
    stamp, previous = now(), item.archived_at
    # The same timestamp identifies records archived together; never revive older archives.
    for row_kind, row in [(kind, item), *descendants]:
        if row is not item and (
            row.archived_at is not None if archived else row.archived_at != previous
        ):
            continue
        row.archived_at = stamp if archived else None
        row.updated_at, row.version = stamp, row.version + 1
        invalidate(db, row_kind, row)
    if archived:
        archived_milestones = {
            row.id
            for row_kind, row in [(kind, item), *descendants]
            if row_kind == "milestones" and row.archived_at == stamp
        }
        if archived_milestones:
            affected = (
                set(
                    db.scalars(
                        select(Dependency.milestone_id).where(
                            Dependency.user_id == user_id,
                            Dependency.prerequisite_id.in_(archived_milestones),
                        )
                    )
                )
                - archived_milestones
            )
            db.execute(
                delete(Dependency).where(
                    Dependency.user_id == user_id,
                    or_(
                        Dependency.milestone_id.in_(archived_milestones),
                        Dependency.prerequisite_id.in_(archived_milestones),
                    ),
                )
            )
            for dependant in db.scalars(
                select(Milestone).where(
                    Milestone.user_id == user_id,
                    Milestone.id.in_(affected),
                )
            ):
                dependant.version += 1
                dependant.updated_at = stamp
                invalidate(db, "milestones", dependant)
    focus = db.get(Focus, user_id)
    if (
        archived
        and focus
        and focus.goal_id
        in {row.id for row_kind, row in [(kind, item), *descendants] if row_kind == "goals"}
    ):
        focus.goal_id = None
    db.flush()
    return item


def prerequisites(db: Session, user_id: str, milestone_id: str, version: int, ids: list[str]):
    lock_owner(db, user_id)
    milestone = owned(db, "milestones", milestone_id, user_id, active=True)
    if milestone.version != version:
        raise HTTPException(409, "This Milestone changed")
    for entity_id in ids:
        prerequisite = owned(db, "milestones", entity_id, user_id, active=True)
        if milestone.status == "done" and prerequisite.status != "done":
            raise HTTPException(422, "A completed Milestone cannot gain an unfinished prerequisite")
    edges = {}
    for row in db.scalars(select(Dependency).where(Dependency.user_id == user_id)):
        edges.setdefault(row.milestone_id, []).append(row.prerequisite_id)
    edges[milestone_id] = list(set(ids))
    try:
        assert_acyclic(edges)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    db.execute(
        delete(Dependency).where(
            Dependency.user_id == user_id, Dependency.milestone_id == milestone_id
        )
    )
    db.add_all(
        Dependency(user_id=user_id, milestone_id=milestone_id, prerequisite_id=i) for i in set(ids)
    )
    milestone.version += 1
    milestone.updated_at = now()
    return milestone


def checkin(db: Session, user_id: str, habit_id: str, day: date, state: str):
    lock_owner(db, user_id)
    habit = owned(db, "habits", habit_id, user_id, active=True)
    today = now().astimezone(ZoneInfo(habit.timezone)).date()
    current = db.get(HabitDay, (habit_id, day))
    if day < habit.created_at.astimezone(
        ZoneInfo(habit.timezone)
    ).date() or day > today + timedelta(days=3 if state in ("rest", "clear") else 0):
        raise HTTPException(422, "Date is outside this Habit's check-in window")
    if state == "rest" and (day <= today or (current and current.state == "done")):
        raise HTTPException(422, "Plan rest only for tomorrow through the next three days")
    if state == "clear" and current and current.state == "rest" and day <= today:
        raise HTTPException(422, "Past and current Rest Days are preserved")
    was_done = current is not None and current.state == "done"
    if state == "clear":
        if current:
            db.delete(current)
    elif current:
        current.state = state
    else:
        db.add(HabitDay(habit_id=habit_id, day=day, state=state))
    if state == "done" and habit.first_check_in_at is None:
        habit.first_check_in_at = now()
    if was_done != (state == "done"):
        db.add(
            Activity(
                user_id=user_id,
                entity_id=habit_id,
                kind="habit.completed" if state == "done" else "habit.undone",
            )
        )
    db.flush()
    return {"day": day, "state": state}


def habit_days(db: Session, user_id: str, habit_id: str, start: date, end: date):
    habit = owned(db, "habits", habit_id, user_id)
    if (end - start).days > 366 or start > end:
        raise HTTPException(422, "Choose a date range up to 366 days")
    rows = db.scalars(
        select(HabitDay).where(HabitDay.habit_id == habit_id, HabitDay.day.between(start, end))
    ).all()
    done = {row.day for row in rows if row.state == "done"}
    rest = {row.day for row in rows if row.state == "rest"}
    since = max(start, habit.created_at.astimezone(ZoneInfo(habit.timezone)).date())
    today = min(end, now().astimezone(ZoneInfo(habit.timezone)).date())
    streak = (
        weekly_streak(done, rest, habit.target, since, today)
        if habit.frequency == "weekly"
        else daily_streak(done, rest, since, today)
    )
    return {
        "days": [{"day": row.day, "state": row.state} for row in rows],
        "window_streak": streak,
        "window_streak_unit": "weeks" if habit.frequency == "weekly" else "days",
    }


def dashboard(db: Session, user_id: str, today: date, timezone: str):
    week_start = today - timedelta(days=today.weekday())
    base = (Task.user_id == user_id, Task.archived_at.is_(None))
    counts = {
        "open_tasks": db.scalar(
            select(func.count()).select_from(Task).where(*base, Task.status != "done")
        ),
        "completed_tasks": db.scalar(
            select(func.count()).select_from(Task).where(*base, Task.status == "done")
        ),
        "goals": db.scalar(
            select(func.count())
            .select_from(Goal)
            .where(Goal.user_id == user_id, Goal.archived_at.is_(None))
        ),
        "notes": db.scalar(
            select(func.count())
            .select_from(Note)
            .where(Note.user_id == user_id, Note.archived_at.is_(None))
        ),
    }
    tasks = db.scalars(
        select(Task)
        .where(
            *base,
            Task.status != "done",
            or_(
                Task.due_date == today,
                Task.start_date == today,
                func.date(func.timezone(timezone, Task.scheduled_at)) == today,
                Task.id.in_(
                    select(TaskSelection.task_id).where(
                        TaskSelection.user_id == user_id,
                        TaskSelection.period == "daily",
                        TaskSelection.day == today,
                    )
                ),
            ),
        )
        .order_by(Task.importance.desc(), Task.id)
        .limit(50)
    ).all()
    week = db.scalars(
        select(Task)
        .where(
            *base,
            Task.status != "done",
            or_(
                Task.due_date.between(week_start, week_start + timedelta(days=6)),
                Task.start_date.between(week_start, week_start + timedelta(days=6)),
                func.date(func.timezone(timezone, Task.scheduled_at)).between(
                    week_start, week_start + timedelta(days=6)
                ),
                Task.id.in_(
                    select(TaskSelection.task_id).where(
                        TaskSelection.user_id == user_id,
                        TaskSelection.period == "weekly",
                        TaskSelection.day == week_start,
                    )
                ),
            ),
        )
        .order_by(Task.due_date, Task.id)
        .limit(50)
    ).all()
    habits = db.scalars(
        select(Habit).where(Habit.user_id == user_id, Habit.archived_at.is_(None)).limit(50)
    ).all()
    focus = db.get(Focus, user_id)
    goal = (
        db.scalar(
            select(Goal).where(
                Goal.user_id == user_id, Goal.id == focus.goal_id, Goal.archived_at.is_(None)
            )
        )
        if focus and focus.goal_id
        else None
    )
    return {
        "date": today,
        "counts": counts,
        "focus_goal": serialize(goal) if goal else None,
        "today": [serialize(t) for t in tasks],
        "week": [serialize(t) for t in week],
        "habits": [serialize(h) for h in habits],
    }


def progress_for_user(db: Session, user_id: str):
    goals = db.execute(
        select(Goal.id, Goal.parent_goal_id, Goal.status).where(
            Goal.user_id == user_id, Goal.archived_at.is_(None)
        )
    ).all()
    milestones = db.execute(
        select(Milestone.goal_id, Milestone.status).where(
            Milestone.user_id == user_id, Milestone.archived_at.is_(None)
        )
    ).all()
    tasks = db.execute(
        select(Task.goal_id, Task.status, Task.series_id).where(
            Task.user_id == user_id,
            Task.archived_at.is_(None),
            Task.goal_id.is_not(None),
            Task.series_id.is_(None),
        )
    ).all()
    return goal_progress(goals, milestones, tasks)
