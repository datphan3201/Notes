import { get, post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export function initAssistant(doc = document) {
    const launcher = doc.querySelector('[data-assistant-open]');
    const dialog = doc.querySelector('[data-assistant-dialog]');
    if (!launcher || !dialog) return;
    const log = dialog.querySelector('[data-assistant-log]');
    const form = dialog.querySelector('[data-assistant-form]');
    const status = dialog.querySelector('[data-assistant-status]');
    let checked = false;

    const say = (role, text) => {
        const bubble = document.createElement('p');
        bubble.className = `assistant-message is-${role}`;
        bubble.textContent = text;
        log.append(bubble);
        log.scrollTop = log.scrollHeight;
    };
    launcher.addEventListener('click', async () => {
        dialog.showModal();
        form.elements.question.focus();
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
    });
    dialog.querySelector('[data-assistant-close]').addEventListener('click', () => dialog.close());
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
