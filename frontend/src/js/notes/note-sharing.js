import { get, patch, post, put, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

/** Applies a preset name or #rrggbb color plus an optional background image to a card. */
export function applyNoteStyle(node, color, backgroundUrl = null) {
    const custom = /^#[0-9a-f]{6}$/i.test(color || '');
    node.dataset.noteColor = custom ? 'custom' : color || 'neutral';
    node.style.setProperty('--note-custom-color', custom ? color : '');
    node.style.backgroundImage = backgroundUrl ? `url("${backgroundUrl}")` : '';
    node.classList.toggle('has-background', !!backgroundUrl);
}

/**
 * Owner sharing controls, the "Shared with me" scope, invitations and the
 * recipient's view/edit dialog for a shared Note.
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
        this.shareDialog
            .querySelector('[data-share-form]')
            .addEventListener('submit', (event) => this.invite(event));
        this.sharedDialog
            .querySelector('[data-shared-note-close]')
            .addEventListener('click', () => this.sharedDialog.close());
        this.sharedDialog
            .querySelector('[data-shared-note-form]')
            .addEventListener('submit', (event) => this.saveShared(event));
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
        } catch {
            return;
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
                const card = element('article', 'note-card note-card-shared');
                card.dataset.sharedNoteId = note.note_id;
                card.tabIndex = 0;
                applyNoteStyle(card, note.color);
                card.append(
                    element('h2', 'note-card-title', note.title),
                    element('p', 'note-card-preview', note.excerpt),
                    element(
                        'small',
                        'note-card-meta',
                        `${note.owner.display_name} · ${t(note.permission === 'edit' ? 'Can edit' : 'View only')}`,
                    ),
                );
                card.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') this.openSharedNote(note.note_id);
                });
                container.append(card);
            }
        }
        if (!notes.length) {
            const empty = element('div', 'empty-state');
            empty.append(
                element('h2', '', t('Nothing shared with you yet')),
                element(
                    'p',
                    '',
                    t('Notes other people share with you appear here after you accept.'),
                ),
            );
            this.page.grid.append(empty.cloneNode(true));
            this.page.list.append(empty);
        }
        this.page.root.querySelector('[data-pagination]')?.replaceChildren();
    }

    renderInvitations() {
        this.invitations.replaceChildren();
        this.invitations.classList.toggle('is-hidden', !this.received.invitations.length);
        for (const invitation of this.received.invitations) {
            const row = element('div', 'share-invitation');
            row.append(
                element(
                    'span',
                    '',
                    `${invitation.owner.display_name} ${t('shared')} “${invitation.title}” (${t(invitation.permission === 'edit' ? 'Can edit' : 'View only')})`,
                ),
            );
            for (const action of ['accept', 'decline']) {
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
        this.shareDialog.querySelector('[data-share-status]').textContent = '';
        this.shareDialog.showModal();
        try {
            this.renderShares((await get(`/api/v1/notes/${noteId}/shares`)).payload.data);
        } catch (error) {
            this.shareDialog.querySelector('[data-share-status]').textContent = error.message;
        }
    }

    renderShares(shares) {
        const list = this.shareDialog.querySelector('[data-share-list]');
        list.replaceChildren();
        if (!shares.length)
            list.append(element('p', 'subtle-copy', t('Not shared with anyone yet.')));
        for (const share of shares) {
            const row = element('div', 'share-row');
            row.append(
                element(
                    'span',
                    '',
                    `${share.recipient.display_name} (${share.recipient.email})${share.status === 'pending' ? ` · ${t('invited')}` : ''}`,
                ),
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
                this.updateShares(() =>
                    patch(`/api/v1/notes/${this.ownerNoteId}/shares/${share.id}`, {
                        permission: permission.value,
                    }),
                ),
            );
            const kick = element('button', 'text-button', t('Remove'));
            kick.type = 'button';
            kick.addEventListener('click', () =>
                this.updateShares(() =>
                    remove(`/api/v1/notes/${this.ownerNoteId}/shares/${share.id}`),
                ),
            );
            row.append(permission, kick);
            list.append(row);
        }
    }

    async updateShares(operation) {
        const status = this.shareDialog.querySelector('[data-share-status]');
        try {
            this.renderShares((await operation()).payload.data);
            status.textContent = t('Saved.');
        } catch (error) {
            status.textContent =
                Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
        }
    }

    async invite(event) {
        event.preventDefault();
        const form = event.currentTarget;
        await this.updateShares(() =>
            post(`/api/v1/notes/${this.ownerNoteId}/shares`, {
                email: form.elements.email.value,
                permission: form.elements.permission.value,
            }),
        );
        // Unknown addresses succeed silently so sharing never reveals who has an account.
        this.shareDialog.querySelector('[data-share-status]').textContent = t(
            t('If that email belongs to a Planner account, they will receive an invitation.'),
        );
        form.reset();
    }

    async openSharedNote(noteId) {
        const status = this.sharedDialog.querySelector('[data-shared-note-status]');
        status.textContent = '';
        try {
            this.showShared((await get(`/api/v1/shared-notes/${noteId}`)).payload.data);
            this.sharedDialog.showModal();
        } catch (error) {
            this.page.toast(error.message, true);
            this.load();
        }
    }

    showShared(note) {
        this.openShared = note;
        const form = this.sharedDialog.querySelector('[data-shared-note-form]');
        const editable = note.permission === 'edit';
        form.elements.title.value = note.title;
        form.elements.content.value = note.content;
        form.elements.title.readOnly = form.elements.content.readOnly = !editable;
        this.sharedDialog.querySelector('[data-shared-note-save]').hidden = !editable;
        this.sharedDialog.querySelector('[data-shared-note-owner]').textContent =
            `${t('Shared by')} ${note.owner?.display_name || ''} · ${t(editable ? 'Can edit' : 'View only')}`;
        applyNoteStyle(this.sharedDialog, note.color);
    }

    async saveShared(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const status = this.sharedDialog.querySelector('[data-shared-note-status]');
        try {
            this.showShared(
                (
                    await patch(`/api/v1/shared-notes/${this.openShared.id}`, {
                        base_version: this.openShared.version,
                        title: form.elements.title.value,
                        content: form.elements.content.value,
                    })
                ).payload.data,
            );
            status.textContent = t('Saved.');
            this.load();
        } catch (error) {
            if (error.status === 409 && error.payload?.current) {
                status.textContent = t(
                    t(
                        'Someone else changed this note. Copy your text, then reload the latest version.',
                    ),
                );
                this.openShared.version = error.payload.current.version;
                return;
            }
            status.textContent =
                Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
        }
    }

    async leave() {
        if (
            !window.confirm(
                t('Leave this shared note? You will need a new invitation to see it again.'),
            )
        )
            return;
        try {
            await remove(`/api/v1/shared-notes/memberships/${this.openShared.share_id}`);
            this.sharedDialog.close();
            this.load();
        } catch (error) {
            this.sharedDialog.querySelector('[data-shared-note-status]').textContent =
                error.message;
        }
    }

    async report() {
        const reason = window.prompt(
            t('Tell the administrators what is wrong with this note.'),
            '',
        );
        if (!reason) return;
        const status = this.sharedDialog.querySelector('[data-shared-note-status]');
        try {
            await post(`/api/v1/shared-notes/${this.openShared.id}/report`, { reason });
            status.textContent = t('Thank you. An administrator will review this note.');
        } catch (error) {
            status.textContent =
                Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
        }
    }

    /** Owner-only: use one of the Note's own images as its background. */
    static setBackground(noteId, attachmentId) {
        return put(`/api/v1/notes/${noteId}/background`, { attachment_id: attachmentId || null });
    }
}
