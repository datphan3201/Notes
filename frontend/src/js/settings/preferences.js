import { referenceDecoration } from './reference-decoration.js';
import { patch } from '../lib/http';
import { applyAppearance, visualThemes } from './theme-catalog.js';
import { guardWorkspaceLeave } from '../lib/workspace-ui.js';

export function initPreferences(root) {
    const preferences = { ...window.notesBootstrap.preferences };
    const serverPreferences = { ...preferences };
    const queue = [];
    let running = false;
    let quoteSaving = false;
    const status = root.querySelector('[data-preference-status]');
    const picker = root.querySelector('[data-theme-picker]');
    for (const theme of visualThemes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-option';
        button.dataset.pref = 'visual_theme';
        button.dataset.value = theme.id;
        const image = document.createElement('img');
        image.src = theme.image;
        image.alt = '';
        image.width = 320;
        image.height = 126;
        const label = document.createElement('strong');
        label.textContent = theme.name;
        if (theme.id === 'mountain') {
            const illustration = referenceDecoration('landscape');
            illustration.classList.add('reference-theme-thumbnail');
            button.append(illustration, label);
        } else button.append(image, label);
        picker.append(button);
    }
    const buttons = [...root.querySelectorAll('[data-pref]')];
    const toggles = [...root.querySelectorAll('[data-pref-toggle]')];
    const quoteForm = root.querySelector('[data-quote-form]');
    const quote = quoteForm.elements.custom_quote;
    quote.value = preferences.custom_quote;
    guardWorkspaceLeave(
        () => running || quoteSaving || quote.value !== serverPreferences.custom_quote,
    );
    const render = () => {
        buttons.forEach((button) => {
            const selected = String(preferences[button.dataset.pref]) === button.dataset.value;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        toggles.forEach((toggle) => {
            toggle.checked = preferences[toggle.dataset.prefToggle];
        });
        applyAppearance(preferences);
    };
    const pump = async () => {
        if (running) return;
        running = true;
        while (queue.length) {
            const item = queue.shift();
            try {
                const result = await patch('/api/v1/preferences', { [item.key]: item.value });
                Object.assign(serverPreferences, result.payload.data);
                Object.assign(window.notesBootstrap.preferences, serverPreferences);
                Object.assign(preferences, serverPreferences);
                for (const pending of queue) preferences[pending.key] = pending.value;
                status.textContent = queue.length
                    ? 'Saving…'
                    : quote.value !== serverPreferences.custom_quote
                      ? 'Preferences saved · unsaved quote'
                      : 'Saved';
                status.className = 'save-status is-success';
                item.resolve?.(result.payload.data);
            } catch (error) {
                preferences[item.key] = serverPreferences[item.key];
                status.textContent = error.message || 'Unable to save this preference.';
                status.className = 'save-status is-error';
                const discarded = queue.filter((queued) => queued.key === item.key);
                discarded.forEach((queued) => queued.reject?.(error));
                queue.splice(0, queue.length, ...queue.filter((queued) => queued.key !== item.key));
                item.reject?.(error);
            }
            render();
        }
        running = false;
    };
    const change = (key, value) => {
        preferences[key] = value;
        render();
        status.textContent = 'Saving…';
        const queued = queue.find((item) => item.key === key);
        if (queued) queued.value = value;
        else queue.push({ key, value });
        pump();
    };
    buttons.forEach((button) =>
        button.addEventListener('click', () => {
            const key = button.dataset.pref;
            change(
                key,
                key === 'note_font_size' ? Number(button.dataset.value) : button.dataset.value,
            );
        }),
    );
    toggles.forEach((toggle) =>
        toggle.addEventListener('change', () => change(toggle.dataset.prefToggle, toggle.checked)),
    );
    const saveQuote = async (value) => {
        if (quoteSaving) return;
        quoteSaving = true;
        const controls = [...quoteForm.querySelectorAll('button')];
        controls.forEach((button) => {
            button.disabled = true;
        });
        status.textContent = 'Saving quote…';
        try {
            const saved = await new Promise((resolve, reject) => {
                queue.push({ key: 'custom_quote', value, resolve, reject });
                pump();
            });
            serverPreferences.custom_quote = preferences.custom_quote = saved.custom_quote;
            window.notesBootstrap.preferences.custom_quote = preferences.custom_quote;
            if (quote.value === value) quote.value = preferences.custom_quote;
            render();
            status.textContent =
                quote.value === serverPreferences.custom_quote
                    ? 'Saved'
                    : 'Saved · newer quote edits are unsaved';
            status.className = 'save-status is-success';
        } catch (error) {
            status.textContent = error.message || 'Unable to save your quote.';
            status.className = 'save-status is-error';
        } finally {
            quoteSaving = false;
            controls.forEach((button) => {
                button.disabled = false;
            });
        }
    };
    quoteForm.addEventListener('submit', (event) => {
        event.preventDefault();
        saveQuote(quote.value);
    });
    root.querySelector('[data-quote-reset]').addEventListener('click', () => {
        quote.value = '';
        saveQuote('');
    });
    quote.addEventListener('input', () => {
        status.textContent =
            quote.value === serverPreferences.custom_quote ? 'Saved' : 'Unsaved quote';
    });
    render();
}
