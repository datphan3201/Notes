import { apply, compose, fromDiff, isNoop, transform } from './text-operation.js';

/**
 * Client side of the ot.js protocol for one text field.
 *
 * At most one operation is in flight (outstanding); edits made meanwhile are
 * composed into a buffer and sent after the server acknowledges. Incoming
 * server operations are transformed over outstanding and buffered edits
 * before they touch the local document, so every participant converges.
 */
export class OTClient {
    /**
     * @param {object} options
     * @param {number} options.revision server revision of `text`
     * @param {string} options.text
     * @param {(revision: number, ops: Array) => void} options.send
     * @param {(ops: Array, text: string) => void} options.onRemote called after a remote op changed the text
     */
    constructor({ revision, text, send, onRemote }) {
        this.revision = revision;
        this.text = text;
        // The server's text at `revision` (no unacknowledged local edits).
        this.confirmed = text;
        this.send = send;
        this.onRemote = onRemote;
        this.outstanding = null;
        this.buffer = null;
    }

    get state() {
        if (this.buffer) return 'awaiting-with-buffer';
        return this.outstanding ? 'awaiting-confirm' : 'synchronized';
    }

    /** A local edit (already applied to the visible field). */
    applyLocal(ops) {
        if (isNoop(ops)) return;
        this.text = apply(ops, this.text);
        if (!this.outstanding) {
            this.outstanding = ops;
            this.send(this.revision, ops);
        } else if (!this.buffer) {
            this.buffer = ops;
        } else {
            this.buffer = compose(this.buffer, ops);
        }
    }

    /** An operation another participant made, already sequenced by the server. */
    applyServer(ops) {
        this.revision += 1;
        this.confirmed = apply(ops, this.confirmed);
        let incoming = ops;
        if (this.outstanding) {
            [this.outstanding, incoming] = transform(this.outstanding, incoming);
            if (this.buffer) [this.buffer, incoming] = transform(this.buffer, incoming);
        }
        this.text = apply(incoming, this.text);
        this.onRemote(incoming, this.text);
    }

    /** The server accepted our outstanding operation. */
    serverAck() {
        this.revision += 1;
        if (!this.outstanding) return;
        this.confirmed = apply(this.outstanding, this.confirmed);
        this.outstanding = this.buffer;
        this.buffer = null;
        if (this.outstanding) this.send(this.revision, this.outstanding);
    }

    /**
     * After a reconnect the server reports its current revision and text.
     * Changes others made meanwhile are merged under the local unacknowledged
     * edits (standard transform), which are then sent again from the new base.
     * Returns the operation applied to the visible text (null when unchanged).
     */
    rebase(revision, serverText) {
        const pending = this.pendingOps();
        let base = this.confirmed;
        let local = pending;
        // The last edit may have been applied before the connection dropped.
        if (pending && apply(pending, base) === serverText) local = null;
        else if (this.outstanding && apply(this.outstanding, base) === serverText) {
            base = serverText;
            local = this.buffer;
        }
        const remote = fromDiff(base, serverText);
        let visible = remote;
        if (local) [local, visible] = transform(local, remote);
        if (!local) visible = fromDiff(this.text, serverText);
        this.revision = revision;
        this.confirmed = serverText;
        this.outstanding = null;
        this.buffer = null;
        const changed = !isNoop(visible);
        this.text = apply(visible, this.text);
        if (local && !isNoop(local)) this.applyLocalFromRebase(local);
        if (changed) this.onRemote(visible, this.text);
        return changed ? visible : null;
    }

    applyLocalFromRebase(ops) {
        this.outstanding = ops;
        this.send(this.revision, ops);
    }

    /** True while local edits have not been acknowledged. */
    hasPending() {
        return Boolean(this.outstanding || this.buffer);
    }

    /** Ops the visible text contains that the server has not acknowledged (outstanding ∘ buffer). */
    pendingOps() {
        if (!this.outstanding) return null;
        return this.buffer ? compose(this.outstanding, this.buffer) : this.outstanding;
    }
}
