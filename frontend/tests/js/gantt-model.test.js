import assert from 'node:assert/strict';
import test from 'node:test';
import {
    containerSpan,
    dragChanges,
    draggable,
    extendRange,
    ganttRows,
    initialRange,
    scaleSegments,
    taskSpan,
} from '../../src/js/planning/gantt-model.js';

const tz = 'Asia/Ho_Chi_Minh';

test('a task spans its start to its due date; a single date is a point', () => {
    assert.deepEqual(taskSpan({ start_date: '2026-11-02', deadline: '2026-11-06' }, tz), {
        start: '2026-11-02',
        end: '2026-11-06',
        point: false,
    });
    assert.deepEqual(taskSpan({ deadline: '2026-11-06' }, tz), {
        start: '2026-11-06',
        end: '2026-11-06',
        point: true,
    });
    // A work slot counts in the account time zone: 23:00 UTC is the next local day.
    assert.deepEqual(
        taskSpan(
            { scheduled_start: '2026-11-05T23:00:00Z', scheduled_end: '2026-11-06T01:00:00Z' },
            tz,
        ),
        { start: '2026-11-06', end: '2026-11-06', point: false },
    );
    assert.equal(taskSpan({ name: 'No dates' }, tz), null);
});

test('milestones and goals take missing ends from the work inside, marked as derived', () => {
    const inner = [
        { start: '2026-11-03', end: '2026-11-05' },
        { start: '2026-11-01', end: '2026-11-09' },
    ];
    assert.deepEqual(containerSpan({ deadline: '2026-11-20' }, inner), {
        start: '2026-11-01',
        end: '2026-11-20',
        point: false,
        derived: { start: true, end: false },
    });
    assert.deepEqual(
        containerSpan({ start_date: '2026-11-02', deadline: '2026-11-20' }, inner).derived,
        {
            start: false,
            end: false,
        },
    );
    assert.equal(containerSpan({ deadline: '2026-11-20' }, []).point, true);
    assert.equal(containerSpan({}, []), null);
});

const data = {
    goals: [
        { id: 'g1', name: 'Exam', deadline: '2026-12-31', progress: 25, status: 'Active' },
        {
            id: 'g2',
            name: 'Later',
            start_date: '2027-01-05',
            deadline: '2027-02-01',
            status: 'Active',
        },
    ],
    milestones: [
        {
            id: 'm1',
            goal_id: 'g1',
            name: 'Grammar',
            start_date: '2026-11-01',
            deadline: '2026-11-10',
            position: 0,
            progress: { percentage: 100 },
            status: 'Completed',
            prerequisite_ids: [],
        },
        {
            id: 'm2',
            goal_id: 'g1',
            name: 'Listening',
            deadline: '2026-11-30',
            position: 1,
            progress: { percentage: 50 },
            status: 'NotStarted',
            prerequisite_ids: ['m1'],
        },
    ],
    tasks: [
        {
            id: 't1',
            milestone_id: 'm2',
            name: 'Paper 1',
            start_date: '2026-11-12',
            deadline: '2026-11-14',
            status: 'InProgress',
        },
        {
            id: 't2',
            goal_id: 'g1',
            name: 'Book exam',
            deadline: '2026-11-04',
            status: 'NotStarted',
        },
        { id: 't3', name: 'Undated', status: 'NotStarted' },
    ],
};

test('rows by goal nest milestones and tasks only when opened', () => {
    const closed = ganttRows(data, { by: 'goal', today: '2026-11-05' }, tz);
    assert.deepEqual(
        closed.map((row) => row.key),
        ['goal:g1', 'goal:g2'],
    );
    assert.equal(closed[0].hasChildren, true);
    const open = ganttRows(
        data,
        { by: 'goal', expanded: new Set(['goal:g1', 'milestone:m2']), today: '2026-11-05' },
        tz,
    );
    assert.deepEqual(
        open.map((row) => `${row.depth}:${row.key}`),
        ['0:goal:g1', '1:milestone:m1', '1:milestone:m2', '2:task:t1', '1:task:t2', '0:goal:g2'],
    );
    // The goal starts with its earliest milestone and keeps its own deadline.
    assert.deepEqual([open[0].span.start, open[0].span.end], ['2026-11-01', '2026-12-31']);
    // Book exam was due on Nov 4 and is not done.
    assert.equal(open.find((row) => row.key === 'task:t2').overdue, true);
});

test('rows by task skip undated work; rows by milestone carry their goal as context', () => {
    assert.deepEqual(
        ganttRows(data, { by: 'task', today: '2026-11-05' }, tz).map((row) => row.key),
        ['task:t2', 'task:t1'],
    );
    const milestones = ganttRows(
        data,
        { by: 'milestone', visible: (type, item) => item.id !== 'm1' },
        tz,
    );
    assert.deepEqual(
        milestones.map((row) => [row.key, row.context]),
        [['milestone:m2', 'Exam']],
    );
});

test('rows by task leave out work that ended before the timeline starts', () => {
    assert.deepEqual(
        ganttRows(data, { by: 'task', from: '2026-11-10' }, tz).map((row) => row.key),
        ['task:t1'],
    );
});

test('dragging moves own dates together and edges never cross', () => {
    const task = {
        status: 'NotStarted',
        start_date: '2026-11-12',
        deadline: '2026-11-14',
        scheduled_start: '2026-11-12T12:00:00Z',
    };
    assert.deepEqual(dragChanges('task', task, 'move', 3, tz), {
        start_date: '2026-11-15',
        deadline: '2026-11-17',
        scheduled_start: '2026-11-15T12:00:00.000Z',
    });
    assert.deepEqual(dragChanges('task', task, 'end', -5, tz), { deadline: '2026-11-12' });
    assert.deepEqual(dragChanges('task', task, 'start', 9, tz), { start_date: '2026-11-14' });
    assert.equal(dragChanges('task', task, 'move', 0, tz), null);
    assert.equal(dragChanges('task', { ...task, status: 'Done' }, 'move', 2, tz), null);
    // A milestone without its own start only moves its deadline.
    assert.deepEqual(dragChanges('milestone', data.milestones[1], 'move', -2, tz), {
        deadline: '2026-11-28',
    });
});

test('only own, unfinished dates are draggable', () => {
    const [goal] = ganttRows(data, { by: 'goal', today: '2026-11-05' }, tz);
    assert.deepEqual(draggable(goal), { move: true, start: false, end: true });
    const done = ganttRows(data, { by: 'milestone', today: '2026-11-05' }, tz).find(
        (row) => row.key === 'milestone:m1',
    );
    assert.deepEqual(draggable(done), { move: false, start: false, end: false });
});

test('the range starts on a Monday before today and grows at its end', () => {
    const range = initialRange('2026-11-05', 'day');
    assert.equal(range.start, '2026-10-26');
    assert.equal(extendRange(range, 'day').days, range.days + 90);
    const { months, units } = scaleSegments({ start: '2026-10-26', days: 14 }, 'day');
    assert.deepEqual(months, [
        { start: '2026-10-26', days: 6 },
        { start: '2026-11-01', days: 8 },
    ]);
    assert.equal(units.length, 14);
});
