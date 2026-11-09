import assert from "node:assert/strict";
import test from "node:test";
import { pickedTaskPatch, returnedTaskPatch, readPickedTask, taskCanReturn, taskIsPicked } from "../src/lib/task-picker.ts";
import type { TaskRecord } from "../src/components/preview/task-data";

const task = (fields: Partial<TaskRecord> = {}) => ({
    id: 1, daily: false, weekly: false, parent: "", start: "", due: "",
    scheduledStart: "", scheduledEnd: "", ...fields,
}) as TaskRecord;

test("manual daily/weekly selections preserve dates, status and an existing daily selection", () => {
    assert.deepEqual(pickedTaskPatch(task(), { kind: "plan", period: "today" }), { daily: true, weekly: true });
    assert.deepEqual(pickedTaskPatch(task({ daily: true }), { kind: "plan", period: "week" }), { daily: true, weekly: true });
    assert.equal(taskIsPicked(task({ daily: true }), { kind: "plan", period: "today" }), true);
});

test("an undated task gains only its target due date", () => {
    assert.deepEqual(pickedTaskPatch(task(), { kind: "calendar", date: "2026-11-09" }), { due: "2026-11-09" });
});

test("calendar moves shift complete intervals across month boundaries and keep local clock times", () => {
    const row = task({ start: "2026-10-31", due: "2026-11-02", scheduledStart: "2026-10-31T23:30", scheduledEnd: "2026-11-01T00:30" });
    assert.deepEqual(pickedTaskPatch(row, { kind: "calendar", date: "2026-11-09" }), {
        start: "2026-11-09", due: "2026-11-11", scheduledStart: "2026-11-09T23:30", scheduledEnd: "2026-11-10T00:30",
    });
    assert.equal(row.start, "2026-10-31");
});

test("date-only intervals can move backwards without reversing their order", () => {
    assert.deepEqual(pickedTaskPatch(task({ start: "2026-11-09", due: "2026-11-11" }), { kind: "calendar", date: "2026-11-01" }), {
        start: "2026-11-01", due: "2026-11-03", scheduledStart: "", scheduledEnd: "",
    });
});

test("primary-parent assignment changes only the parent and duplicate detection uses that exact parent", () => {
    assert.deepEqual(pickedTaskPatch(task({ due: "2026-11-09" }), { kind: "parent", id: "milestone-a" }), { parent: "milestone-a" });
    assert.equal(taskIsPicked(task({ parent: "goal-a" }), { kind: "parent", id: "milestone-a" }), false);
    assert.equal(taskIsPicked(task({ parent: "milestone-a" }), { kind: "parent", id: "milestone-a" }), true);
});

test("drag payload IDs reject malformed, negative and unsafe numbers", () => {
    for (const value of ["", "-1", "0", "1.5", "Infinity", "task:1", "9007199254740992"]) assert.equal(readPickedTask(value), null);
    assert.equal(readPickedTask("123"), 123);
});


test("returning from Today keeps the weekly selection while removing the week also clears Today", () => {
    const row = task({ daily: true, weekly: true, due: "2026-11-10" });
    assert.deepEqual({ ...row, ...returnedTaskPatch({ kind: "plan", period: "today" }) }, { ...row, daily: false });
    assert.deepEqual(returnedTaskPatch({ kind: "plan", period: "week" }), { daily: false, weekly: false });
});

test("returning from Calendar clears all date fields and preserves other metadata", () => {
    const row = task({ start: "2026-11-09", due: "2026-11-10", scheduledStart: "2026-11-09T09:00", scheduledEnd: "2026-11-09T10:00", parent: "goal", daily: true, reminder: "custom", reminderAt: "2026-11-12T08:00" });
    assert.deepEqual({ ...row, ...returnedTaskPatch({ kind: "calendar", date: "2026-11-15" }) }, {
        ...row, start: "", due: "", scheduledStart: "", scheduledEnd: "",
    });
    assert.equal(taskCanReturn(row, { kind: "calendar", date: "2026-11-15" }), true);
    assert.equal(taskCanReturn(task(), { kind: "calendar", date: "2026-11-15" }), false);
});

test("a parent return detaches only Tasks directly attached to that exact parent", () => {
    assert.deepEqual(returnedTaskPatch({ kind: "parent", id: "milestone" }), { parent: "" });
    assert.equal(taskCanReturn(task({ parent: "milestone" }), { kind: "parent", id: "milestone" }), true);
    assert.equal(taskCanReturn(task({ parent: "other" }), { kind: "parent", id: "milestone" }), false);
});

test("due, overdue and scheduled dates do not imply a manual Today selection", () => {
    for (const fields of [{ due: "2026-11-09" }, { due: "2026-11-01" }, { scheduledStart: "2026-11-09T09:00", scheduledEnd: "2026-11-09T10:00" }]) {
        assert.equal(taskIsPicked(task(fields), { kind: "plan", period: "today" }), false);
    }
});
