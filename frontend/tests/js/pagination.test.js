import assert from 'node:assert/strict';
import test from 'node:test';
import { pageWindow } from '../../src/js/lib/pagination.js';

test('a single page needs no pagination', () => {
    assert.deepEqual(pageWindow(1, 0), []);
    assert.deepEqual(pageWindow(1, 1), []);
});

test('short ranges show every page', () => {
    assert.deepEqual(pageWindow(1, 5), [1, 2, 3, 4, 5]);
    assert.deepEqual(pageWindow(4, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('the current page stays visible with gaps on both sides', () => {
    assert.deepEqual(pageWindow(1, 12), [1, 2, 3, null, 12]);
    assert.deepEqual(pageWindow(6, 12), [1, null, 4, 5, 6, 7, 8, null, 12]);
    assert.deepEqual(pageWindow(12, 12), [1, null, 10, 11, 12]);
});

test('a skip of one page shows the page instead of a gap', () => {
    assert.deepEqual(pageWindow(4, 12), [1, 2, 3, 4, 5, 6, null, 12]);
    assert.deepEqual(pageWindow(9, 12), [1, null, 7, 8, 9, 10, 11, 12]);
});

test('out-of-range pages are clamped', () => {
    assert.deepEqual(pageWindow(0, 12), pageWindow(1, 12));
    assert.deepEqual(pageWindow(40, 12), pageWindow(12, 12));
});
