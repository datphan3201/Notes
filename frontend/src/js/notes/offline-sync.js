import { get, patch, post, remove } from '../lib/http.js';
import { secureUuidV4 } from '../lib/uuid.js';

const SYNC_EVERY_MS = 60000;

/**
 * Keeps the IndexedDB copy in step with MySQL.
 *
 * push: replays changes queued while offline, oldest first. Creates are
 *       idempotent (client UUIDs) and updates carry the version they were
 *       based on. If someone changed the Note meanwhile (409), the offline
 *       text is saved as a separate "offline copy" so nothing is lost.
 * pull: reads the cursor-based /notes/sync feed into the local copy.
 *
 * Events: `synced` (detail: { noteId, note }) after a queued change reached
 * the server, `changed` after the local copy changed, `conflict`, `dropped`.
 */
export class OfflineSync extends EventTarget {
    constructor(store) {
        super();
        this.store = store;
        this.running = null;
        this.timer = null;
    }

    start() {
        window.addEventListener('online', () => this.syncNow());
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.syncNow();
        });
        this.timer = window.setInterval(() => {
            if (!document.hidden) this.syncNow();
        }, SYNC_EVERY_MS);
        return this.syncNow();
    }

    /** syncNow, at most every 15 seconds (used after ordinary list loads). */
    syncSoon() {
        if (Date.now() - (this.lastRun || 0) < 15000) return Promise.resolve(false);
        return this.syncNow();
    }

    /** One push then pull; concurrent calls share the run in progress. */
    syncNow() {
        if (navigator.onLine === false) return Promise.resolve(false);
        this.lastRun = Date.now();
        this.running ??= (async () => {
            try {
                await this.push();
                await this.pull();
                return true;
            } catch {
                return false;
            } finally {
                this.running = null;
            }
        })();
        return this.running;
    }

    async pending() {
        return (await this.store.outbox()).length;
    }

    async push() {
        for (const entry of await this.store.outbox()) {
            try {
                const note = await this.send(entry);
                await this.store.dequeue(entry.noteId);
                if (note) await this.store.putNote(note);
                else await this.store.deleteNotes([entry.noteId]);
                this.emit('synced', { noteId: entry.noteId, note });
            } catch (error) {
                if (error.status === 0) throw error; // still offline: keep the rest queued
                if (error.status === 409 && entry.kind !== 'delete') {
                    const copy = await this.saveConflictCopy(entry);
                    await this.store.dequeue(entry.noteId);
                    this.emit('conflict', { noteId: entry.noteId, copy });
                } else {
                    // 404/410: the note is gone; 422/423: it cannot be saved like this.
                    await this.store.dequeue(entry.noteId);
                    this.emit('dropped', { noteId: entry.noteId, status: error.status });
                }
            }
        }
    }

    async send(entry) {
        const url = '/api/v1/notes/' + encodeURIComponent(entry.noteId);
        if (entry.kind === 'delete') {
            await remove(url, { base_version: entry.baseVersion });
            return null;
        }
        const snapshot = entry.snapshot;
        if (entry.kind === 'create') {
            let note = (
                await post('/api/v1/notes', {
                    id: entry.noteId,
                    title: snapshot.title,
                    content: snapshot.content,
                    color: snapshot.color,
                })
            ).payload.data;
            if (snapshot.is_pinned || snapshot.label_ids?.length) {
                note = (
                    await patch(url + '/attributes', {
                        is_pinned: snapshot.is_pinned,
                        label_ids: (snapshot.label_ids || []).map(Number),
                    })
                ).payload.data;
            }
            return note;
        }
        return (
            await patch(url, {
                base_version: entry.baseVersion,
                title: snapshot.title,
                content: snapshot.content,
                color: snapshot.color,
                is_pinned: snapshot.is_pinned,
                label_ids: (snapshot.label_ids || []).map(Number),
            })
        ).payload.data;
    }

    async saveConflictCopy(entry) {
        const suffix = ' (offline copy)';
        const title = entry.snapshot.title.slice(0, 200 - suffix.length) + suffix;
        const response = await post('/api/v1/notes', {
            id: secureUuidV4(),
            title,
            content: entry.snapshot.content,
            color: entry.snapshot.color,
        });
        await this.store.putNote(response.payload.data);
        return response.payload.data;
    }

    async pull() {
        let cursor = (await this.store.getMeta('cursor')) || null;
        for (let page = 0; page < 50; page++) {
            const query = cursor ? '?cursor=' + encodeURIComponent(cursor) : '';
            let data;
            try {
                data = (await get('/api/v1/notes/sync' + query)).payload.data;
            } catch (error) {
                // A cursor from another schema/account: start over with a full sync.
                if (error.status === 422 && cursor) {
                    cursor = null;
                    continue;
                }
                throw error;
            }
            if (data.notes.length) await this.store.putNotes(data.notes);
            if (data.deleted.length) await this.store.deleteNotes(data.deleted);
            cursor = data.cursor;
            await this.store.setMeta('cursor', cursor);
            await this.store.setMeta('synced_at', new Date().toISOString());
            if (data.notes.length || data.deleted.length) this.emit('changed', {});
            if (!data.has_more) break;
        }
    }

    emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }
}
