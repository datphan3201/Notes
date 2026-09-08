import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryStore } from '../../resources/js/lib/recovery-store.js';

class MemoryStorage {
    values = new Map();
    get length() {
        return this.values.size;
    }
    key(index) {
        return [...this.values.keys()][index] ?? null;
    }
    getItem(key) {
        return this.values.get(key) ?? null;
    }
    setItem(key, value) {
        this.values.set(key, String(value));
    }
    removeItem(key) {
        this.values.delete(key);
    }
}

test('recovery is isolated by user and survives a reload in the same tab', () => {
    const storage = new MemoryStorage();
    const store = new RecoveryStore({ storage, userId: '7', now: () => 1000 });
    assert.equal(
        store.write({ noteId: 'note-1', persisted: false, draftSnapshot: { content: 'bản nháp' } }),
        true,
    );
    assert.equal(store.read().draftSnapshot.content, 'bản nháp');
    assert.equal(new RecoveryStore({ storage, userId: '8', now: () => 1000 }).read(), null);
});

test('corrupt and expired records are removed defensively', () => {
    const storage = new MemoryStorage();
    const store = new RecoveryStore({ storage, userId: '7', now: () => 1000 });
    storage.setItem('notes:r1:7:editor', '{bad json');
    assert.equal(store.read(), null);
    store.write({ noteId: 'note-1', draftSnapshot: {} });
    const expired = new RecoveryStore({
        storage,
        userId: '7',
        now: () => 1000 + 24 * 60 * 60 * 1000 + 1,
    });
    assert.equal(expired.read(), null);
    assert.equal(storage.getItem('notes:r1:7:editor'), null);
});

test('clearAll removes application recovery keys without touching unrelated storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('notes:r1:7:editor', '{}');
    storage.setItem('other-app-key', 'keep');
    RecoveryStore.clearAll(storage);
    assert.equal(storage.getItem('notes:r1:7:editor'), null);
    assert.equal(storage.getItem('other-app-key'), 'keep');
});
