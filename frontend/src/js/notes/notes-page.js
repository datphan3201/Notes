import { t } from '../lib/i18n.js';
import { get, patch, post, remove } from '../lib/http';
import { DebouncedAction, LatestRequest } from '../lib/read-coordinator';
import { RecoveryStore } from '../lib/recovery-store';
import { NoteEditor } from './note-editor';
import { NoteSharing, appendHighlightedText, applyNoteStyle } from './note-sharing.js';

export class NotesPage {
    constructor(root) {
        this.root = root;
        this.bootstrap = window.notesBootstrap;
        this.user = this.bootstrap.user;
        this.preferences = { ...this.bootstrap.preferences };
        this.labels = [];
        this.notes = [];
        this.query = {
            q: '',
            labelIds: [],
            page: 1,
            sort: this.query?.sort || 'updated',
            direction: this.query?.direction || 'desc',
        };
        this.meta = { current_page: 1, last_page: 1, total: 0 };
        this.noteRequests = new LatestRequest();
        this.searchDebounce = new DebouncedAction({ delay: 300 });
        this.editor = null;
        document.addEventListener('notes:preferences-changed', (event) =>
            Object.assign(this.preferences, event.detail),
        );
        this.bindShell();
        this.bindDialogs();
    }

    async init() {
        this.editor = new NoteEditor({
            root: document.querySelector('[data-editor-dialog]'),
            userId: this.user.id,
            preferences: this.preferences,
            getLabels: () => this.labels,
            onChanged: () => this.loadNotes(),
            confirm: (title, message) => this.confirm(title, message),
            toast: (message, error = false) => this.toast(message, error),
            onConflict: (machine) => this.openConflict(machine),
        });
        this.applyView(this.preferences.notes_view, false);
        this.sharing = new NoteSharing(this);
        this.sharing.init();
        await this.loadLabels();
        await this.loadNotes();
        this.checkRecovery();
        // Recovery must inspect the previous page's draft before a new editor
        // can write its first account-scoped recovery record.
        this.root.querySelector('[data-new-note]').disabled = false;
    }

    bindShell() {
        this.search = this.root.querySelector('[data-notes-search]');
        this.feedback = this.root.querySelector('[data-notes-feedback]');
        this.grid = this.root.querySelector('[data-notes-grid]');
        this.list = this.root.querySelector('[data-notes-list]');
        this.pagination = this.root.querySelector('[data-pagination]');
        this.total = this.root.querySelector('[data-note-total]');
        this.search.addEventListener('input', () => {
            this.searchDebounce.schedule(() => {
                this.query.q = this.search.value.normalize('NFC').trim();
                this.query.page = 1;
                this.loadNotes();
            });
            this.root
                .querySelector('[data-clear-search]')
                .classList.toggle('is-hidden', !this.search.value);
        });
        this.root.querySelector('[data-clear-search]').addEventListener('click', () => {
            this.search.value = '';
            this.search.dispatchEvent(new Event('input'));
        });
        this.root
            .querySelector('[data-filter-all]')
            .addEventListener('click', () => this.clearFilters());
        this.root
            .querySelector('[data-clear-filters]')
            .addEventListener('click', () => this.clearFilters());
        this.root
            .querySelector('[data-new-note]')
            .addEventListener('click', () => this.editor.requestNew());
        this.root
            .querySelector('[data-view-toggle]')
            .addEventListener('click', () =>
                this.applyView(this.preferences.notes_view === 'grid' ? 'list' : 'grid', true),
            );
        this.root.querySelector('[data-note-sort]').addEventListener('change', (event) => {
            const [sort, direction] = event.currentTarget.value.split(':');
            this.query = { ...this.query, sort, direction, page: 1 };
            this.loadNotes();
        });
        this.root.querySelectorAll('[data-open-label-manager]').forEach((button) => {
            button.addEventListener('click', () => this.openLabelManager());
        });
        this.root.addEventListener('click', (event) => {
            const card = event.target.closest('[data-note-id]');
            if (!card || event.target.closest('button')) return;
            this.editor.requestOpen(card.dataset.noteId);
        });
        document.addEventListener('notes:upload-files', (event) =>
            this.editor?.uploadFiles(event.detail.files),
        );
        document.addEventListener('notes:session-changed', () => {
            this.editor?.dispose();
            this.editor?.hide();
            this.toast('Your session changed. Reopen the note.', true);
        });
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[data-leave-guard]');
            if (!link || !this.editor?.machine || this.editor.root.classList.contains('is-hidden'))
                return;
            event.preventDefault();
            this.editor.requestClose().then((canLeave) => {
                if (canLeave) window.location.assign(link.href);
            });
        });
        document.addEventListener('submit', (event) => {
            const form = event.target.closest('form[data-leave-guard-form]');
            if (
                !form ||
                form.dataset.submitted === 'true' ||
                !this.editor?.machine ||
                this.editor.root.classList.contains('is-hidden')
            )
                return;
            event.preventDefault();
            this.editor.requestClose().then((canLeave) => {
                if (!canLeave) return;
                RecoveryStore.clearAll();
                this.broadcastSessionEvent();
                form.dataset.submitted = 'true';
                HTMLFormElement.prototype.submit.call(form);
            });
        });
    }

    bindDialogs() {
        this.labelDialog = document.querySelector('[data-label-dialog]');
        this.labelBackdrop = document.querySelector('[data-label-dialog-backdrop]');
        this.labelDialog
            .querySelector('[data-close-label-manager]')
            .addEventListener('click', () => this.closeLabelManager());
        this.labelDialog
            .querySelector('[data-label-create-form]')
            .addEventListener('submit', (event) => this.createLabel(event));
        document.addEventListener('notes:open-labels', () => this.openLabelManager());

        this.confirmDialog = document.querySelector('[data-confirm-dialog]');
        this.confirmBackdrop = document.querySelector('[data-confirm-dialog-backdrop]');
        this.confirmResolve = null;
        this.confirmDialog
            .querySelector('[data-confirm-cancel]')
            .addEventListener('click', () => this.resolveConfirm(false));
        this.confirmDialog
            .querySelector('[data-confirm-accept]')
            .addEventListener('click', () => this.resolveConfirm(true));

        this.conflictDialog = document.querySelector('[data-conflict-dialog]');
        this.conflictBackdrop = document.querySelector('[data-conflict-dialog-backdrop]');
        this.conflictDialog
            .querySelector('[data-close-conflict]')
            .addEventListener('click', () => this.closeConflict());
        this.conflictDialog.querySelector('[data-use-server]').addEventListener('click', () => {
            this.conflictMachine?.useServer();
            this.editor?.syncFieldsFromDraft();
            this.closeConflict();
        });
        this.conflictDialog.querySelector('[data-keep-local]').addEventListener('click', () => {
            this.conflictMachine?.keepLocal();
            this.closeConflict();
        });
        this.recoveryDialog = document.querySelector('[data-recovery-dialog]');
        this.recoveryBackdrop = document.querySelector('[data-recovery-dialog-backdrop]');
        this.recoveryRecord = null;
        this.recoveryDialog
            .querySelector('[data-recovery-discard]')
            .addEventListener('click', () => {
                this.recoveryRecord = null;
                RecoveryStore.clearAll();
                this.closeRecovery();
            });
        this.recoveryDialog
            .querySelector('[data-recovery-accept]')
            .addEventListener('click', async () => {
                const record = this.recoveryRecord;
                this.closeRecovery();
                if (record) await this.editor.recover(record);
            });
        [this.labelDialog, this.confirmDialog, this.conflictDialog].forEach((dialog) => {
            dialog?.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && dialog === this.confirmDialog)
                    this.resolveConfirm(false);
                if (event.key === 'Escape' && dialog === this.conflictDialog) this.closeConflict();
            });
        });
    }

    async loadLabels() {
        try {
            const result = await get('/api/v1/labels');
            this.labels = result.payload.data || [];
            this.renderLabelFilters();
            this.editor?.renderLabels(this.editor.machine?.state.draftSnapshot.label_ids || []);
        } catch (error) {
            this.toast(error.message || 'Unable to load tags.', true);
        }
    }

    checkRecovery() {
        const record = new RecoveryStore({ userId: this.user.id }).read();
        if (!record) return;
        this.recoveryRecord = record;
        const preview = this.recoveryDialog.querySelector('[data-recovery-preview]');
        preview.textContent = [record.draftSnapshot?.title, record.draftSnapshot?.content]
            .filter(Boolean)
            .join('\n\n')
            .slice(0, 500);
        this.recoveryDialog.classList.remove('is-hidden');
        this.recoveryBackdrop.classList.remove('is-hidden');
        this.recoveryDialog.querySelector('[data-recovery-accept]').focus();
    }

    closeRecovery() {
        this.recoveryDialog.classList.add('is-hidden');
        this.recoveryBackdrop.classList.add('is-hidden');
    }

    broadcastSessionEvent() {
        window.notesSessionChannel?.postMessage({ userId: String(this.user.id), type: 'logout' });
    }

    async loadNotes() {
        if (this.sharing?.active) {
            this.sharing.render();
            return;
        }
        const ticket = this.noteRequests.begin();
        this.setFeedback('Loading notes…');
        const params = new URLSearchParams();
        if (this.query.q) params.set('q', this.query.q);
        this.query.labelIds.forEach((id) => params.append('label_ids[]', id));
        params.set('page', String(this.query.page));
        params.set('sort', this.query.sort);
        params.set('direction', this.query.direction);
        try {
            const result = await get('/api/v1/notes?' + params.toString(), {
                signal: ticket.signal,
            });
            if (!this.noteRequests.isCurrent(ticket)) return;
            this.notes = result.payload.data || [];
            this.meta = result.payload.meta || this.meta;
            if (
                this.notes.length === 0 &&
                this.query.page > 1 &&
                this.query.page > this.meta.last_page
            ) {
                this.query.page = this.meta.last_page;
                return this.loadNotes();
            }
            this.renderNotes();
            this.setFeedback('');
            this.total.textContent = String(this.meta.total || 0);
            this.renderActiveFilter();
        } catch (error) {
            if (this.noteRequests.shouldIgnore(ticket, error)) return;
            this.setFeedback(error.message || 'Unable to load notes. Try again.', true);
        }
    }

    renderNotes() {
        this.grid.replaceChildren();
        this.list.replaceChildren();
        const hasPinned = this.notes.some((note) => note.is_pinned);
        const hasUnpinned = this.notes.some((note) => !note.is_pinned);
        const showGroups = hasPinned && hasUnpinned && Boolean(this.notes[0]?.is_pinned);
        let unpinnedHeaderAdded = false;
        if (showGroups) {
            this.grid.append(this.createGroupLabel(t('Pinned')));
            this.list.append(this.createGroupLabel(t('Pinned')));
        }
        this.notes.forEach((note) => {
            if (showGroups && !note.is_pinned && !unpinnedHeaderAdded) {
                unpinnedHeaderAdded = true;
                this.grid.append(this.createGroupLabel(t('Other notes')));
                this.list.append(this.createGroupLabel(t('Other notes')));
            }
            this.grid.append(this.createCard(note));
            this.list.append(this.createCard(note));
        });
        if (!this.notes.length) {
            this.grid.append(this.createEmptyState());
            this.list.append(this.createEmptyState());
        }
        this.renderPagination();
    }

    createGroupLabel(text) {
        const heading = document.createElement('div');
        heading.className = 'notes-group-heading';
        heading.textContent = text;
        return heading;
    }

    createEmptyState() {
        const hasFilters = Boolean(this.query.q || this.query.labelIds.length);
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        const icon = document.createElement('span');
        icon.className = 'empty-state-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = hasFilters ? '⌕' : '✦';
        const title = document.createElement('h2');
        title.textContent = t(hasFilters ? 'No matching notes' : 'No notes yet');
        const copy = document.createElement('p');
        copy.textContent = t(
            hasFilters
                ? 'Clear some filters or try another search term.'
                : 'Start with something you want to remember.',
        );
        const action = document.createElement('button');
        action.type = 'button';
        action.className =
            'button empty-state-action ' + (hasFilters ? 'button-quiet' : 'button-primary');
        action.textContent = hasFilters ? t('Clear filters') : '＋ ' + t('New note');
        action.addEventListener('click', () => {
            if (hasFilters) this.clearFilters();
            else this.editor?.requestNew();
        });
        empty.append(icon, title, copy, action);
        return empty;
    }

    createCard(note) {
        const card = document.createElement('article');
        card.className = 'note-card' + (note.is_pinned ? ' is-pinned' : '');
        card.dataset.noteId = note.id;
        applyNoteStyle(card, note.color, note.background_url);
        const head = document.createElement('div');
        head.className = 'note-card-head';
        const title = document.createElement('h2');
        title.className = 'note-card-title';
        appendHighlightedText(title, note.title, this.query.q);
        const actions = document.createElement('div');
        actions.className = 'note-card-actions';
        if (this.sharing) {
            const share = document.createElement('button');
            share.className = 'icon-button note-card-action';
            share.type = 'button';
            share.textContent = '⇄';
            share.title = t('Share');
            share.setAttribute('aria-label', t('Share'));
            share.addEventListener('click', (event) => {
                event.stopPropagation();
                this.sharing.openShareDialog(note.id);
            });
            actions.append(share);
        }
        const pin = document.createElement('button');
        pin.className = 'icon-button note-card-action' + (note.is_pinned ? ' is-active' : '');
        pin.type = 'button';
        pin.textContent = note.is_pinned ? '◆' : '◇';
        const pinLabel = t(note.is_pinned ? 'Unpin note' : 'Pin note');
        pin.title = pinLabel;
        pin.setAttribute('aria-label', pinLabel);
        pin.setAttribute('aria-pressed', note.is_pinned ? 'true' : 'false');
        pin.addEventListener('click', (event) => {
            event.stopPropagation();
            this.togglePin(note.id);
        });
        actions.append(pin);
        head.append(title, actions);
        const preview = document.createElement('p');
        preview.className = 'note-card-preview';
        appendHighlightedText(preview, note.content_preview, this.query.q);
        const footer = document.createElement('div');
        footer.className = 'note-card-footer';
        const labels = document.createElement('div');
        labels.className = 'note-labels';
        (note.labels || []).slice(0, 3).forEach((label) => {
            const chip = document.createElement('span');
            chip.className = 'label-chip';
            chip.textContent = label.name;
            labels.append(chip);
        });
        if ((note.labels || []).length > 3) {
            const more = document.createElement('span');
            more.className = 'label-chip';
            more.textContent = '+' + ((note.labels || []).length - 3);
            labels.append(more);
        }
        const metaGroup = document.createElement('div');
        metaGroup.className = 'note-card-meta-group';
        if (note.attachment_count) {
            const attachmentMark = document.createElement('span');
            attachmentMark.className = 'note-card-attachment';
            attachmentMark.textContent = '⌑ ' + note.attachment_count;
            attachmentMark.setAttribute('aria-label', note.attachment_count + ' attachments');
            metaGroup.append(attachmentMark);
        }
        const meta = document.createElement('span');
        meta.textContent = this.formatDate(note.updated_at);
        metaGroup.append(meta);
        footer.append(labels, metaGroup);
        card.append(head, preview, footer);
        return card;
    }

    renderPagination() {
        this.pagination.replaceChildren();
        if (this.meta.last_page <= 1) return;
        const previous = this.pageButton('‹', this.query.page - 1, this.query.page === 1);
        this.pagination.append(previous);
        for (let page = 1; page <= this.meta.last_page; page += 1) {
            if (page > 5 && page < this.meta.last_page) continue;
            this.pagination.append(
                this.pageButton(String(page), page, false, page === this.query.page),
            );
        }
        this.pagination.append(
            this.pageButton('›', this.query.page + 1, this.query.page === this.meta.last_page),
        );
    }

    pageButton(label, page, disabled, active = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'page-button' + (active ? ' is-active' : '');
        button.textContent = label;
        button.disabled = disabled;
        button.setAttribute('aria-label', 'Trang ' + page);
        button.addEventListener('click', () => {
            this.searchDebounce.cancel();
            this.query.page = page;
            this.loadNotes();
        });
        return button;
    }

    renderLabelFilters() {
        const list = this.root.querySelector('[data-label-filter-list]');
        list.replaceChildren();
        if (!this.labels.length) {
            const copy = document.createElement('p');
            copy.className = 'subtle-copy';
            copy.textContent = t('No tags yet');
            list.append(copy);
            return;
        }
        this.labels.forEach((label) => {
            const row = document.createElement('label');
            row.className = 'label-filter-option';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.value = String(label.id);
            input.checked = this.query.labelIds.includes(String(label.id));
            input.addEventListener('change', () => {
                this.searchDebounce.cancel();
                this.query.labelIds = Array.from(list.querySelectorAll('input:checked')).map(
                    (item) => item.value,
                );
                this.query.page = 1;
                this.loadNotes();
            });
            const text = document.createElement('span');
            text.textContent = label.name;
            row.append(input, text);
            list.append(row);
        });
    }

    renderActiveFilter() {
        const row = this.root.querySelector('[data-active-filter-row]');
        const copy = this.root.querySelector('[data-active-filter-copy]');
        const parts = [];
        if (this.query.q) parts.push(t('Search') + ' “' + this.query.q + '”');
        if (this.query.labelIds.length) parts.push(this.query.labelIds.length + ' selected tags');
        row.classList.toggle('is-hidden', parts.length === 0);
        copy.textContent = parts.join(' · ');
        this.root
            .querySelector('[data-filter-all]')
            .classList.toggle('is-active', parts.length === 0);
    }

    clearFilters() {
        this.searchDebounce.cancel();
        this.query = {
            q: '',
            labelIds: [],
            page: 1,
            sort: this.query?.sort || 'updated',
            direction: this.query?.direction || 'desc',
        };
        this.search.value = '';
        this.root.querySelector('[data-clear-search]').classList.add('is-hidden');
        this.renderLabelFilters();
        this.loadNotes();
    }

    async togglePin(noteId) {
        try {
            const detail = (await get('/api/v1/notes/' + encodeURIComponent(noteId))).payload.data;
            const result = await patch('/api/v1/notes/' + encodeURIComponent(noteId), {
                base_version: detail.version,
                title: detail.title,
                content: detail.content,
                color: detail.color,
                is_pinned: !detail.is_pinned,
                label_ids: (detail.labels || []).map((label) => label.id),
            });
            this.toast(result.payload.data.is_pinned ? 'Note pinned.' : 'Note unpinned.');
            this.loadNotes();
        } catch (error) {
            this.toast(error.message || 'The note changed. Try again.', true);
            this.loadNotes();
        }
    }

    applyView(view, persist) {
        this.preferences.notes_view = view;
        this.grid.classList.toggle('is-hidden', view !== 'grid');
        this.list.classList.toggle('is-hidden', view !== 'list');
        // One View button: it shows the layout it switches to.
        const toggle = this.root.querySelector('[data-view-toggle]');
        const nextLabel = t(view === 'grid' ? 'Show list view' : 'Show grid view');
        toggle.textContent = view === 'grid' ? '☷' : '▦';
        toggle.setAttribute('aria-label', t(nextLabel));
        toggle.title = t(nextLabel);
        if (persist) {
            patch('/api/v1/preferences', { notes_view: view }).catch(() =>
                this.toast('Unable to save the note layout.', true),
            );
        }
    }

    openLabelManager() {
        this.renderManagedLabels();
        this.labelDialog.classList.remove('is-hidden');
        this.labelBackdrop.classList.remove('is-hidden');
        this.labelDialog.querySelector('[data-label-create-input]').focus();
    }

    closeLabelManager() {
        this.labelDialog.classList.add('is-hidden');
        this.labelBackdrop.classList.add('is-hidden');
    }

    renderManagedLabels() {
        const list = this.labelDialog.querySelector('[data-managed-label-list]');
        list.replaceChildren();
        if (!this.labels.length) {
            const empty = document.createElement('p');
            empty.className = 'subtle-copy';
            empty.textContent = t('No tags yet.');
            list.append(empty);
            return;
        }
        this.labels.forEach((label) => {
            const row = document.createElement('div');
            row.className = 'managed-label-row';
            const name = document.createElement('span');
            name.className = 'managed-label-name';
            name.textContent = label.name;
            const actions = document.createElement('div');
            actions.className = 'managed-label-actions';
            const rename = document.createElement('button');
            rename.className = 'text-button';
            rename.type = 'button';
            rename.textContent = 'Rename';
            rename.addEventListener('click', () => this.renameLabel(label));
            const removeButton = document.createElement('button');
            removeButton.className = 'text-button';
            removeButton.type = 'button';
            removeButton.textContent = 'Delete';
            removeButton.addEventListener('click', () => this.deleteLabel(label));
            actions.append(rename, removeButton);
            row.append(name, actions);
            list.append(row);
        });
    }

    async createLabel(event) {
        event.preventDefault();
        const input = this.labelDialog.querySelector('[data-label-create-input]');
        const error = this.labelDialog.querySelector('[data-label-create-error]');
        try {
            await post('/api/v1/labels', { name: input.value });
            input.value = '';
            error.classList.add('is-hidden');
            await this.loadLabels();
            this.renderManagedLabels();
        } catch (requestError) {
            error.textContent = requestError.payload?.errors?.name?.[0] || requestError.message;
            error.classList.remove('is-hidden');
        }
    }

    async renameLabel(label) {
        const next = window.prompt('New tag name', label.name);
        if (next === null || next === label.name) return;
        try {
            await patch('/api/v1/labels/' + encodeURIComponent(label.id), {
                name: next,
                base_version: label.version,
            });
            await this.loadLabels();
            this.renderManagedLabels();
            this.loadNotes();
        } catch (error) {
            this.toast(error.message || 'Unable to rename the tag.', true);
        }
    }

    async deleteLabel(label) {
        if (
            !(await this.confirm(
                'Delete the tag “' + label.name + '”?',
                'Your notes will be kept.',
            ))
        )
            return;
        try {
            await remove('/api/v1/labels/' + encodeURIComponent(label.id), {
                base_version: label.version,
            });
            this.query.labelIds = this.query.labelIds.filter((id) => id !== String(label.id));
            await this.loadLabels();
            this.renderManagedLabels();
            this.loadNotes();
        } catch (error) {
            this.toast(error.message || 'Unable to delete the tag.', true);
        }
    }

    openConflict(machine) {
        if (
            this.conflictMachine === machine &&
            !this.conflictDialog.classList.contains('is-hidden')
        )
            return;
        this.conflictMachine = machine;
        const server = machine.state.conflictCurrent;
        const local = machine.state.draftSnapshot;
        this.conflictDialog.querySelector('[data-conflict-server-title]').textContent =
            server?.title || '';
        this.conflictDialog.querySelector('[data-conflict-server-content]').textContent =
            server?.content || '';
        this.conflictDialog.querySelector('[data-conflict-local-title]').textContent = local.title;
        this.conflictDialog.querySelector('[data-conflict-local-content]').textContent =
            local.content;
        this.conflictDialog.querySelector('[data-conflict-note]').textContent =
            'Keeping your draft will replace the displayed version after you confirm.';
        this.conflictDialog.classList.remove('is-hidden');
        this.conflictBackdrop.classList.remove('is-hidden');
    }

    closeConflict() {
        this.conflictDialog.classList.add('is-hidden');
        this.conflictBackdrop.classList.add('is-hidden');
    }

    confirm(title, message) {
        this.confirmDialog.querySelector('[data-confirm-title]').textContent = t(title);
        this.confirmDialog.querySelector('[data-confirm-message]').textContent = t(message);
        this.confirmDialog.classList.remove('is-hidden');
        this.confirmBackdrop.classList.remove('is-hidden');
        return new Promise((resolve) => {
            this.confirmResolve = resolve;
        });
    }

    resolveConfirm(value) {
        this.confirmDialog.classList.add('is-hidden');
        this.confirmBackdrop.classList.add('is-hidden');
        const resolve = this.confirmResolve;
        this.confirmResolve = null;
        resolve?.(value);
    }

    setFeedback(message, error = false) {
        this.feedback.textContent = t(message);
        this.feedback.classList.toggle('is-error', error);
    }

    formatDate(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat(
                document.documentElement.lang === 'vi' ? 'vi-VN' : 'en-US',
                {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                },
            ).format(new Date(value));
        } catch {
            return '';
        }
    }

    toast(message, error = false) {
        const region = document.querySelector('[data-toast-region]');
        const toast = document.createElement('div');
        toast.className = 'toast' + (error ? ' is-error' : '');
        toast.textContent = t(message);
        region.append(toast);
        window.setTimeout(() => toast.remove(), 3600);
    }
}
