import { t } from '../lib/i18n.js';
import { get } from '../lib/http.js';
export function initReminders() {
    const button = document.querySelector('[data-reminders-open]');
    const output = document.querySelector('[data-reminders-list]');
    button?.addEventListener('click', async () => {
        output.textContent = t('Checking reminders…');
        try {
            const response = await get('/api/v1/reminders');
            output.replaceChildren();
            if (!response.payload.data.length) output.textContent = t('No pending reminders.');
            for (const task of response.payload.data) {
                const link = document.createElement('a');
                link.href = `/tasks/${encodeURIComponent(task.id)}`;
                link.textContent = task.name;
                output.append(link);
            }
        } catch (error) {
            output.textContent = error.message;
        }
    });
}
