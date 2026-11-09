from datetime import timedelta
from zoneinfo import ZoneInfo

from planner.models import now


def test_dashboard_density_preferences_persist_with_authoritative_bounds(client):
    user = client.get("/api/v1/auth/me").json()["user"]
    values = {key: user[key] for key in ("name", "timezone", "locale", "theme")}
    values["preferences"] = {"dashboard": {"tasks": 2, "habits": 4, "completed": 1}}
    assert client.put("/api/v1/preferences", json=values).status_code == 200
    saved = client.get("/api/v1/auth/me").json()["user"]["preferences"]
    assert saved["dashboard"] == {"tasks": 2, "habits": 4, "completed": 1}
    for invalid in (0, 21):
        values["preferences"]["dashboard"]["tasks"] = invalid
        assert client.put("/api/v1/preferences", json=values).status_code == 422
    assert client.get("/api/v1/auth/me").json()["user"]["preferences"]["dashboard"]["tasks"] == 2


def test_retrospective_habit_checkin_undo_future_and_ownership(client, stranger, db):
    response = client.post("/api/v1/habits", json={"title": "Retrospective practice", "timezone": "Asia/Ho_Chi_Minh"})
    assert response.status_code == 201, response.text
    habit = response.json()
    today = now().astimezone(ZoneInfo(habit["timezone"])).date()
    path = f'/api/v1/habits/{habit["id"]}/checkin'
    for offset in (3, 2, 1, 0):
        day = (today - timedelta(days=offset)).isoformat()
        assert client.put(path, json={"day": day, "state": "done"}).status_code == 200
    start = (today - timedelta(days=3)).isoformat()
    days_path = f'/api/v1/habits/{habit["id"]}/days?start={start}&end={today.isoformat()}'
    days = client.get(days_path)
    assert days.status_code == 200, days.text
    assert days.json()["window_streak"] == 4
    assert stranger.put(path, json={"day": start, "state": "clear"}).status_code == 404
    assert client.put(path, json={"day": (today + timedelta(days=1)).isoformat(), "state": "done"}).status_code == 422
    assert client.put(path, json={"day": start, "state": "clear"}).status_code == 200
    assert len(client.get(days_path).json()["days"]) == 3

    from planner.models import HabitDay

    rest_day = today - timedelta(days=5)
    db.add(HabitDay(habit_id=habit["id"], day=rest_day, state="rest"))
    db.commit()
    for state in ("done", "clear"):
        assert client.put(path, json={"day": rest_day.isoformat(), "state": state}).status_code == 422
