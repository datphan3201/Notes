import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeSnapshot,
    snapshotsEqual,
    validateSnapshot,
} from '../../resources/js/lib/normalization.js';

test('canonical snapshots preserve literal HTML and indentation', () => {
    const value = normalizeSnapshot({
        title: '  Tiêu đề  ',
        content: '  <b>%</b>\r\n  dòng hai',
        label_ids: [10, 2, 10],
    });
    assert.equal(value.title, 'Tiêu đề');
    assert.equal(value.content, '  <b>%</b>\n  dòng hai');
    assert.deepEqual(value.label_ids, ['2', '10']);
    assert.equal(snapshotsEqual(value, { ...value }), true);
});

test('invalid drafts stay local and are not considered dispatchable', () => {
    assert.equal(validateSnapshot({ title: '', content: 'nội dung' }).valid, false);
    assert.equal(validateSnapshot({ title: 'Tiêu đề', content: '\0' }).valid, false);
    assert.equal(
        validateSnapshot({ title: 'Tiêu đề', content: 'nội dung', color: 'bad' }).valid,
        false,
    );
});
