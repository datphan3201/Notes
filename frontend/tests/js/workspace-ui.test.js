import assert from 'node:assert/strict';
import test from 'node:test';
import { creationState, createWithForm } from '../../src/js/lib/workspace-ui.js';

function formFixture() {
    return {
        elements: [
            { name: 'name', type: 'text', value: '', disabled: false },
            { name: 'frequency', type: 'select-one', value: 'daily', disabled: false },
            { name: 'weekdays', type: 'checkbox', checked: false, disabled: true },
        ],
        setAttribute() {},
    };
}
test('creation drafts include selection and checkbox changes without depending on disabled state', () => {
    const form = formFixture();
    const state = creationState(form);
    assert.equal(state.dirty, false);
    form.elements[1].value = 'weekly';
    assert.equal(state.dirty, true);
    state.markSaved();
    form.elements[2].disabled = false;
    assert.equal(state.dirty, false);
    form.elements[2].checked = true;
    assert.equal(state.dirty, true);
});
test('creation serializes a pending write and restores the original controls after failure', async () => {
    const form = formFixture();
    let release;
    let calls = 0;
    const pending = createWithForm(form, async () => {
        calls++;
        await new Promise((resolve) => {
            release = resolve;
        });
        throw new Error('Validation failure');
    });
    assert.equal(creationState(form).pending, true);
    assert.ok(form.elements.every((control) => control.disabled));
    await createWithForm(form, async () => {
        calls++;
    });
    assert.equal(calls, 1);
    release();
    await assert.rejects(pending, /Validation failure/);
    assert.equal(creationState(form).pending, false);
    assert.deepEqual(
        form.elements.map((control) => control.disabled),
        [false, false, true],
    );
});
