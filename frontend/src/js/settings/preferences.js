import { t } from '../lib/i18n.js';
import { referenceDecoration } from './reference-decoration.js';
import { patch, upload, remove, get } from '../lib/http';
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
    // Preset themes and uploaded images share one picker. A preset clears the
    // selected upload; an upload keeps the preset's quote and decorations.
    for (const theme of visualThemes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'theme-option';
        button.dataset.sceneryTheme = theme.id;
        button.addEventListener('click', () =>
            changeScenery({ visual_theme: theme.id, background_id: '' }),
        );
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
    // "Add" opens the personal background dialog: an uploaded image or an RGB color.
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'theme-option theme-option-add';
    add.dataset.openDialog = 'personal-background-dialog';
    const plus = document.createElement('span');
    plus.className = 'theme-add-symbol';
    plus.setAttribute('aria-hidden', 'true');
    plus.textContent = '+';
    const addLabel = document.createElement('strong');
    addLabel.textContent = t('Your image or color');
    add.append(plus, addLabel);
    picker.append(add);
    let backgrounds = [];
    const renderBackgrounds = () => {
        picker.querySelectorAll('[data-scenery-upload]').forEach((tile) => tile.remove());
        for (const background of backgrounds) {
            const tile = document.createElement('div');
            tile.className = 'theme-option-upload';
            tile.dataset.sceneryUpload = background.id;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'theme-option';
            const image = document.createElement('img');
            image.src = background.url;
            image.alt = '';
            image.width = 320;
            image.height = 126;
            image.loading = 'lazy';
            const label = document.createElement('strong');
            label.textContent = t('Your image');
            button.append(image, label);
            button.addEventListener('click', () => changeScenery({ background_id: background.id }));
            const discard = document.createElement('button');
            discard.type = 'button';
            discard.className = 'theme-option-remove';
            discard.textContent = '×';
            discard.setAttribute('aria-label', t('Remove this background'));
            discard.title = t('Remove this background');
            discard.addEventListener('click', () => deleteBackground(background, discard));
            tile.append(button, discard);
            picker.insertBefore(tile, add);
        }
        render();
    };
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
        // An RGB color overrides both, so neither kind of tile is selected then.
        const scenery = preferences.background_color
            ? null
            : preferences.background_id || `theme:${preferences.visual_theme}`;
        picker.querySelectorAll('[data-scenery-theme]').forEach((button) => {
            const selected = scenery === `theme:${button.dataset.sceneryTheme}`;
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        picker.querySelectorAll('[data-scenery-upload]').forEach((tile) => {
            const selected = scenery === tile.dataset.sceneryUpload;
            const button = tile.querySelector('.theme-option');
            button.classList.toggle('is-selected', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        applyAppearance(preferences);
    };
    const pump = async () => {
        if (running) return;
        running = true;
        while (queue.length) {
            const item = queue.shift();
            try {
                const result = await patch('/api/v1/preferences', changesOf(item));
                Object.assign(serverPreferences, result.payload.data);
                Object.assign(window.notesBootstrap.preferences, serverPreferences);
                Object.assign(preferences, serverPreferences);
                for (const pending of queue) applyLocally(pending);
                status.textContent = queue.length
                    ? t('Saving…')
                    : quote.value !== serverPreferences.custom_quote
                      ? t('Preferences saved · unsaved quote')
                      : t('Saved');
                status.className = 'save-status is-success';
                item.resolve?.(result.payload.data);
            } catch (error) {
                for (const key of [...Object.keys(changesOf(item)), ...sceneryDerived])
                    preferences[key] = serverPreferences[key];
                status.textContent = error.message || t('Unable to save this preference.');
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
    // "scenery" items carry several fields: a theme or upload choice and the
    // background color it clears are saved together.
    const sceneryDerived = ['background_color', 'background_url'];
    const changesOf = (item) => (item.key === 'scenery' ? item.value : { [item.key]: item.value });
    const applyLocally = (item) => {
        Object.assign(preferences, changesOf(item));
        if (item.key !== 'scenery') return;
        const id = preferences.background_id;
        preferences.background_color = '';
        preferences.background_url = id
            ? backgrounds.find((background) => background.id === id)?.url || ''
            : '';
    };
    const change = (key, value) => {
        const queued = queue.find((item) => item.key === key);
        if (queued) queued.value = key === 'scenery' ? { ...queued.value, ...value } : value;
        else queue.push({ key, value });
        applyLocally({ key, value });
        render();
        status.textContent = t('Saving…');
        pump();
    };
    function changeScenery(fields) {
        change('scenery', fields);
    }
    async function deleteBackground(background, control) {
        if (!window.confirm(t('Remove this background from your images?'))) return;
        control.disabled = true;
        try {
            await remove(`/api/v1/preferences/backgrounds/${encodeURIComponent(background.id)}`);
            backgrounds = backgrounds.filter((item) => item.id !== background.id);
            await refreshPreferences();
            renderBackgrounds();
            status.textContent = t('Background removed');
            status.className = 'save-status is-success';
        } catch (error) {
            control.disabled = false;
            status.textContent = error.message;
            status.className = 'save-status is-error';
        }
    }
    async function refreshPreferences() {
        const saved = (await get('/api/v1/preferences')).payload.data;
        Object.assign(preferences, saved);
        Object.assign(serverPreferences, saved);
        Object.assign(window.notesBootstrap.preferences, saved);
        for (const pending of queue) applyLocally(pending);
    }
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
        status.textContent = t('Saving quote…');
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
                    ? t('Saved')
                    : t('Saved · newer quote edits are unsaved');
            status.className = 'save-status is-success';
        } catch (error) {
            status.textContent = error.message || t('Unable to save your quote.');
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
            quote.value === serverPreferences.custom_quote ? t('Saved') : t('Unsaved quote');
    });
    const backgroundDialog = root.querySelector('#personal-background-dialog');
    root.querySelector('[data-background-color-form]').addEventListener('submit', (event) => {
        event.preventDefault();
        change('background_color', new FormData(event.currentTarget).get('background_color'));
        backgroundDialog?.close();
    });
    // Uploaded images stay in the picker; this only switches back to the preset.
    root.querySelector('[data-reset-background]').addEventListener('click', () => {
        changeScenery({ background_id: '' });
        backgroundDialog?.close();
    });
    root.querySelector('[data-background-upload]').addEventListener('change', async (event) => {
        const input = event.currentTarget;
        const file = input.files?.[0];
        if (!file) return;
        input.disabled = true;
        const data = new FormData();
        data.append('background', file);
        status.textContent = t('Uploading background…');
        try {
            const added = (await upload('/api/v1/preferences/background', data)).payload.data;
            backgrounds = [...backgrounds, added];
            await refreshPreferences();
            renderBackgrounds();
            status.textContent = t('Background saved');
            status.className = 'save-status is-success';
            backgroundDialog?.close();
        } catch (error) {
            status.textContent =
                Object.values(error.payload?.errors || {}).flat()[0] || error.message;
            status.className = 'save-status is-error';
        } finally {
            input.value = '';
            input.disabled = false;
        }
    });
    root.querySelector('[data-interface-locale]').addEventListener('change', async (event) => {
        if (quote.value !== serverPreferences.custom_quote) {
            window.alert(t('Save your quote before changing language.'));
            event.currentTarget.value = preferences.locale;
            return;
        }
        const input = event.currentTarget;
        input.disabled = true;
        try {
            await new Promise((resolve, reject) => {
                queue.push({ key: 'locale', value: input.value, resolve, reject });
                pump();
            });
            window.setTimeout(() => window.location.reload(), 0);
        } catch (error) {
            status.textContent = error.message;
            input.disabled = false;
        }
    });
    render();
    get('/api/v1/preferences/backgrounds')
        .then((response) => {
            backgrounds = response.payload.data;
            renderBackgrounds();
        })
        .catch((error) => {
            status.textContent = error.message;
            status.className = 'save-status is-error';
        });
}
