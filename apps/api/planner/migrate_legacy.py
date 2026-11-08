"""Read-only MySQL snapshot and transactional, archive-preserving local import.

No production cutover is performed by this command. Connection strings come from the
environment and are never printed. A verified snapshot is retained in full, including Teams.
"""

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
from datetime import UTC, date, datetime, time
from decimal import Decimal
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from sqlalchemy import create_engine, func, select, text

from planner.db import session_factory
from planner.domain import assert_acyclic
from planner.models import (
    Activity,
    Area,
    Attachment,
    Dependency,
    Habit,
    HabitDay,
    ImportReceipt,
    LegacyRecord,
    Note,
    Review,
    Task,
    TaskSeries,
    User,
)
from planner.planning import MODELS
from planner.schemas import WorkspacePreferences


def encode(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return {"$binary": base64.b64encode(value).decode()}
    if isinstance(value, Decimal):
        return {"$decimal": str(value)}
    raise TypeError(type(value).__name__)


def canonical(row):
    return json.dumps(
        row, sort_keys=True, ensure_ascii=False, default=encode, separators=(",", ":")
    )


def checksum(path):
    with path.open("rb") as handle:
        return hashlib.file_digest(handle, "sha256").hexdigest()


def safe_child(root: Path, name: str):
    path = root / name
    if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
        raise ValueError("Snapshot path escapes its private directory")
    return path


def export_snapshot(dsn: str, output: Path, file_root: Path | None = None):
    repository = Path(__file__).resolve().parents[3]
    if output.resolve().is_relative_to(repository):
        raise ValueError("Export outside the repository and public web roots")
    output.mkdir(mode=0o700)  # Exclusive; never overwrite an existing export.
    manifest = {"format": 1, "created_at": datetime.now(UTC).isoformat(), "tables": {}, "files": {}}
    source = create_engine(dsn, hide_parameters=True)
    try:
        with source.connect() as connection:
            connection.exec_driver_sql("SET SESSION TRANSACTION READ ONLY")
            connection.exec_driver_sql("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
            connection.exec_driver_sql("START TRANSACTION WITH CONSISTENT SNAPSHOT")
            tables = connection.execute(
                text(
                    "SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
                )
            ).all()
            for name, engine in tables:
                if not re.fullmatch(r"[a-zA-Z0-9_]+", name) or engine != "InnoDB":
                    raise ValueError("Export requires supported InnoDB table names")
                path, count = output / (name + ".jsonl"), 0
                with path.open("x", encoding="utf-8") as handle:
                    rows = connection.execution_options(stream_results=True).exec_driver_sql(
                        f"SELECT * FROM `{name}`"
                    )
                    for row in rows.mappings():
                        handle.write(canonical(dict(row)) + "\n")
                        count += 1
                path.chmod(0o600)
                columns = connection.execute(
                    text(
                        "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table ORDER BY ORDINAL_POSITION"
                    ),
                    {"table": name},
                ).all()
                manifest["tables"][name] = {
                    "path": path.name,
                    "rows": count,
                    "sha256": checksum(path),
                    "columns": [list(row) for row in columns],
                }
            connection.rollback()
        if file_root:
            root = file_root.resolve()
            for original in sorted(root.rglob("*")):
                if original.is_symlink():
                    raise ValueError("Private file snapshot must not contain symlinks")
                if not original.is_file():
                    continue
                relative = original.relative_to(root).as_posix()
                target = output / "files" / relative
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                before = original.stat()
                shutil.copyfile(original, target)
                after = original.stat()
                if (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
                    raise ValueError(
                        "Source file changed during snapshot; freeze writes and export again"
                    )
                target.chmod(0o600)
                manifest["files"][relative] = {
                    "size": target.stat().st_size,
                    "sha256": checksum(target),
                }
        (output / "manifest.json").write_text(canonical(manifest), encoding="utf-8")
        (output / "manifest.json").chmod(0o600)
        return {"tables": len(manifest["tables"]), "files": len(manifest["files"])}
    finally:
        source.dispose()


def verify_snapshot(root: Path):
    root = root.resolve()
    manifest = json.loads((root / "manifest.json").read_text())
    if manifest["format"] != 1:
        raise ValueError("Unsupported snapshot format")
    for name, spec in manifest["tables"].items():
        if not re.fullmatch(r"[a-zA-Z0-9_]+", name):
            raise ValueError("Invalid source table name")
        path = safe_child(root, spec["path"])
        if checksum(path) != spec["sha256"]:
            raise ValueError("Snapshot checksum mismatch: " + name)
        with path.open() as handle:
            count = sum(1 for line in handle if line.strip())
        if count != spec["rows"]:
            raise ValueError("Snapshot row count mismatch: " + name)
    for name, spec in manifest["files"].items():
        path = safe_child(root / "files", name)
        if path.stat().st_size != spec["size"] or checksum(path) != spec["sha256"]:
            raise ValueError("Private file checksum mismatch")
    return manifest


def rows(root, manifest, table):
    if table not in manifest["tables"]:
        return
    with safe_child(root, manifest["tables"][table]["path"]).open() as handle:
        for line in handle:
            if line.strip():
                yield json.loads(line)


def user_id(value):
    return str(uuid5(NAMESPACE_URL, f"datphan3201/Notes:user:{value}"))


def instant(value):
    if value is None:
        return None
    stamp = datetime.fromisoformat(value)
    return stamp.replace(tzinfo=UTC) if stamp.tzinfo is None else stamp.astimezone(UTC)


def day(value):
    return date.fromisoformat(value) if value else None


def common(row):
    return {
        "id": row["id"],
        "user_id": user_id(row["user_id"]),
        "title": row.get("name", row.get("title", "")),
        "content": row.get("description", row.get("content", "")),
        "version": row.get("version", 1),
        "importance": row.get("importance", 3),
        "created_at": instant(row["created_at"]),
        "updated_at": instant(row["updated_at"]),
        "archived_at": instant(row.get("archived_at") or row.get("deleted_at")),
    }


def import_snapshot(root: Path, expected_database: str, *, merge_existing: bool = False):
    from sqlalchemy.engine import make_url

    from planner.config import settings

    root = root.resolve()
    manifest = verify_snapshot(root)
    fingerprint = checksum(root / "manifest.json")
    config = settings()
    allowed = expected_database in ("planner_test", "planner_staging") or (
        expected_database == "planner_dev"
        and merge_existing
        and config.environment == "development"
    )
    if not allowed or make_url(config.database_url).database != expected_database:
        raise ValueError("Import is restricted to test/staging or an explicit development merge")
    report = {
        "snapshot_sha256": fingerprint,
        "archived_tables": {},
        "imported": {},
        "merge_existing": merge_existing,
        "indexing_queued": False,
        "cutover_ready": False,
        "limitations": [
            "Raw archive retains every original field; import is not proof of product parity",
            "Unsupported relationships/settings/Teams remain in the private raw archive",
            "Legacy MFA accounts require assisted recovery; old sessions/tokens/vectors are not reused",
            "Import does not enqueue external AI indexing or send imported content to a provider",
        ],
    }
    copied = []
    with session_factory()() as db:
        if db.scalar(text("SELECT current_database()")) != expected_database:
            raise ValueError("Actual import database does not match the allowlist")
        # Serialize imports; application writers must be paused during a development merge.
        db.execute(text("SELECT pg_advisory_xact_lock(71293011)"))
        previous = db.get(ImportReceipt, fingerprint)
        if previous:
            return {**previous.report, "replayed": True}
        if db.scalar(select(func.count()).select_from(LegacyRecord)) or db.scalar(
            select(func.count()).select_from(ImportReceipt)
        ):
            raise ValueError("Target already contains a different legacy snapshot")
        if not merge_existing and db.scalar(select(func.count()).select_from(User)):
            raise ValueError("Import requires an empty target or an explicit merge")
        source_users = list(rows(root, manifest, "users"))
        owner_ids = [user_id(row["id"]) for row in source_users]
        emails = [row["email"].lower() for row in source_users]
        if db.scalar(
            select(User.id).where((User.id.in_(owner_ids)) | (func.lower(User.email).in_(emails)))
        ):
            raise ValueError("Legacy account ID/email conflicts with an existing account")
        counted_models = {
            **MODELS,
            "users": User,
            "attachments": Attachment,
            "activities": Activity,
            "dependencies": Dependency,
            "habit-days": HabitDay,
        }
        report["existing"] = {
            kind: db.scalar(select(func.count()).select_from(model))
            for kind, model in counted_models.items()
        }
        try:
            for table in manifest["tables"]:
                batch = []
                for offset, row in enumerate(rows(root, manifest, table)):
                    encoded = canonical(row)
                    batch.append(
                        LegacyRecord(
                            source_table=table,
                            source_key=str(offset),
                            payload=row,
                            checksum=hashlib.sha256(encoded.encode()).hexdigest(),
                        )
                    )
                    if len(batch) == 1000:
                        db.add_all(batch)
                        db.flush()
                        batch = []
                db.add_all(batch)
                report["archived_tables"][table] = manifest["tables"][table]["rows"]
            preferences = {
                str(row["user_id"]): row for row in rows(root, manifest, "user_preferences")
            }
            for row in source_users:
                preference = preferences.get(str(row["id"]), {})
                db.add(
                    User(
                        id=user_id(row["id"]),
                        email=row["email"].lower(),
                        name=row["display_name"],
                        password_hash=row["password"],
                        created_at=instant(row["created_at"]),
                        timezone=preference.get("timezone", "UTC"),
                        locale=preference.get("locale", "vi"),
                        theme=preference.get("theme", "light"),
                        preferences={
                            key: value
                            for key, value in preference.items()
                            if key in WorkspacePreferences.model_fields and value is not None
                        },
                        email_verified_at=instant(row.get("email_verified_at")),
                        locked_at=instant(row.get("locked_at")),
                        requires_mfa_reset=bool(row.get("two_factor_method")),
                    )
                )
            db.flush()
            for row in rows(root, manifest, "areas"):
                db.add(Area(**common(row)))
            db.flush()
            goals = {row["id"]: row for row in rows(root, manifest, "goals")}
            assert_acyclic(
                {
                    key: [row["parent_goal_id"]] if row.get("parent_goal_id") else []
                    for key, row in goals.items()
                }
            )
            imported = set()
            while goals:
                ready = [
                    key
                    for key, row in goals.items()
                    if row.get("parent_goal_id") is None or row["parent_goal_id"] in imported
                ]
                if not ready:
                    raise ValueError("Unresolved Goal parent mapping")
                for key in ready:
                    row = goals.pop(key)
                    db.add(
                        MODELS["goals"](
                            **common(row),
                            area_id=row.get("area_id"),
                            parent_goal_id=row.get("parent_goal_id"),
                            start_date=day(row.get("start_date")),
                            due_date=day(row.get("deadline")),
                            status={"Active": "active", "Completed": "completed"}[row["status"]],
                            expected_result=row.get("expected_result", ""),
                            completion_criteria=row.get("completion_criteria", ""),
                        )
                    )
                    imported.add(key)
                db.flush()
            for row in rows(root, manifest, "milestones"):
                db.add(
                    MODELS["milestones"](
                        **common(row),
                        goal_id=row["goal_id"],
                        start_date=day(row.get("start_date")),
                        due_date=day(row.get("deadline")),
                        status={"NotStarted": "todo", "InProgress": "doing", "Completed": "done"}[
                            row["status"]
                        ],
                        completion_criteria=row.get("completion_criteria", ""),
                    )
                )
            db.flush()
            dependencies = list(rows(root, manifest, "milestone_dependencies"))
            dependency_graph = {}
            for row in dependencies:
                dependency_graph.setdefault(row["milestone_id"], []).append(row["prerequisite_id"])
            assert_acyclic(dependency_graph)
            for row in dependencies:
                db.add(
                    Dependency(
                        user_id=user_id(row["user_id"]),
                        milestone_id=row["milestone_id"],
                        prerequisite_id=row["prerequisite_id"],
                    )
                )
            for row in rows(root, manifest, "task_series"):
                db.add(
                    TaskSeries(
                        **common(row),
                        frequency=row["frequency"],
                        interval_count=row["interval_count"],
                        weekdays=[i + 1 for i in range(7) if row.get("weekday_mask", 0) & (1 << i)],
                        start_date=day(row["start_date"]),
                        end_date=day(row.get("end_date")),
                        cursor=day(row.get("cursor_date")),
                        timezone=row["timezone"],
                        state=row["state"].lower(),
                    )
                )
            db.flush()
            checklist = {}
            for row in rows(root, manifest, "checklist_items"):
                if not row.get("deleted_at"):
                    checklist.setdefault(row["task_id"], []).append(
                        {"text": row["title"], "checked": bool(row["checked"])}
                    )
            working = {row["task_id"]: row["body"] for row in rows(root, manifest, "task_notes")}
            for row in rows(root, manifest, "tasks"):
                db.add(
                    Task(
                        **common(row),
                        completed_at=instant(row.get("completed_at")),
                        goal_id=row.get("goal_id"),
                        milestone_id=row.get("milestone_id"),
                        status={
                            "NotStarted": "todo",
                            "InProgress": "doing",
                            "Blocked": "blocked",
                            "Done": "done",
                        }[row["status"]],
                        start_date=day(row.get("start_date")),
                        due_date=day(row.get("deadline")),
                        scheduled_at=instant(row.get("scheduled_start")),
                        scheduled_end=instant(row.get("scheduled_end")),
                        reminder_at=instant(row.get("reminder_at")),
                        estimated_minutes=row.get("estimated_minutes"),
                        series_id=row.get("series_id"),
                        occurrence_date=day(row.get("occurrence_date")),
                        expected_result=row.get("expected_result", ""),
                        completion_criteria=row.get("completion_criteria", ""),
                        checklist=checklist.get(row["id"], []),
                        working_note=working.get(row["id"], ""),
                    )
                )
            db.flush()
            tags = {str(row["id"]): row["name"] for row in rows(root, manifest, "labels")}
            note_tags = {}
            for row in rows(root, manifest, "label_note"):
                note_tags.setdefault(row["note_id"], []).append(tags[str(row["label_id"])])
            links = {row["note_id"]: row for row in rows(root, manifest, "note_links")}
            for row in rows(root, manifest, "notes"):
                link = links.get(row["id"], {})
                db.add(
                    Note(
                        **common(row),
                        color=row.get("color", "neutral"),
                        lock_hash=row.get("lock_hash"),
                        pinned=bool(row.get("pinned_at")),
                        tags=note_tags.get(row["id"], []),
                        goal_id=link.get("goal_id"),
                        task_id=link.get("task_id"),
                    )
                )
            for row in rows(root, manifest, "habits"):
                db.add(
                    Habit(
                        **common(row),
                        frequency=row["period"],
                        target=row["target_frequency"],
                        timezone=row["timezone"],
                        first_check_in_at=instant(row.get("first_check_in_at")),
                    )
                )
            db.flush()
            for table, state in (("habit_rest_days", "rest"), ("habit_check_ins", "done")):
                for row in rows(root, manifest, table):
                    current = db.get(HabitDay, (row["habit_id"], day(row["local_date"])))
                    if current:
                        current.state = state
                    else:
                        db.add(
                            HabitDay(
                                habit_id=row["habit_id"], day=day(row["local_date"]), state=state
                            )
                        )
                    db.flush()
            for row in rows(root, manifest, "reviews"):
                values = common(row)
                values.update(
                    title=f"{row['kind']} review {row['period_start']}", content=row["reflection"]
                )
                snapshot = (
                    row["snapshot"]
                    if isinstance(row["snapshot"], dict)
                    else json.loads(row["snapshot"])
                )
                db.add(
                    Review(
                        **values,
                        period=row["kind"].lower(),
                        period_date=day(row["period_start"]),
                        snapshot=snapshot,
                    )
                )
            for row in rows(root, manifest, "activities"):
                db.add(
                    Activity(
                        id=row["id"],
                        user_id=user_id(row["user_id"]),
                        kind=f"{row['source_type']}.{row['action']}",
                        entity_id=row["source_id"],
                        created_at=instant(row["occurred_at"]),
                    )
                )
            db.flush()
            if config.storage_bucket or config.supabase_storage_bucket:
                raise ValueError("This importer requires a local private storage root")
            for row in rows(root, manifest, "attachments"):
                if row.get("deleted_at") or not row.get("path"):
                    continue
                original = safe_child(root / "files", row["path"])
                if row["path"] not in manifest["files"]:
                    raise ValueError("Attachment bytes are missing from the snapshot")
                from planner.storage import storage_path

                key = str(uuid5(NAMESPACE_URL, "Notes:attachment:" + row["id"]))
                target = storage_path(key)
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with original.open("rb") as source, target.open("xb") as destination:
                    shutil.copyfileobj(source, destination)
                copied.append(target)
                target.chmod(0o600)
                db.add(
                    Attachment(
                        id=row["id"],
                        user_id=user_id(row["user_id"]),
                        note_id=row["note_id"],
                        storage_key=key,
                        filename=row["original_name"],
                        size=target.stat().st_size,
                        checksum=checksum(target),
                    )
                )
            db.flush()
            report["total_after"] = {}
            for kind, model in counted_models.items():
                query = select(func.count()).select_from(model)
                report["total_after"][kind] = db.scalar(query)
                if model is HabitDay:
                    query = query.join(Habit).where(Habit.user_id.in_(owner_ids))
                else:
                    owner = User.id if model is User else model.user_id
                    query = query.where(owner.in_(owner_ids))
                report["imported"][kind] = db.scalar(query)
            db.add(ImportReceipt(snapshot_hash=fingerprint, report=report))
            db.commit()
            return report
        except Exception:
            db.rollback()
            for target in copied:
                target.unlink(missing_ok=True)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    export = commands.add_parser("export")
    export.add_argument("--output", type=Path, required=True)
    export.add_argument("--private-files", type=Path)
    verify = commands.add_parser("verify")
    verify.add_argument("snapshot", type=Path)
    importer = commands.add_parser("import")
    importer.add_argument("snapshot", type=Path)
    importer.add_argument(
        "--target-database",
        choices=["planner_staging", "planner_test", "planner_dev"],
        required=True,
    )
    importer.add_argument(
        "--merge-existing",
        action="store_true",
        help="Preserve existing accounts; required for an authorized planner_dev import (pause writers)",
    )
    args = parser.parse_args()
    if args.command == "export":
        result = export_snapshot(os.environ["LEGACY_MYSQL_DSN"], args.output, args.private_files)
    elif args.command == "verify":
        manifest = verify_snapshot(args.snapshot)
        result = {
            "verified": True,
            "tables": len(manifest["tables"]),
            "files": len(manifest["files"]),
        }
    else:
        result = import_snapshot(
            args.snapshot, args.target_database, merge_existing=args.merge_existing
        )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
