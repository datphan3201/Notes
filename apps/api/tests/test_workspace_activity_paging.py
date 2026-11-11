from datetime import timedelta

from planner.models import Activity, User, now


def test_activity_pages_are_stable_and_owner_scoped(client, stranger, db):
    first_owner = db.query(User).filter_by(email="owner@example.com").one().id
    other_owner = db.query(User).filter_by(email="other@example.com").one().id
    stamp = now()
    for identifier in ("a", "b", "c"):
        db.add(Activity(id=identifier, user_id=first_owner, kind="task.completed", entity_id=identifier, created_at=stamp))
    db.add(Activity(id="foreign", user_id=other_owner, kind="task.completed", entity_id="private", created_at=stamp))
    db.commit()
    first = client.get("/api/v1/workspace/activity?size=2").json()
    assert [item["id"] for item in first["items"]] == ["c", "b"]
    assert first["next_cursor"] == "b"
    second = client.get("/api/v1/workspace/activity", params={"size": 2, "before": first["next_cursor"]}).json()
    assert [item["id"] for item in second["items"]] == ["a"]
    assert second["next_cursor"] is None
    assert client.get("/api/v1/workspace/activity?before=foreign").status_code == 404
    assert stranger.get("/api/v1/workspace/activity?before=a").status_code == 404
    bounded = client.get("/api/v1/workspace/activity", params={
        "start": (stamp + timedelta(seconds=1)).isoformat()
    }).json()
    assert bounded["items"] == []
    assert client.get("/api/v1/workspace/activity?start=2026-01-01T00:00:00").status_code == 422


def test_archive_pages_hide_foreign_and_locked_notes(client, stranger, db):
    from planner.models import Note

    first_owner = db.query(User).filter_by(email="owner@example.com").one().id
    other_owner = db.query(User).filter_by(email="other@example.com").one().id
    stamp = now()
    for identifier in ("n-a", "n-b"):
        db.add(Note(id=identifier, user_id=first_owner, title="secret", content="private", lock_hash="hash", archived_at=stamp))
    db.add(Note(id="foreign-note", user_id=other_owner, title="foreign", content="foreign", archived_at=stamp))
    db.commit()
    first = client.get("/api/v1/workspace/archive/notes?size=1").json()
    assert len(first["items"]) == 1
    assert first["items"][0]["id"] == "n-b"
    assert first["items"][0]["title"] == "Locked Note"
    assert first["items"][0]["content"] == ""
    assert first["next_cursor"] == "n-b"
    second = client.get("/api/v1/workspace/archive/notes?size=1&before=n-b").json()
    assert [item["id"] for item in second["items"]] == ["n-a"]
    assert client.get("/api/v1/workspace/archive/notes?before=foreign-note").status_code == 404
    assert stranger.get("/api/v1/workspace/archive/notes?before=n-a").status_code == 404


def test_activity_summary_counts_local_days_and_excludes_reversals(client, stranger, db):
    from datetime import UTC, datetime

    first_owner = db.query(User).filter_by(email="owner@example.com").one().id
    other_owner = db.query(User).filter_by(email="other@example.com").one().id
    stamp = datetime(2026, 11, 11, 18, tzinfo=UTC)
    db.add_all([
        Activity(id="sum-a", user_id=first_owner, kind="task.completed", entity_id="a", created_at=stamp),
        Activity(id="sum-b", user_id=first_owner, kind="task.reopened", entity_id="a", created_at=stamp),
        Activity(id="sum-c", user_id=other_owner, kind="task.completed", entity_id="b", created_at=stamp),
    ])
    db.commit()
    result = client.get("/api/v1/workspace/activity/summary?start=2026-11-12&end=2026-11-12")
    assert result.status_code == 200
    assert result.json()["items"] == [{"date": "2026-11-12", "kind": "task", "count": 1}]
    assert client.get("/api/v1/workspace/activity/summary?start=2025-01-01&end=2026-11-12").status_code == 422
    full = client.get("/api/v1/workspace/snapshot").json()
    bounded = client.get("/api/v1/workspace/snapshot?activity=summary").json()
    assert len(full["activity"]) == 2
    assert bounded["activity"] == []
    assert "activity_counts" in bounded
