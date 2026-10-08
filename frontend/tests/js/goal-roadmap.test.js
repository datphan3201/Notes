import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftBuffer } from '../../src/js/planning/draft-buffer.js';
import { transitionEntity } from '../../src/js/planning/transitions.js';

test('a late save acknowledgement preserves typing after the submitted snapshot', () => {
    const buffer = new DraftBuffer();
    buffer.receive({ strategy_notes: 'Saved' }, 1);
    buffer.values.strategy_notes = 'First edit';
    const frozen = buffer.freeze();
    buffer.values.strategy_notes = 'Typed during save';
    buffer.acknowledge({ strategy_notes: frozen.strategy_notes }, 2, {
        strategy_notes: frozen.strategy_notes,
    });
    assert.equal(buffer.values.strategy_notes, 'Typed during save');
    assert.equal(buffer.dirty, true);
    assert.deepEqual(buffer.freeze(), { base_version: 2, strategy_notes: 'Typed during save' });
});

test('refresh cannot erase or silently rebase a dirty goal draft', () => {
    const buffer = new DraftBuffer();
    buffer.receive({ strategy_notes: 'Saved' }, 1);
    buffer.values.strategy_notes = 'Local';
    assert.equal(buffer.receive({ strategy_notes: 'Remote' }, 3), false);
    assert.equal(buffer.values.strategy_notes, 'Local');
    assert.equal(buffer.version, 1);
    buffer.receive({ strategy_notes: 'Remote' }, 3, { keepDraft: true });
    assert.equal(buffer.saved.strategy_notes, 'Remote');
    assert.equal(buffer.values.strategy_notes, 'Local');
    assert.equal(buffer.version, 3);
    assert.equal(buffer.dirty, true);
});

test('task completion sends acknowledgement only after explicit checklist confirmation', async () => {
    const calls = [];
    let prompts = 0;
    const response = await transitionEntity(
        'task',
        { id: 'task', name: 'Build', version: 2 },
        'complete',
        {
            send: async (path, body) => {
                calls.push({ path, body: { ...body } });
                if (calls.length === 1)
                    throw {
                        status: 422,
                        payload: { errors: { acknowledge_unchecked_items: ['Confirm'] } },
                    };
                return { payload: { data: { status: 'Done' } } };
            },
            confirm: () => {
                prompts++;
                return true;
            },
        },
    );
    assert.equal(prompts, 1);
    assert.deepEqual(calls[0].body, { base_version: 2 });
    assert.deepEqual(calls[1].body, { base_version: 2, acknowledge_unchecked_items: true });
    assert.equal(response.payload.data.status, 'Done');
});

test('cancelled ancestor confirmation never submits an acknowledged reopen', async () => {
    let calls = 0;
    const result = await transitionEntity(
        'milestone',
        { id: 'm', name: 'Core', version: 3 },
        'reopen',
        {
            send: async () => {
                calls++;
                throw {
                    status: 422,
                    code: 'ANCESTOR_REOPEN_REQUIRED',
                    payload: { ancestors: [{ name: 'Engineer' }] },
                };
            },
            confirm: (message) => {
                assert.match(message, /Engineer/);
                return false;
            },
        },
    );
    assert.equal(result, null);
    assert.equal(calls, 1);
});

test('version conflicts and network failures are not retried by the transition flow', async () => {
    for (const status of [409, 0]) {
        let calls = 0;
        await assert.rejects(
            transitionEntity('goal', { id: 'g', name: 'Goal', version: 1 }, 'reopen', {
                send: async () => {
                    calls++;
                    throw Object.assign(new Error('Failed'), { status });
                },
                confirm: () => assert.fail('No confirmation is allowed here'),
            }),
            /Failed/,
        );
        assert.equal(calls, 1);
    }
});

test('an older read cannot roll a saved draft back after its acknowledgement', () => {
    const draft = new DraftBuffer();
    draft.receive({ body: 'initial' }, 1);
    draft.values = { body: 'saved edit' };
    draft.acknowledge({ body: 'saved edit' }, 2, { body: 'saved edit' });
    assert.equal(draft.receive({ body: 'initial' }, 1), false);
    assert.equal(draft.receive({ body: '' }, null), false);
    assert.deepEqual(draft.freeze(), { base_version: 2, body: 'saved edit' });
    assert.equal(draft.dirty, false);
});
