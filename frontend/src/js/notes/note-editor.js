import { get, patch, post, remove, upload } from '../lib/http';
import { RecoveryStore } from '../lib/recovery-store';
import {
    normalizeSnapshot,
    snapshotFromNote,
    snapshotsEqual,
    validateSnapshot,
} from '../lib/normalization';
import { AutosaveMachine } from './autosave-machine';

export class NoteEditor {
    constructor({ root, userId, preferences, getLabels, onChanged, confirm, toast, onConflict }) {
        this.root = root;
        this.userId = String(userId);
        this.preferences = preferences;
        this.getLabels = getLabels;
        this.onChanged = onChanged;
        this.confirm = confirm;
        this.toast = toast;
        this.onConflict = onConflict;
        this.generation = 0;
        this.machine = null;
        this.note = null;
        this.pendingClose = false;
        this.closeResolve = null;
        this.uploadQueue = [];
        this.uploadActive = null;
        this.uploadAbortController = null;

        this.backdrop = document.querySelector('[data-editor-dialog-backdrop]');
        this.title = root.querySelector('[data-editor-title]');
        this.content = root.querySelector('[data-editor-content]');
        this.status = root.querySelector('[data-editor-status]');
        this.meta = root.querySelector('[data-editor-meta]');
        this.heading = root.querySelector('[data-editor-heading]');
        this.eyebrow = root.querySelector('[data-editor-eyebrow]');
        this.titleError = root.querySelector('[data-editor-title-error]');
        this.contentError = root.querySelector('[data-editor-content-error]');
        this.pinButton = root.querySelector('[data-editor-pin]');
        this.pinLabel = root.querySelector('[data-pin-label]');
        this.deleteButton = root.querySelector('[data-editor-delete]');
        this.labelPopover = root.querySelector('[data-editor-label-popover]');
        this.labelList = root.querySelector('[data-editor-label-list]');
        this.labelCount = root.querySelector('[data-label-selection-count]');
        this.attachmentsSection = root.querySelector('[data-attachments-section]');
        this.attachmentList = root.querySelector('[data-attachment-list]');
        this.attachmentCount = root.querySelector('[data-attachment-count]');
        this.bind();
    }

    bind() {
        this.title.addEventListener('input', () => this.input());
        this.content.addEventListener('input', () => this.input());
        this.title.addEventListener('compositionstart', () => this.machine?.compositionStart());
        this.content.addEventListener('compositionstart', () => this.machine?.compositionStart());
        this.title.addEventListener('compositionend', () => this.machine?.compositionEnd());
        this.content.addEventListener('compositionend', () => this.machine?.compositionEnd());
        this.root
            .querySelector('[data-close-editor]')
            .addEventListener('click', () => this.requestClose());
        this.pinButton.addEventListener('click', () => this.togglePin());
        this.deleteButton.addEventListener('click', () => this.deleteNote());
        this.root.querySelector('[data-editor-labels]').addEventListener('click', () => {
            this.labelPopover.classList.toggle('is-hidden');
        });
        this.root.querySelectorAll('[data-color]').forEach((button) => {
            button.addEventListener('click', () => this.setColor(button.dataset.color));
        });
        this.root.querySelectorAll('[data-open-label-manager]').forEach((button) => {
            button.addEventListener('click', () => {
                this.labelPopover.classList.add('is-hidden');
                document.dispatchEvent(new CustomEvent('notes:open-labels'));
            });
        });
        this.root.querySelector('[data-attachment-input]')?.addEventListener('change', (event) => {
            document.dispatchEvent(
                new CustomEvent('notes:upload-files', { detail: { files: event.target.files } }),
            );
            event.target.value = '';
        });
        this.beforeUnload = (event) => {
            if (
                !this.machine ||
                (!this.machine.isDirty() && !this.uploadActive && this.uploadQueue.length === 0)
            )
                return;
            event.preventDefault();
            event.returnValue = '';
        };
        window.addEventListener('beforeunload', this.beforeUnload);
        window.addEventListener('online', () => this.machine?.resumeRetry());
        this.root
            .querySelector('[data-recheck-session]')
            .addEventListener('click', () => this.recheckSession());
        this.root
            .querySelector('[data-retry-save]')
            .addEventListener('click', () => this.machine?.retry());
        window.addEventListener('focus', () => {
            if (this.machine?.phase === 'auth_expired') this.recheckSession();
        });
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.machine?.phase === 'auth_expired') this.recheckSession();
        });
    }

    async openNew() {
        this.dispose();
        this.note = null;
        this.show();
        this.heading.textContent = 'Viết điều bạn muốn giữ lại';
        this.eyebrow.textContent = 'Ghi chú mới';
        this.writeFields({ title: '', content: '' });
        this.machine = this.createMachine(
            {
                id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
                title: '',
                content: '',
                color: this.preferences.default_note_color,
                is_pinned: false,
                version: null,
                labels: [],
            },
            false,
        );
        this.renderState(this.machine.state);
        this.title.focus();
    }

    async openExisting(noteId) {
        this.dispose();
        const generation = this.generation;
        this.show();
        this.heading.textContent = 'Đang mở ghi chú…';
        this.eyebrow.textContent = 'Ghi chú';
        this.setStatus('Đang tải…');
        try {
            const result = await get('/api/v1/notes/' + encodeURIComponent(noteId));
            if (generation !== this.generation) return;
            this.note = result.payload.data;
            this.writeFields(this.note);
            this.machine = this.createMachine(this.note, true);
            this.heading.textContent = this.note.title || 'Ghi chú không có tiêu đề';
            this.eyebrow.textContent = 'Đang chỉnh sửa';
            this.renderState(this.machine.state);
            this.title.focus();
        } catch (error) {
            if (generation !== this.generation) return;
            this.hide();
            this.toast(error.message || 'Không thể mở ghi chú.', true);
        }
    }

    createMachine(note, persisted) {
        const recovery = new RecoveryStore({ userId: this.userId });
        const machine = new AutosaveMachine({
            userId: this.userId,
            noteId: String(note.id),
            editorGeneration: this.generation,
            persisted,
            baseVersion: persisted ? note.version : null,
            snapshot: {
                title: note.title,
                content: note.content,
                color: note.color,
                is_pinned: note.is_pinned,
                label_ids: (note.labels || []).map((label) => label.id),
            },
            recovery,
            transport: (request) => this.send(request),
            onChange: (state) => this.renderState(state),
        });
        return machine;
    }

    async send(request) {
        if (request.kind === 'create') {
            const result = await post('/api/v1/notes', {
                id: request.noteId,
                title: request.sentSnapshot.title,
                content: request.sentSnapshot.content,
                color: request.sentSnapshot.color,
            });
            return result.payload;
        }
        const result = await patch('/api/v1/notes/' + encodeURIComponent(request.noteId), {
            base_version: request.baseVersion,
            title: request.sentSnapshot.title,
            content: request.sentSnapshot.content,
            color: request.sentSnapshot.color,
            is_pinned: request.sentSnapshot.is_pinned,
            label_ids: request.sentSnapshot.label_ids,
        });
        return result.payload;
    }

    input() {
        if (!this.machine) return;
        this.machine.input({ title: this.title.value, content: this.content.value });
    }

    togglePin() {
        if (!this.machine) return;
        this.machine.input({ is_pinned: !this.machine.state.draftSnapshot.is_pinned });
    }

    setColor(color) {
        this.machine?.input({ color });
    }

    setLabels(labelIds) {
        this.machine?.input({ label_ids: labelIds });
    }

    renderState(state) {
        if (!this.machine) return;
        const locked = ['auth_expired', 'unavailable', 'closing'].includes(state.phase);
        this.title.readOnly = locked;
        this.content.readOnly = locked;
        this.root
            .querySelector('[data-session-recovery]')
            .classList.toggle('is-hidden', state.phase !== 'auth_expired');
        this.root
            .querySelector('[data-retry-save]')
            .classList.toggle('is-hidden', !['error', 'retry_wait'].includes(state.phase));
        this.root
            .querySelectorAll(
                '[data-editor-pin], [data-editor-labels], [data-color], [data-attachment-input]',
            )
            .forEach((control) => {
                control.disabled = locked || !state.persisted;
            });
        const note = state.acknowledgedNote || this.note;
        if (note) {
            this.note = note;
            this.heading.textContent = note.title || 'Ghi chú không có tiêu đề';
            this.deleteButton.classList.toggle('is-hidden', !state.persisted);
            this.attachmentsSection.classList.toggle('is-hidden', !state.persisted);
            this.renderAttachments(note.attachments || []);
        } else {
            this.deleteButton.classList.add('is-hidden');
            this.attachmentsSection.classList.add('is-hidden');
            this.renderAttachments([]);
        }
        const labels = state.draftSnapshot.label_ids;
        this.renderLabels(labels);
        this.root.querySelectorAll('[data-color]').forEach((button) => {
            const selected = button.dataset.color === state.draftSnapshot.color;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        this.pinButton.setAttribute(
            'aria-pressed',
            state.draftSnapshot.is_pinned ? 'true' : 'false',
        );
        this.pinLabel.textContent = state.draftSnapshot.is_pinned ? 'Bỏ ghim' : 'Ghim';
        this.titleError.textContent = state.validationErrors.title || '';
        this.titleError.classList.toggle('is-hidden', !state.validationErrors.title);
        this.contentError.textContent = state.validationErrors.content || '';
        this.contentError.classList.toggle('is-hidden', !state.validationErrors.content);

        const copy =
            {
                loading: 'Đang tải…',
                pristine: '',
                incomplete: 'Chưa đủ thông tin',
                dirty: 'Đang chờ lưu…',
                saving: 'Đang lưu…',
                saved: 'Đã lưu',
                retry_wait: 'Mất kết nối · sẽ thử lại',
                error: 'Chưa lưu được · thử lại',
                conflict: 'Cần chọn phiên bản',
                auth_expired: 'Phiên đã hết hạn',
                unavailable: 'Ghi chú không còn khả dụng',
            }[state.phase] || '';
        this.setStatus(
            copy,
            ['error', 'conflict', 'auth_expired', 'unavailable'].includes(state.phase),
        );
        if (state.phase === 'conflict') this.onConflict(this.machine);
        this.meta.textContent = state.persisted ? 'Phiên bản ' + state.baseVersion : 'Bản nháp mới';
        if (state.recoveryAvailable === false)
            this.meta.textContent += ' · khôi phục tạm thời không khả dụng';
        if (state.phase === 'saved') this.onChanged?.(this.note);
        if (this.pendingClose && state.phase === 'saved') {
            this.pendingClose = false;
            this.hide();
            this.closeResolve?.(true);
            this.closeResolve = null;
        } else if (this.pendingClose && !['saving', 'retry_wait'].includes(state.phase)) {
            this.pendingClose = false;
            this.closeResolve?.(false);
            this.closeResolve = null;
        }
        this.syncUnloadGuard();
    }

    renderLabels(selectedIds) {
        const labels = this.getLabels();
        this.labelList.replaceChildren();
        labels.forEach((label) => {
            const row = document.createElement('label');
            row.className = 'editor-label-check';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedIds.includes(String(label.id));
            checkbox.addEventListener('change', () => {
                const next = Array.from(this.labelList.querySelectorAll('input:checked')).map(
                    (input) => input.value,
                );
                this.setLabels(next);
            });
            checkbox.value = String(label.id);
            const text = document.createElement('span');
            text.textContent = label.name;
            row.append(checkbox, text);
            this.labelList.append(row);
        });
        this.labelCount.textContent = selectedIds.length + '/20';
    }

    setStatus(text, error = false) {
        this.status.textContent = text;
        this.status.classList.toggle('is-error', error);
        this.status.classList.toggle('is-success', text === 'Đã lưu');
    }

    writeFields(note) {
        this.title.value = note.title || '';
        this.content.value = note.content || '';
        this.root.querySelectorAll('[data-color]').forEach((button) => {
            const selected = button.dataset.color === (note.color || 'neutral');
            button.classList.toggle('is-selected', selected);
        });
    }

    syncFieldsFromDraft() {
        if (!this.machine) return;
        const snapshot = this.machine.state.draftSnapshot;
        this.title.value = snapshot.title;
        this.content.value = snapshot.content;
    }

    syncUnloadGuard() {
        // The handler is registered once because a modal can be reopened many
        // times; its decision is always derived from the current machine.
        return (
            this.machine &&
            (this.machine.isDirty() || this.uploadActive || this.uploadQueue.length > 0)
        );
    }

    async requestOpen(noteId) {
        if (!this.machine || this.root.classList.contains('is-hidden')) {
            return this.openExisting(noteId);
        }
        if (String(this.machine.noteId) === String(noteId)) return undefined;
        if (!(await this.requestClose())) return undefined;
        return this.openExisting(noteId);
    }

    async requestNew() {
        if (
            this.machine &&
            !this.root.classList.contains('is-hidden') &&
            !(await this.requestClose())
        )
            return;
        return this.openNew();
    }

    async requestClose() {
        if (!this.machine) {
            this.hide();
            return true;
        }
        if (this.uploadActive || this.uploadQueue.length > 0) {
            const leaveWhileUploading = await this.confirm(
                'Tệp đang được tải lên',
                'Rời đi sẽ hủy các lượt tải đang chờ. Tệp đã tới máy chủ sẽ được đối soát khi mở lại ghi chú.',
            );
            if (!leaveWhileUploading) return false;
            this.cancelUploads();
        }
        if (this.machine.phase === 'pristine' || this.machine.phase === 'saved') {
            this.hide();
            return true;
        }
        if (this.machine.phase === 'saving') {
            this.pendingClose = true;
            this.setStatus('Đang hoàn tất lưu trước khi đóng…');
            return new Promise((resolve) => {
                this.closeResolve = resolve;
            });
        }
        if (this.machine.phase === 'retry_wait') {
            const leaveUnknown = await this.confirm(
                'Chưa xác nhận được lần lưu',
                'Máy chủ có thể đã nhận dữ liệu. Bỏ bản nháp và rời đi không hoàn tác dữ liệu đã gửi. Chọn Hủy để tiếp tục chờ lưu.',
            );
            if (!leaveUnknown) return false;
            this.machine.discard();
            this.hide();
            return true;
        }
        if (this.machine.phase === 'dirty' || this.machine.phase === 'incomplete') {
            if (this.machine.phase === 'dirty') {
                this.pendingClose = true;
                this.machine.flush();
                if (this.machine.phase === 'saving' || this.machine.phase === 'retry_wait') {
                    this.setStatus('Đang hoàn tất lưu trước khi đóng…');
                    return new Promise((resolve) => {
                        this.closeResolve = resolve;
                    });
                }
                if (this.machine.phase === 'saved') return true;
            }
            const leave = await this.confirm(
                'Rời ghi chú này?',
                'Bỏ thay đổi chưa lưu và rời đi? Bản nháp trong cửa sổ này sẽ bị xóa. Chọn Hủy để tiếp tục chỉnh sửa.',
            );
            if (leave) {
                this.machine.discard();
                this.hide();
                return true;
            }
            return false;
        }
        const leave = await this.confirm(
            'Rời ghi chú này?',
            'Bỏ thay đổi chưa lưu và rời đi? Bản nháp sẽ bị xóa; dữ liệu đã gửi lên máy chủ không được hoàn tác.',
        );
        if (leave) {
            this.machine.discard();
            this.hide();
            return true;
        }
        return false;
    }

    async recover(record) {
        // Reconstruct the original identity and base revision before reading
        // the server; a fresh GET is not consent to overwrite another tab.
        this.dispose();
        this.note = null;
        this.show();
        this.heading.textContent = 'Viết điều bạn muốn giữ lại';
        this.eyebrow.textContent = 'Bản nháp khôi phục';
        const snapshot = normalizeSnapshot(record.draftSnapshot);
        this.writeFields(snapshot);
        this.machine = this.createMachine(
            {
                id: String(record.noteId),
                title: snapshot.title,
                content: snapshot.content,
                color: snapshot.color,
                is_pinned: snapshot.is_pinned,
                version: null,
                labels: this.getLabels().filter((label) =>
                    snapshot.label_ids.includes(String(label.id)),
                ),
            },
            false,
        );
        this.machine.restore(record);
        this.renderState(this.machine.state);
        await this.recheckSession();
        this.title.focus();
    }

    async recheckSession() {
        const machine = this.machine;
        if (!machine || this.recheckingSession) return;
        this.recheckingSession = true;
        try {
            const session = (await get('/api/v1/session')).payload.data;
            if (this.machine !== machine) return;
            if (String(session.user.id) !== this.userId) {
                RecoveryStore.clearAll();
                this.hide();
                this.writeFields({});
                window.location.assign('/');
                return;
            }
            document
                .querySelector('meta[name="csrf-token"]')
                .setAttribute('content', session.csrf_token);
            window.notesBootstrap.csrf_token = session.csrf_token;
            let current = null;
            try {
                current = (await get('/api/v1/notes/' + encodeURIComponent(machine.noteId))).payload
                    .data;
            } catch (error) {
                if (![404, 410].includes(error.status)) throw error;
            }
            if (this.machine === machine) machine.reconcile(current);
        } catch (error) {
            if (this.machine === machine)
                this.setStatus(error.message || 'Không thể kiểm tra phiên. Hãy thử lại.', true);
        } finally {
            this.recheckingSession = false;
        }
    }

    async uploadFiles(fileList) {
        if (!this.machine?.state.persisted) {
            this.toast('Hãy chờ ghi chú được lưu lần đầu rồi thêm tệp.', true);
            return;
        }
        for (const file of Array.from(fileList || [])) {
            this.uploadQueue.push({
                id: globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random(),
                file,
                status: 'pending',
                progress: 0,
                error: '',
            });
        }
        this.renderAttachments(this.note?.attachments || []);
        this.processUploads();
    }

    async processUploads() {
        if (this.uploadActive || !this.machine?.state.persisted) return;
        const editorMachine = this.machine;
        const item = this.uploadQueue.find((candidate) => candidate.status === 'pending');
        if (!item) return;
        this.uploadActive = item;
        item.status = 'uploading';
        this.uploadAbortController = new AbortController();
        this.renderAttachments(this.note?.attachments || []);
        try {
            const form = new FormData();
            form.append('id', item.id);
            form.append('file', item.file, item.file.name);
            await upload(
                '/api/v1/notes/' + encodeURIComponent(editorMachine.noteId) + '/attachments',
                form,
                {
                    signal: this.uploadAbortController.signal,
                    onProgress: (progress) => {
                        item.progress = progress;
                        this.renderAttachments(this.note?.attachments || []);
                    },
                },
            );
            item.status = 'complete';
            if (this.machine === editorMachine) await this.refreshAttachments(editorMachine);
        } catch (error) {
            if (item.status !== 'cancelled') {
                item.status = 'error';
                item.error = error.message || 'Không thể tải tệp.';
            }
        } finally {
            if (this.uploadActive === item) {
                this.uploadActive = null;
                this.uploadAbortController = null;
                this.uploadQueue = this.uploadQueue.filter(
                    (candidate) =>
                        candidate.status !== 'complete' && candidate.status !== 'cancelled',
                );
                if (this.machine === editorMachine)
                    this.renderAttachments(this.note?.attachments || []);
            }
            this.processUploads();
        }
    }

    retryUpload(item) {
        item.status = 'pending';
        item.progress = 0;
        item.error = '';
        this.renderAttachments(this.note?.attachments || []);
        this.processUploads();
    }

    cancelUpload(item) {
        if (this.uploadActive === item) {
            item.status = 'cancelled';
            this.uploadAbortController?.abort();
        } else {
            item.status = 'cancelled';
            this.uploadQueue = this.uploadQueue.filter((candidate) => candidate !== item);
            this.renderAttachments(this.note?.attachments || []);
        }
    }

    cancelUploads() {
        this.uploadQueue.forEach((item) => {
            item.status = 'cancelled';
        });
        this.uploadAbortController?.abort();
        this.uploadQueue = [];
        this.uploadActive = null;
        this.renderAttachments(this.note?.attachments || []);
    }

    async refreshAttachments(editorMachine = this.machine) {
        if (!editorMachine?.state.persisted) return;
        const result = await get(
            '/api/v1/notes/' + encodeURIComponent(editorMachine.noteId) + '/attachments',
        );
        if (this.machine !== editorMachine) return;
        this.note = { ...(this.note || {}), attachments: result.payload.data || [] };
        this.renderAttachments(this.note.attachments);
        this.onChanged?.(this.note);
    }

    renderAttachments(attachments) {
        if (!this.attachmentList || !this.attachmentCount) return;
        this.attachmentList.replaceChildren();
        const rows = Array.isArray(attachments) ? attachments : [];
        this.attachmentCount.textContent = rows.length ? rows.length + '/20' : '';
        rows.forEach((attachment) => this.attachmentList.append(this.attachmentRow(attachment)));
        this.uploadQueue.forEach((item) =>
            this.attachmentList.append(this.pendingAttachmentRow(item)),
        );
    }

    attachmentRow(attachment) {
        const row = document.createElement('div');
        row.className = 'attachment-row';
        if (attachment.kind === 'image' && attachment.preview_url) {
            const image = document.createElement('img');
            image.src = attachment.preview_url;
            image.alt = attachment.original_name;
            row.append(image);
        } else if (attachment.kind === 'video' && attachment.preview_url) {
            const video = document.createElement('video');
            video.src = attachment.preview_url;
            video.controls = true;
            video.preload = 'metadata';
            row.append(video);
        }
        const copy = document.createElement('div');
        copy.className = 'attachment-row-copy';
        const name = document.createElement('strong');
        name.textContent = attachment.original_name;
        const meta = document.createElement('small');
        meta.textContent = this.formatBytes(attachment.size_bytes);
        copy.append(name, meta);
        const download = document.createElement('a');
        download.className = 'text-button';
        download.href = attachment.download_url;
        download.textContent = 'Tải';
        download.setAttribute('download', attachment.original_name);
        const removeButton = document.createElement('button');
        removeButton.className = 'icon-button';
        removeButton.type = 'button';
        removeButton.textContent = '×';
        removeButton.setAttribute('aria-label', 'Xóa ' + attachment.original_name);
        removeButton.addEventListener('click', () => this.deleteAttachment(attachment));
        row.append(copy, download, removeButton);
        return row;
    }

    pendingAttachmentRow(item) {
        const row = document.createElement('div');
        row.className = 'attachment-row attachment-row-pending';
        const copy = document.createElement('div');
        copy.className = 'attachment-row-copy';
        const name = document.createElement('strong');
        name.textContent = item.file.name;
        const meta = document.createElement('small');
        meta.textContent =
            item.status === 'uploading'
                ? 'Đang tải ' + item.progress + '%'
                : item.status === 'error'
                  ? item.error
                  : 'Đang chờ';
        copy.append(name, meta);
        let retry = null;
        if (item.status === 'error') {
            retry = document.createElement('button');
            retry.className = 'text-button';
            retry.type = 'button';
            retry.textContent = 'Thử lại';
            retry.addEventListener('click', () => this.retryUpload(item));
        }
        const cancel = document.createElement('button');
        cancel.className = 'icon-button';
        cancel.type = 'button';
        cancel.textContent = '×';
        cancel.setAttribute('aria-label', 'Hủy tải ' + item.file.name);
        cancel.addEventListener('click', () => this.cancelUpload(item));
        row.append(copy);
        if (retry) row.append(retry);
        row.append(cancel);
        return row;
    }

    formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (value < 1024) return value + ' B';
        if (value < 1024 * 1024) return Math.round(value / 1024) + ' KB';
        return (value / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async deleteAttachment(attachment) {
        if (!(await this.confirm('Xóa tệp này?', 'Tệp sẽ bị xóa khỏi ghi chú.'))) return;
        try {
            await remove(
                '/api/v1/notes/' +
                    encodeURIComponent(this.machine.noteId) +
                    '/attachments/' +
                    encodeURIComponent(attachment.id),
            );
            await this.refreshAttachments();
            this.toast('Đã xóa tệp.');
        } catch (error) {
            this.toast(error.message || 'Không thể xóa tệp.', true);
        }
    }

    async deleteNote() {
        if (!this.machine?.state.persisted || !this.note) return;
        const accepted = await this.confirm(
            'Xóa ghi chú này?',
            'Ghi chú sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.',
        );
        if (!accepted) return;
        try {
            await remove('/api/v1/notes/' + encodeURIComponent(this.machine.noteId), {
                base_version: this.machine.baseVersion,
            });
            this.machine.discard();
            this.hide();
            this.onChanged?.();
            this.toast('Đã xóa ghi chú.');
        } catch (error) {
            if (error.status === 409 && error.payload?.current) {
                this.machine.conflictCurrent = error.payload.current;
                this.machine.phase = 'conflict';
                this.machine.emit();
            } else this.toast(error.message || 'Không thể xóa ghi chú.', true);
        }
    }

    show() {
        this.root.classList.remove('is-hidden');
        this.backdrop.classList.remove('is-hidden');
        document.body.classList.add('modal-open');
    }

    hide() {
        this.dispose();
        this.root.classList.add('is-hidden');
        this.backdrop.classList.add('is-hidden');
        document.body.classList.remove('modal-open');
    }

    dispose() {
        this.generation += 1;
        this.machine?.dispose();
        this.uploadAbortController?.abort();
        this.uploadQueue = [];
        this.uploadActive = null;
        this.machine = null;
        this.note = null;
        this.pendingClose = false;
    }
}
