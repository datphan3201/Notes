import { get, patch, post, put, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';

const firstError = (error, field) =>
    error?.payload?.errors?.[field]?.[0] ||
    Object.values(error?.payload?.errors || {})[0]?.[0] ||
    error?.message ||
    t('Something went wrong. Try again.');

function relativeTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const locale = document.documentElement.lang === 'vi' ? 'vi-VN' : 'en-US';
    const seconds = Math.round((date.getTime() - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const [unit, size] of [
        ['year', 31536000],
        ['month', 2592000],
        ['day', 86400],
        ['hour', 3600],
        ['minute', 60],
    ]) {
        if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
    }
    return format.format(0, 'second');
}

export { relativeTime };

/**
 * Per-Note password dialogs: the unlock prompt shown before any action on a
 * locked Note, and the owner's enable / change / remove dialog.
 */
export class NoteLockUI {
    constructor() {
        this.unlockDialog = document.querySelector('[data-unlock-dialog]');
        this.lockDialog = document.querySelector('[data-lock-dialog]');
        this.unlockDialog
            ?.querySelectorAll('[data-unlock-cancel]')
            .forEach((button) => button.addEventListener('click', () => this.finishUnlock(false)));
        this.unlockDialog?.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.finishUnlock(false);
        });
        this.unlockDialog
            ?.querySelector('[data-unlock-form]')
            .addEventListener('submit', (event) => this.submitUnlock(event));
        this.lockDialog
            ?.querySelectorAll('[data-lock-close]')
            .forEach((button) => button.addEventListener('click', () => this.finishLock(null)));
        this.lockDialog?.addEventListener('cancel', (event) => {
            event.preventDefault();
            this.finishLock(null);
        });
        this.lockDialog
            ?.querySelectorAll('[data-lock-mode]')
            .forEach((button) =>
                button.addEventListener('click', () => this.setMode(button.dataset.lockMode)),
            );
        this.lockDialog
            ?.querySelector('[data-lock-form]')
            .addEventListener('submit', (event) => this.submitLock(event));
    }

    /** Asks for the password of a locked Note; resolves true once this session may use it. */
    unlock(noteId, title = '') {
        this.unlockNoteId = noteId;
        const form = this.unlockDialog.querySelector('[data-unlock-form]');
        form.reset();
        this.unlockError('');
        this.unlockDialog.querySelector('[data-unlock-title]').textContent = title
            ? `${t('Unlock')} “${title}”`
            : t("Enter this note's password");
        this.unlockDialog.showModal();
        form.elements.password.focus();
        return new Promise((resolve) => {
            this.unlockResolve = resolve;
        });
    }

    /**
     * Runs `action` on a possibly locked Note. When the caller already knows the
     * Note is locked, the password is asked first; otherwise a 423 answer asks
     * for it and runs the action once more. Resolves undefined when cancelled.
     */
    async withUnlock(noteId, action, title = '', { locked = false } = {}) {
        if (locked && !(await this.unlock(noteId, title))) return undefined;
        try {
            return await action();
        } catch (error) {
            if (error?.status !== 423) throw error;
            if (!(await this.unlock(noteId, title))) return undefined;
            return action();
        }
    }

    async submitUnlock(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const password = form.elements.password.value;
        if (!password) {
            this.unlockError(t('Enter the password.'));
            return;
        }
        const submit = form.querySelector('[data-unlock-submit]');
        submit.disabled = true;
        try {
            await post(`/api/v1/notes/${encodeURIComponent(this.unlockNoteId)}/unlock`, {
                password,
            });
            this.finishUnlock(true);
        } catch (error) {
            this.unlockError(
                error.status === 429
                    ? t('Too many wrong passwords. Wait a few minutes and try again.')
                    : firstError(error, 'password'),
            );
            form.elements.password.select();
        } finally {
            submit.disabled = false;
        }
    }

    unlockError(message) {
        const node = this.unlockDialog.querySelector('[data-unlock-error]');
        node.textContent = t(message);
        node.classList.toggle('is-hidden', !message);
        this.unlockDialog
            .querySelector('#unlock-password')
            .setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    finishUnlock(value) {
        if (this.unlockDialog.open) this.unlockDialog.close();
        const resolve = this.unlockResolve;
        this.unlockResolve = null;
        resolve?.(value);
    }

    /** Owner dialog. Resolves with the server's lock result, or null when cancelled. */
    manage(note) {
        this.lockNote = note;
        const form = this.lockDialog.querySelector('[data-lock-form]');
        form.reset();
        this.clearLockErrors();
        const locked = Boolean(note.is_locked);
        this.lockDialog.querySelector('[data-lock-heading]').textContent = t(
            locked ? 'Note password' : 'Protect this note',
        );
        this.lockDialog.querySelector('[data-lock-copy]').textContent = t(
            locked
                ? 'Change this note’s password or remove it. Both need the current password.'
                : 'Anyone opening this note, including people you share it with, must enter this password first.',
        );
        this.lockDialog.querySelector('[data-lock-modes]').hidden = !locked;
        this.setMode(locked ? 'change' : 'enable');
        this.lockDialog.showModal();
        form.querySelector('input:not([hidden])')?.focus();
        return new Promise((resolve) => {
            this.lockResolve = resolve;
        });
    }

    setMode(mode) {
        this.lockMode = mode;
        this.lockDialog.querySelectorAll('[data-lock-mode]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.lockMode === mode));
            button.classList.toggle('is-active', button.dataset.lockMode === mode);
        });
        const visible = {
            enable: ['password', 'password_confirmation'],
            change: ['current', 'password', 'password_confirmation'],
            disable: ['current'],
        }[mode];
        this.lockDialog.querySelectorAll('[data-lock-field]').forEach((field) => {
            field.hidden = !visible.includes(field.dataset.lockField);
        });
        const submit = this.lockDialog.querySelector('[data-lock-submit]');
        submit.textContent = t(
            { enable: 'Turn on password', change: 'Change password', disable: 'Remove password' }[
                mode
            ],
        );
        submit.classList.toggle('button-danger', mode === 'disable');
        submit.classList.toggle('button-primary', mode !== 'disable');
        this.clearLockErrors();
    }

    async submitLock(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const values = {
            current_password: form.elements.current_password.value,
            password: form.elements.password.value,
            password_confirmation: form.elements.password_confirmation.value,
        };
        this.clearLockErrors();
        // Quick checks before the server repeats them authoritatively.
        if (this.lockMode !== 'disable') {
            if (values.password.length < 4)
                return this.lockError('password', t('Use at least 4 characters.'));
            if (values.password !== values.password_confirmation)
                return this.lockError(
                    'password_confirmation',
                    t('The two passwords do not match.'),
                );
        }
        if (this.lockMode !== 'enable' && !values.current_password)
            return this.lockError('current_password', t('Enter the current password.'));
        const url = `/api/v1/notes/${encodeURIComponent(this.lockNote.id)}/lock`;
        const submit = form.querySelector('[data-lock-submit]');
        submit.disabled = true;
        try {
            const response =
                this.lockMode === 'enable'
                    ? await put(url, {
                          password: values.password,
                          password_confirmation: values.password_confirmation,
                      })
                    : this.lockMode === 'change'
                      ? await patch(url, values)
                      : await remove(url, { current_password: values.current_password });
            this.finishLock({ mode: this.lockMode, ...response.payload.data });
        } catch (error) {
            const errors = error.payload?.errors || {};
            if (error.status === 429)
                this.lockError(
                    'current_password',
                    t('Too many wrong passwords. Wait a few minutes and try again.'),
                );
            else if (Object.keys(errors).length)
                for (const [field, messages] of Object.entries(errors))
                    this.lockError(field, messages[0]);
            else this.lockError('current_password', firstError(error));
        } finally {
            submit.disabled = false;
        }
    }

    lockError(field, message) {
        const node = this.lockDialog.querySelector(`[data-lock-error="${field}"]`);
        if (!node) return;
        node.textContent = t(message);
        node.classList.remove('is-hidden');
        node.closest('.field')?.querySelector('input')?.setAttribute('aria-invalid', 'true');
        node.closest('.field')?.querySelector('input')?.focus();
    }

    clearLockErrors() {
        this.lockDialog.querySelectorAll('[data-lock-error]').forEach((node) => {
            node.textContent = '';
            node.classList.add('is-hidden');
        });
        this.lockDialog
            .querySelectorAll('input')
            .forEach((input) => input.removeAttribute('aria-invalid'));
    }

    finishLock(value) {
        if (this.lockDialog.open) this.lockDialog.close();
        const resolve = this.lockResolve;
        this.lockResolve = null;
        resolve?.(value);
    }
}

/** A small text prompt that replaces window.prompt (renaming tags, report reasons). */
export function promptText({
    title,
    label,
    value = '',
    multiline = false,
    maxLength = 200,
    submit,
}) {
    const dialog = document.querySelector('[data-prompt-dialog]');
    const form = dialog.querySelector('[data-prompt-form]');
    const input = dialog.querySelector('[data-prompt-input]');
    const error = dialog.querySelector('[data-prompt-error]');
    dialog.querySelector('[data-prompt-title]').textContent = t(title);
    dialog.querySelector('[data-prompt-label]').textContent = t(label);
    dialog.querySelector('[data-prompt-submit]').textContent = t(submit || 'Save');
    input.value = value;
    input.rows = multiline ? 4 : 1;
    input.maxLength = maxLength;
    input.classList.toggle('is-single-line', !multiline);
    error.classList.add('is-hidden');
    dialog.showModal();
    input.focus();
    input.select();
    return new Promise((resolve) => {
        const finish = (result) => {
            form.removeEventListener('submit', onSubmit);
            input.removeEventListener('keydown', onKey);
            dialog.removeEventListener('close', onClose);
            dialog
                .querySelectorAll('[data-prompt-cancel]')
                .forEach((button) => button.removeEventListener('click', onCancel));
            if (dialog.open) dialog.close();
            resolve(result);
        };
        const onSubmit = (event) => {
            event.preventDefault();
            const text = input.value.trim();
            if (!text) {
                error.textContent = t('This field is required.');
                error.classList.remove('is-hidden');
                input.focus();
                return;
            }
            finish(text);
        };
        const onKey = (event) => {
            if (!multiline && event.key === 'Enter') {
                event.preventDefault();
                form.requestSubmit();
            }
        };
        const onCancel = () => finish(null);
        const onClose = () => finish(null);
        form.addEventListener('submit', onSubmit);
        input.addEventListener('keydown', onKey);
        dialog.addEventListener('close', onClose);
        dialog
            .querySelectorAll('[data-prompt-cancel]')
            .forEach((button) => button.addEventListener('click', onCancel));
    });
}

/** AI summary of one Note: shows the stored summary and generates or regenerates it. */
export class SummaryPanel {
    constructor(root) {
        this.root = root;
        this.noteId = null;
        this.text = root.querySelector('[data-ai-summary-text]');
        this.meta = root.querySelector('[data-ai-summary-meta]');
        this.stale = root.querySelector('[data-ai-summary-stale]');
        this.button = root.querySelector('[data-ai-summary-run]');
        this.button.addEventListener('click', () => this.generate());
        this.generation = 0;
    }

    async load(noteId) {
        this.noteId = noteId;
        const generation = ++this.generation;
        this.root.classList.remove('is-hidden');
        this.render(null);
        try {
            const data = (await get(`/api/v1/notes/${encodeURIComponent(noteId)}/summary`)).payload
                .data;
            if (generation === this.generation) this.render(data);
        } catch {
            if (generation === this.generation) this.render(null);
        }
    }

    hide() {
        this.generation++;
        this.noteId = null;
        this.root.classList.add('is-hidden');
    }

    async generate() {
        if (!this.noteId) return;
        const generation = ++this.generation;
        this.button.disabled = true;
        this.root.setAttribute('aria-busy', 'true');
        this.text.replaceChildren(this.skeleton());
        this.meta.textContent = t('Reading your note…');
        try {
            const data =
                // Generation can take a while; the provider itself retries for up to ~90 s.
                (
                    await post(
                        `/api/v1/notes/${encodeURIComponent(this.noteId)}/summary`,
                        {},
                        { timeout: 90000 },
                    )
                ).payload.data;
            if (generation === this.generation) this.render(data);
        } catch (error) {
            if (generation !== this.generation) return;
            this.text.replaceChildren();
            const message = document.createElement('p');
            message.className = 'ai-summary-error';
            message.textContent =
                {
                    AI_DISABLED: t('AI is not enabled on this server.'),
                    AI_QUOTA: t('The AI usage limit has been reached. Try again later.'),
                    TOO_MANY_REQUESTS: t('Too many requests. Try again in a minute.'),
                }[error.code] || firstError(error, 'content');
            this.text.append(message);
            this.meta.textContent = '';
        } finally {
            if (generation === this.generation) {
                this.button.disabled = false;
                this.root.removeAttribute('aria-busy');
            }
        }
    }

    render(data) {
        this.text.replaceChildren();
        const summary = data?.summary;
        this.button.textContent = t(summary ? 'Regenerate' : 'Summarize');
        this.stale.classList.toggle('is-hidden', !data?.is_stale);
        if (!summary) {
            const empty = document.createElement('p');
            empty.className = 'subtle-copy';
            empty.textContent = t('Get a short summary of the main ideas in this note.');
            this.text.append(empty);
            this.meta.textContent = '';
            return;
        }
        const lines = summary
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
        const bullets = lines.filter((line) => /^[-•*]\s+/.test(line));
        if (bullets.length >= Math.max(1, lines.length - 1)) {
            const intro = lines.find((line) => !/^[-•*]\s+/.test(line));
            if (intro) {
                const p = document.createElement('p');
                p.textContent = intro;
                this.text.append(p);
            }
            const list = document.createElement('ul');
            for (const line of bullets) {
                const item = document.createElement('li');
                item.textContent = line.replace(/^[-•*]\s+/, '');
                list.append(item);
            }
            this.text.append(list);
        } else {
            for (const line of lines) {
                const p = document.createElement('p');
                p.textContent = line;
                this.text.append(p);
            }
        }
        this.meta.textContent = `${t('Generated')} ${relativeTime(data.generated_at)}${data.is_stale ? ' · ' + t('the note changed since then') : ''}`;
    }

    skeleton() {
        const wrap = document.createElement('div');
        wrap.className = 'skeleton-lines';
        wrap.setAttribute('aria-hidden', 'true');
        for (let index = 0; index < 3; index++) wrap.append(document.createElement('span'));
        return wrap;
    }
}

/** "Ask about your notes": question, synthesized answer and clickable note references. */
export class AskAIDialog {
    constructor(dialog, { openNote, openShared, offline }) {
        this.dialog = dialog;
        this.openNote = openNote;
        this.openShared = openShared;
        this.offline = offline;
        this.form = dialog.querySelector('[data-ask-form]');
        this.result = dialog.querySelector('[data-ask-result]');
        this.input = this.form.elements.question;
        dialog.querySelector('[data-ask-close]').addEventListener('click', () => dialog.close());
        this.form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.ask();
        });
        this.input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                this.form.requestSubmit();
            }
        });
        dialog.querySelectorAll('[data-ask-suggestion]').forEach((button) =>
            button.addEventListener('click', () => {
                this.input.value = button.textContent.trim();
                this.ask();
            }),
        );
    }

    open() {
        this.dialog.showModal();
        this.input.focus();
    }

    async ask() {
        const question = this.input.value.trim();
        if (question.length < 3) {
            this.message(t('Ask a question of at least 3 characters.'), true);
            this.input.focus();
            return;
        }
        if (this.offline?.()) {
            this.message(t('AI answers need an internet connection.'), true);
            return;
        }
        const submit = this.form.querySelector('[data-ask-submit]');
        submit.disabled = true;
        this.result.setAttribute('aria-busy', 'true');
        const thinking = document.createElement('div');
        thinking.className = 'ask-thinking';
        const dots = document.createElement('span');
        dots.className = 'typing-dots';
        dots.setAttribute('aria-hidden', 'true');
        dots.append(
            document.createElement('i'),
            document.createElement('i'),
            document.createElement('i'),
        );
        thinking.append(dots, document.createTextNode(t('Searching your notes…')));
        this.result.replaceChildren(thinking);
        try {
            const data = (await post('/api/v1/notes/ask', { question }, { timeout: 90000 })).payload
                .data;
            this.render(question, data);
        } catch (error) {
            this.message(
                {
                    AI_DISABLED: t('AI is not enabled on this server.'),
                    AI_QUOTA: t('The AI usage limit has been reached. Try again later.'),
                    TOO_MANY_REQUESTS: t('Too many requests. Try again in a minute.'),
                }[error.code] || firstError(error, 'question'),
                true,
            );
        } finally {
            submit.disabled = false;
            this.result.removeAttribute('aria-busy');
        }
    }

    message(text, error = false) {
        const node = document.createElement('p');
        node.className = error ? 'ai-summary-error' : 'subtle-copy';
        node.setAttribute('role', error ? 'alert' : 'status');
        node.textContent = text;
        this.result.replaceChildren(node);
    }

    render(question, data) {
        this.result.replaceChildren();
        const card = document.createElement('article');
        card.className = 'ask-answer' + (data.found ? '' : ' is-not-found');
        const heading = document.createElement('p');
        heading.className = 'ask-question-echo';
        heading.textContent = question;
        const answer = document.createElement('div');
        answer.className = 'ask-answer-text';
        for (const line of data.answer.split('\n').filter((entry) => entry.trim())) {
            const p = document.createElement('p');
            p.textContent = line;
            answer.append(p);
        }
        card.append(heading, answer);
        if (data.references?.length) {
            const title = document.createElement('h3');
            title.className = 'ask-references-title';
            title.textContent = t('Sources');
            const list = document.createElement('ol');
            list.className = 'ask-references';
            data.references.forEach((reference) => {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'ask-reference';
                const name = document.createElement('strong');
                name.textContent = reference.title;
                const meta = document.createElement('small');
                meta.textContent = reference.shared
                    ? `${t('Shared by')} ${reference.owner_name}`
                    : `${t('Updated')} ${relativeTime(reference.updated_at)}`;
                const excerpt = document.createElement('span');
                excerpt.className = 'ask-reference-excerpt';
                excerpt.textContent = reference.excerpt;
                button.append(name, meta, excerpt);
                button.setAttribute('aria-label', `${t('Open note')} ${reference.title}`);
                button.addEventListener('click', () => {
                    this.dialog.close();
                    if (reference.shared) this.openShared(reference.id);
                    else this.openNote(reference.id);
                });
                item.append(button);
                list.append(item);
            });
            card.append(title, list);
        }
        this.result.append(card);
    }
}
