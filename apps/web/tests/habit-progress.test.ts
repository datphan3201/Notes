import { test } from "node:test";
import assert from "node:assert/strict";
import { habitStreak } from "../src/lib/habit-progress.ts";
import { addDays } from "../src/lib/task-views.ts";
import type { Habit } from "../src/components/preview/workspace-data";
const habit = (fields: Partial<Habit>): Habit => ({
    id: "h",
    title: ["Practice", "Practice"],
    goal: "",
    frequency: "daily",
    target: 1,
    timezone: "UTC",
    importance: 3,
    icon: "leaf",
    color: "",
    checkins: [],
    rests: [],
    archived: false,
    ...fields,
});
test("daily streaks bridge rest without counting it and have no one-year limit", () => {
    const first = "2024-01-01",
        days = Array.from({ length: 400 }, (_, i) => addDays(first, i));
    assert.equal(
        habitStreak(
            habit({
                created: first,
                checkins: days.filter((_, i) => i !== 200),
                rests: [days[200]],
            }),
            days[399],
        ),
        399,
    );
    assert.equal(
        habitStreak(
            habit({ created: first, checkins: [first] }),
            addDays(first, 1),
        ),
        1,
    );
});
test("weekly rest reduces quota, all-rest weeks protect but do not inflate streaks", () => {
    const row = habit({
        frequency: "weekly",
        target: 3,
        created: "2026-10-19",
        checkins: ["2026-10-19", "2026-10-20", "2026-10-21", "2026-11-02"],
        rests: [
            ...Array.from({ length: 7 }, (_, i) => addDays("2026-10-26", i)),
            "2026-11-03",
            "2026-11-04",
        ],
    });
    assert.equal(habitStreak(row, "2026-11-08"), 2);
});
test("a partial first week caps the required target at tracked days", () => {
    assert.equal(
        habitStreak(
            habit({
                frequency: "weekly",
                target: 7,
                created: "2026-11-08",
                checkins: ["2026-11-08"],
            }),
            "2026-11-08",
        ),
        1,
    );
});

test("retrospective check-ins extend a streak before the Habit creation date", () => {
    assert.equal(habitStreak(habit({ created: "2026-11-09", checkins: ["2026-11-07", "2026-11-08", "2026-11-09"] }), "2026-11-09"), 3);
});
