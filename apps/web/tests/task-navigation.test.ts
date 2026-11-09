import test from "node:test";
import assert from "node:assert/strict";
import { matchesTaskView, views, type TaskRecord } from "../src/components/preview/task-data.ts";
const task = (values: Partial<TaskRecord>) => ({ start: "", due: "", scheduledStart: "", scheduledEnd: "", daily: false, weekly: false, ...values }) as TaskRecord;
const today = "2026-11-09";

test("Task navigation exposes exactly the four requested tabs", () => {
    assert.deepEqual(views.map(([key]) => key), ["all", "today", "week", "other"]);
});
test("Other excludes Today and the same week membership used by its counter", () => {
    for (const values of [{ daily: true }, { weekly: true }, { due: today }])
        assert.equal(matchesTaskView(task(values), "other", today, true), false);
    assert.equal(matchesTaskView(task({ due: "2026-11-08" }), "other", today, true), false);
    assert.equal(matchesTaskView(task({ due: "2026-11-08", status: "Done" }), "other", today, true), true);
    assert.equal(matchesTaskView(task({}), "other", today, true), true);
    assert.equal(matchesTaskView(task({ due: "2026-11-10" }), "other", today, true), true);
    assert.equal(matchesTaskView(task({ due: "2026-11-10" }), "other", today, false), false);
});
