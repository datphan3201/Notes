import { post } from '../lib/http.js';
import { OTClient } from '../lib/ot-client.js';
import { fromDiff } from '../lib/text-operation.js';

const FIELDS = ['title', 'content'];
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000];

/**
 * Live collaboration on one Note over the realtime WebSocket.
 *
 * Each field (title, content) is an independent OT document. The page tells
 * the session about local edits with `localChange(field, text)`; remote edits
 * arrive through `onRemote(field, text, ops)` with the operation so carets
 * can be moved. The server saves merged text itself and reports `saved`.
 * The session reconnects with backoff and rebases unsent edits; when it
 * cannot connect at all, `onUnavailable` lets the page fall back to HTTP.
 */
export class CollaborationSession {
    constructor({
        noteId,
        onInit = () => {},
        onRemote = () => {},
        onPeers = () => {},
        onCursor = () => {},
        onStatus = () => {},
        onSaved = () => {},
        onPermission = () => {},
        onEnded = () => {},
        onUnavailable = () => {},
        onActivity = () => {},
        WebSocketImpl = globalThis.WebSocket,
    }) {
        Object.assign(this, {
            noteId,
            onInit,
            onRemote,
            onPeers,
            onCursor,
            onStatus,
            onSaved,
            onPermission,
            onEnded,
            onUnavailable,
            onActivity,
            WebSocketImpl,
        });
        this.socket = null;
        this.clients = null;
        this.stopped = false;
        this.attempt = 0;
        this.connectedOnce = false;
        this.retryTimer = null;
        this.pingTimer = null;
        this.status = 'connecting';
        this.permission = null;
        this.clientId = null;
    }

    get live() {
        return this.status === 'live';
    }

    async start() {
        this.stopped = false;
        await this.connect();
    }

    async connect() {
        if (this.stopped) return;
        this.setStatus(this.connectedOnce ? 'reconnecting' : 'connecting');
        let ticket;
        try {
            ticket = (await post(`/api/v1/notes/${encodeURIComponent(this.noteId)}/realtime`, {}))
                .payload.data;
        } catch (error) {
            // 503: realtime is switched off on this server; 404/423: access changed.
            if ([404, 410, 423, 503].includes(error.status) || !this.WebSocketImpl) {
                this.setStatus('unavailable');
                this.onUnavailable(error);
                return;
            }
            this.scheduleRetry();
            return;
        }
        if (this.stopped) return;
        const url =
            ticket.url ||
            `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${ticket.path}`;
        let socket;
        try {
            socket = new this.WebSocketImpl(url);
        } catch {
            this.scheduleRetry();
            return;
        }
        this.socket = socket;
        socket.addEventListener('open', () =>
            socket.send(JSON.stringify({ type: 'auth', ticket: ticket.ticket })),
        );
        socket.addEventListener('message', (event) => {
            if (socket !== this.socket) return;
            try {
                this.receive(JSON.parse(event.data));
            } catch {
                // A malformed frame must not break the editor; the next init resyncs.
            }
        });
        socket.addEventListener('close', (event) => {
            if (socket !== this.socket) return;
            this.socket = null;
            window.clearInterval(this.pingTimer);
            if (this.stopped) return;
            if ([4401, 4403, 4404].includes(event.code)) {
                this.setStatus('ended');
                this.onEnded(event.code === 4404 ? 'gone' : 'revoked');
                return;
            }
            this.scheduleRetry();
        });
    }

    scheduleRetry() {
        if (this.stopped) return;
        // Never connected after a few tries: the server is probably not running.
        if (!this.connectedOnce && this.attempt >= 2) {
            this.setStatus('unavailable');
            this.onUnavailable(null);
            return;
        }
        this.setStatus('reconnecting');
        const delay = RETRY_DELAYS[Math.min(this.attempt, RETRY_DELAYS.length - 1)];
        this.attempt += 1;
        window.clearTimeout(this.retryTimer);
        this.retryTimer = window.setTimeout(() => this.connect(), delay);
    }

    receive(message) {
        switch (message.type) {
            case 'init':
                return this.init(message);
            case 'ack':
                return this.clients?.[message.field]?.serverAck();
            case 'op':
                this.onActivity(message.client, message.field);
                return this.clients?.[message.field]?.applyServer(message.op);
            case 'resync': {
                const client = this.clients?.[message.field];
                if (!client) return;
                // The server could not use our edit: adopt its text for this field.
                client.outstanding = null;
                client.buffer = null;
                client.rebase(message.rev, message.text);
                return;
            }
            case 'peers':
                return this.onPeers(message.peers.filter((peer) => peer.client !== this.clientId));
            case 'cursor':
                return this.onCursor(message.client, message.cursor);
            case 'saved':
                this.saveState = 'saved';
                this.onStatus(this.status, 'saved');
                return this.onSaved(message);
            case 'save_state':
                this.saveState = message.state;
                return this.onStatus(this.status, message.state, message.message);
            case 'permission':
                this.permission = message.permission;
                return this.onPermission(message.permission);
            case 'revoked':
            case 'gone':
                this.stopped = true;
                this.setStatus('ended');
                this.socket?.close();
                return this.onEnded(message.type === 'gone' ? 'gone' : 'revoked', message.message);
            default:
                return undefined;
        }
    }

    init(message) {
        const reconnect = Boolean(this.clients);
        this.clientId = message.client_id;
        this.permission = message.permission;
        this.attempt = 0;
        this.connectedOnce = true;
        if (reconnect) {
            for (const field of FIELDS)
                this.clients[field].rebase(message.revisions[field], message[field]);
        } else {
            this.clients = {};
            for (const field of FIELDS) {
                this.clients[field] = new OTClient({
                    revision: message.revisions[field],
                    text: message[field],
                    send: (revision, ops) =>
                        this.send({ type: 'op', field, rev: revision, op: ops }),
                    onRemote: (ops, text) => this.onRemote(field, text, ops),
                });
            }
        }
        this.saveState = message.save_state;
        this.setStatus('live');
        this.onInit(message, reconnect);
        this.onPeers(message.peers.filter((peer) => peer.client !== this.clientId));
        window.clearInterval(this.pingTimer);
        this.pingTimer = window.setInterval(() => this.send({ type: 'ping' }), 20000);
    }

    /** The field now shows `text` because of a local edit. */
    localChange(field, text) {
        const client = this.clients?.[field];
        if (!client || client.text === text) return;
        if (!['owner', 'edit'].includes(this.permission)) return;
        client.applyLocal(fromDiff(client.text, text));
        this.saveState = 'pending';
        this.onStatus(this.status, 'pending');
    }

    text(field) {
        return this.clients?.[field]?.text ?? null;
    }

    hasPending() {
        return FIELDS.some((field) => this.clients?.[field]?.hasPending());
    }

    sendCursor(field, start, end) {
        if (this.live) this.send({ type: 'cursor', field, sel: [start, end] });
    }

    send(message) {
        if (this.socket?.readyState === 1) this.socket.send(JSON.stringify(message));
    }

    setStatus(status) {
        this.status = status;
        this.onStatus(status, this.saveState);
    }

    stop() {
        this.stopped = true;
        window.clearTimeout(this.retryTimer);
        window.clearInterval(this.pingTimer);
        const socket = this.socket;
        this.socket = null;
        socket?.close(1000);
    }
}
