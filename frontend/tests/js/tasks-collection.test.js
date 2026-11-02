import test from 'node:test';
import assert from 'node:assert/strict';
import { completedInView, seriesPage, sortTasks } from '../../src/js/planning/tasks-collection.js';
import { historyPage } from '../../src/js/settings/task-history.js';

const today = '2026-11-02';
test('Completed follows Today/Week/Next/All membership instead of leaking global completions', () => {
    const tasks = [
        { id: 'today', status: 'Done', start_date: today },
        { id: 'other', status: 'Done', start_date: '2026-11-03' },
        { id: 'manual', status: 'Done' },
        { id: 'old', status: 'Done', start_date: today, completed_at: '2020-01-01T00:00:00Z' },
        { id: 'open', status: 'InProgress', start_date: today },
    ];
    const ids = (view) =>
        completedInView(tasks, view, today, 'UTC', new Set(['other']), new Set(['manual'])).map(
            (t) => t.id,
        );
    assert.deepEqual(ids('today'), ['today', 'manual']);
    assert.deepEqual(ids('week'), ['other']);
    assert.deepEqual(ids('next'), ['other']);
    assert.deepEqual(ids('all'), ['today', 'other', 'manual']);
});

test('sorting uses account-local scheduled time, keeps undated work last and is independent of filtering', () => {
    const tasks = [
        { id: 'undated', importance: 5 },
        { id: 'instant', importance: 3, scheduled_start: '2026-11-03T00:00:00Z' },
        { id: 'date', importance: 3, start_date: '2026-11-02' },
    ];
    assert.deepEqual(
        sortTasks(tasks, 'scheduled', 'America/Mexico_City').map((t) => t.id),
        ['date', 'instant', 'undated'],
    );
    assert.deepEqual(
        sortTasks(tasks, 'importance', 'UTC').map((t) => t.id),
        ['undated', 'instant', 'date'],
    );
    assert.deepEqual(
        tasks.map((t) => t.id),
        ['undated', 'instant', 'date'],
    );
});

test('Repeating search/state/count/paging use the same series including terminal rows', () => {
    const series = [
        { id: 'a', name: 'Read [API]', state: 'Active' },
        { id: 'b', name: 'Read [API]', state: 'Paused' },
        { id: 'c', name: 'Read [API]', state: 'Ended' },
        { id: 'd', name: 'Write', state: 'Active' },
    ];
    assert.equal(seriesPage(series).total, 4);
    const result = seriesPage(series, { query: '[api]', state: 'Ended', page: 9, size: 1 });
    assert.equal(result.total, 1);
    assert.equal(result.page, 0);
    assert.deepEqual(
        result.items.map((t) => t.id),
        ['c'],
    );
    assert.equal(seriesPage(series, { state: 'Active', query: 'missing' }).total, 0);
});

test('History sorts completion/due facts newest first, searches descriptions and clamps pages after reopen', () => {
    const tasks = [
        { id: 'older', name: 'Read', status: 'Done', completed_at: '2026-10-01T12:00:00Z' },
        {
            id: 'late',
            name: 'Write',
            description: 'API',
            status: 'InProgress',
            deadline: '2026-10-28',
        },
        { id: 'newer', name: 'API', status: 'Done', completed_at: '2026-10-30T12:00:00Z' },
        { id: 'open', name: 'API', status: 'NotStarted' },
    ];
    const options = {
        today,
        now: Date.parse('2026-11-02T12:00:00Z'),
        thresholds: { completedHours: 24, overdueDays: 3 },
    };
    assert.deepEqual(
        historyPage(tasks, options).items.map((t) => t.id),
        ['newer', 'late', 'older'],
    );
    assert.deepEqual(
        historyPage(tasks, { ...options, query: 'api' }).items.map((t) => t.id),
        ['newer', 'late'],
    );
    assert.equal(historyPage(tasks, { ...options, page: 2, size: 1 }).page, 2);
    assert.equal(historyPage(tasks.slice(1), { ...options, page: 2, size: 1 }).page, 1);
    assert.deepEqual(
        tasks.map((t) => t.id),
        ['older', 'late', 'newer', 'open'],
    );
});
