import { get, patch, post, put, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { checkMark } from '../lib/check-mark.js';
import { noteLines } from '../lib/note-checkbox-text.js';
import { CollabBinding } from './collab-binding.js';
import { NoteContentEditor } from './note-content-editor.js';
import { SummaryPanel, promptText, relativeTime } from './note-dialogs.js';

const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

const firstError = (error) =>
    Object.values(error?.payload?.errors || {})[0]?.[0] || error?.message || '';

/** Applies a preset name or #rrggbb color plus an optional background image to a card. */
export function applyNoteStyle(node, color, backgroundUrl = null) {
    const custom = /^#[0-9a-f]{6}$/i.test(color || '');
    node.dataset.noteColor = custom ? 'custom' : color || 'neutral';
    node.style.setProperty('--note-custom-color', custom ? color : '');
    node.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : '';
    node.classList.toggle('has-background', !!backgroundUrl);
}

/**
 * Splits text into literal segments with case-insensitive match flags for safe DOM rendering.
 * @param {string} text
 * @param {string} query
 * @returns {Array<{text: string, match: boolean}>}
 */
export function highlightTextSegments(text, query) {
    const raw = String(text ?? '');
    const needle = String(query ?? '')
        .normalize('NFC')
        .trim();
    if (!raw) return [];
    if (!needle) return [{ text: raw, match: false }];
    const lowerText = raw.toLocaleLowerCase();
    const lowerNeedle = needle.toLocaleLowerCase();
    if (!lowerNeedle) return [{ text: raw, match: false }];
    const segments = [];
    let cursor = 0;
    while (cursor < raw.length) {
        const matchIndex = lowerText.indexOf(lowerNeedle, cursor);
        if (matchIndex === -1) {
            segments.push({ text: raw.slice(cursor), match: false });
            break;
        }
        if (matchIndex > cursor) {
            segments.push({ text: raw.slice(cursor, matchIndex), match: false });
        }
        segments.push({
            text: raw.slice(matchIndex, matchIndex + lowerNeedle.length),
            match: true,
        });
        cursor = matchIndex + lowerNeedle.length;
    }
    return segments;
}

export function appendHighlightedText(container, text, query) {
    container.replaceChildren();
    for (const segment of highlightTextSegments(text, query)) {
        if (segment.match) {
            const mark = document.createElement('mark');
            mark.className = 'note-search-highlight';
            mark.textContent = segment.text;
            container.append(mark);
        } else {
            container.append(document.createTextNode(segment.text));
        }
    }
}

/** Card preview: checklist lines show a box instead of their "- [x]" markup. */
export function appendNotePreview(container, text, query) {
    container.replaceChildren();
    noteLines(text || '').forEach((line, index) => {
        if (index) container.append(document.createTextNode('\n'));
        if (line.checked !== null) {
            const box = element('span', `note-preview-box${line.checked ? ' is-checked' : ''}`);
            box.setAttribute('role', 'img');
            box.setAttribute('aria-label', t(line.checked ? 'Checked' : 'Unchecked'));
            if (line.checked) box.append(checkMark());
            container.append(document.createTextNode(line.indent), box);
        }
        for (const segment of highlightTextSegments(line.text, query)) {
            if (segment.match) {
                container.append(element('mark', 'note-search-highlight', segment.text));
            } else {
                container.append(document.createTextNode(segment.text));
            }
        }
    });
}

/** Splits "a@x.com, b@y.com c@z.com" into unique lowercase addresses. */
export function parseEmails(text) {
    return [
        ...new Set(
            String(text || '')
                .split(/[\s,;]+/)
                .map((part) => part.trim().toLowerCase())
                .filter(Boolean),
        ),
    ];
}

/**
 * Owner sharing controls, the "Shared with me" scope, invitations and the
 * recipient's live editor for a shared Note.
 */
export class NoteSharing {
    constructor(page) {
        this.page = page;
        this.active = false;
        this.received = { invitations: [], notes: [] };
        this.shareDialog = document.querySelector('[data-share-dialog]');
        this.sharedDialog = document.querySelector('[data-shared-note-dialog]');
        this.filter = page.root.querySelector('[data-filter-shared]');
        this.invitations = page.root.querySelector('[data-share-invitations]');
        this.ownerNoteId = null;
        this.openShared = null;
        this.collab = null;
        this.saveTimer = null;
        this.saving = null;
    }

    init() {
        this.filter.addEventListener('click', () => this.activate());
        this.page.root
            .querySelector('[data-filter-all]')
            .addEventListener('click', () => this.deactivate());
        document.querySelector('[data-editor-share]')?.addEventListener('click', () => {
            if (this.page.editor?.note?.id) this.openShareDialog(this.page.editor.note.id);
        });
        this.shareDialog
            .querySelector('[data-share-close]')
            .addEventListener('click', () => this.shareDialog.close());
        this.shareDialog.addEventListener('close', () => {
            this.page.loadNotes();
            if (this.page.editor?.note?.id === this.ownerNoteId)
                this.page.editor.refreshSharing?.();
        });
        this.shareDialog
            .querySelector('[data-share-form]')
            .addEventListener('submit', (event) => this.invite(event));
        this.shareDialog
            .querySelector('#share-email')
            .addEventListener('input', () => this.shareError(''));

        const form = this.sharedDialog.querySelector('[data-shared-note-form]');
        this.sharedTitle = form.elements.title;
        this.sharedContent = new NoteContentEditor(form.elements.content);
        this.sharedSummary = new SummaryPanel(
            this.sharedDialog.querySelector('[data-shared-ai-summary]'),
        );
        this.sharedTitle.addEventListener('input', () => this.sharedInput());
        form.elements.content.addEventListener('input', () => this.sharedInput());
        form.addEventListener('submit', (event) => event.preventDefault());
        for (const selector of ['[data-shared-note-close]', '[data-shared-note-done]'])
            this.sharedDialog
                .querySelector(selector)
                .addEventListener('click', () => this.closeShared());
        this.sharedDialog.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.closeShared();
        });
        this.sharedDialog
            .querySelector('[data-shared-note-leave]')
            .addEventListener('click', () => this.leave());
        this.sharedDialog
            .querySelector('[data-shared-note-report]')
            .addEventListener('click', () => this.report());
        this.page.root.addEventListener('click', (event) => {
            const card = event.target.closest('[data-shared-note-id]');
            if (card && !event.target.closest('button'))
                this.openSharedNote(card.dataset.sharedNoteId);
        });
        get('/api/v1/contacts')
            .then((response) => {
                const list = this.shareDialog.querySelector('[data-share-contacts]');
                for (const contact of response.payload.data)
                    list.append(new Option(contact.display_name, contact.email));
            })
            .catch(() => {});
        this.load().then(() => {
            if (new URLSearchParams(window.location.search).has('shared')) this.activate();
        });
    }

    async load() {
        try {
            this.received = (await get('/api/v1/shared-notes')).payload.data;
            this.page.offlineStore?.putShared(this.received);
        } catch {
            const cached = await this.page.offlineStore?.getShared();
            if (!cached) return;
            this.received = cached;
        }
        this.page.root.querySelector('[data-shared-total]').textContent = String(
            this.received.notes.length,
        );
        this.renderInvitations();
        if (this.active) this.render();
    }

    activate() {
        this.active = true;
        this.filter.classList.add('is-active');
        this.filter.setAttribute('aria-pressed', 'true');
        this.page.root.querySelector('[data-filter-all]').classList.remove('is-active');
        this.page.root.querySelector('[data-active-filter-row]')?.classList.add('is-hidden');
        this.render();
    }

    deactivate() {
        if (!this.active) return;
        this.active = false;
        this.filter.classList.remove('is-active');
        this.filter.setAttribute('aria-pressed', 'false');
        this.page.loadNotes();
    }

    render() {
        const needle = (this.page.search?.value || '').trim().toLocaleLowerCase();
        const notes = this.received.notes.filter((note) =>
            `${note.title} ${note.excerpt}`.toLocaleLowerCase().includes(needle),
        );
        this.page.grid.replaceChildren();
        this.page.list.replaceChildren();
        for (const note of notes) {
            for (const container of [this.page.grid, this.page.list]) {
                container.append(this.sharedCard(note, needle));
            }
        }
        if (!notes.length) {
            const empty = element('div', 'empty-state');
            const icon = element('span', 'empty-state-icon', '⇄');
            icon.setAttribute('aria-hidden', 'true');
            empty.append(
                icon,
                element('h2', '', t(needle ? 'No matching notes' : 'Nothing shared with you yet')),
                element(
                    'p',
                    '',
                    t(
                        needle
                            ? 'Clear some filters or try another search term.'
                            : 'Notes other people share with you appear here after you accept.',
                    ),
                ),
            );
            this.page.grid.append(empty.cloneNode(true));
            this.page.list.append(empty);
        }
        this.page.root.querySelector('[data-pagination]')?.replaceChildren();
        this.page.setFeedback('');
    }

    sharedCard(note, needle) {
        const card = element('article', 'note-card note-card-shared');
        card.dataset.sharedNoteId = note.note_id;
        applyNoteStyle(card, note.color);
        const head = element('div', 'note-card-head');
        const title = element('h2', 'note-card-title');
        const open = element('button', 'note-card-open');
        open.type = 'button';
        appendHighlightedText(open, note.title, needle);
        open.append(
            element(
                'span',
                'sr-only',
                ` (${t('Shared by')} ${note.owner.display_name}, ${t(note.permission === 'edit' ? 'Can edit' : 'View only')}${note.is_locked ? ', ' + t('Password protected') : ''})`,
            ),
        );
        open.addEventListener('click', () => this.openSharedNote(note.note_id));
        title.append(open);
        const badges = element('div', 'note-card-badges');
        if (note.is_locked) badges.append(this.page.statusBadge('lock', t('Password protected')));
        badges.append(
            this.page.statusBadge(
                note.permission === 'edit' ? 'edit' : 'eye',
                t(note.permission === 'edit' ? 'Can edit' : 'View only'),
                true,
            ),
        );
        head.append(title, badges);
        const preview = element('p', 'note-card-preview');
        if (note.is_locked) preview.append(this.page.lockedPreview());
        else appendHighlightedText(preview, note.excerpt, needle);
        const footer = element('div', 'note-card-footer');
        const owner = element('span', 'note-card-owner');
        owner.append(
            this.page.avatar(note.owner.display_name),
            document.createTextNode(note.owner.display_name),
        );
        const when = element('span', 'note-card-date', relativeTime(note.shared_at));
        when.title = `${t('Shared')} ${new Date(note.shared_at).toLocaleString()}`;
        footer.append(owner, when);
        card.append(head, preview, footer);
        return card;
    }

    renderInvitations() {
        this.invitations.replaceChildren();
        this.invitations.classList.toggle('is-hidden', !this.received.invitations.length);
        if (this.received.invitations.length) {
            this.invitations.append(element('h2', 'invitations-heading', t('Invitations')));
        }
        for (const invitation of this.received.invitations) {
            const row = element('div', 'share-invitation');
            const copy = element('div', 'share-invitation-copy');
            copy.append(
                element(
                    'strong',
                    '',
                    `${invitation.owner.display_name} ${t('shared')} “${invitation.title}”`,
                ),
                element(
                    'small',
                    '',
                    `${t(invitation.permission === 'edit' ? 'Can edit' : 'View only')} · ${relativeTime(invitation.shared_at)}`,
                ),
            );
            row.append(this.page.avatar(invitation.owner.display_name), copy);
            for (const action of ['decline', 'accept']) {
                const button = element(
                    'button',
                    action === 'accept' ? 'button button-primary' : 'button button-quiet',
                    t(action === 'accept' ? 'Accept' : 'Decline'),
                );
                button.type = 'button';
                button.addEventListener('click', async () => {
                    button.disabled = true;
                    try {
                        this.received = (
                            await post(
                                `/api/v1/shared-notes/invitations/${invitation.share_id}/${action}`,
                                {},
                            )
                        ).payload.data;
                        this.page.root.querySelector('[data-shared-total]').textContent = String(
                            this.received.notes.length,
                        );
                        this.renderInvitations();
                        if (this.active) this.render();
                        this.page.toast(
                            action === 'accept'
                                ? 'Invitation accepted. Find the note in Shared with me.'
                                : 'Invitation declined.',
                        );
                    } catch (error) {
                        this.page.toast(error.message, true);
                        button.disabled = false;
                    }
                });
                row.append(button);
            }
            this.invitations.append(row);
        }
    }

    async openShareDialog(noteId) {
        this.ownerNoteId = noteId;
        this.shareError('');
        this.shareStatus('');
        this.shareDialog.querySelector('[data-share-form]').reset();
        this.shareDialog
            .querySelector('[data-share-list]')
            .replaceChildren(element('p', 'subtle-copy', t('Loading…')));
        this.shareDialog.showModal();
        this.shareDialog.querySelector('#share-email').focus();
        try {
            const known = this.page.notes.find((note) => note.id === noteId);
            const shares = await this.page.lockUI.withUnlock(
                noteId,
                () => get(`/api/v1/notes/${noteId}/shares`),
                known?.title || '',
                { locked: Boolean(known?.is_locked) && !this.page.editor?.machine },
            );
            if (shares) this.renderShares(shares.payload.data);
            else this.shareDialog.close();
        } catch (error) {
            this.shareStatus(error.message, true);
        }
    }

    renderShares(shares) {
        const list = this.shareDialog.querySelector('[data-share-list]');
        list.replaceChildren();
        if (!shares.length)
            list.append(element('p', 'subtle-copy', t('Not shared with anyone yet.')));
        for (const share of shares) {
            const row = element('div', 'share-row');
            const person = element('div', 'share-person');
            const copy = element('div', 'share-person-copy');
            copy.append(
                element('strong', '', share.recipient.display_name),
                element('small', '', share.recipient.email),
            );
            person.append(this.page.avatar(share.recipient.display_name), copy);
            const status = element(
                'span',
                'status-badge' + (share.status === 'pending' ? ' is-warning' : ' is-success'),
                t(share.status === 'pending' ? 'Invited' : 'Has access'),
            );
            const permission = element('select');
            permission.setAttribute(
                'aria-label',
                `${t('Permission')}: ${share.recipient.display_name}`,
            );
            permission.append(
                new Option(t('Can view'), 'view', false, share.permission === 'view'),
                new Option(t('Can view and edit'), 'edit', false, share.permission === 'edit'),
            );
            permission.addEventListener('change', () =>
                this.updateShares(
                    () =>
                        patch(`/api/v1/notes/${this.ownerNoteId}/shares/${share.id}`, {
                            permission: permission.value,
                        }),
                    'Permission updated.',
                ),
            );
            const kick = element('button', 'text-button text-danger', t('Remove'));
            kick.type = 'button';
            kick.setAttribute('aria-label', `${t('Remove')} ${share.recipient.display_name}`);
            kick.addEventListener('click', async () => {
                if (
                    !(await this.page.confirm(
                        'Remove access?',
                        `${share.recipient.display_name} ${t('will no longer see this note.')}`,
                        { accept: 'Remove' },
                    ))
                )
                    return;
                this.updateShares(
                    () => remove(`/api/v1/notes/${this.ownerNoteId}/shares/${share.id}`),
                    'Access removed.',
                );
            });
            const controls = element('div', 'share-controls');
            controls.append(status, permission, kick);
            row.append(person, controls);
            list.append(row);
        }
    }

    async updateShares(operation, success) {
        try {
            this.renderShares((await operation()).payload.data);
            this.shareStatus(t(success));
        } catch (error) {
            this.shareStatus(firstError(error), true);
        }
    }

    shareStatus(message, error = false) {
        const status = this.shareDialog.querySelector('[data-share-status]');
        status.textContent = message;
        status.classList.toggle('is-error', error);
        status.classList.toggle('is-success', Boolean(message) && !error);
    }

    shareError(message) {
        const node = this.shareDialog.querySelector('[data-share-error]');
        node.textContent = message;
        node.classList.toggle('is-hidden', !message);
        this.shareDialog
            .querySelector('#share-email')
            .setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    async invite(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const emails = parseEmails(form.elements.emails.value);
        const invalid = emails.filter((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        if (!emails.length) return this.shareError(t('Enter at least one email address.'));
        if (invalid.length)
            return this.shareError(`${t('Check these addresses:')} ${invalid.join(', ')}`);
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
            const response = await post(`/api/v1/notes/${this.ownerNoteId}/shares`, {
                emails,
                permission: form.elements.permission.value,
            });
            this.renderShares(response.payload.data);
            this.shareStatus(
                emails.length === 1
                    ? t('Invitation sent.')
                    : `${t('Invitations sent to')} ${emails.length} ${t('people')}.`,
            );
            form.elements.emails.value = '';
        } catch (error) {
            this.shareError(firstError(error));
        } finally {
            submit.disabled = false;
        }
    }

    /** Opens a shared Note: asks for its password first when it is locked. */
    async openSharedNote(noteId) {
        if (this.sharedDialog.open) await this.closeShared();
        let response;
        try {
            const known = this.received.notes.find((note) => note.note_id === noteId);
            response = await this.page.lockUI.withUnlock(
                noteId,
                () => get(`/api/v1/shared-notes/${noteId}`),
                known?.title || '',
                { locked: Boolean(known?.is_locked) },
            );
        } catch (error) {
            this.page.toast(error.message, true);
            this.load();
            return;
        }
        if (!response) return;
        this.showShared(response.payload.data);
        this.sharedDialog.showModal();
        if (this.openShared.permission === 'edit') this.sharedTitle.focus();
        this.sharedSummary.load(noteId);
        this.startSharedCollaboration();
    }

    showShared(note) {
        this.openShared = note;
        const editable = note.permission === 'edit';
        this.sharedTitle.value = note.title;
        this.sharedContent.setValue(note.content, { reset: true });
        this.setSharedEditable(editable);
        this.sharedDialog.querySelector('[data-shared-note-heading]').textContent =
            note.title || t('Shared note');
        this.sharedDialog.querySelector('[data-shared-note-owner]').textContent =
            `${t('Shared by')} ${note.owner?.display_name || ''}`;
        this.sharedDialog.querySelector('[data-shared-note-meta]').textContent = [
            t(editable ? 'You can edit' : 'View only'),
            note.shared_at ? `${t('shared')} ${relativeTime(note.shared_at)}` : '',
            note.is_locked ? t('Password protected') : '',
        ]
            .filter(Boolean)
            .join(' · ');
        applyNoteStyle(this.sharedDialog, note.color);
        this.sharedStatus(editable ? '' : 'Read only', false);
    }

    setSharedEditable(editable) {
        this.sharedTitle.readOnly = !editable;
        this.sharedContent.setReadOnly(!editable);
    }

    startSharedCollaboration() {
        this.collab?.stop();
        const noteId = this.openShared.id;
        const binding = new CollabBinding({
            noteId,
            title: this.sharedTitle,
            content: this.sharedContent,
            presence: this.sharedDialog.querySelector('[data-shared-presence]'),
            onInit: () =>
                this.renderSharedCollabStatus(binding.session.status, binding.session.saveState),
            onStatus: (status, saveState, message) =>
                this.renderSharedCollabStatus(status, saveState, message),
            onSaved: (message) => {
                if (this.openShared?.id === noteId) this.openShared.version = message.version;
            },
            onRemote: () => {
                this.sharedDialog.querySelector('[data-shared-note-heading]').textContent =
                    this.sharedTitle.value || t('Shared note');
            },
            onPermission: (permission) => {
                if (!this.openShared) return;
                this.openShared.permission = permission;
                this.setSharedEditable(permission === 'edit');
                this.page.toast(
                    permission === 'edit'
                        ? 'You can now edit this note.'
                        : 'The owner changed your access to view only.',
                );
            },
            onEnded: (reason, message) => {
                this.collab = null;
                this.page.toast(
                    message ||
                        (reason === 'gone'
                            ? 'This note was deleted.'
                            : 'This note is no longer shared with you.'),
                    true,
                );
                this.sharedDialog.close();
                this.load();
            },
            onUnavailable: () => {
                this.collab = null;
                this.sharedStatus(
                    this.openShared?.permission === 'edit'
                        ? 'Changes save automatically'
                        : 'Read only',
                );
            },
        });
        this.collab = binding;
        binding.start();
    }

    renderSharedCollabStatus(status, saveState, message) {
        const editable = this.openShared?.permission === 'edit';
        if (status === 'connecting') return this.sharedStatus('Connecting…');
        if (status === 'reconnecting')
            return this.sharedStatus('Reconnecting… your edits are kept');
        if (status !== 'live') return undefined;
        if (!editable) return this.sharedStatus('Read only · live updates', false, true);
        if (saveState === 'pending') return this.sharedStatus('Saving…');
        if (saveState === 'invalid')
            return this.sharedStatus(message || 'Add a title and content to save', true);
        if (saveState === 'error') return this.sharedStatus('Saving is delayed · retrying', true);
        return this.sharedStatus('Saved · live', false, true);
    }

    sharedStatus(message, error = false, live = false) {
        const status = this.sharedDialog.querySelector('[data-shared-note-status]');
        status.textContent = t(message);
        status.classList.toggle('is-error', error);
        status.classList.toggle('is-live', live);
        status.classList.toggle('is-success', message === 'Saved');
    }

    /** Edits by a recipient: live when connected, otherwise debounced autosave over HTTP. */
    sharedInput() {
        if (!this.openShared || this.openShared.permission !== 'edit') return;
        this.sharedDialog.querySelector('[data-shared-note-heading]').textContent =
            this.sharedTitle.value || t('Shared note');
        if (this.collab?.active) {
            this.collab.localInput();
            return;
        }
        this.sharedStatus('Waiting to save…');
        window.clearTimeout(this.saveTimer);
        this.saveTimer = window.setTimeout(() => this.saveSharedNow(), 800);
    }

    async saveSharedNow() {
        window.clearTimeout(this.saveTimer);
        const note = this.openShared;
        if (!note || note.permission !== 'edit' || this.collab?.active) return true;
        const title = this.sharedTitle.value.trim();
        const content = this.sharedContent.value;
        if (title === note.title && content === note.content) return true;
        if (!title || !content.trim()) {
            this.sharedStatus('Add a title and content to save', true);
            return false;
        }
        this.sharedStatus('Saving…');
        this.saving = patch(`/api/v1/shared-notes/${note.id}`, {
            base_version: note.version,
            title,
            content,
        });
        try {
            const saved = (await this.saving).payload.data;
            if (this.openShared?.id === note.id) {
                this.openShared = { ...this.openShared, ...saved };
                this.sharedStatus('Saved');
            }
            return true;
        } catch (error) {
            if (error.status === 409 && error.payload?.current) {
                // Someone else saved first: keep our text and save it on top of theirs.
                this.openShared.version = error.payload.current.version;
                this.openShared.title = error.payload.current.title;
                this.openShared.content = error.payload.current.content;
                return this.saveSharedNow();
            }
            this.sharedStatus(firstError(error) || 'Not saved · retry', true);
            return false;
        } finally {
            this.saving = null;
        }
    }

    async closeShared() {
        if (!this.openShared) {
            if (this.sharedDialog.open) this.sharedDialog.close();
            return;
        }
        if (this.collab?.active && this.collab.hasPending()) {
            this.sharedStatus('Finishing the save before closing…');
            await this.collab.settle();
        } else if (!this.collab?.active && !(await this.saveSharedNow())) {
            const leave = await this.page.confirm(
                'Leave this note?',
                'Your latest changes could not be saved. Leave anyway?',
                { accept: 'Leave' },
            );
            if (!leave) return;
        }
        this.collab?.stop();
        this.collab = null;
        this.sharedSummary.hide();
        const note = this.openShared;
        this.openShared = null;
        if (note?.is_locked)
            post(`/api/v1/notes/${encodeURIComponent(note.id)}/relock`, {}).catch(() => {});
        if (this.sharedDialog.open) this.sharedDialog.close();
        this.load();
    }

    async leave() {
        if (
            !(await this.page.confirm(
                'Leave this shared note?',
                'You will need a new invitation to see it again.',
                { accept: 'Leave' },
            ))
        )
            return;
        try {
            await remove(`/api/v1/shared-notes/memberships/${this.openShared.share_id}`);
            this.collab?.stop();
            this.collab = null;
            this.openShared = null;
            this.sharedDialog.close();
            this.page.toast('You left the shared note.');
            this.load();
        } catch (error) {
            this.sharedStatus(error.message, true);
        }
    }

    async report() {
        const reason = await promptText({
            title: 'Report this note',
            label: 'Tell the administrators what is wrong with this note.',
            multiline: true,
            maxLength: 1000,
            submit: 'Send report',
        });
        if (!reason) return;
        try {
            await post(`/api/v1/shared-notes/${this.openShared.id}/report`, { reason });
            this.sharedStatus('Thank you. An administrator will review this note.');
        } catch (error) {
            this.sharedStatus(firstError(error), true);
        }
    }

    /** Owner-only: use one of the Note's own images as its background. */
    static setBackground(noteId, attachmentId) {
        return put(`/api/v1/notes/${noteId}/background`, { attachment_id: attachmentId || null });
    }
}
