import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyTaskList, taskScheduledOn } from '../../src/js/planning/dashboard-tasks.js';
import { taskMatchesView } from '../../src/js/planning/task-views.js';
import { transitionEntity } from '../../src/js/planning/transitions.js';

const tasks = [
    { id: 'a', status: 'NotStarted', importance: 5, scheduled_start: '2026-11-02T15:00:00Z' },
    { id: 'b', status: 'InProgress', importance: 2, scheduled_start: '2026-11-02T08:00:00Z' },
    { id: 'c', status: 'InProgress', importance: 4, start_date: '2026-11-01' },
    { id: 'd', status: 'Done', importance: 3 },
];

test('weekly sort and status filter work independently without changing stored order', () => {
    const original = structuredClone(tasks);
    assert.deepEqual(
        weeklyTaskList(tasks).map((task) => task.id),
        ['a', 'c', 'd', 'b'],
    );
    assert.deepEqual(
        weeklyTaskList(tasks, { sort: 'scheduled' }).map((task) => task.id),
        ['c', 'b', 'a', 'd'],
    );
    assert.deepEqual(
        weeklyTaskList(tasks, { sort: 'scheduled', status: 'InProgress' }).map((task) => task.id),
        ['c', 'b'],
    );
    assert.deepEqual(
        weeklyTaskList(tasks, { status: 'InProgress' }).map((task) => task.id),
        ['c', 'b'],
    );
    assert.deepEqual(
        weeklyTaskList(tasks, { status: 'Done' }).map((task) => task.id),
        ['d'],
    );
    assert.deepEqual(tasks, original);
});

test('Scheduled means planned start, occurrence or overlapping work interval, not deadline or reminder', () => {
    const today = '2026-11-01';
    const zone = 'America/Los_Angeles';
    assert.equal(taskScheduledOn({ scheduled_start: '2026-11-02T01:00:00Z' }, today, zone), true);
    assert.equal(
        taskScheduledOn(
            { scheduled_start: '2026-10-31T22:00:00Z', scheduled_end: '2026-11-02T12:00:00Z' },
            today,
            zone,
        ),
        true,
    );
    assert.equal(taskScheduledOn({ start_date: today }, today, zone), true);
    assert.equal(taskScheduledOn({ occurrence_date: today }, today, zone), true);
    assert.equal(
        taskScheduledOn({ deadline: today, reminder_at: '2026-11-02T01:00:00Z' }, today, zone),
        false,
    );
});

test('daily and weekly selections can explicitly reveal historical work while Overdue remains accessible', () => {
    const old = { id: 'old', status: 'NotStarted', deadline: '2026-10-01' };
    assert.equal(taskMatchesView(old, 'today', '2026-11-02', 'UTC', new Set()), false);
    assert.equal(
        taskMatchesView(old, 'today', '2026-11-02', 'UTC', new Set(), new Set(['old'])),
        true,
    );
    assert.equal(taskMatchesView(old, 'week', '2026-11-02', 'UTC', new Set(['old'])), true);
    assert.equal(taskMatchesView(old, 'overdue', '2026-11-02', 'UTC', new Set()), true);
    assert.equal(
        taskMatchesView({ ...old, status: 'Done' }, 'overdue', '2026-11-02', 'UTC', new Set()),
        false,
    );
});

test('reopening an overdue Task sends the chosen date with existing acknowledgement and version', async () => {
    const calls = [];
    const task = { id: 'task', name: 'Work', version: 7 };
    const result = await transitionEntity('task', task, 'reopen', {
        chooseDeadline: async (entity, today) => {
            assert.equal(entity, task);
            assert.equal(today, '2026-11-02');
            return { deadline: null };
        },
        confirm: () => true,
        send: async (path, body) => {
            calls.push({ path, body: { ...body } });
            if (calls.length === 1)
                throw {
                    status: 422,
                    code: 'REOPEN_DEADLINE_REQUIRED',
                    payload: { today: '2026-11-02' },
                };
            if (calls.length === 2)
                throw {
                    status: 422,
                    code: 'ANCESTOR_REOPEN_REQUIRED',
                    payload: { ancestors: [{ name: 'Parent' }] },
                };
            return { payload: { data: { id: 'task' } } };
        },
    });
    assert.equal(result.payload.data.id, 'task');
    assert.deepEqual(calls[2].body, {
        base_version: 7,
        deadline: null,
        acknowledge_ancestor_reopen: true,
    });
});

test('cancelling the overdue date decision never submits a mutation retry', async () => {
    let calls = 0;
    const result = await transitionEntity('task', { id: 'task', version: 1 }, 'reopen', {
        chooseDeadline: async () => null,
        send: async () => {
            calls++;
            throw {
                status: 422,
                code: 'REOPEN_DEADLINE_REQUIRED',
                payload: { today: '2026-11-02' },
            };
        },
    });
    assert.equal(result, null);
    assert.equal(calls, 1);
});
