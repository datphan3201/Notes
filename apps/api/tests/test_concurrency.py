from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from test_boundaries import make

from planner.main import app


def test_concurrent_inverse_goal_moves_cannot_both_succeed(client):
    area = make(client, "areas")
    a = make(client, "goals", area_id=area["id"])
    b = make(client, "goals", area_id=area["id"])
    with TestClient(app) as second:
        second.cookies.update(client.cookies)
        second.headers.update(client.headers)
        with ThreadPoolExecutor(2) as pool:
            futures = [
                pool.submit(
                    current.patch,
                    "/api/v1/goals/" + source["id"],
                    json={
                        "version": 1,
                        "fields": {"area_id": None, "parent_goal_id": target["id"]},
                    },
                )
                for current, source, target in [(client, a, b), (second, b, a)]
            ]
            statuses = sorted(future.result().status_code for future in futures)
    assert statuses == [200, 422]


def test_concurrent_updates_do_not_lose_a_draft(client):
    task = make(client, "tasks")
    url = "/api/v1/tasks/" + task["id"]
    with TestClient(app) as second:
        second.cookies.update(client.cookies)
        second.headers.update(client.headers)
        with ThreadPoolExecutor(2) as pool:
            futures = [
                pool.submit(current.patch, url, json={"version": 1, "fields": {"title": title}})
                for current, title in [(client, "Draft A"), (second, "Draft B")]
            ]
            statuses = sorted(future.result().status_code for future in futures)
    assert statuses == [200, 409]
    assert client.get(url).json()["title"] in ("Draft A", "Draft B")


def test_reads_above_thread_and_connection_pool_capacity_release_sessions(client):
    make(client, "tasks")
    with ThreadPoolExecutor(60) as pool:
        futures = [pool.submit(client.get, "/api/v1/tasks") for _ in range(120)]
        assert all(future.result(timeout=15).status_code == 200 for future in futures)
    from planner.db import engine

    assert engine().pool.checkedout() == 0
