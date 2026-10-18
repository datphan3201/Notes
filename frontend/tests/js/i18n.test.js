import test from 'node:test';
import assert from 'node:assert/strict';
import { t } from '../../src/js/lib/i18n.js';
test('interface translation selects the account language and preserves unknown content', () => {
    assert.equal(t('Settings', 'vi'), 'Cài đặt');
    assert.equal(t('Settings', 'en'), 'Settings');
    assert.equal(t('A user-written task title', 'vi'), 'A user-written task title');
});
