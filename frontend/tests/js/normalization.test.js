import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeSnapshot,
    snapshotsEqual,
    validateSnapshot,
} from '../../src/js/lib/normalization.js';

test('canonical snapshots preserve literal HTML and indentation', () => {
    const value = normalizeSnapshot({
        title: '  Title  ',
        content: '  <b>%</b>\r\n  line two',
        label_ids: [10, 2, 10],
    });
    assert.equal(value.title, 'Title');
    assert.equal(value.content, '  <b>%</b>\n  line two');
    assert.deepEqual(value.label_ids, ['2', '10']);
    assert.equal(snapshotsEqual(value, { ...value }), true);
});

test('invalid drafts stay local and are not considered dispatchable', () => {
    assert.equal(validateSnapshot({ title: '', content: 'content' }).valid, false);
    assert.equal(validateSnapshot({ title: 'Title', content: '\0' }).valid, false);
    assert.equal(
        validateSnapshot({ title: 'Title', content: 'content', color: 'bad' }).valid,
        false,
    );
});
