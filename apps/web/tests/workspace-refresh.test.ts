import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeWorkspace, versionInventory, workspaceKinds } from '../src/lib/workspace-refresh.ts';

test('incremental refresh retains omitted bodies and removes only explicitly missing IDs', () => {
    const previous = Object.fromEntries(workspaceKinds.map(kind => [kind, []])) as any;
    previous.notes = [{ id:'keep', version:1, content:'draft base' }, {id:'revoked',version:1,content:'private'}];
    previous.tasks = [{id:'task',version:1,note_ids:[]}];
    const update = Object.fromEntries(workspaceKinds.map(kind => [kind, []])) as any;
    update.manifest = Object.fromEntries(workspaceKinds.map(kind => [kind, []]));
    update.manifest.notes = ['keep'];
    update.manifest.tasks = ['task'];
    update.task_notes = {task:['keep']};
    update.note_state = {keep: {files: [{id:'new-attachment'}], shares: [{id:'recipient'}]}};
    const result = mergeWorkspace(previous, update);
    assert.equal(result.notes.length, 1);
    assert.equal(result.notes[0].content, 'draft base');
    assert.equal(result.notes[0].files[0].id, 'new-attachment');
    assert.equal(result.notes[0].shares[0].id, 'recipient');
    assert.deepEqual(result.tasks[0].note_ids, ['keep']);
    assert.equal(versionInventory(result).notes.keep, 1);
    delete update.manifest.notes;
    assert.throws(() => mergeWorkspace(previous, update));
});
