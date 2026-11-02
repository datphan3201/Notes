import test from 'node:test';
import assert from 'node:assert/strict';
import { recentActivityCalendar } from '../../src/js/planning/recent-activity.js';

test('the recent calendar spans exactly thirty dates over a year boundary and fills zero days', () => {
    const fact = { date: '2026-01-01', total: 2, counts: { task: 2 } };
    const cells = recentActivityCalendar('2025-12-03', '2026-01-01', [fact]);
    const days = cells.filter(Boolean);
    assert.equal(days.length, 30);
    assert.equal(cells.length % 7, 0);
    assert.equal(cells[0], null);
    assert.equal(cells[1], null);
    assert.equal(days[0].date, '2025-12-03');
    assert.equal(days.at(-1), fact);
    assert.deepEqual(days[0], { date: '2025-12-03', total: 0, counts: {} });
});

test('the recent calendar includes leap day without accepting facts outside its range', () => {
    const days = recentActivityCalendar('2024-02-01', '2024-03-01', [
        { date: '2024-01-31', total: 99 },
        { date: '2024-03-02', total: 99 },
        { date: '2024-02-29', total: 1, counts: { habit: 1 } },
    ]).filter(Boolean);
    assert.equal(days.length, 30);
    assert.equal(days.filter((day) => day.total).length, 1);
    assert.equal(days.find((day) => day.total).date, '2024-02-29');
});

test('DATE arithmetic stays consecutive across daylight-saving transitions', () => {
    const days = recentActivityCalendar('2026-10-04', '2026-11-02', []).filter(Boolean);
    assert.equal(days.length, 30);
    assert.equal(new Set(days.map((day) => day.date)).size, 30);
    assert.equal(days.at(-2).date, '2026-11-01');
    assert.equal(days.at(-1).date, '2026-11-02');
});
