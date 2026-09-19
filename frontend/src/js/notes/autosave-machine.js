import { realClock } from '../lib/clock.js';
import { secureUuidV4 } from '../lib/uuid.js';
import {
    normalizeSnapshot,
    snapshotFromNote,
    snapshotsEqual,
    validateSnapshot,
} from '../lib/normalization.js';

const RETRY_DELAYS = [1000, 2000, 4000];

export class AutosaveMachine {
    constructor({
        userId,
        noteId = secureUuidV4(),
        persisted = false,
        editorGeneration = 0,
        baseVersion = null,
        snapshot = {},
        transport,
        recovery = null,
        clock = realClock,
        onChange = () => {},
    }) {
        this.userId = String(userId);
        this.noteId = noteId;
        this.persisted = persisted;
        this.editorGeneration = editorGeneration;
        this.baseVersion = baseVersion;
        this.acknowledgedSnapshot = persisted ? normalizeSnapshot(snapshot) : null;
        this.acknowledgedNote = null;
        this.draftSnapshot = normalizeSnapshot(snapshot);
        this.pendingRequest = null;
        this.lastFailedRequest = null;
        this.conflictCurrent = null;
        this.validationErrors = {};
        this.composing = false;
        this.firstDirtyAt = null;
        this.lastInputAt = null;
        this.debounceTimer = null;
        this.maxWaitTimer = null;
        this.retryTimer = null;
        this.retryDelay = null;
        this.retryPaused = false;
        this.transport = transport;
        this.recovery = recovery;
        this.clock = clock;
        this.onChange = onChange;
        this.phase = persisted ? 'saved' : this.isEmpty() ? 'pristine' : 'incomplete';
        this.recoveryAvailable = true;
        this.emit();
    }

    get state() {
        return {
            phase: this.phase,
            noteId: this.noteId,
            persisted: this.persisted,
            baseVersion: this.baseVersion,
            draftSnapshot: this.draftSnapshot,
            acknowledgedSnapshot: this.acknowledgedSnapshot,
            acknowledgedNote: this.acknowledgedNote,
            pendingRequest: this.pendingRequest,
            conflictCurrent: this.conflictCurrent,
            validationErrors: this.validationErrors,
            composing: this.composing,
            recoveryAvailable: this.recoveryAvailable,
        };
    }

    input(partial) {
        if (['conflict', 'auth_expired', 'unavailable', 'closing'].includes(this.phase)) return;
        this.draftSnapshot = normalizeSnapshot({ ...this.draftSnapshot, ...partial });
        this.lastInputAt = this.clock.now();
        this.validationErrors = validateSnapshot(this.draftSnapshot).errors;
        // Typing cannot resolve an outstanding write, even when the user
        // restores the previously acknowledged text while a retry is pending.
        if (this.pendingRequest) {
            this.persistRecovery();
            this.emit();
            return;
        }
        if (!this.isDirty()) {
            this.phase = this.persisted ? 'saved' : this.isEmpty() ? 'pristine' : 'incomplete';
            this.persistRecovery();
            this.emit();
            return;
        }
        this.phase = Object.keys(this.validationErrors).length ? 'incomplete' : 'dirty';
        this.persistRecovery();
        this.schedule();
        this.emit();
    }

    compositionStart() {
        this.composing = true;
        this.emit();
    }

    compositionEnd() {
        this.composing = false;
        this.input({});
    }

    schedule() {
        if (this.composing || this.pendingRequest || Object.keys(this.validationErrors).length)
            return;
        const now = this.clock.now();
        if (this.firstDirtyAt === null) this.firstDirtyAt = now;
        if (this.debounceTimer) this.clock.clearTimeout(this.debounceTimer);
        const elapsed = now - this.firstDirtyAt;
        const remaining = Math.max(0, 2000 - elapsed);
        const delay = Math.min(500, remaining);
        this.debounceTimer = this.clock.setTimeout(() => this.dispatch(), delay);
        if (!this.maxWaitTimer) {
            this.maxWaitTimer = this.clock.setTimeout(() => this.dispatch(), remaining);
        }
    }

    flush() {
        if (this.debounceTimer) this.clock.clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
        if (
            this.isDirty() &&
            !this.pendingRequest &&
            !this.composing &&
            !Object.keys(this.validationErrors).length
        ) {
            this.dispatch();
        }
        return this.phase === 'saved';
    }

    dispatch(replay = null) {
        if (['conflict', 'auth_expired', 'unavailable', 'closing'].includes(this.phase)) return;
        if (this.composing || this.pendingRequest || (!this.isDirty() && !replay)) return;
        const validation = validateSnapshot(this.draftSnapshot);
        if (!validation.valid && !replay) {
            this.validationErrors = validation.errors;
            this.phase = 'incomplete';
            this.persistRecovery();
            this.emit();
            return;
        }

        this.clearTimers();
        this.firstDirtyAt = null;
        const source = replay || {
            kind: this.persisted ? 'update' : 'create',
            noteId: this.noteId,
            sentSnapshot: normalizeSnapshot(this.draftSnapshot),
            baseVersion: this.baseVersion,
            editorGeneration: this.editorGeneration || 0,
            attempt: 0,
            startedAt: this.clock.now(),
        };
        const snapshot = normalizeSnapshot(source.sentSnapshot);
        Object.freeze(snapshot.label_ids);
        const request = Object.freeze({ ...source, sentSnapshot: Object.freeze(snapshot) });
        this.pendingRequest = request;
        this.lastFailedRequest = null;
        this.phase = 'saving';
        this.persistRecovery();
        this.emit();

        Promise.resolve()
            .then(() => this.transport(request))
            .then((response) => this.acknowledge(response, request))
            .catch((error) => this.fail(error, request));
    }

    acknowledge(response, request) {
        if (this.pendingRequest !== request) return;
        const note = response?.data || response;
        if (
            !note ||
            String(note.id) !== String(request.noteId) ||
            !Number.isInteger(note.version)
        ) {
            this.fail(
                {
                    status: 0,
                    code: 'MALFORMED_RESPONSE',
                    message: 'The server returned invalid data.',
                },
                request,
            );
            return;
        }

        const serverSnapshot = snapshotFromNote(note);
        // The server may normalize Unicode/line endings, but it must not
        // acknowledge an unrelated editable snapshot as if it were ours.
        if (!snapshotsEqual(serverSnapshot, request.sentSnapshot)) {
            this.fail(
                {
                    status: 0,
                    code: 'UNEXPECTED_ACK',
                    message: 'The saved note could not be confirmed.',
                },
                request,
            );
            return;
        }
        this.pendingRequest = null;
        this.persisted = true;
        this.noteId = String(note.id);
        this.acknowledgedNote = note;
        this.baseVersion = note.version;
        this.acknowledgedSnapshot = serverSnapshot;
        this.validationErrors = {};
        this.firstDirtyAt = null;
        this.clearTimers();

        if (snapshotsEqual(this.draftSnapshot, serverSnapshot)) {
            this.phase = 'saved';
            this.recovery?.remove();
        } else if (validateSnapshot(this.draftSnapshot).valid && !this.composing) {
            this.phase = 'dirty';
            this.emit();
            this.dispatch();
            return;
        } else {
            this.phase = 'incomplete';
            this.persistRecovery();
        }
        this.emit();
    }

    fail(error, request) {
        if (this.pendingRequest !== request) return;
        const status = Number(error?.status || 0);
        if (status === 409 && error?.payload?.current) {
            this.pendingRequest = null;
            this.conflictCurrent = error.payload.current;
            this.phase = 'conflict';
            this.persistRecovery();
            this.emit();
            return;
        }
        if (status === 422) {
            this.pendingRequest = null;
            this.validationErrors = error.payload?.errors || {};
            this.phase = 'error';
            this.persistRecovery();
            this.emit();
            return;
        }
        if (status === 401 || status === 419) {
            this.phase = 'auth_expired';
            this.persistRecovery();
            this.emit();
            return;
        }
        if (status === 404 || status === 410) {
            this.pendingRequest = null;
            this.phase = 'unavailable';
            this.persistRecovery();
            this.emit();
            return;
        }

        const attempt = Number(request.attempt || 0);
        if ((status === 0 || status === 429 || status >= 500) && attempt < 3) {
            this.phase = 'retry_wait';
            const delay = status === 429 ? this.retryAfterMs(error) : RETRY_DELAYS[attempt];
            this.retryDelay = delay;
            this.retryPaused = globalThis.navigator?.onLine === false;
            if (!this.retryPaused) this.scheduleRetry(request, delay, attempt);
            this.persistRecovery();
            this.emit();
            return;
        }

        this.pendingRequest = null;
        this.lastFailedRequest = request;
        this.phase = 'error';
        this.persistRecovery();
        this.emit();
    }

    retry() {
        if (this.retryTimer) this.clock.clearTimeout(this.retryTimer);
        this.retryTimer = null;
        if (this.phase === 'retry_wait' && this.pendingRequest) {
            const request = this.pendingRequest;
            this.pendingRequest = null;
            this.retryPaused = false;
            this.retryDelay = null;
            this.dispatch({ ...request, attempt: 0 });
            return;
        }
        if (this.lastFailedRequest) {
            this.dispatch({ ...this.lastFailedRequest, attempt: 0 });
        } else if (this.isDirty()) {
            this.dispatch();
        }
    }

    /** Resume a bounded retry after the browser reports that a connection may exist. */
    resumeRetry() {
        if (
            this.phase !== 'retry_wait' ||
            !this.pendingRequest ||
            this.retryTimer ||
            !this.retryPaused
        )
            return;
        this.retryPaused = false;
        this.scheduleRetry(
            this.pendingRequest,
            this.retryDelay ?? RETRY_DELAYS[this.pendingRequest.attempt || 0],
            this.pendingRequest.attempt || 0,
        );
        this.emit();
    }

    scheduleRetry(request, delay, attempt) {
        this.retryTimer = this.clock.setTimeout(() => {
            this.retryTimer = null;
            this.pendingRequest = null;
            this.dispatch({ ...request, attempt: attempt + 1 });
        }, delay);
    }

    retryAfterMs(error) {
        const raw = error?.retryAfter;
        if (raw === null || raw === undefined || String(raw).trim() === '') return 5000;
        const value = Number(raw);
        if (Number.isFinite(value) && value >= 0) return value * 1000;
        const date = Date.parse(raw);
        return Number.isFinite(date) ? Math.max(0, date - this.clock.now()) : 5000;
    }

    /** Restore intent without adopting a newer revision as permission to overwrite it. */
    restore(record) {
        this.clearTimers();
        this.persisted = record.persisted;
        this.baseVersion = record.baseVersion;
        this.acknowledgedSnapshot = record.acknowledgedSnapshot;
        this.draftSnapshot = normalizeSnapshot(record.draftSnapshot);
        this.pendingRequest = record.pendingRequest;
        this.phase = 'auth_expired';
        this.persistRecovery();
    }

    /** Called only after the caller has verified the authenticated account. */
    reconcile(current) {
        this.clearTimers();
        const pending = this.pendingRequest || this.lastFailedRequest;
        this.pendingRequest = null;
        this.lastFailedRequest = null;
        if (!current) {
            if (this.persisted) {
                this.phase = 'unavailable';
            } else {
                this.phase = 'dirty';
                if (pending) {
                    this.dispatch({ ...pending, attempt: 0 });
                    return;
                }
                this.input({});
                return;
            }
        } else if (String(current.id) !== this.noteId || !Number.isInteger(current.version)) {
            this.phase = 'error';
        } else {
            const server = snapshotFromNote(current);
            const acknowledgedPending = pending && snapshotsEqual(server, pending.sentSnapshot);
            const unchanged =
                current.version === this.baseVersion &&
                this.acknowledgedSnapshot &&
                snapshotsEqual(server, this.acknowledgedSnapshot);
            if (acknowledgedPending || unchanged || snapshotsEqual(server, this.draftSnapshot)) {
                this.persisted = true;
                this.baseVersion = current.version;
                this.acknowledgedNote = current;
                this.acknowledgedSnapshot = server;
                this.phase = 'dirty';
                this.input({});
                return;
            }
            this.persisted = true;
            this.conflictCurrent = current;
            this.phase = 'conflict';
        }
        this.persistRecovery();
        this.emit();
    }

    /** Detach callbacks before another editor takes ownership of the UI. */
    dispose() {
        this.clearTimers();
        this.pendingRequest = null;
        this.onChange = () => {};
        this.phase = 'closing';
    }

    useServer() {
        if (!this.conflictCurrent) return;
        const current = this.conflictCurrent;
        this.pendingRequest = null;
        this.persisted = true;
        this.noteId = String(current.id);
        this.baseVersion = current.version;
        this.acknowledgedSnapshot = snapshotFromNote(current);
        this.acknowledgedNote = current;
        this.draftSnapshot = this.acknowledgedSnapshot;
        this.conflictCurrent = null;
        this.phase = 'saved';
        this.recovery?.remove();
        this.emit();
    }

    keepLocal() {
        if (!this.conflictCurrent) return;
        const current = this.conflictCurrent;
        this.persisted = true;
        this.noteId = String(current.id);
        this.baseVersion = current.version;
        this.acknowledgedSnapshot = snapshotFromNote(current);
        this.acknowledgedNote = current;
        this.conflictCurrent = null;
        this.phase = 'dirty';
        this.persistRecovery();
        this.emit();
        this.dispatch();
    }

    isDirty() {
        return (
            !this.persisted ||
            !this.acknowledgedSnapshot ||
            !snapshotsEqual(this.draftSnapshot, this.acknowledgedSnapshot)
        );
    }

    isEmpty() {
        return this.draftSnapshot.title === '' && this.draftSnapshot.content === '';
    }

    persistRecovery() {
        if (!this.recovery || this.phase === 'saved' || this.phase === 'pristine') return;
        const ok = this.recovery.write({
            noteId: this.noteId,
            persisted: this.persisted,
            baseVersion: this.baseVersion,
            acknowledgedSnapshot: this.acknowledgedSnapshot,
            draftSnapshot: this.draftSnapshot,
            pendingRequest:
                this.pendingRequest || this.lastFailedRequest
                    ? {
                          kind: (this.pendingRequest || this.lastFailedRequest).kind,
                          sentSnapshot: (this.pendingRequest || this.lastFailedRequest)
                              .sentSnapshot,
                          baseVersion: (this.pendingRequest || this.lastFailedRequest).baseVersion,
                          noteId: (this.pendingRequest || this.lastFailedRequest).noteId,
                          attempt: (this.pendingRequest || this.lastFailedRequest).attempt,
                      }
                    : null,
        });
        this.recoveryAvailable = ok;
    }

    clearTimers() {
        [this.debounceTimer, this.maxWaitTimer, this.retryTimer].forEach((handle) => {
            if (handle) this.clock.clearTimeout(handle);
        });
        this.debounceTimer = null;
        this.maxWaitTimer = null;
        this.retryTimer = null;
        this.retryDelay = null;
        this.retryPaused = false;
    }

    discard() {
        this.clearTimers();
        this.pendingRequest = null;
        this.lastFailedRequest = null;
        this.recovery?.remove();
        this.phase = this.persisted ? 'saved' : 'pristine';
        this.emit();
    }

    emit() {
        this.onChange(this.state);
    }
}
