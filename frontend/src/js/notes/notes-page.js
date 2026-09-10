import { get, patch, post, remove } from '../lib/http';
import { RecoveryStore } from '../lib/recovery-store';
import { NoteEditor } from './note-editor';

export class NotesPage {
    constructor(root) {
        this.root = root;
        this.bootstrap = window.notesBootstrap;
        this.user = this.bootstrap.user;
        this.preferences = { ...this.bootstrap.preferences };
        this.labels = [];
        this.notes = [];
        this.query = { q: '', labelIds: [], page: 1 };
        this.meta = { current_page: 1, last_page: 1, total: 0 };
        this.sequence = 0;
        this.abortController = null;
        this.searchTimer = null;
        this.editor = null;
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
        await this.loadLabels();
        await this.loadNotes();
        this.checkRecovery();
    }

    bindShell() {
        this.search = this.root.querySelector('[data-notes-search]');
        this.feedback = this.root.querySelector('[data-notes-feedback]');
        this.grid = this.root.querySelector('[data-notes-grid]');
        this.list = this.root.querySelector('[data-notes-list]');
        this.pagination = this.root.querySelector('[data-pagination]');
        this.total = this.root.querySelector('[data-note-total]');
        this.search.addEventListener('input', () => {
            window.clearTimeout(this.searchTimer);
            this.searchTimer = window.setTimeout(() => {
                this.query.q = this.search.value.normalize('NFC').trim();
                this.query.page = 1;
                this.loadNotes();
            }, 300);
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
        this.root.querySelectorAll('[data-view]').forEach((button) => {
            button.addEventListener('click', () => this.applyView(button.dataset.view, true));
        });
        this.root.querySelectorAll('[data-open-label-manager]').forEach((button) => {
            button.addEventListener('click', () => this.openLabelManager());
        });
        document
            .querySelector('[data-open-sidebar]')
            ?.addEventListener('click', () => this.toggleSidebar(true));
        document
            .querySelectorAll('[data-close-sidebar]')
            .forEach((button) => button.addEventListener('click', () => this.toggleSidebar(false)));
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
            this.toast('Phiên đăng nhập đã thay đổi. Hãy mở lại ghi chú.', true);
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
            this.toast(error.message || 'Không thể tải nhãn.', true);
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
        const seq = ++this.sequence;
        this.abortController?.abort();
        this.abortController = new AbortController();
        this.setFeedback('Đang tải ghi chú…');
        const params = new URLSearchParams();
        if (this.query.q) params.set('q', this.query.q);
        this.query.labelIds.forEach((id) => params.append('label_ids[]', id));
        params.set('page', String(this.query.page));
        try {
            const result = await get('/api/v1/notes?' + params.toString(), {
                signal: this.abortController.signal,
            });
            if (seq !== this.sequence) return;
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
            if (
                seq !== this.sequence ||
                (error.code === 'NETWORK_ERROR' &&
                    error.status === 0 &&
                    this.abortController?.signal.aborted)
            )
                return;
            this.setFeedback(error.message || 'Không thể tải ghi chú. Hãy thử lại.', true);
        }
    }

    renderNotes() {
        this.grid.replaceChildren();
        this.list.replaceChildren();
        this.notes.forEach((note) => {
            this.grid.append(this.createCard(note));
            this.list.append(this.createCard(note));
        });
        if (!this.notes.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            const title = document.createElement('h2');
            title.textContent =
                this.query.q || this.query.labelIds.length
                    ? 'Không tìm thấy ghi chú'
                    : 'Chưa có ghi chú nào';
            const copy = document.createElement('p');
            copy.textContent =
                this.query.q || this.query.labelIds.length
                    ? 'Thử xóa bớt bộ lọc hoặc tìm một từ khác.'
                    : 'Bắt đầu bằng một điều bạn muốn giữ lại.';
            empty.append(title, copy);
            this.grid.append(empty.cloneNode(true));
            this.list.append(empty);
        }
        this.renderPagination();
    }

    createCard(note) {
        const card = document.createElement('article');
        card.className = 'note-card';
        card.dataset.noteId = note.id;
        card.dataset.noteColor = note.color;
        const head = document.createElement('div');
        head.className = 'note-card-head';
        const title = document.createElement('h2');
        title.className = 'note-card-title';
        title.textContent = note.title;
        const actions = document.createElement('div');
        actions.className = 'note-card-actions';
        const pin = document.createElement('button');
        pin.className = 'icon-button';
        pin.type = 'button';
        pin.textContent = note.is_pinned ? '◆' : '◇';
        pin.setAttribute('aria-label', note.is_pinned ? 'Bỏ ghim ghi chú' : 'Ghim ghi chú');
        pin.addEventListener('click', (event) => {
            event.stopPropagation();
            this.togglePin(note.id);
        });
        actions.append(pin);
        head.append(title, actions);
        const preview = document.createElement('p');
        preview.className = 'note-card-preview';
        preview.textContent = note.content_preview;
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
        const meta = document.createElement('span');
        meta.textContent = this.formatDate(note.updated_at);
        footer.append(labels, meta);
        if (note.is_pinned) {
            const pinMark = document.createElement('span');
            pinMark.className = 'note-card-pin';
            pinMark.textContent = '◆';
            pinMark.setAttribute('aria-label', 'Đã ghim');
            footer.prepend(pinMark);
        }
        if (note.attachment_count) {
            const attachmentMark = document.createElement('span');
            attachmentMark.className = 'note-card-attachment';
            attachmentMark.textContent = '⌑ ' + note.attachment_count;
            attachmentMark.setAttribute('aria-label', note.attachment_count + ' tệp đính kèm');
            footer.append(attachmentMark);
        }
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
            copy.textContent = 'Chưa có nhãn';
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
        if (this.query.q) parts.push('Tìm “' + this.query.q + '”');
        if (this.query.labelIds.length) parts.push(this.query.labelIds.length + ' nhãn đã chọn');
        row.classList.toggle('is-hidden', parts.length === 0);
        copy.textContent = parts.join(' · ');
        this.root
            .querySelector('[data-filter-all]')
            .classList.toggle('is-active', parts.length === 0);
    }

    clearFilters() {
        this.query = { q: '', labelIds: [], page: 1 };
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
            this.toast(result.payload.data.is_pinned ? 'Đã ghim ghi chú.' : 'Đã bỏ ghim ghi chú.');
            this.loadNotes();
        } catch (error) {
            this.toast(error.message || 'Ghi chú đã thay đổi. Hãy thử lại.', true);
            this.loadNotes();
        }
    }

    applyView(view, persist) {
        this.preferences.notes_view = view;
        this.grid.classList.toggle('is-hidden', view !== 'grid');
        this.list.classList.toggle('is-hidden', view !== 'list');
        this.root.querySelectorAll('[data-view]').forEach((button) => {
            const selected = button.dataset.view === view;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        if (persist) {
            patch('/api/v1/preferences', { notes_view: view }).catch(() =>
                this.toast('Không lưu được kiểu hiển thị.', true),
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
            empty.textContent = 'Chưa có nhãn nào.';
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
            rename.textContent = 'Đổi tên';
            rename.addEventListener('click', () => this.renameLabel(label));
            const removeButton = document.createElement('button');
            removeButton.className = 'text-button';
            removeButton.type = 'button';
            removeButton.textContent = 'Xóa';
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
        const next = window.prompt('Tên nhãn mới', label.name);
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
            this.toast(error.message || 'Không thể đổi tên nhãn.', true);
        }
    }

    async deleteLabel(label) {
        if (
            !(await this.confirm('Xóa nhãn “' + label.name + '”?', 'Các ghi chú vẫn được giữ lại.'))
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
            this.toast(error.message || 'Không thể xóa nhãn.', true);
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
            'Giữ bản đang soạn sẽ thay thế phiên bản hiển thị sau khi bạn xác nhận.';
        this.conflictDialog.classList.remove('is-hidden');
        this.conflictBackdrop.classList.remove('is-hidden');
    }

    closeConflict() {
        this.conflictDialog.classList.add('is-hidden');
        this.conflictBackdrop.classList.add('is-hidden');
    }

    confirm(title, message) {
        this.confirmDialog.querySelector('[data-confirm-title]').textContent = title;
        this.confirmDialog.querySelector('[data-confirm-message]').textContent = message;
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
        this.feedback.textContent = message;
        this.feedback.classList.toggle('is-error', error);
    }

    formatDate(value) {
        if (!value) return '';
        try {
            return new Intl.DateTimeFormat('vi-VN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            }).format(new Date(value));
        } catch {
            return '';
        }
    }

    toast(message, error = false) {
        const region = document.querySelector('[data-toast-region]');
        const toast = document.createElement('div');
        toast.className = 'toast' + (error ? ' is-error' : '');
        toast.textContent = message;
        region.append(toast);
        window.setTimeout(() => toast.remove(), 3600);
    }

    toggleSidebar(open) {
        document.querySelector('.app-sidebar')?.classList.toggle('is-open', open);
        document.querySelector('.sidebar-scrim')?.classList.toggle('is-visible', open);
    }
}
