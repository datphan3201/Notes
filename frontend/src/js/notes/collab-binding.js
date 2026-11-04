import { t } from '../lib/i18n.js';
import { transformIndex } from '../lib/text-operation.js';
import { CollaborationSession } from './collaboration.js';

const initials = (name) =>
    String(name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join('') || '?';

/**
 * Connects a title <input>, a NoteContentEditor and a presence strip to a
 * CollaborationSession: local edits go out as operations, remote edits come
 * in without moving the local caret, and the strip shows who else is here.
 */
export class CollabBinding {
    constructor({ noteId, title, content, presence, ...callbacks }) {
        this.title = title;
        this.content = content;
        this.presence = presence;
        this.callbacks = callbacks;
        this.peers = [];
        this.cursorTimer = null;
        this.initialized = false;
        this.session = new CollaborationSession({
            noteId,
            onInit: (message, reconnect) => this.init(message, reconnect),
            onRemote: (field, text, ops) => this.remote(field, text, ops),
            onPeers: (peers) => this.renderPeers(peers),
            onCursor: (client, cursor) => this.cursor(client, cursor),
            onActivity: (client) => this.activity(client),
            onStatus: (status, saveState, message) =>
                callbacks.onStatus?.(status, saveState, message),
            onSaved: (message) => callbacks.onSaved?.(message),
            onPermission: (permission) => callbacks.onPermission?.(permission),
            onEnded: (reason, message) => {
                this.renderPeers([]);
                callbacks.onEnded?.(reason, message);
            },
            onUnavailable: (error) => {
                this.renderPeers([]);
                callbacks.onUnavailable?.(error);
            },
        });
        this.onSelection = () => this.scheduleCursor();
        document.addEventListener('selectionchange', this.onSelection);
    }

    /** True once the server has sent the shared text (even while reconnecting). */
    get active() {
        return this.initialized && !['ended', 'unavailable'].includes(this.session.status);
    }

    get permission() {
        return this.session.permission;
    }

    start() {
        return this.session.start();
    }

    stop() {
        document.removeEventListener('selectionchange', this.onSelection);
        window.clearTimeout(this.cursorTimer);
        this.session.stop();
        this.renderPeers([]);
    }

    init(message, reconnect) {
        this.initialized = true;
        if (!reconnect) {
            this.title.value = message.title;
            this.content.setValue(message.content, { reset: true });
        }
        this.callbacks.onInit?.(message, reconnect);
    }

    /** Call after any local edit to either field. */
    localInput() {
        if (!this.active) return;
        this.session.localChange('title', this.title.value);
        this.session.localChange('content', this.content.value);
    }

    hasPending() {
        return this.session.hasPending();
    }

    /** Waits (bounded) until the server acknowledged every local edit. */
    async settle(timeout = 3000) {
        const deadline = Date.now() + timeout;
        while (this.session.hasPending() && Date.now() < deadline)
            await new Promise((resolve) => window.setTimeout(resolve, 100));
        return !this.session.hasPending();
    }

    remote(field, text, ops) {
        if (field === 'title') {
            const input = this.title;
            const focused = document.activeElement === input;
            const start = transformIndex(ops, input.selectionStart ?? 0);
            const end = transformIndex(ops, input.selectionEnd ?? 0);
            input.value = text;
            if (focused) input.setSelectionRange(start, end);
        } else {
            this.content.applyRemote(text, ops);
        }
        this.callbacks.onRemote?.(field, text);
    }

    scheduleCursor() {
        if (!this.active) return;
        window.clearTimeout(this.cursorTimer);
        this.cursorTimer = window.setTimeout(() => {
            if (document.activeElement === this.title)
                this.session.sendCursor(
                    'title',
                    this.title.selectionStart ?? 0,
                    this.title.selectionEnd ?? 0,
                );
            else if (this.content.root.contains(document.activeElement)) {
                const selection = this.content.getSelection();
                this.session.sendCursor('content', selection.start, selection.end);
            }
        }, 200);
    }

    renderPeers(peers) {
        this.peers = peers;
        if (!this.presence) return;
        this.presence.replaceChildren();
        this.presence.classList.toggle('is-hidden', !this.initialized || !peers.length);
        if (!peers.length) return;
        const label = document.createElement('span');
        label.className = 'presence-label';
        label.textContent = t('Also here');
        this.presence.append(label);
        for (const peer of peers) {
            const chip = document.createElement('span');
            chip.className = 'presence-chip';
            chip.dataset.client = String(peer.client);
            chip.style.setProperty('--presence-color', peer.color);
            chip.textContent = initials(peer.name);
            const role = t(peer.permission === 'view' ? 'View only' : 'Can edit');
            chip.title = `${peer.name} · ${role}`;
            chip.setAttribute('aria-label', `${peer.name}, ${role}`);
            chip.setAttribute('role', 'img');
            this.presence.append(chip);
        }
    }

    cursor(client, cursor) {
        const chip = this.presence?.querySelector(`[data-client="${client}"]`);
        const peer = this.peers.find((entry) => entry.client === client);
        if (!chip || !peer) return;
        const where = cursor ? t(cursor.field === 'title' ? 'In the title' : 'In the content') : '';
        chip.title = [peer.name, where].filter(Boolean).join(' · ');
    }

    activity(client) {
        const chip = this.presence?.querySelector(`[data-client="${client}"]`);
        if (!chip) return;
        chip.classList.add('is-typing');
        window.clearTimeout(chip.typingTimer);
        chip.typingTimer = window.setTimeout(() => chip.classList.remove('is-typing'), 1500);
    }
}
