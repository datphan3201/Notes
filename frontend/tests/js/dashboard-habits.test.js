import assert from 'node:assert/strict';
import test from 'node:test';
import { habitCheckInSummary, weeklyHabitTargets } from '../../src/js/planning/dashboard-habits.js';
import { milestoneProgress } from '../../src/js/planning/dashboard-roadmap.js';

const habits = [
    { id: 'a', period: 'daily', done_today: true },
    { id: 'b', period: 'daily', done_today: false },
    { id: 'c', period: 'weekly', done_today: false },
];

test('habit check-in summary counts only Habits checked in on their own today', () => {
    assert.deepEqual(habitCheckInSummary(habits), { done: 1, total: 3 });
    assert.deepEqual(habitCheckInSummary([]), { done: 0, total: 0 });
});

test('weekly targets list only weekly Habits and preserve server order', () => {
    assert.deepEqual(
        weeklyHabitTargets(habits).map((habit) => habit.id),
        ['c'],
    );
});

test('roadmap connector progress follows the Milestone, clamped to 0-100', () => {
    assert.equal(milestoneProgress({ status: 'Completed', progress: { percentage: 0 } }), 100);
    assert.equal(milestoneProgress({ status: 'InProgress', progress: { percentage: 50 } }), 50);
    assert.equal(milestoneProgress({ status: 'InProgress', progress: { percentage: 140 } }), 100);
    assert.equal(milestoneProgress({ status: 'NotStarted' }), 0);
    assert.equal(milestoneProgress({ status: 'NotStarted', progress: { percentage: 'x' } }), 0);
});
