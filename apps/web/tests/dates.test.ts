import assert from "node:assert/strict";
import test from "node:test";
import {
    localDate,
    monthDays,
    taskMatches,
    zonedInput,
    zonedInstant,
} from "../src/lib/dates.ts";

test("calendar is Monday first and includes leap day", () => {
    const days = monthDays("2024-02");
    assert.equal(days.length, 42);
    assert.equal(new Date(days[0]).getUTCDay(), 1);
    assert.ok(days.includes("2024-02-29"));
});
test("scheduling follows account timezone and rejects nonexistent DST time", () => {
    assert.equal(
        zonedInstant("2026-11-07T09:00", "Asia/Ho_Chi_Minh"),
        "2026-11-07T02:00:00.000Z",
    );
    assert.equal(
        zonedInput("2026-11-07T02:00:00Z", "Asia/Ho_Chi_Minh"),
        "2026-11-07T09:00",
    );
    assert.throws(
        () => zonedInstant("2026-03-08T02:30", "America/New_York"),
        /daylight saving/,
    );
});
test("today uses account timezone, keeping DATE fields separate from instants", () => {
    const instant = new Date("2026-11-06T20:00:00Z");
    assert.equal(localDate("Asia/Ho_Chi_Minh", instant), "2026-11-07");
    assert.equal(localDate("America/Mexico_City", instant), "2026-11-06");
    assert.ok(
        taskMatches(
            { scheduled_at: instant.toISOString() },
            "2026-11-07",
            "Asia/Ho_Chi_Minh",
        ),
    );
    assert.ok(
        taskMatches(
            { due_date: "2026-11-06" },
            "2026-11-06",
            "Asia/Ho_Chi_Minh",
        ),
    );
});
