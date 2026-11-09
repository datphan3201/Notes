import assert from "node:assert/strict";
import test from "node:test";
import {
    dashboardTask,
    dashboardHabit,
    dashboardGoal,
} from "../src/lib/dashboard-model.ts";
import type { Entity } from "../src/lib/api.ts";
const entity: Entity = {
    id: "owner-task",
    title: "Stored title",
    content: "Stored content",
    importance: 4,
    version: 7,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-11-06T20:00:00Z",
    archived_at: null,
    status: "todo",
};
test("Dashboard uses account dates for scheduled Tasks and retains real text", () => {
    const row = { ...entity, scheduled_at: "2026-11-06T20:00:00Z" };
    const vi = dashboardTask(
        row,
        0,
        "2026-11-07",
        "Asia/Ho_Chi_Minh",
        { daily: [], weekly: [] },
        {},
    );
    assert.equal(vi.daily, true);
    assert.deepEqual(vi.title, ["Stored title", "Stored title"]);
    assert.equal(vi.scheduledStart, "2026-11-07T03:00");
    assert.equal(
        dashboardTask(
            row,
            0,
            "2026-11-07",
            "America/Mexico_City",
            { daily: [], weekly: [] },
            {},
        ).daily,
        false,
    );
});
test("weekly selections and history follow the connected system contract", () => {
    const due = { ...entity, due_date: "2026-11-07" };
    assert.equal(
        dashboardTask(
            due,
            0,
            "2026-11-07",
            "UTC",
            { daily: [], weekly: [] },
            {},
        ).weekly,
        false,
    );
    assert.equal(
        dashboardTask(
            entity,
            0,
            "2026-11-07",
            "UTC",
            { daily: [], weekly: [entity.id] },
            {},
        ).weekly,
        true,
    );
    const old = {
        ...entity,
        status: "done" as const,
        due_date: "2026-11-07",
        completed_at: "2020-01-01T00:00:00Z",
    };
    assert.equal(
        dashboardTask(
            old,
            0,
            "2026-11-07",
            "UTC",
            { daily: [], weekly: [] },
            {},
        ).daily,
        false,
    );
});
test("Habit check-ins use the Habit timezone and keep rest distinct", () => {
    const habit = dashboardHabit(
        {
            ...entity,
            timezone: "America/Mexico_City",
            frequency: "weekly",
            target: 3,
        },
        [
            { day: "2026-11-05", state: "done" },
            { day: "2026-11-06", state: "rest" },
        ],
        new Date("2026-11-07T00:30:00Z"),
    );
    assert.equal(habit.today, "2026-11-06");
    assert.deepEqual(habit.checkins, ["2026-11-05"]);
    assert.deepEqual(habit.rests, ["2026-11-06"]);
    assert.equal(habit.target, 3);
});
test("Goal focus uses the stored identifier and completion state", () => {
    const goal = dashboardGoal({
        ...entity,
        status: "completed",
        area_id: "owned-area",
    });
    assert.equal(goal.id, entity.id);
    assert.equal(goal.area, "owned-area");
    assert.equal(goal.status, "Done");
});

test("Task completion is binary while Goal progress states remain distinct", () => {
    for (const status of ["todo", "doing", "blocked", "done"]) {
        const row = dashboardTask({ ...entity, status }, 1, "2026-11-09", "UTC", { daily: [], weekly: [] }, {});
        assert.equal(row.status, status === "done" ? "Done" : "NotStarted");
    }
    assert.equal(dashboardGoal({ ...entity, status: "doing" }).status, "InProgress");
});

test("Habits without timezone use UTC+7 and explicit UTC remains authoritative", () => {
    const at = new Date("2026-11-09T18:30:00Z");
    assert.equal(dashboardHabit(entity, [], at).today, "2026-11-10");
    assert.equal(dashboardHabit({ ...entity, timezone: "UTC" }, [], at).today, "2026-11-09");
});
