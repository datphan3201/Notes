import { patch } from '../lib/http';

export function initPreferences(root) {
    const preferences = { ...window.notesBootstrap.preferences };
    const serverPreferences = { ...preferences };
    const queue = [];
    let running = false;
    const status = root.querySelector('[data-preference-status]');
    const buttons = [...root.querySelectorAll('[data-pref]')];
    const render = () => {
        buttons.forEach((button) => {
            const selected = String(preferences[button.dataset.pref]) === button.dataset.value;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', selected ? 'true' : 'false');
        });
        document.documentElement.dataset.theme = preferences.theme;
        document.documentElement.dataset.fontSize = preferences.note_font_size;
        document.documentElement.style.setProperty(
            '--font-size-note',
            preferences.note_font_size + 'px',
        );
    };
    const pump = async () => {
        if (running) return;
        running = true;
        while (queue.length) {
            const item = queue.shift();
            try {
                const result = await patch('/api/v1/preferences', { [item.key]: item.value });
                Object.assign(serverPreferences, result.payload.data);
                Object.assign(preferences, result.payload.data);
                status.textContent = 'Saved';
                status.className = 'save-status is-success';
            } catch (error) {
                // Roll back to the last server-confirmed value, not merely the
                // value visible when the user clicked; this handles coalesced
                // clicks while an earlier request is still in flight.
                preferences[item.key] = serverPreferences[item.key];
                render();
                status.textContent = error.message || 'Unable to save this preference.';
                status.className = 'save-status is-error';
                queue.splice(0, queue.length, ...queue.filter((queued) => queued.key !== item.key));
            }
        }
        running = false;
    };

    buttons.forEach((button) => {
        button.addEventListener('click', async () => {
            const key = button.dataset.pref;
            const value =
                key === 'note_font_size' ? Number(button.dataset.value) : button.dataset.value;
            preferences[key] = value;
            render();
            status.textContent = 'Saving…';
            const queued = queue.find((item) => item.key === key);
            if (queued) queued.value = value;
            else queue.push({ key, value });
            pump();
        });
    });
    render();
}
