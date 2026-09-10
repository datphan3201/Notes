const KEY_PREFIX = 'notes:r1:';
const SCHEMA = 1;
const MAX_AGE = 24 * 60 * 60 * 1000;

export class RecoveryStore {
    constructor({ storage = window.sessionStorage, userId, now = () => Date.now() } = {}) {
        this.storage = storage;
        this.userId = String(userId);
        this.now = now;
        this.key = KEY_PREFIX + this.userId + ':editor';
    }

    read() {
        try {
            const raw = this.storage.getItem(this.key);
            if (!raw) return null;
            const record = JSON.parse(raw);
            if (
                record.schema !== SCHEMA ||
                String(record.userId) !== this.userId ||
                this.now() - record.recordedAt > MAX_AGE
            ) {
                this.remove();
                return null;
            }
            if (
                !record.noteId ||
                !record.draftSnapshot ||
                typeof record.draftSnapshot !== 'object'
            ) {
                this.remove();
                return null;
            }
            return record;
        } catch {
            this.remove();
            return null;
        }
    }

    write(record) {
        try {
            this.storage.setItem(
                this.key,
                JSON.stringify({
                    schema: SCHEMA,
                    userId: this.userId,
                    ...record,
                    recordedAt: this.now(),
                }),
            );
            return true;
        } catch {
            return false;
        }
    }

    remove() {
        try {
            this.storage.removeItem(this.key);
        } catch {
            /* storage may be disabled */
        }
    }

    static clearAll(storage = window.sessionStorage) {
        try {
            for (let index = storage.length - 1; index >= 0; index -= 1) {
                const key = storage.key(index);
                if (key?.startsWith(KEY_PREFIX)) storage.removeItem(key);
            }
        } catch {
            /* logout still proceeds when storage is unavailable */
        }
    }
}
