import test from "node:test";
import assert from "node:assert/strict";
import { matchesView, inHistory, monday } from "../src/lib/task-views.ts";
import type { Entity } from "../src/lib/api.ts";
const task = (values: Partial<Entity>) => ({ id: "a", status: "todo", ...values }) as Entity;

test("scheduled work can be both Today and Next after projecting into account timezone", () => {
    const item = task({ due_date: "2026-10-08", scheduled_at: "2026-10-08T02:00:00Z" });
    assert.ok(matchesView(item, "today", "2026-10-07", "America/Mexico_City"));
    assert.ok(matchesView(item, "next", "2026-10-07", "America/Mexico_City"));
    assert.equal(matchesView(item, "backlog", "2026-10-07", "UTC"), false);
});
test("weekly membership is explicit and survives completion", () => {
    const item = task({ due_date: "2026-10-07", status: "done" });
    assert.equal(matchesView(item, "week", "2026-10-07", "UTC"), false);
    assert.ok(matchesView(item, "week", "2026-10-07", "UTC", new Set(["a"])));
    assert.equal(monday("2026-10-11"), "2026-10-05");
});
test("manual daily selection can reveal history without changing the Task", () => {
    const item = task({ due_date: "2026-10-01" });
    assert.equal(matchesView(item, "today", "2026-10-07", "UTC"), false);
    assert.ok(matchesView(item, "today", "2026-10-07", "UTC", new Set(), new Set(["a"])));
    assert.equal(item.due_date, "2026-10-01");
    assert.ok(matchesView(item, "overdue", "2026-10-07", "UTC"));
});
test("overdue remains in Today only until the local-date history threshold", () => {
    const item = task({ due_date: "2026-10-06" });
    assert.ok(matchesView(item, "today", "2026-10-07", "UTC"));
    assert.equal(matchesView(item, "today", "2026-10-09", "UTC"), false);
    assert.ok(matchesView(item, "history", "2026-10-09", "UTC"));
    assert.ok(matchesView(item, "today", "2026-10-09", "UTC", new Set(), new Set(), { history_overdue_days: 5 }));
});
test("intervals spanning midnight and recurrence dates preserve view membership", () => {
    const item = task({ scheduled_at: "2026-10-06T23:00:00Z", scheduled_end: "2026-10-07T01:00:00Z" });
    assert.ok(matchesView(item, "today", "2026-10-07", "UTC"));
    assert.equal(matchesView(item, "today", "2026-10-08", "UTC"), false);
    assert.ok(matchesView(task({ occurrence_date: "2026-10-08" }), "next", "2026-10-07", "UTC"));
    assert.equal(matchesView(task({ occurrence_date: "2026-10-08" }), "backlog", "2026-10-07", "UTC"), false);
});
test("completion history uses elapsed instants with exact threshold boundaries", () => {
    const now = Date.parse("2026-10-19T12:00:00Z");
    assert.ok(inHistory(task({ status: "done", completed_at: "2026-10-18T12:00:00Z" }), "2026-10-19", {}, now));
    assert.equal(inHistory(task({ status: "done", completed_at: "2026-10-18T12:00:01Z" }), "2026-10-19", {}, now), false);
    assert.equal(inHistory(task({ status: "done" }), "2026-10-19", {}, now), false);
});
