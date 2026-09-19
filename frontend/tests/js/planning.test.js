import assert from 'node:assert/strict';
import test from 'node:test';
import { activityLevel, calendarDays } from '../../src/js/planning/dashboard-page.js';
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

test('activity calendar lays out complete Sunday-first weeks for a month', () => {
    const days = calendarDays('2026-09', [
        { date: '2026-09-18', active: true, total: 3, counts: { task: 3 } },
    ]);

    assert.equal(days.length % 7, 0);
    assert.equal(
        days.slice(0, 2).every((day) => day === null),
        true,
    );
    assert.equal(days.find((day) => day?.date === '2026-09-18').total, 3);
    assert.equal(days.filter((day) => day !== null).length, 30);
});
