import assert from "node:assert/strict";
import test from "node:test";
import { rebaseEdit } from "../src/lib/workspace-rebase.ts";

test("queued edits preserve fresh versions and untouched server fields", () => {
    const before = [{ id: "a", title: ["Old", "Old"], version: 1, done: false }, { id: "b", title: ["Other", "Other"], version: 1, done: false }];
    const after = before.map((row) => row.id === "a" ? { ...row, title: ["New", "New"] } : row);
    const server = before.map((row) => ({ ...row, version: 2, done: true }));
    assert.deepEqual(rebaseEdit(before, after, server), [
        { id: "a", title: ["New", "New"], version: 2, done: true },
        { id: "b", title: ["Other", "Other"], version: 2, done: true },
    ]);
});

test("creations keep their evaluated IDs and later edits target the same row", () => {
    const first = [{ id: "allocated-once", title: "Draft" }];
    const edited = [{ ...first[0], title: "Latest" }];
    const withCreation = rebaseEdit([], first, [{ id: "remote", title: "Remote" }]);
    assert.deepEqual(rebaseEdit(first, edited, withCreation), [
        { id: "remote", title: "Remote" }, { id: "allocated-once", title: "Latest" },
    ]);
});

test("queued check-in and undo preserve other days received from the server", () => {
    const before = { checkins: ["2026-11-01"], rests: [] as string[] };
    const checked = { ...before, checkins: [...before.checkins, "2026-11-08"] };
    const server = { ...before, checkins: [...before.checkins, "2026-11-07"] };
    const merged = rebaseEdit(before, checked, server);
    assert.deepEqual(merged.checkins, ["2026-11-01", "2026-11-07", "2026-11-08"]);
    assert.deepEqual(rebaseEdit(checked, before, merged).checkins, server.checkins);
});

test("deletions do not resurrect rows removed remotely and no-op edits stay no-op", () => {
    const before = [{ id: "a", value: 1 }, { id: "b", value: 2 }];
    assert.deepEqual(rebaseEdit(before, [before[1]], [...before, { id: "c", value: 3 }]), [{ id: "b", value: 2 }, { id: "c", value: 3 }]);
    assert.deepEqual(rebaseEdit(before, [{ ...before[0], value: 4 }, before[1]], [before[1]]), [before[1]]);
    assert.deepEqual(rebaseEdit(before, before, []), []);
});
