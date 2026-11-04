import assert from 'node:assert/strict';
import test from 'node:test';
import {
    calendarEntries,
    canMove,
    entriesOn,
    monthWeeks,
    moveChanges,
    shiftInstant,
    unscheduledTasks,
    weekDays,
} from '../../src/js/planning/calendar-model.js';

const task = (fields) => ({
    id: 't',
    name: 'Task',
    status: 'NotStarted',
    importance: 3,
    ...fields,
});

test('weeks start on Monday and a month never ends with an empty week', () => {
    assert.deepEqual(weekDays('2026-11-04').slice(0, 2), ['2026-11-02', '2026-11-03']);
    assert.equal(weekDays('2026-11-08')[6], '2026-11-08');
    const november = monthWeeks(2026, 11);
    assert.equal(november[0][0], '2026-10-26');
    assert.equal(november.at(-1).at(-1), '2026-12-06');
    assert.equal(november.length, 6);
    assert.equal(monthWeeks(2027, 2).length, 4);
});

test('a Task appears once per day, with the most specific date kind', () => {
    const entries = calendarEntries(
        {
            tasks: [
                task({ id: 'a', start_date: '2026-11-02', deadline: '2026-11-05' }),
                task({ id: 'b', start_date: '2026-11-05', deadline: '2026-11-05' }),
                task({
                    id: 'c',
                    deadline: '2026-11-06',
                    scheduled_start: '2026-11-05T23:00:00Z',
                    scheduled_end: '2026-11-06T01:00:00Z',
                }),
            ],
            milestones: [{ id: 'm', name: 'M', deadline: '2026-11-05', status: 'Active' }],
        },
        'Asia/Ho_Chi_Minh',
    );
    const on = (date) => entriesOn(entries, date).map((entry) => `${entry.item.id}:${entry.kind}`);
    assert.deepEqual(on('2026-11-02'), ['a:start']);
    assert.deepEqual(on('2026-11-05'), ['m:deadline', 'a:due', 'b:due']);
    // 23:00Z is 06:00 the next local day, so the block and the due date share Nov 6.
    assert.deepEqual(on('2026-11-06'), ['c:scheduled']);
});

test('moving shifts every date on the source day and keeps scheduled clock times', () => {
    const zone = 'Asia/Ho_Chi_Minh';
    assert.deepEqual(
        moveChanges(
            'task',
            task({ start_date: '2026-11-05', deadline: '2026-11-05' }),
            '2026-11-05',
            '2026-11-09',
            zone,
        ),
        { deadline: '2026-11-09', start_date: '2026-11-09' },
    );
    assert.deepEqual(
        moveChanges(
            'task',
            task({ start_date: '2026-11-02', deadline: '2026-11-05' }),
            '2026-11-05',
            '2026-11-03',
            zone,
        ),
        { deadline: '2026-11-03' },
    );
    assert.deepEqual(
        moveChanges(
            'task',
            task({
                scheduled_start: '2026-11-05T02:00:00.000Z',
                scheduled_end: '2026-11-05T03:30:00.000Z',
            }),
            '2026-11-05',
            '2026-11-04',
            zone,
        ),
        { scheduled_start: '2026-11-04T02:00:00.000Z', scheduled_end: '2026-11-04T03:30:00.000Z' },
    );
    assert.deepEqual(moveChanges('task', task({}), null, '2026-11-07', zone), {
        deadline: '2026-11-07',
    });
    assert.deepEqual(
        moveChanges('milestone', { deadline: '2026-11-05' }, '2026-11-05', '2026-11-08', zone),
        {
            deadline: '2026-11-08',
        },
    );
    assert.equal(
        moveChanges('task', task({ deadline: '2026-11-05' }), '2026-11-05', '2026-11-05', zone),
        null,
    );
});

test('daylight saving never moves the wall-clock time of a scheduled block', () => {
    // 09:00 in New York before and after the 2026-11-01 change back to standard time.
    assert.equal(
        shiftInstant('2026-10-31T13:00:00.000Z', 2, 'America/New_York'),
        '2026-11-02T14:00:00.000Z',
    );
});

test('occurrences and completed work stay put; the tray lists only undated open one-offs', () => {
    const zone = 'UTC';
    const [occurrence] = calendarEntries(
        { tasks: [task({ series_id: 's', occurrence_date: '2026-11-05' })] },
        zone,
    );
    assert.equal(canMove(occurrence, zone), false);
    const [done] = calendarEntries(
        { tasks: [task({ status: 'Done', deadline: '2026-11-05' })] },
        zone,
    );
    assert.equal(canMove(done, zone), false);
    assert.equal(canMove({ type: 'task', item: task({}), date: null, done: false }, zone), true);
    assert.deepEqual(
        unscheduledTasks([
            task({ id: 'low', importance: 2 }),
            task({ id: 'high', importance: 5 }),
            task({ id: 'dated', deadline: '2026-11-05' }),
            task({ id: 'done', status: 'Done' }),
            task({ id: 'series', series_id: 's' }),
        ]).map((item) => item.id),
        ['high', 'low'],
    );
});
