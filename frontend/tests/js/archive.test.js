import assert from 'node:assert/strict';
import test from 'node:test';
import { archiveMatches, restoreBlocker } from '../../src/js/settings/archive.js';

const items = [
    { type: 'goal', name: 'Learn Rust', parent: { type: 'area', name: 'Study', archived: false } },
    {
        type: 'task',
        name: 'Old idea',
        parent: { type: 'goal', name: 'Learn Rust', archived: true },
    },
    { type: 'habit', name: 'Run', parent: { type: 'goal', name: 'Fitness', archived: true } },
    { type: 'area', name: 'Side projects', parent: null },
];

test('archive filters by type and name, keeping server order', () => {
    assert.deepEqual(
        archiveMatches(items, { type: 'all', query: '' }).map((item) => item.name),
        ['Learn Rust', 'Old idea', 'Run', 'Side projects'],
    );
    assert.deepEqual(
        archiveMatches(items, { type: 'task' }).map((item) => item.name),
        ['Old idea'],
    );
    assert.deepEqual(
        archiveMatches(items, { query: ' RUST ' }).map((item) => item.name),
        ['Learn Rust'],
    );
});

test('only items inside an archived parent wait for it; a Habit only links to its Goal', () => {
    assert.equal(restoreBlocker(items[0]), '');
    assert.equal(
        restoreBlocker(items[1]),
        'Inside the archived Goal “Learn Rust”. Restore it first.',
    );
    assert.equal(restoreBlocker(items[2]), '');
    assert.equal(restoreBlocker(items[3]), '');
});
