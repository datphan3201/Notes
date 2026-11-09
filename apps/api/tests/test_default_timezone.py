from datetime import UTC, datetime, timedelta

from planner.timezones import DEFAULT_TIMEZONE, zone


def test_new_user_habit_and_series_default_to_utc7(client):
    user = client.get("/api/v1/auth/me").json()["user"]
    assert user["timezone"] == DEFAULT_TIMEZONE
    habit = client.post("/api/v1/habits", json={"title": "Default zone"})
    assert habit.status_code == 201
    assert habit.json()["timezone"] == DEFAULT_TIMEZONE
    series = client.post("/api/v1/task-series", json={"title": "Default series", "frequency": "daily", "start_date": "2026-11-09"})
    assert series.status_code == 201
    assert series.json()["timezone"] == DEFAULT_TIMEZONE
    at = datetime(2026, 11, 9, 18, 30, tzinfo=UTC)
    assert at.astimezone(zone()).utcoffset() == timedelta(hours=7)
    assert at.astimezone(zone()).date().isoformat() == "2026-11-10"
    explicit = client.post("/api/v1/habits", json={"title": "Explicit UTC", "timezone": "UTC"})
    assert explicit.status_code == 201
    assert at.astimezone(zone(explicit.json()["timezone"])).utcoffset() == timedelta(0)
