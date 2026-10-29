import test from 'node:test';
import assert from 'node:assert/strict';
import {
    addDays,
    monthMatrix,
    nextWeek,
    reminderPreset,
    repeatRule,
    shiftMonth,
    to24Hour,
} from '../../src/js/lib/calendar.js';

test('month matrix shows six Sunday-first weeks like the reference picker', () => {
    const matrix = monthMatrix(2026, 10);
    assert.equal(matrix.length, 6);
    assert.deepEqual(matrix[0], [
        '2026-09-27',
        '2026-09-28',
        '2026-09-29',
        '2026-09-30',
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
    ]);
    assert.equal(matrix[5][6], '2026-11-07');
});

test('date presets cross month and year boundaries without DST drift', () => {
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(nextWeek('2026-10-16'), '2026-10-19');
    assert.equal(nextWeek('2026-10-19'), '2026-10-26');
    assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
    assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test('reminder presets use 7 PM later today and 9 AM for tomorrow and next week', () => {
    const friday = new Date(2026, 9, 16, 10, 30);
    assert.equal(reminderPreset('later', friday), '2026-10-16T19:00');
    assert.equal(reminderPreset('later', new Date(2026, 9, 16, 20, 10)), '2026-10-16T21:00');
    assert.equal(reminderPreset('tomorrow', friday), '2026-10-17T09:00');
    assert.equal(reminderPreset('week', friday), '2026-10-19T09:00');
    assert.equal(to24Hour('12', '0', 'AM'), '00:00');
    assert.equal(to24Hour('7', '30', 'PM'), '19:30');
});

test('repeat choices become task-series rules, including custom intervals', () => {
    assert.equal(repeatRule(null, '2026-10-16'), null);
    assert.deepEqual(repeatRule({ kind: 'weekdays' }, '2026-10-16'), {
        frequency: 'weekly',
        interval_count: 1,
        weekdays: [1, 2, 3, 4, 5],
    });
    assert.deepEqual(repeatRule({ kind: 'weekly' }, '2026-10-16'), {
        frequency: 'weekly',
        interval_count: 1,
        weekdays: [5],
    });
    assert.deepEqual(repeatRule({ kind: 'monthly' }, '2026-10-16'), {
        frequency: 'monthly',
        interval_count: 1,
        weekdays: [],
    });
    assert.deepEqual(repeatRule({ kind: 'custom', unit: 'daily', interval: 3 }, '2026-10-16'), {
        frequency: 'daily',
        interval_count: 3,
        weekdays: [],
    });
    assert.deepEqual(
        repeatRule({ kind: 'custom', unit: 'weekly', interval: 2, weekdays: [3, 1] }, '2026-10-18'),
        { frequency: 'weekly', interval_count: 2, weekdays: [1, 3] },
    );
    assert.deepEqual(
        repeatRule({ kind: 'custom', unit: 'weekly', interval: 2, weekdays: [] }, '2026-10-18'),
        { frequency: 'weekly', interval_count: 2, weekdays: [7] },
    );
});
