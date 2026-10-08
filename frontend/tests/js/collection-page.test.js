import assert from 'node:assert/strict';
import test from 'node:test';
import { collectionPage } from '../../src/js/planning/collection-page.js';

const tasks = Array.from({ length: 19 }, (_, index) => ({
    id: index,
    name: `Task [${index}]`,
    status: index % 2 ? 'Done' : 'NotStarted',
}));
test('task filtering treats search text literally and preserves server order', () => {
    assert.deepEqual(
        collectionPage(tasks, { query: ' [1] ', status: 'all' }).items.map((item) => item.id),
        [1],
    );
    assert.deepEqual(
        collectionPage(tasks, { status: 'open', size: 3 }).items.map((item) => item.id),
        [0, 2, 4],
    );
    assert.equal(collectionPage(tasks, { query: 'TASK', status: 'Done' }).total, 9);
});
test('a page shrinks safely after filtering or its final row is removed', () => {
    const before = collectionPage(tasks, { page: 2 });
    assert.deepEqual(
        before.items.map((item) => item.id),
        [16, 17, 18],
    );
    const after = collectionPage(tasks.slice(0, 16), { page: 2 });
    assert.equal(after.page, 1);
    assert.equal(after.items.length, 8);
    assert.deepEqual(collectionPage(tasks, { query: 'missing', page: 5 }), {
        items: [],
        page: 0,
        pages: 1,
        total: 0,
    });
});
