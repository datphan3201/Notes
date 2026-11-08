"""Owned read tools and a proposal compiler. Tool calls never write business data."""

import copy
import re
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select

from planner import planning
from planner.models import Dependency, Goal, Milestone, Note, Task, now
from planner.timezones import zone

KINDS = {
    "goal": "goals",
    "milestone": "milestones",
    "task": "tasks",
    "habit": "habits",
    "note": "notes",
}
REFERENCES = {
    "area_id": "areas",
    "parent_goal_id": "goals",
    "goal_id": "goals",
    "milestone_id": "milestones",
    "task_id": "tasks",
    "primary_goal_id": "goals",
}
ALIASES = {
    "name": "title",
    "description": "content",
    "deadline": "due_date",
    "strategy_notes": "strategy",
    "period": "frequency",
    "target_frequency": "target",
    "scheduled_start": "scheduled_at",
}


def obj(properties, required=()):
    return {
        "type": "object",
        "properties": properties,
        "required": list(required),
        "additionalProperties": False,
    }


def catalogue():
    string = {"type": "string"}
    identifier = {
        "type": "string",
        "description": "An owned ID returned by a read tool, or an earlier create ref c1, c2…",
    }
    day = {
        "type": "string",
        "description": "YYYY-MM-DD in the account timezone; empty clears an optional date",
    }
    fields = {
        "title": string,
        "content": string,
        "importance": {"type": "integer", "minimum": 1, "maximum": 5},
        "start_date": day,
        "due_date": day,
        "expected_result": string,
        "completion_criteria": string,
    }
    goal = {
        **fields,
        "area_id": identifier,
        "parent_goal_id": identifier,
        "allow_duplicate": {"type": "boolean"},
        "strategy": string,
    }
    task = {
        **fields,
        "goal_id": identifier,
        "milestone_id": identifier,
        "estimated_minutes": {"type": "integer", "minimum": 1, "maximum": 1440},
        "scheduled_start": {
            "type": "string",
            "description": "Local YYYY-MM-DDTHH:MM in the account timezone",
        },
        "scheduled_end": {
            "type": "string",
            "description": "Local YYYY-MM-DDTHH:MM in the account timezone",
        },
    }
    milestone = {key: value for key, value in fields.items() if key != "expected_result"}
    habit = {
        "title": string,
        "content": string,
        "importance": fields["importance"],
        "primary_goal_id": identifier,
        "frequency": {"type": "string", "enum": ["daily", "weekly"]},
        "target": {"type": "integer", "minimum": 1, "maximum": 7},
    }
    note = {"title": string, "content": string, "goal_id": identifier, "task_id": identifier}
    specs = []

    def add(name, description, properties, required=()):
        specs.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": description,
                    "parameters": obj(properties, required),
                },
            }
        )

    add(
        "list_areas",
        "List the user's Areas before choosing where a new Goal belongs.",
        {"query": string},
    )
    for singular, kind in KINDS.items():
        if kind != "milestones":
            add(
                "search_" + kind,
                "Search owned active "
                + kind
                + "; an empty query lists recent items. Locked Notes are excluded.",
                {"query": string, "include_completed": {"type": "boolean"}},
            )
            add(
                "get_" + singular,
                "Read an owned " + singular + " with its ID, version, fields and parent context.",
                {"id": identifier},
                ["id"],
            )
    add(
        "get_roadmap",
        "Read a Goal, ordered Milestones, their Tasks and prerequisites, direct Tasks and child Goals.",
        {"goal_id": identifier},
        ["goal_id"],
    )
    ms_item = obj(
        {**milestone, "tasks": {"type": "array", "items": obj(task, ["title"]), "maxItems": 15}},
        ["title"],
    )
    roadmap_goal = obj({**goal, "id": identifier})
    add(
        "create_roadmap",
        "QUEUE one complete Goal → ordered Milestones → Tasks structure for ONE user confirmation. goal.id reuses an existing Goal; otherwise provide title and exactly one area_id or parent_goal_id. Never replace phases with child Goals.",
        {
            "goal": roadmap_goal,
            "milestones": {"type": "array", "items": ms_item, "minItems": 1, "maxItems": 12},
            "tasks": {"type": "array", "items": obj(task, ["title"]), "maxItems": 15},
            "ordered": {"type": "boolean"},
        },
        ["goal", "milestones"],
    )
    add(
        "create_milestones",
        "QUEUE Milestones and their Tasks inside a Goal; ordered defaults true and chains prerequisites.",
        {
            "goal_id": identifier,
            "milestones": {"type": "array", "items": ms_item, "minItems": 1, "maxItems": 12},
            "ordered": {"type": "boolean"},
            "after_milestone_id": identifier,
        },
        ["goal_id", "milestones"],
    )
    add(
        "create_tasks",
        "QUEUE concrete Tasks under exactly one Goal/Milestone, or Inbox when neither is supplied.",
        {"tasks": {"type": "array", "items": obj(task, ["title"]), "minItems": 1, "maxItems": 15}},
        ["tasks"],
    )
    for singular, properties in [("goal", goal), ("habit", habit), ("note", note)]:
        add(
            "create_" + singular,
            "QUEUE a new "
            + singular
            + "; returns a local ref. Nothing is written until confirmation.",
            properties,
            ["title"],
        )
    for singular, properties in [
        ("goal", goal),
        ("milestone", milestone),
        ("task", task),
        ("habit", habit),
        ("note", note),
    ]:
        add(
            "update_" + singular,
            "QUEUE edits; only pass changed fields. Existing identity, checklist and history are preserved.",
            {
                **properties,
                "id": identifier,
                "append_content": string,
                **({"clear_schedule": {"type": "boolean"}} if singular == "task" else {}),
            },
            ["id"],
        )
        add(
            "delete_" + singular,
            "QUEUE deletion ONLY when explicitly requested. Notes are permanently removed with files; planning work is archived. A Milestone must be empty first.",
            {"id": identifier},
            ["id"],
        )
        if singular in ("goal", "milestone", "task"):
            add(
                "complete_" + singular,
                "QUEUE completion using ordinary domain rules. Required acknowledgements are shown to the user.",
                {"id": identifier},
                ["id"],
            )
            add(
                "reopen_" + singular,
                "QUEUE reopening. For an overdue Task supply a new due_date or an empty string to explicitly clear it.",
                {"id": identifier, "due_date": day},
                ["id"],
            )
    add(
        "move_tasks",
        "QUEUE moving existing Tasks, preserving IDs and history. Choose exactly one destination: goal_id, milestone_id, or inbox true. Never delete and recreate to restructure.",
        {
            "task_ids": {"type": "array", "items": identifier, "minItems": 1, "maxItems": 30},
            "goal_id": identifier,
            "milestone_id": identifier,
            "inbox": {"type": "boolean"},
        },
        ["task_ids"],
    )
    add(
        "reschedule",
        "QUEUE Calendar moves atomically, keeping local wall-clock times across DST. Give shift_days OR to_date; completed work and repeating occurrences stay fixed.",
        {
            "items": {
                "type": "array",
                "items": obj(
                    {
                        "type": {"type": "string", "enum": ["goal", "milestone", "task"]},
                        "id": identifier,
                    },
                    ["type", "id"],
                ),
                "minItems": 1,
                "maxItems": 30,
            },
            "shift_days": {"type": "integer", "minimum": -366, "maximum": 366},
            "to_date": day,
        },
        ["items"],
    )
    add(
        "check_in_habit",
        "QUEUE a Habit check-in for a date, defaulting to today in its own timezone. Never check in future dates.",
        {"id": identifier, "date": day},
        ["id"],
    )
    return specs


def local_instant(value, timezone):
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=zone(timezone))
        if parsed.astimezone(UTC).astimezone(zone(timezone)).replace(tzinfo=None) != parsed.replace(
            tzinfo=None
        ):
            raise ValueError("This local time does not exist because of daylight saving")
    return parsed.astimezone(UTC).isoformat()


class TaskRecreation(ValueError):
    def __init__(self, title):
        super().__init__(
            "Move existing Tasks instead of deleting and recreating them; matching queued deletion was withdrawn"
        )
        self.title = title.casefold()


class ToolSession:
    def __init__(self, user_id, question, timezone, references):
        self.user_id, self.question, self.timezone = user_id, question, timezone
        self.references = references
        self.operations, self.locals, self.versions = [], {}, {}
        self.serial = 0

    def read(self, db, kind, identifier):
        row = planning.owned(db, kind, identifier, self.user_id, active=True)
        if isinstance(row, Note) and row.lock_hash:
            raise HTTPException(404, "Not found")
        previous = self.references.get((kind, row.id))
        if previous and previous["version"] != row.version:
            raise HTTPException(409, "Context changed during this request; generate a new proposal")
        self.references[(kind, row.id)] = {"kind": kind, "id": row.id, "version": row.version}
        return row

    def public(self, row):
        values = jsonable_encoder(planning.serialize(row))
        for key, value in list(values.items()):
            if isinstance(value, str) and len(value) > 4000:
                values[key] = value[:4000]
                values["truncated"] = True
        return values

    def parent(self, db, kind, identifier):
        if identifier in self.locals:
            if self.locals[identifier]["kind"] != kind:
                raise ValueError("Local reference has the wrong type")
        else:
            self.read(db, kind, identifier)
        return identifier

    def fields(self, arguments):
        values = {
            ALIASES.get(key, key): value
            for key, value in arguments.items()
            if key
            not in (
                "id",
                "allow_duplicate",
                "append_content",
                "append_description",
                "clear_schedule",
            )
        }
        for key in ("start_date", "due_date"):
            if key in values:
                values[key] = values[key] or None
                if (
                    values[key]
                    and date.fromisoformat(values[key])
                    < now().astimezone(zone(self.timezone)).date()
                ):
                    raise ValueError("New dates must be today or later")
        for key in ("scheduled_at", "scheduled_end"):
            if values.get(key):
                values[key] = local_instant(values[key], self.timezone)
                if datetime.fromisoformat(values[key]) < now():
                    raise ValueError("New scheduled times must not be in the past")
        if arguments.get("clear_schedule"):
            values.update(scheduled_at=None, scheduled_end=None)
        return values

    def relations(self, db, values):
        for field, kind in REFERENCES.items():
            if values.get(field):
                self.parent(db, kind, values[field])
        for identifier in values.get("related", []):
            self.parent(db, "goals", identifier)

    def append(self, operation):
        if len(self.operations) >= 50:
            raise ValueError("Use at most 50 changes in one confirmation")
        self.operations.append(operation)

    def create(self, db, kind, arguments):
        fields = self.fields(arguments)
        if kind == "habits":
            fields["timezone"] = self.timezone
        if kind == "goals":
            if (
                fields.get("parent_goal_id")
                and re.search(r"milestone|cột mốc|giai đoạn", self.question, re.I)
                and not re.search(r"sub.?goal|mục tiêu con", self.question, re.I)
            ):
                raise ValueError("Use Milestones for phases, not child Goals")
            title = fields.get("title", "")
            duplicate = db.scalar(
                select(Goal.id).where(
                    Goal.user_id == self.user_id,
                    Goal.archived_at.is_(None),
                    func.lower(Goal.title) == title.lower(),
                )
            )
            duplicate = duplicate or any(
                v["kind"] == "goals" and v["fields"]["title"].casefold() == title.casefold()
                for v in self.locals.values()
            )
            if duplicate and not (
                arguments.get("allow_duplicate")
                and re.search(r"separate|duplicate|riêng|khác|trùng", self.question, re.I)
            ):
                raise ValueError(
                    "An active Goal with this title already exists. Reuse it or ask the user to confirm a separate Goal."
                )
        self.relations(db, fields)
        validated = planning.INPUTS[kind].model_validate(fields).model_dump(mode="json")
        fields = {key: validated[key] for key in fields}
        if kind == "tasks" and any(
            op["kind"] == "tasks"
            and op["action"] == "archive"
            and self.public(self.read(db, "tasks", op["id"]))["title"].casefold()
            == fields["title"].casefold()
            for op in self.operations
        ):
            raise TaskRecreation(fields["title"])
        self.serial += 1
        ref = f"c{self.serial}"
        self.locals[ref] = {"kind": kind, "fields": fields}
        self.append({"kind": kind, "action": "create", "ref": ref, "fields": fields})
        return ref

    def change(self, db, kind, identifier, action, fields, acknowledgements=()):
        if identifier in self.locals:
            self.parent(db, kind, identifier)
            base = 1
        else:
            base = self.read(db, kind, identifier).version
        key = (kind, identifier)
        version = self.versions.get(key, base)
        self.append(
            {
                "kind": kind,
                "action": action,
                "id": identifier,
                "version": version,
                "fields": fields,
                "acknowledgements": list(acknowledgements),
            }
        )
        if action not in ("checkin", "delete"):
            self.versions[key] = version + 1

    def milestone_group(self, db, goal_id, milestones, ordered=True, after=None):
        self.parent(db, "goals", goal_id)
        if not isinstance(milestones, list) or not 1 <= len(milestones) <= 12:
            raise ValueError("Use 1–12 Milestones")
        previous = self.parent(db, "milestones", after) if after else None
        for milestone in milestones:
            values = dict(milestone)
            tasks = values.pop("tasks", [])
            ref = self.create(db, "milestones", {**values, "goal_id": goal_id})
            if ordered and previous:
                self.change(db, "milestones", ref, "prerequisites", {"ids": [previous]})
            self.tasks(db, tasks, "milestone_id", ref)
            previous = ref

    def tasks(self, db, tasks, parent_field=None, parent_id=None):
        if not isinstance(tasks, list) or len(tasks) > 15:
            raise ValueError("Use at most 15 Tasks per parent")
        result = []
        for task in tasks:
            fields = dict(task)
            if parent_field:
                fields.pop("goal_id", None)
                fields.pop("milestone_id", None)
                fields[parent_field] = parent_id
            result.append(self.create(db, "tasks", fields))
        return result

    def update(self, db, kind, identifier, arguments):
        row = self.read(db, kind, identifier)
        fields = self.fields(arguments)
        existing = {
            key: getattr(row, key)
            if key in row.__table__.columns
            else row.details.get(key, definition.get_default(call_default_factory=True))
            for key, definition in planning.INPUTS[kind].model_fields.items()
        }
        for pending in self.operations:
            if (
                pending.get("id") == identifier
                and pending["kind"] == kind
                and pending["action"] == "update"
            ):
                existing.update(pending["fields"])
        appended = arguments.get("append_content") or arguments.get("append_description")
        if appended:
            fields["content"] = (
                fields.get("content", existing.get("content", "")) + "\n" + appended
            ).strip()
        self.relations(db, fields)
        planning.INPUTS[kind].model_validate({**existing, **fields})
        acks = []
        if fields.get("status") in ("done", "completed"):
            if kind == "tasks" and any(not item["checked"] for item in row.checklist):
                acks.append("unchecked")
            if kind in ("goals", "milestones"):
                unfinished = db.scalar(
                    select(Task.id)
                    .where(
                        Task.user_id == self.user_id,
                        Task.archived_at.is_(None),
                        Task.series_id.is_(None),
                        Task.status != "done",
                        Task.goal_id == row.id if kind == "goals" else Task.milestone_id == row.id,
                    )
                    .limit(1)
                )
                if kind == "goals":
                    unfinished = (
                        unfinished
                        or db.scalar(
                            select(Goal.id)
                            .where(
                                Goal.user_id == self.user_id,
                                Goal.parent_goal_id == row.id,
                                Goal.archived_at.is_(None),
                                Goal.status != "completed",
                            )
                            .limit(1)
                        )
                        or db.scalar(
                            select(Milestone.id)
                            .where(
                                Milestone.user_id == self.user_id,
                                Milestone.goal_id == row.id,
                                Milestone.archived_at.is_(None),
                                Milestone.status != "done",
                            )
                            .limit(1)
                        )
                    )
                if unfinished:
                    acks.append("unfinished")
        if (
            kind == "habits"
            and row.first_check_in_at
            and fields.get("frequency", row.frequency) != row.frequency
        ):
            raise ValueError("Habit period is fixed after the first check-in")
        if fields.get("status") == "todo" and existing.get("status") in ("done", "completed"):
            if (
                kind == "tasks"
                and row.due_date
                and row.due_date < now().astimezone(zone(self.timezone)).date()
                and "due_date" not in fields
            ):
                raise ValueError("Choose a new due_date or explicitly clear the overdue deadline")
            parent_goal = getattr(row, "parent_goal_id", None) or getattr(row, "goal_id", None)
            if getattr(row, "milestone_id", None):
                parent = self.read(db, "milestones", row.milestone_id)
                parent_goal = parent.goal_id
                if parent.status == "done":
                    acks.append("reopen_parents")
            while parent_goal:
                parent = self.read(db, "goals", parent_goal)
                if parent.status == "completed" and "reopen_parents" not in acks:
                    acks.append("reopen_parents")
                parent_goal = parent.parent_goal_id
        self.change(db, kind, identifier, "update", fields, acks)

    def reschedule(self, db, arguments):
        items, shift, target = (
            arguments["items"],
            arguments.get("shift_days"),
            arguments.get("to_date"),
        )
        if not 1 <= len(items) <= 30 or (shift is None) == (target is None):
            raise ValueError("Choose 1–30 items and exactly one of shift_days or to_date")
        if shift is not None and (type(shift) is not int or not 0 < abs(shift) <= 366):
            raise ValueError("shift_days must be a nonzero integer within 366 days")
        seen = set()
        for item in items:
            kind = KINDS[item["type"]]
            if kind not in ("tasks", "goals", "milestones"):
                raise ValueError("Only Tasks, Goals and Milestones have Calendar dates")
            if (kind, item["id"]) in seen:
                continue
            seen.add((kind, item["id"]))
            row = self.read(db, kind, item["id"])
            if row.status in ("done", "completed") or getattr(row, "series_id", None):
                raise ValueError("Completed work and repeating occurrences stay fixed")
            block = getattr(row, "scheduled_at", None)
            anchor = (
                block.astimezone(zone(self.timezone)).date()
                if block
                else row.due_date or row.start_date
            )
            offset = (
                shift
                if shift is not None
                else (date.fromisoformat(target) - anchor).days
                if anchor
                else None
            )
            fields = {}
            if anchor is None:
                if target is None:
                    raise ValueError("Use to_date for undated work")
                fields["due_date"] = target
            else:
                for field in ("start_date", "due_date"):
                    if getattr(row, field):
                        fields[field] = (getattr(row, field) + timedelta(days=offset)).isoformat()
                for field in ("scheduled_at", "scheduled_end", "reminder_at"):
                    value = getattr(row, field, None)
                    if value:
                        local = value.astimezone(zone(self.timezone)) + timedelta(days=offset)
                        fields[field] = local_instant(
                            local.replace(tzinfo=None).isoformat(), self.timezone
                        )
            self.update(db, kind, row.id, fields)

    def execute(self, db, name, arguments):
        checkpoint = copy.deepcopy((self.operations, self.locals, self.versions))
        try:
            result = self.run(db, name, arguments)
            return jsonable_encoder(result)
        except (HTTPException, ValueError, KeyError, TypeError) as exc:
            self.operations, self.locals, self.versions = checkpoint
            if isinstance(exc, TaskRecreation):
                removed_refs = set()
                kept = []
                for operation in self.operations:
                    matches = operation["kind"] == "tasks" and (
                        operation["action"] == "create"
                        and operation["fields"]["title"].casefold() == exc.title
                        or operation["action"] == "archive"
                        and self.read(db, "tasks", operation["id"]).title.casefold() == exc.title
                    )
                    if matches:
                        if operation.get("ref"):
                            removed_refs.add(operation["ref"])
                    else:
                        kept.append(operation)
                self.operations = kept
                self.locals = {
                    ref: item for ref, item in self.locals.items() if ref not in removed_refs
                }
                self.versions = {}
                for operation in self.operations:
                    if operation["action"] == "create":
                        continue
                    key = (operation["kind"], operation["id"])
                    base = 1 if operation["id"] in self.locals else self.references[key]["version"]
                    operation["version"] = self.versions.get(key, base)
                    if operation["action"] not in ("checkin", "delete"):
                        self.versions[key] = operation["version"] + 1
            return {"error": str(exc.detail if isinstance(exc, HTTPException) else exc)}

    def run(self, db, name, arguments):
        if name == "list_areas" or name.startswith("search_") or name == "read_context":
            kind = (
                "areas"
                if name == "list_areas"
                else arguments["kind"]
                if name == "read_context"
                else name.removeprefix("search_")
            )
            if kind not in ("areas", *KINDS.values()):
                raise ValueError("This data kind is not available to the assistant")
            model = planning.model_for(kind)
            statement = select(model).where(
                model.user_id == self.user_id, model.archived_at.is_(None)
            )
            if model is Note:
                statement = statement.where(Note.lock_hash.is_(None))
            query = arguments.get("query", "")
            if query:
                statement = statement.where(
                    func.strpos(func.lower(model.title + " " + model.content), query.lower()) > 0
                )
            if kind in ("tasks", "goals") and not (
                arguments.get("include_completed") or arguments.get("include_done")
            ):
                statement = statement.where(model.status.not_in(["done", "completed"]))
            rows = db.scalars(statement.order_by(model.updated_at.desc(), model.id).limit(12)).all()
            return {kind: [self.public(self.read(db, kind, row.id)) for row in rows], "limit": 12}
        if name == "get_roadmap":
            goal = self.read(db, "goals", arguments["goal_id"])
            milestones = db.scalars(
                select(Milestone)
                .where(
                    Milestone.user_id == self.user_id,
                    Milestone.goal_id == goal.id,
                    Milestone.archived_at.is_(None),
                )
                .order_by(Milestone.created_at, Milestone.id)
                .limit(30)
            ).all()
            tasks = db.scalars(
                select(Task)
                .where(
                    Task.user_id == self.user_id,
                    Task.archived_at.is_(None),
                    (Task.goal_id == goal.id)
                    | Task.milestone_id.in_([row.id for row in milestones]),
                )
                .order_by(Task.created_at, Task.id)
                .limit(100)
            ).all()
            edges = db.scalars(
                select(Dependency).where(
                    Dependency.user_id == self.user_id,
                    Dependency.milestone_id.in_([row.id for row in milestones]),
                )
            ).all()
            children = db.scalars(
                select(Goal)
                .where(
                    Goal.user_id == self.user_id,
                    Goal.parent_goal_id == goal.id,
                    Goal.archived_at.is_(None),
                )
                .limit(12)
            ).all()
            return {
                "goal": self.public(goal),
                "milestones": [
                    {
                        **self.public(self.read(db, "milestones", row.id)),
                        "prerequisites": [
                            edge.prerequisite_id for edge in edges if edge.milestone_id == row.id
                        ],
                        "tasks": [
                            self.public(self.read(db, "tasks", task.id))
                            for task in tasks
                            if task.milestone_id == row.id
                        ],
                    }
                    for row in milestones
                ],
                "tasks": [
                    self.public(self.read(db, "tasks", row.id))
                    for row in tasks
                    if row.goal_id == goal.id
                ],
                "child_goals": [self.public(self.read(db, "goals", row.id)) for row in children],
            }
        if name.startswith("get_"):
            return self.public(self.read(db, KINDS[name.removeprefix("get_")], arguments["id"]))
        if name == "create_roadmap":
            goal = arguments["goal"]
            goal_id = (
                self.parent(db, "goals", goal["id"])
                if goal.get("id")
                else self.create(db, "goals", goal)
            )
            self.milestone_group(
                db, goal_id, arguments["milestones"], arguments.get("ordered", True)
            )
            self.tasks(db, arguments.get("tasks", []), "goal_id", goal_id)
        elif name == "create_milestones":
            self.milestone_group(
                db,
                arguments["goal_id"],
                arguments["milestones"],
                arguments.get("ordered", True),
                arguments.get("after_milestone_id"),
            )
        elif name == "create_tasks":
            if not arguments["tasks"]:
                raise ValueError("Provide at least one Task")
            self.tasks(db, arguments["tasks"])
        elif name == "move_tasks":
            if (
                sum(bool(arguments.get(key)) for key in ("goal_id", "milestone_id", "inbox")) != 1
                or not 1 <= len(arguments["task_ids"]) <= 30
            ):
                raise ValueError("Choose exactly one destination for 1–30 Tasks")
            fields = {
                "goal_id": arguments.get("goal_id"),
                "milestone_id": arguments.get("milestone_id"),
            }
            for identifier in dict.fromkeys(arguments["task_ids"]):
                self.update(db, "tasks", identifier, fields)
        elif name == "reschedule":
            self.reschedule(db, arguments)
        elif name == "check_in_habit":
            row = self.read(db, "habits", arguments["id"])
            day = arguments.get("date") or now().astimezone(zone(row.timezone)).date().isoformat()
            if date.fromisoformat(day) > now().astimezone(zone(row.timezone)).date():
                raise ValueError("Future check-ins are not allowed")
            self.change(db, "habits", row.id, "checkin", {"day": day, "state": "done"})
        elif name.startswith("create_"):
            self.create(db, KINDS[name.removeprefix("create_")], arguments)
        elif name.startswith("update_"):
            self.update(db, KINDS[name.removeprefix("update_")], arguments["id"], arguments)
        elif name.startswith("delete_"):
            kind = KINDS[name.removeprefix("delete_")]
            row = self.read(db, kind, arguments["id"])
            if kind == "milestones":
                tasks = db.scalars(
                    select(Task).where(
                        Task.user_id == self.user_id,
                        Task.milestone_id == row.id,
                        Task.archived_at.is_(None),
                    )
                ).all()
                for task in tasks:
                    parent, archived = task.milestone_id, False
                    for pending in self.operations:
                        if pending["kind"] == "tasks" and pending.get("id") == task.id:
                            if pending["action"] == "archive":
                                archived = True
                            if (
                                pending["action"] == "update"
                                and "milestone_id" in pending["fields"]
                            ):
                                parent = pending["fields"]["milestone_id"]
                    if not archived and parent == row.id:
                        raise ValueError("Move or archive this Milestone's Tasks first")
            if kind == "tasks" and any(
                op["kind"] == "tasks"
                and op["action"] == "create"
                and op["fields"]["title"].casefold() == row.title.casefold()
                for op in self.operations
            ):
                raise TaskRecreation(row.title)
            self.change(
                db,
                kind,
                row.id,
                "delete" if kind == "notes" else "archive",
                {"include_contents": kind == "goals"} if kind != "notes" else {},
            )
        elif name.startswith("complete_") or name.startswith("reopen_"):
            action, singular = name.split("_", 1)
            kind = KINDS[singular]
            self.update(
                db,
                kind,
                arguments["id"],
                {
                    **{key: value for key, value in arguments.items() if key != "id"},
                    "status": ("completed" if kind == "goals" else "done")
                    if action == "complete"
                    else "todo",
                },
            )
        else:
            raise ValueError("Unknown assistant tool")
        return {
            "status": "queued_for_user_confirmation",
            "changes": len(self.operations),
            "created": [
                {"ref": ref, "kind": item["kind"], "title": item["fields"]["title"]}
                for ref, item in self.locals.items()
            ],
        }
