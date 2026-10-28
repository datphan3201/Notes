import assert from 'node:assert/strict';
import test from 'node:test';
import { outsideDialog } from '../../src/js/lib/dialog-backdrop.js';

test('only clicks beyond the dialog box count as backdrop clicks', () => {
    const dialog = {
        getBoundingClientRect: () => ({ left: 100, right: 500, top: 50, bottom: 450 }),
    };
    assert.equal(outsideDialog(dialog, 300, 200), false);
    assert.equal(outsideDialog(dialog, 100, 50), false);
    assert.equal(outsideDialog(dialog, 99, 200), true);
    assert.equal(outsideDialog(dialog, 300, 451), true);
});
