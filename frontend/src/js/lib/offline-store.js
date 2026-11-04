import { coalesce } from './offline-outbox.js';

const VERSION = 1;
const PREFIX = 'planner-offline-';

const promise = (request) =>
    new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

const done = (transaction) =>
    new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });

/**
 * The browser's offline copy of one account's Notes (IndexedDB, one database
 * per user): `notes` mirrors the server, `outbox` holds edits made offline,
 * `meta` keeps the sync cursor and the "Shared with me" snapshot.
 * Every method fails soft (resolves empty) when storage is unavailable.
 */
export class OfflineStore {
    constructor(userId) {
        this.name = PREFIX + userId;
        this.db = null;
        this.opening = null;
    }

    static supported() {
        return typeof indexedDB !== 'undefined';
    }

    /** Removes every account's offline data (logout, account switch). */
    static async clearAll() {
        if (!OfflineStore.supported()) return;
        try {
            const databases = (await indexedDB.databases?.()) || [];
            await Promise.all(
                databases
                    .filter((entry) => entry.name?.startsWith(PREFIX))
                    .map((entry) => promise(indexedDB.deleteDatabase(entry.name)).catch(() => {})),
            );
        } catch {
            // Best effort: private windows may refuse storage entirely.
        }
    }

    async open() {
        if (this.db) return this.db;
        if (!OfflineStore.supported()) return null;
        this.opening ??= new Promise((resolve) => {
            const request = indexedDB.open(this.name, VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('notes'))
                    db.createObjectStore('notes', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('outbox'))
                    db.createObjectStore('outbox', { keyPath: 'noteId' });
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
            };
            request.onsuccess = () => {
                this.db = request.result;
                this.db.onversionchange = () => this.db?.close();
                resolve(this.db);
            };
            request.onerror = () => resolve(null);
            request.onblocked = () => resolve(null);
        });
        return this.opening;
    }

    async run(stores, mode, work) {
        const db = await this.open();
        if (!db) return undefined;
        try {
            const transaction = db.transaction(stores, mode);
            const result = await work(transaction);
            await done(transaction);
            return result;
        } catch {
            return undefined;
        }
    }

    putNote(note) {
        if (!note?.id) return Promise.resolve();
        const copy = { ...note };
        // Locked text never stays on the device.
        if (copy.is_locked) {
            copy.content = '';
            copy.content_preview = '';
            copy.background_url = null;
        }
        delete copy.attachments;
        return this.run(['notes'], 'readwrite', (tx) => {
            const store = tx.objectStore('notes');
            return promise(store.get(copy.id)).then((existing) =>
                store.put({ ...(existing || {}), ...copy }),
            );
        });
    }

    putNotes(notes) {
        return this.run(['notes'], 'readwrite', (tx) => {
            const store = tx.objectStore('notes');
            for (const note of notes) store.put(note);
        });
    }

    deleteNotes(ids) {
        return this.run(['notes'], 'readwrite', (tx) => {
            for (const id of ids) tx.objectStore('notes').delete(id);
        });
    }

    async getNote(id) {
        return (
            (await this.run(['notes'], 'readonly', (tx) =>
                promise(tx.objectStore('notes').get(id)),
            )) || null
        );
    }

    async allNotes() {
        return (
            (await this.run(['notes'], 'readonly', (tx) =>
                promise(tx.objectStore('notes').getAll()),
            )) || []
        );
    }

    async getMeta(key) {
        return this.run(['meta'], 'readonly', (tx) => promise(tx.objectStore('meta').get(key)));
    }

    setMeta(key, value) {
        return this.run(['meta'], 'readwrite', (tx) => tx.objectStore('meta').put(value, key));
    }

    putShared(received) {
        return this.setMeta('shared', received);
    }

    getShared() {
        return this.getMeta('shared');
    }

    /** Queues an offline change, merging it with an earlier one for the same Note. */
    queue(entry) {
        return this.run(['outbox'], 'readwrite', (tx) => {
            const store = tx.objectStore('outbox');
            return promise(store.get(entry.noteId)).then((previous) => {
                const merged = coalesce(previous, { ...entry, queuedAt: Date.now() });
                if (merged) store.put(merged);
                else store.delete(entry.noteId);
                return merged;
            });
        });
    }

    async outbox() {
        const entries =
            (await this.run(['outbox'], 'readonly', (tx) =>
                promise(tx.objectStore('outbox').getAll()),
            )) || [];
        return entries.sort((a, b) => (a.queuedAt || 0) - (b.queuedAt || 0));
    }

    async outboxEntry(noteId) {
        return (
            (await this.run(['outbox'], 'readonly', (tx) =>
                promise(tx.objectStore('outbox').get(noteId)),
            )) || null
        );
    }

    dequeue(noteId) {
        return this.run(['outbox'], 'readwrite', (tx) => tx.objectStore('outbox').delete(noteId));
    }
}
