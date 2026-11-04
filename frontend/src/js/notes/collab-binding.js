import { t } from '../lib/i18n.js';
import { fromDiff, transformIndex } from '../lib/text-operation.js';
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
        this.cursors = new Map();
        this.cursorTimer = null;
        this.caretLayer = null;
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
        this.onScroll = () => this.renderCarets();
        this.content.root.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', this.onScroll);
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
        this.content.root.removeEventListener('scroll', this.onScroll);
        window.removeEventListener('resize', this.onScroll);
        this.cursors.clear();
        this.caretLayer?.remove();
        this.caretLayer = null;
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
        const before = this.session.text('content');
        this.session.localChange('title', this.title.value);
        this.session.localChange('content', this.content.value);
        if (before !== null && before !== this.content.value) {
            const ops = fromDiff(before, this.content.value);
            for (const cursor of this.cursors.values())
                if (cursor.field === 'content')
                    cursor.sel = cursor.sel.map((index) => transformIndex(ops, index));
            this.renderCarets();
        }
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
            // Other people's carets move with the text they are standing in.
            for (const cursor of this.cursors.values()) {
                if (cursor.field !== 'content') continue;
                cursor.sel = cursor.sel.map((index) => transformIndex(ops, index));
            }
        }
        this.renderCarets();
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
        for (const client of this.cursors.keys())
            if (!peers.some((peer) => peer.client === client)) this.cursors.delete(client);
        for (const peer of peers) if (peer.cursor) this.cursors.set(peer.client, peer.cursor);
        this.renderCarets();
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
        if (cursor) this.cursors.set(client, { field: cursor.field, sel: [...cursor.sel] });
        else this.cursors.delete(client);
        this.renderCarets();
        const chip = this.presence?.querySelector(`[data-client="${client}"]`);
        const peer = this.peers.find((entry) => entry.client === client);
        if (!chip || !peer) return;
        const where = cursor ? t(cursor.field === 'title' ? 'In the title' : 'In the content') : '';
        chip.title = [peer.name, where].filter(Boolean).join(' · ');
    }

    /** Coloured carets with names for everyone else typing in the content. */
    renderCarets() {
        const frame = this.content.frame;
        if (!frame) return;
        if (!this.caretLayer) {
            this.caretLayer = document.createElement('div');
            this.caretLayer.className = 'remote-caret-layer';
            this.caretLayer.setAttribute('aria-hidden', 'true');
            frame.append(this.caretLayer);
        }
        this.caretLayer.replaceChildren();
        const box = frame.getBoundingClientRect();
        const editor = this.content.root.getBoundingClientRect();
        for (const [client, cursor] of this.cursors) {
            if (cursor.field !== 'content') continue;
            const peer = this.peers.find((entry) => entry.client === client);
            const rect = peer && this.content.caretRect(cursor.sel[1]);
            if (!rect || rect.top < editor.top - 2 || rect.bottom > editor.bottom + 2) continue;
            const caret = document.createElement('span');
            caret.className = 'remote-caret';
            caret.style.setProperty('--presence-color', peer.color);
            caret.style.left = `${rect.left - box.left}px`;
            caret.style.top = `${rect.top - box.top}px`;
            caret.style.height = `${rect.height}px`;
            const name = document.createElement('span');
            name.className = 'remote-caret-name';
            name.textContent = peer.name.split(/\s+/)[0];
            caret.append(name);
            this.caretLayer.append(caret);
        }
    }

    activity(client) {
        const chip = this.presence?.querySelector(`[data-client="${client}"]`);
        if (!chip) return;
        chip.classList.add('is-typing');
        window.clearTimeout(chip.typingTimer);
        chip.typingTimer = window.setTimeout(() => chip.classList.remove('is-typing'), 1500);
    }
}
