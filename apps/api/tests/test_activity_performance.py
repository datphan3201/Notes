"""Bounded Activity read compared with the existing full workspace snapshot."""
import json
import time
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import text


def test_activity_page_limits_payload_on_large_history(client, db):
    owner = client.get("/api/v1/auth/me").json()["user"]["id"]
    db.execute(text("""
        INSERT INTO activities (id, user_id, kind, entity_id, created_at)
        SELECT md5(i::text), :owner, 'task.completed', 'fixture-task',
               now() - (i * interval '1 second')
        FROM generate_series(1, 50000) AS i
    """), {"owner": owner})
    db.commit()
    start = time.monotonic()
    full = client.get("/api/v1/workspace/snapshot")
    full_ms = (time.monotonic() - start) * 1000
    start = time.monotonic()
    page = client.get("/api/v1/workspace/activity?size=100")
    page_ms = (time.monotonic() - start) * 1000
    start = time.monotonic()
    bounded = client.get("/api/v1/workspace/snapshot?activity=summary")
    bounded_ms = (time.monotonic() - start) * 1000
    assert full.status_code == page.status_code == bounded.status_code == 200
    facts = full.json()["activity"]
    items = page.json()["items"]
    assert len(facts) == 50000 and len(items) == 100
    assert [item["id"] for item in items] == [item["id"] for item in reversed(facts[-100:])]
    assert len(page.content) < len(full.content) / 100
    assert bounded.json()["activity"] == []
    assert sum(item["count"] for item in bounded.json()["activity_counts"]) == 50000
    assert len(bounded.content) < len(full.content) / 100
    def timed(path):
        started = time.monotonic()
        response = client.get(path)
        assert response.status_code == 200
        return (time.monotonic() - started) * 1000

    with ThreadPoolExecutor(max_workers=5) as pool:
        full_concurrent = list(pool.map(timed, ["/api/v1/workspace/snapshot"] * 5))
    with ThreadPoolExecutor(max_workers=5) as pool:
        bounded_concurrent = list(pool.map(timed, ["/api/v1/workspace/snapshot?activity=summary"] * 5))
    print(json.dumps({"activity_rows": len(facts), "page_rows": len(items),
                      "snapshot_bytes": len(full.content), "page_bytes": len(page.content),
                      "bounded_snapshot_bytes": len(bounded.content),
                      "snapshot_ms": round(full_ms, 1), "page_ms": round(page_ms, 1),
                      "bounded_snapshot_ms": round(bounded_ms, 1),
                      "snapshot_5_concurrent_max_ms": round(max(full_concurrent), 1),
                      "bounded_5_concurrent_max_ms": round(max(bounded_concurrent), 1)}))
