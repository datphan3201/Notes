from test_boundaries import make

from planner.models import Attachment, Note


def test_refresh_returns_changes_and_explicit_inventory(client, db):
    note = make(client, "notes", content="large unchanged content")
    task = make(client, "tasks")
    original = client.get("/api/v1/workspace/snapshot").json()
    kinds = ["areas", "goals", "milestones", "tasks", "habits", "notes", "reviews", "task-series"]
    known = {kind: {row["id"]: row["version"] for row in original[kind]} for kind in kinds}
    refreshed = client.post("/api/v1/workspace/refresh", json={"known": known})
    assert refreshed.status_code == 200
    data = refreshed.json()
    assert data["notes"] == [] and data["tasks"] == []
    assert note["id"] in data["manifest"]["notes"]
    assert task["id"] in data["manifest"]["tasks"]
    row = db.get(Note, note["id"])
    row.lock_hash = "locked-without-version-change"
    db.commit()
    masked = client.post("/api/v1/workspace/refresh", json={"known": known}).json()
    assert masked["notes"][0]["content"] == ""
    assert masked["notes"][0]["locked"] is True
    row = db.get(Note, note["id"])
    db.delete(row)
    db.commit()
    removed = client.post("/api/v1/workspace/refresh", json={"known": known}).json()
    assert note["id"] not in removed["manifest"]["notes"]


def test_refresh_never_accepts_foreign_known_ids_as_access(client, stranger):
    note = make(stranger, "notes", content="foreign private body")
    result = client.post(
        "/api/v1/workspace/refresh", json={"known": {"notes": {note["id"]: note["version"]}}}
    )
    assert result.status_code == 200
    assert note["id"] not in result.json()["manifest"]["notes"]
    assert "foreign private body" not in result.text


def test_compact_pages_omit_history_and_load_note_on_demand(client, stranger):
    note = make(client, "notes", content="first " + "large body " * 1000)
    foreign = make(stranger, "notes", content="foreign secret")
    archived = make(client, "tasks")
    client.post(f"/api/v1/tasks/{archived['id']}/archive", json={"version": archived["version"], "archived": True})
    bootstrap = client.get("/api/v1/workspace/bootstrap").json()
    assert bootstrap["notes"] == [] and bootstrap["tasks"] == [] and bootstrap["activity"] == []
    notes = client.get("/api/v1/workspace/page/notes?size=1").json()
    assert len(notes["items"]) == 1 and len(notes["items"][0]["content"]) == 2048
    assert notes["items"][0]["body_loaded"] is False
    assert "document" not in notes["items"][0]
    assert client.get("/api/v1/workspace/page/tasks").json()["items"] == []
    detail = client.get(f"/api/v1/workspace/note/{note['id']}").json()
    assert detail["content"] == note["content"] and detail["body_loaded"] is True
    assert client.get(f"/api/v1/workspace/note/{foreign['id']}").status_code == 404
    assert client.get("/api/v1/workspace/note-search?q=large").json()["ids"] == [note["id"]]
    assert not client.get("/api/v1/workspace/note-search?q=foreign").json()["ids"]
    synced = client.get("/api/v1/workspace/note-sync").json()["items"]
    assert synced[0]["content"] == note["content"]


def test_compact_pages_are_complete_without_duplicates(client):
    expected = {make(client, "tasks")["id"] for _ in range(5)}
    ids, cursor = [], ""
    while True:
        page = client.get("/api/v1/workspace/page/tasks", params={"size": 2, "after": cursor}).json()
        ids.extend(row["id"] for row in page["items"])
        cursor = page["next_cursor"]
        if not cursor:
            break
    assert len(ids) == 5 and set(ids) == expected


def test_archive_roots_search_and_atomic_delete(client, stranger):
    area = make(client, "areas")
    goal = make(client, "goals", area_id=area["id"])
    task = make(client, "tasks", goal_id=goal["id"])
    archived = client.post("/api/v1/workspace/changes", json={"changes": [{
        "action": "archive", "kind": "areas", "id": area["id"], "version": area["version"],
        "fields": {"include_contents": True},
    }]}).json()["items"][0]
    page = client.get("/api/v1/workspace/archived").json()
    assert [(row["kind"], row["id"]) for row in page["items"]] == [("areas", area["id"])]
    assert not stranger.get("/api/v1/workspace/archived").json()["items"]
    assert not client.get("/api/v1/workspace/archived?q=not-present").json()["items"]
    change = {"action": "delete", "kind": "areas", "id": area["id"], "version": area["version"], "fields": {}}
    assert client.post("/api/v1/workspace/archived/delete", json={"items": [change]}).status_code == 409
    assert client.get(f"/api/v1/tasks/{task['id']}").status_code == 200
    change["version"] = archived["version"]
    assert stranger.post("/api/v1/workspace/archived/delete", json={"items": [change]}).status_code == 404
    assert client.post("/api/v1/workspace/archived/delete", json={"items": [change]}).status_code == 200
    assert client.get(f"/api/v1/tasks/{task['id']}").status_code == 404


def test_note_previews_keep_headings_and_auxiliary_changes_without_body_transfer(client, db):
    note = make(client, "notes", document={"type": "doc", "content": [
        {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": f"Heading {i}"}]}
        for i in range(8)
    ]})
    preview = client.get("/api/v1/workspace/page/notes").json()["items"][0]
    assert preview["body_loaded"] is False
    assert len(preview["document"]["content"]) == 4
    assert preview["document"]["content"][0]["content"][0]["text"] == "Heading 0"
    row = db.get(Note, note["id"])
    db.add(Attachment(user_id=row.user_id, note_id=row.id, storage_key="test-key",
                      filename="new.txt", size=4, checksum="0" * 64, mime="text/plain"))
    db.commit()
    refreshed = client.post("/api/v1/workspace/refresh", json={"known": {"notes": {row.id: row.version}}}).json()
    assert refreshed["notes"] == []
    assert refreshed["note_state"][row.id]["files"][0]["name"] == "new.txt"
