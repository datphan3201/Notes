import assert from 'node:assert/strict';
import test from 'node:test';
import {
    countLabel,
    formatDay,
    formatDayRange,
    formatMoment,
    formatMomentRange,
    formatPercent,
} from '../../src/js/lib/format.js';

const now = new Date('2026-11-03T12:00:00Z');

test('calendar dates drop the year only within the current year', () => {
    assert.equal(formatDay('2026-11-02', { now, locale: 'en-US' }), 'Nov 2');
    assert.equal(formatDay('2027-01-15', { now, locale: 'en-US' }), 'Jan 15, 2027');
    assert.equal(
        formatDayRange('2026-10-26', '2026-11-01', { now, locale: 'en-US' }),
        'Oct 26 – Nov 1',
    );
    assert.equal(formatDay('', { now }), '');
    assert.equal(formatDay('soon', { now }), 'soon');
});

test('moments use the user time zone and write a same-day range once', () => {
    const options = { now, locale: 'en-US', timeZone: 'Asia/Ho_Chi_Minh' };
    assert.equal(formatMoment('2026-11-02T02:00:00Z', options), 'Nov 2, 9:00 AM');
    assert.equal(
        formatMomentRange('2026-11-02T02:00:00Z', '2026-11-02T05:00:00Z', options),
        'Nov 2, 9:00 AM – 12:00 PM',
    );
    assert.equal(
        formatMomentRange('2026-11-02T02:00:00Z', '2026-11-03T05:00:00Z', options),
        'Nov 2, 9:00 AM – Nov 3, 12:00 PM',
    );
});

test('percentages are whole numbers and counts agree with their noun', () => {
    assert.equal(formatPercent(16.67), '17%');
    assert.equal(formatPercent(undefined), '0%');
    assert.equal(countLabel(1, 'task', 'tasks'), '1 task');
    assert.equal(countLabel(3, 'task', 'tasks'), '3 tasks');
});
