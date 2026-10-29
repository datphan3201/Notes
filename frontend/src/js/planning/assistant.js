import { get, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

// The assistant is a non-modal panel so the rest of Planner stays usable while
// it is open. Its open state and conversation survive page navigation within
// the browser tab through sessionStorage.
const STORAGE_KEY = 'planner.assistant';

function loadState() {
    try {
        const state = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
        return {
            open: Boolean(state?.open),
            messages: Array.isArray(state?.messages) ? state.messages : [],
        };
    } catch {
        return { open: false, messages: [] };
    }
}

function saveState(state) {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage can be unavailable (private mode, quota); the panel still works.
    }
}

export function initAssistant(doc = document) {
    const launcher = doc.querySelector('[data-assistant-open]');
    const dialog = doc.querySelector('[data-assistant-dialog]');
    if (!launcher || !dialog) return;
    const log = dialog.querySelector('[data-assistant-log]');
    const form = dialog.querySelector('[data-assistant-form]');
    const status = dialog.querySelector('[data-assistant-status]');
    const state = loadState();
    let checked = false;

    const render = (role, text) => {
        const bubble = document.createElement('p');
        bubble.className = `assistant-message is-${role}`;
        bubble.textContent = text;
        log.append(bubble);
        log.scrollTop = log.scrollHeight;
    };
    const say = (role, text) => {
        render(role, text);
        if (role !== 'error') {
            state.messages.push({ role, text });
            saveState(state);
        }
    };
    const checkAvailability = async () => {
        if (checked) return;
        checked = true;
        try {
            if (!(await get('/api/v1/ai/chat')).payload.data.available) {
                status.textContent = t(
                    'The AI assistant is not enabled on this server. You can still use the rest of Planner.',
                );
                form.querySelector('[type="submit"]').disabled = true;
            }
        } catch {
            checked = false;
        }
    };
    const open = ({ focus = true } = {}) => {
        if (!dialog.open) dialog.show();
        launcher.setAttribute('aria-expanded', 'true');
        state.open = true;
        saveState(state);
        log.scrollTop = log.scrollHeight;
        if (focus) form.elements.question.focus();
        checkAvailability();
    };
    const close = () => {
        dialog.close();
        launcher.setAttribute('aria-expanded', 'false');
        state.open = false;
        saveState(state);
        launcher.focus();
    };

    state.messages.forEach(({ role, text }) => render(role, text));
    launcher.setAttribute('aria-expanded', 'false');
    if (state.open) open({ focus: false });

    launcher.addEventListener('click', () => (dialog.open ? close() : open()));
    dialog.querySelector('[data-assistant-close]').addEventListener('click', close);
    dialog.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            close();
        }
    });
    doc.querySelector('form[action="/logout"]')?.addEventListener('submit', () => {
        sessionStorage.removeItem(STORAGE_KEY);
    });
    form.elements.question.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            form.requestSubmit();
        }
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const question = form.elements.question.value.trim();
        if (!question) return;
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        say('user', question);
        form.elements.question.value = '';
        try {
            say('assistant', (await post('/api/v1/ai/chat', { question })).payload.data.answer);
        } catch (error) {
            say('error', error.message || t('The assistant could not answer right now.'));
            form.elements.question.value = question;
        } finally {
            submit.disabled = false;
            form.elements.question.focus();
        }
    });
}
