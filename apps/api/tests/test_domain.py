from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest

from planner.domain import (
    assert_acyclic,
    daily_streak,
    goal_progress,
    next_materialization,
    recurrence_dates,
)


def rule(start, frequency, **kwargs):
    return SimpleNamespace(
        start_date=date.fromisoformat(start),
        frequency=frequency,
        interval_count=kwargs.get("interval", 1),
        weekdays=kwargs.get("weekdays", []),
        end_date=None,
    )


def test_goal_graph_supports_deep_trees_and_detects_cycles():
    edges = {str(i): [str(i + 1)] for i in range(2500)}
    assert_acyclic(edges)
    edges["2500"] = ["0"]
    with pytest.raises(ValueError, match="cycle"):
        assert_acyclic(edges)


def test_recurrence_checkpoint_uses_local_horizon_and_leap_anchor():
    recurrence = rule("2024-01-31", "monthly")
    recurrence.cursor = date(2024, 1, 31)
    recurrence.timezone = "Asia/Ho_Chi_Minh"
    assert next_materialization(recurrence) == datetime(2024, 2, 21, 17, tzinfo=UTC)
    recurrence.end_date = date(2024, 1, 31)
    assert next_materialization(recurrence) == datetime.max.replace(tzinfo=UTC)


def test_recurrence_handles_supported_date_boundaries():
    recurrence = rule("0001-01-01", "daily")
    recurrence.cursor = None
    recurrence.timezone = "Asia/Ho_Chi_Minh"
    assert recurrence_dates(recurrence, None, date.min, limit=1) == [date.min]
    assert next_materialization(recurrence) == datetime.min.replace(tzinfo=UTC)
    recurrence.cursor = date.max
    assert recurrence_dates(recurrence, date.max, date.max) == []
    assert next_materialization(recurrence) == datetime.max.replace(tzinfo=UTC)


@pytest.mark.parametrize(
    "start,frequency,horizon,expected",
    [
        (
            "2024-01-31",
            "monthly",
            "2024-04-30",
            ["2024-01-31", "2024-02-29", "2024-03-31", "2024-04-30"],
        ),
        (
            "2024-02-29",
            "yearly",
            "2028-03-01",
            ["2024-02-29", "2025-02-28", "2026-02-28", "2027-02-28", "2028-02-29"],
        ),
    ],
)
def test_recurrence_preserves_original_month_and_leap_anchor(start, frequency, horizon, expected):
    recurrence = rule(start, frequency)
    assert [
        day.isoformat()
        for day in recurrence_dates(
            recurrence, recurrence.start_date - timedelta(days=1), date.fromisoformat(horizon)
        )
    ] == expected


def test_weekly_recurrence_is_monday_based():
    recurrence = rule("2026-11-04", "weekly", interval=2, weekdays=[1, 5])
    assert [
        str(day) for day in recurrence_dates(recurrence, date(2026, 11, 3), date(2026, 11, 20))
    ] == ["2026-11-06", "2026-11-16", "2026-11-20"]


def test_rest_does_not_count_and_unfinished_today_does_not_break_streak():
    done = {date(2026, 11, 3), date(2026, 11, 5)}
    assert daily_streak(done, {date(2026, 11, 4)}, date(2026, 11, 1), date(2026, 11, 6)) == 2
    assert daily_streak(done, set(), date(2026, 11, 1), date(2026, 11, 6)) == 1


def test_goal_progress_counts_only_finite_primary_children():
    goals = [
        SimpleNamespace(id="root", parent_goal_id=None, status="active"),
        SimpleNamespace(id="child", parent_goal_id="root", status="completed"),
    ]
    milestones = [SimpleNamespace(goal_id="root", status="todo")]
    tasks = [
        SimpleNamespace(goal_id="root", status="done", series_id=None),
        SimpleNamespace(goal_id=None, status="done", series_id=None),
        SimpleNamespace(goal_id="root", status="todo", series_id="repeat"),
    ]
    progress = goal_progress(goals, milestones, tasks)
    assert progress["child"] == 100
    assert progress["root"] == pytest.approx(200 / 3)


def test_weekly_streak_rest_and_partial_first_week_match_retained_rules():
    from datetime import date, timedelta

    from planner.domain import weekly_streak

    first = date(2026, 10, 19)
    done = {first, first + timedelta(days=1), first + timedelta(days=2), date(2026, 11, 2)}
    rest = {date(2026, 10, 26) + timedelta(days=i) for i in range(7)} | {
        date(2026, 11, 3),
        date(2026, 11, 4),
    }
    assert weekly_streak(done, rest, 3, first, date(2026, 11, 8)) == 2
    assert weekly_streak({date(2026, 11, 8)}, set(), 7, date(2026, 11, 8), date(2026, 11, 8)) == 1
