import assert from 'node:assert/strict';
import test from 'node:test';
import { activityLevel, yearCalendar, yearWindow } from '../../src/js/planning/dashboard-page.js';
import { buildGoalForest } from '../../src/js/planning/planning-page.js';

test('goal forest preserves arbitrary depth without assigning multiple primary parents', () => {
    const goals = [];
    for (let index = 0; index < 1001; index += 1) {
        goals.push({
            id: String(index),
            area_id: index === 0 ? 'area' : null,
            parent_goal_id: index === 0 ? null : String(index - 1),
        });
    }
    const forest = buildGoalForest(goals);
    assert.equal(forest.roots.length, 1);
    assert.equal(forest.nodes.size, 1001);
    assert.equal(forest.nodes.get('999').children[0].id, '1000');
});

test('activity levels use the documented GitHub-style display thresholds', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 6, 7, 20].map(activityLevel), [0, 1, 2, 2, 3, 3, 4, 4]);
});

test('yearly activity calendar gives every month its own Monday-first week block', () => {
    const calendar = yearCalendar(2026, [{ date: '2026-09-18', total: 3, counts: { task: 3 } }]);

    assert.equal(calendar.months.length, 12);
    // 2026-01-01 is a Thursday, so three Monday-first placeholders precede it.
    assert.deepEqual(
        calendar.months[0].cells.slice(0, 4).map((day) => day?.date ?? null),
        [null, null, null, '2026-01-01'],
    );
    for (const { month, cells, weeks } of calendar.months) {
        assert.equal(cells.length, weeks * 7);
        assert.ok(cells.every((day) => day === null || Number(day.date.slice(5, 7)) === month + 1));
    }
    assert.equal(
        calendar.months.flatMap(({ cells }) => cells).filter((day) => day !== null).length,
        365,
    );
    const september = calendar.months[8].cells;
    assert.equal(september.find((day) => day?.date === '2026-09-18').total, 3);
    assert.equal(calendar.months[1].column, calendar.months[0].weeks);
    assert.equal(
        calendar.columns,
        calendar.months.reduce((sum, { weeks }) => sum + weeks, 0),
    );
});

test('year spinner keeps the selected year in the middle and blocks out-of-range neighbours', () => {
    assert.deepEqual(yearWindow(2025, 2026), [
        { year: 2026, selected: false, selectable: true },
        { year: 2025, selected: true, selectable: true },
        { year: 2024, selected: false, selectable: true },
    ]);
    const current = yearWindow(2026, 2026);
    assert.deepEqual(
        current.map(({ year }) => year),
        [2027, 2026, 2025],
    );
    assert.equal(current[0].selectable, false);
    assert.equal(yearWindow(2000, 2026)[2].selectable, false);
});
