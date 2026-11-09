"""Audit the complete versioned lifecycle of each public planning collection."""
import pytest


def create(client, kind, **fields):
    response = client.post(f"/api/v1/{kind}", json={"title": f"CRUD {kind}", **fields})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize("kind", ["areas", "goals", "milestones", "tasks", "habits", "notes", "reviews", "task-series"])
def test_collection_crud_lifecycle_and_ownership(client, stranger, kind):
    fields = {}
    if kind in ("goals", "milestones"):
        area = create(client, "areas")
        if kind == "goals":
            fields = {"area_id": area["id"]}
        else:
            goal = create(client, "goals", area_id=area["id"])
            fields = {"goal_id": goal["id"]}
    elif kind == "reviews":
        fields = {"period_date": "2026-11-01"}
    elif kind == "task-series":
        fields = {"frequency": "daily", "start_date": "2026-11-01", "timezone": "UTC", "template": {"title": "Occurrence"}}
    row = create(client, kind, **fields)
    path = f'/api/v1/{kind}/{row["id"]}'
    assert client.get(path).json()["id"] == row["id"]
    assert row["id"] in [item["id"] for item in client.get(f"/api/v1/{kind}").json()["items"]]
    assert stranger.get(path).status_code == 404
    assert stranger.patch(path, json={"version": row["version"], "fields": {"title": "Foreign edit"}}).status_code == 404
    changed = client.patch(path, json={"version": row["version"], "fields": {"title": "Edited title"}})
    assert changed.status_code == 200, changed.text
    row = changed.json()
    assert row["title"] == "Edited title"
    assert client.patch(path, json={"version": row["version"] - 1, "fields": {"title": "Stale edit"}}).status_code == 409
    if kind in ("notes", "reviews"):
        assert client.post(path + "/archive", json={"version": row["version"]}).status_code == 422
    for archived in (() if kind in ("notes", "reviews") else (True, False, True)):
        response = client.post(path + "/archive", json={"version": row["version"], "archived": archived, "include_contents": True})
        assert response.status_code == 200, response.text
        row = response.json()
        assert bool(row["archived_at"]) is archived
        listed = client.get(f"/api/v1/{kind}", params={"archived": str(archived).lower()}).json()["items"]
        assert row["id"] in [item["id"] for item in listed]
    deletion = {"changes": [{"action": "delete", "kind": kind, "id": row["id"], "version": row["version"]}]}
    assert stranger.post("/api/v1/workspace/changes", json=deletion).status_code == 404
    result = client.post("/api/v1/workspace/changes", json=deletion)
    assert result.status_code == 200, result.text
    assert client.get(path).status_code == 404


@pytest.mark.parametrize("operation", ["create", "update"])
def test_area_names_are_unique_for_create_update_and_archived_rows(client, operation):
    first = create(client, "areas", title="Health")
    archived = client.post(f'/api/v1/areas/{first["id"]}/archive', json={"version": first["version"]})
    assert archived.status_code == 200
    if operation == "create":
        duplicate = client.post("/api/v1/areas", json={"title": "health"})
    else:
        second = create(client, "areas", title="Work")
        duplicate = client.patch(f'/api/v1/areas/{second["id"]}', json={"version": second["version"], "fields": {"title": "HEALTH"}})
    assert duplicate.status_code in (409, 422), duplicate.text


def test_area_name_normalization_and_database_constraint(client, stranger, db):
    from sqlalchemy import update
    from sqlalchemy.exc import IntegrityError

    from planner.models import Area

    first = create(client, "areas", title="  Personal\t  projects  ")
    assert first["title"] == "Personal projects"
    assert client.post("/api/v1/areas", json={"title": "personal   PROJECTS"}).status_code == 409
    assert stranger.post("/api/v1/areas", json={"title": "PERSONAL projects"}).status_code == 201
    # Bypassing the service still cannot introduce a duplicate.
    existing = client.get("/api/v1/areas").json()["items"][0]
    if existing["id"] == first["id"]:
        existing = client.get("/api/v1/areas").json()["items"][1]
    with pytest.raises(IntegrityError), db.begin_nested():
        db.execute(update(Area).where(Area.id == existing["id"]).values(title=" personal\tPROJECTS "))


@pytest.mark.parametrize("kind", ["notes", "reviews"])
def test_legacy_archive_can_be_restored_but_new_archive_is_rejected(client, stranger, db, kind):
    from planner.models import now
    from planner.planning import model_for

    row = create(client, kind, **({"period_date": "2026-11-01"} if kind == "reviews" else {}))
    model = db.get(model_for(kind), row["id"])
    model.archived_at = now()
    model.version += 1
    db.commit()
    version = model.version
    change = {"action": "restore", "kind": kind, "id": row["id"], "version": version}
    assert stranger.post("/api/v1/workspace/changes", json={"changes": [change]}).status_code == 404
    result = client.post("/api/v1/workspace/changes", json={"changes": [change]})
    assert result.status_code == 200, result.text
    assert result.json()["items"][0]["archived_at"] is None
    change.update(action="archive", version=version + 1)
    assert client.post("/api/v1/workspace/changes", json={"changes": [change]}).status_code == 422


def test_bulk_deletion_is_atomic_on_stale_version_and_handles_resource_unlinking(client):
    note = create(client, "notes")
    task = create(client, "tasks", resource_note_ids=[note["id"]])
    task = client.post(f'/api/v1/tasks/{task["id"]}/archive', json={"version": task["version"]}).json()
    changes = [{"action": "delete", "kind": "notes", "id": note["id"], "version": note["version"]},
               {"action": "delete", "kind": "tasks", "id": task["id"], "version": task["version"] - 1}]
    assert client.post("/api/v1/workspace/changes", json={"changes": changes}).status_code == 409
    assert client.get(f'/api/v1/notes/{note["id"]}').status_code == 200
    changes[1]["version"] = task["version"]
    result = client.post("/api/v1/workspace/changes", json={"changes": changes})
    assert result.status_code == 200, result.text
    for kind, row in (("notes", note), ("tasks", task)):
        assert client.get(f'/api/v1/{kind}/{row["id"]}').status_code == 404


def test_area_name_migration_reports_duplicates_without_renaming(client, db, monkeypatch):
    import importlib.util
    from pathlib import Path

    from sqlalchemy import select, text

    from planner.models import Area

    first = create(client, "areas", title="Duplicate migration")
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0008_area_names.py"
    spec = importlib.util.spec_from_file_location("area_names_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    # Transactional DDL is rolled back; the real test constraint remains installed.
    with db.begin_nested() as transaction:
        db.execute(text("DROP INDEX areas_owner_name_unique"))
        owner = db.get(Area, first["id"]).user_id
        duplicate = Area(user_id=owner, title=" DUPLICATE\tmigration ")
        db.add(duplicate)
        db.flush()
        monkeypatch.setattr(migration.op, "get_bind", lambda: db.connection())
        with pytest.raises(RuntimeError, match="rename these Areas") as error:
            migration.upgrade()
        assert first["id"] in str(error.value) and duplicate.id in str(error.value)
        assert db.scalar(select(Area.title).where(Area.id == duplicate.id)) == " DUPLICATE\tmigration "
        transaction.rollback()


@pytest.mark.parametrize("route", ["resource", "workspace"])
def test_locked_legacy_note_restores_without_exposing_content(client, stranger, db, route):
    from planner.models import Note, now

    note = create(client, "notes", title="Private title", content="Private secret")
    path = f'/api/v1/notes/{note["id"]}'
    assert client.post(path + "/password", json={"new_password": "note-password"}).status_code == 200
    model = db.get(Note, note["id"])
    model.archived_at = now()
    model.version += 1
    db.commit()
    version = model.version
    if route == "resource":
        body = {"version": version, "archived": False}
        assert stranger.post(path + "/archive", json=body).status_code == 404
        result = client.post(path + "/archive", json=body)
        values = result.json()
    else:
        body = {"changes": [{"action": "restore", "kind": "notes", "id": note["id"], "version": version}]}
        assert stranger.post("/api/v1/workspace/changes", json=body).status_code == 404
        result = client.post("/api/v1/workspace/changes", json=body)
        values = result.json()["items"][0]
    assert result.status_code == 200, result.text
    assert values["archived_at"] is None and values["title"] == "Locked Note"
    assert values["content"] == "" and "document" not in values
    assert client.get(path).status_code == 423
    assert client.post(path + "/unlock", json={"password": "note-password"}).status_code == 200
    assert client.get(path).json()["content"] == "Private secret"
