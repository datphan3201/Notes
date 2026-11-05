import assert from 'node:assert/strict';
import test from 'node:test';
import { changeValue } from '../../src/js/planning/assistant.js';

const now = new Date('2026-11-05T03:00:00Z');

test('proposal cards show dates and local time slots like the rest of Planner', () => {
    assert.equal(changeValue('2026-11-12', { now, locale: 'en-US' }), 'Nov 12');
    assert.equal(changeValue('2026-11-07T19:00', { now, locale: 'en-US' }), 'Nov 7, 7:00 PM');
    assert.equal(changeValue('2027-01-04', { now, locale: 'en-US' }), 'Jan 4, 2027');
    assert.match(changeValue('2026-11-07T19:00', { now, locale: 'vi-VN' }), /19:00/);
    assert.equal(changeValue('Write the report', { now }), 'Write the report');
    assert.equal(changeValue(5, { now }), 5);
    assert.equal(changeValue(null, { now }), null);
});
