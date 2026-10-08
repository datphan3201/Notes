import test from 'node:test';
import assert from 'node:assert/strict';
import { localDate, taskMatchesView, resourceLinks } from '../../src/js/planning/task-views.js';

test('scheduled tasks cross UTC midnight into the account date, independently of deadline and week selection', () => {
    const task = { id: 'a', deadline: '2026-10-08', scheduled_start: '2026-10-08T02:00:00Z' };
    assert.equal(localDate(task.scheduled_start, 'America/Mexico_City'), '2026-10-07');
    assert.equal(
        taskMatchesView(task, 'today', '2026-10-07', 'America/Mexico_City', new Set()),
        true,
    );
    assert.equal(
        taskMatchesView(task, 'next', '2026-10-07', 'America/Mexico_City', new Set()),
        true,
    );
    assert.equal(taskMatchesView(task, 'week', '2026-10-07', 'UTC', new Set(['a'])), true);
    assert.equal(taskMatchesView(task, 'backlog', '2026-10-07', 'UTC', new Set()), false);
});
test('backlog preserves inbox tasks but excludes selected and overdue tasks without inventing status', () => {
    const inbox = { id: 'a', deadline: null, scheduled_start: null, status: 'Blocked' };
    assert.equal(taskMatchesView(inbox, 'backlog', '2026-10-07', 'UTC', new Set()), true);
    assert.equal(taskMatchesView(inbox, 'backlog', '2026-10-07', 'UTC', new Set(['a'])), false);
    assert.equal(
        taskMatchesView(
            { ...inbox, deadline: '2026-10-06' },
            'backlog',
            '2026-10-07',
            'UTC',
            new Set(),
        ),
        false,
    );
    assert.equal(
        taskMatchesView(
            { ...inbox, deadline: '2026-10-06' },
            'all',
            '2026-10-07',
            'UTC',
            new Set(),
        ),
        true,
    );
});
test('resources recognize only HTTP links, deduplicate, and leave user content unmodified', () => {
    const body =
        'See https://example.org/docs. Again https://example.org/docs. [Article](http://example.org/article) javascript:alert(1) <script>bad</script>';
    assert.deepEqual(resourceLinks(body), [
        'https://example.org/docs',
        'http://example.org/article',
    ]);
    assert.equal(resourceLinks('unfinished https://').length, 0);
});

test('today includes an interval crossing midnight, a planned start date, and a recurring occurrence', () => {
    const spanning = {
        id: 'span',
        scheduled_start: '2026-10-06T23:00:00Z',
        scheduled_end: '2026-10-07T01:00:00Z',
    };
    assert.equal(taskMatchesView(spanning, 'today', '2026-10-07', 'UTC', new Set()), true);
    assert.equal(taskMatchesView(spanning, 'today', '2026-10-08', 'UTC', new Set()), false);
    assert.equal(
        taskMatchesView(
            { id: 'start', start_date: '2026-10-07' },
            'today',
            '2026-10-07',
            'UTC',
            new Set(),
        ),
        true,
    );
    assert.equal(
        taskMatchesView(
            { id: 'occurrence', occurrence_date: '2026-10-08' },
            'next',
            '2026-10-07',
            'UTC',
            new Set(),
        ),
        true,
    );
    assert.equal(
        taskMatchesView(
            { id: 'occurrence', occurrence_date: '2026-10-08' },
            'backlog',
            '2026-10-07',
            'UTC',
            new Set(),
        ),
        false,
    );
});
