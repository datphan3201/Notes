import assert from 'node:assert/strict';
import test from 'node:test';
import { coalesce, filterAndSort, withPendingSnapshot } from '../../src/js/lib/offline-outbox.js';

const snapshot = (title, extra = {}) => ({
    title,
    content: `${title} body`,
    color: 'neutral',
    is_pinned: false,
    label_ids: [],
    ...extra,
});

test('offline edits of one note become a single request', () => {
    const create = { noteId: 'a', kind: 'create', snapshot: snapshot('One') };
    const edited = coalesce(create, {
        noteId: 'a',
        kind: 'update',
        snapshot: snapshot('Two'),
        baseVersion: 1,
    });
    assert.deepEqual(edited, { noteId: 'a', kind: 'create', snapshot: snapshot('Two') });
    assert.equal(coalesce(create, { noteId: 'a', kind: 'delete', baseVersion: 1 }), null);

    const update = { noteId: 'b', kind: 'update', snapshot: snapshot('Old'), baseVersion: 4 };
    const again = coalesce(update, {
        noteId: 'b',
        kind: 'update',
        snapshot: snapshot('New'),
        baseVersion: 4,
    });
    assert.equal(again.baseVersion, 4);
    assert.equal(again.snapshot.title, 'New');
    assert.deepEqual(coalesce(update, { noteId: 'b', kind: 'delete', baseVersion: 4 }), {
        noteId: 'b',
        kind: 'delete',
        baseVersion: 4,
    });
});

test('pending snapshots are shown over the stored copy', () => {
    const stored = { id: 'b', title: 'Old', content: 'x', version: 4, labels: [{ id: 1 }] };
    const shown = withPendingSnapshot(stored, {
        noteId: 'b',
        kind: 'update',
        snapshot: snapshot('New', { is_pinned: true }),
    });
    assert.equal(shown.title, 'New');
    assert.equal(shown.is_pinned, true);
    assert.equal(shown.pending_sync, true);
    assert.equal(shown.version, 4);
    assert.equal(withPendingSnapshot(stored, null), stored);
});

test('offline search, tag filter and order match the server rules', () => {
    const notes = [
        {
            id: '1',
            title: 'Kế hoạch',
            content: 'Đà Lạt',
            updated_at: '2026-11-01',
            labels: [{ id: 7 }],
        },
        { id: '2', title: 'Groceries', content: 'eggs', updated_at: '2026-11-03', labels: [] },
        {
            id: '3',
            title: 'Pinned old',
            content: 'x',
            updated_at: '2026-10-01',
            is_pinned: true,
            pinned_at: '2026-11-02',
        },
        {
            id: '4',
            title: 'Pinned new',
            content: 'x',
            updated_at: '2026-09-01',
            is_pinned: true,
            pinned_at: '2026-11-04',
        },
        { id: '5', title: 'Secret', content: 'eggs', updated_at: '2026-11-05', is_locked: true },
    ];
    assert.deepEqual(
        filterAndSort(notes, {}).map((note) => note.id),
        ['4', '3', '5', '2', '1'],
    );
    assert.deepEqual(
        filterAndSort(notes, { q: 'da lat' }).map((note) => note.id),
        ['1'],
    );
    assert.deepEqual(
        filterAndSort(notes, { q: 'eggs' }).map((note) => note.id),
        ['2'],
        'locked text is not searched',
    );
    assert.deepEqual(
        filterAndSort(notes, { labelIds: ['7'] }).map((note) => note.id),
        ['1'],
    );
    assert.deepEqual(
        filterAndSort(notes, { sort: 'title', direction: 'asc' }).map((note) => note.id),
        ['4', '3', '2', '1', '5'],
    );
});
