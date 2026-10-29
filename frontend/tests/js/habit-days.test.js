import assert from 'node:assert/strict';
import test from 'node:test';
import { habitDayState, restWindow, streakLabel } from '../../src/js/lib/habit-days.js';

test('checked days are checked whenever they happened', () => {
    assert.equal(habitDayState('2026-10-20', true, '2026-10-28', '2026-10-25'), 'checked');
    assert.equal(habitDayState('2026-10-28', true, '2026-10-28', '2026-10-25'), 'checked');
});

test('past unchecked days since tracking began are missed', () => {
    assert.equal(habitDayState('2026-10-25', false, '2026-10-28', '2026-10-25'), 'missed');
    assert.equal(habitDayState('2026-10-27', false, '2026-10-28', '2026-10-25'), 'missed');
});

test('today stays open and days before tracking are unmarked', () => {
    assert.equal(habitDayState('2026-10-28', false, '2026-10-28', '2026-10-25'), 'open');
    assert.equal(habitDayState('2026-10-24', false, '2026-10-28', '2026-10-25'), 'untracked');
    assert.equal(habitDayState('2026-10-24', false, '2026-10-28', null), 'untracked');
});

test('rest days are protected, never done, and future days are upcoming', () => {
    assert.equal(habitDayState('2026-10-27', false, '2026-10-28', '2026-10-25', true), 'rest');
    assert.equal(habitDayState('2026-10-30', false, '2026-10-28', '2026-10-25', true), 'rest');
    assert.equal(habitDayState('2026-10-27', true, '2026-10-28', '2026-10-25', true), 'checked');
    assert.equal(habitDayState('2026-10-30', false, '2026-10-28', '2026-10-25'), 'upcoming');
});

test('the rest window is exactly the next three days and slides daily', () => {
    assert.deepEqual(restWindow('2026-10-30'), ['2026-10-31', '2026-11-01', '2026-11-02']);
    assert.deepEqual(restWindow('2026-10-31'), ['2026-11-01', '2026-11-02', '2026-11-03']);
});

test('streak labels use the streak unit', () => {
    assert.equal(streakLabel({ count: 1, unit: 'days' }), '1 day');
    assert.equal(streakLabel({ count: 3, unit: 'weeks' }), '3 weeks');
    assert.equal(streakLabel(null), '0 days');
});
