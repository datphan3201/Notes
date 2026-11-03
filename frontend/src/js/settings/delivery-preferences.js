import { t } from '../lib/i18n.js';
import { patch } from '../lib/http.js';
import { applyAppearance } from './theme-catalog.js';
export function initDeliveryPreferences(root) {
    const status = root.querySelector('[data-notification-status]');
    for (const input of root.querySelectorAll('[data-notification-pref]')) {
        const key = input.dataset.notificationPref;
        input.checked = window.notesBootstrap.preferences[key];
        input.addEventListener('change', async () => {
            input.disabled = true;
            try {
                const saved = (await patch('/api/v1/preferences', { [key]: input.checked })).payload
                    .data;
                Object.assign(window.notesBootstrap.preferences, saved);
                status.textContent = t('Saved');
            } catch (error) {
                input.checked = !input.checked;
                status.textContent = error.message;
            } finally {
                input.disabled = false;
            }
        });
    }
}
export function initNotePreferences(root) {
    const status = root.querySelector('[data-note-preference-status]');
    const buttons = [...root.querySelectorAll('[data-pref]')];
    const render = () =>
        buttons.forEach((button) =>
            button.setAttribute(
                'aria-pressed',
                String(
                    String(window.notesBootstrap.preferences[button.dataset.pref]) ===
                        button.dataset.value,
                ),
            ),
        );
    for (const button of buttons)
        button.addEventListener('click', async () => {
            buttons.forEach((item) => {
                item.disabled = true;
            });
            const key = button.dataset.pref;
            try {
                const value =
                    key === 'note_font_size' ? Number(button.dataset.value) : button.dataset.value;
                const saved = (await patch('/api/v1/preferences', { [key]: value })).payload.data;
                Object.assign(window.notesBootstrap.preferences, saved);
                applyAppearance(saved);
                // NotesPage applies the layout and other note preferences from this event.
                document.dispatchEvent(
                    new CustomEvent('notes:preferences-changed', { detail: saved }),
                );
                render();
                status.textContent = t('Saved');
            } catch (error) {
                status.textContent = error.message;
            } finally {
                buttons.forEach((item) => {
                    item.disabled = false;
                });
            }
        });
    render();
    // The preferences popover closes on outside clicks and Escape.
    document.addEventListener('click', (event) => {
        if (root.open && !root.contains(event.target)) root.open = false;
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && root.open) {
            root.open = false;
            root.querySelector('summary')?.focus();
        }
    });
}
