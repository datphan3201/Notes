import { t } from './i18n.js';

// User-chosen icons and accents for Areas, Goals, Milestones and Habits. Names mirror
// backend/src/Domain/Planning/EntityIcon.php (a test keeps both lists equal); line icons share the
// app's 24px, 1.8 stroke style, and accents reuse the roadmap's eight hues.
export const ICONS = {
    target: [
        'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
        'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
        'M12 11.5v1',
    ],
    flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
    star: ['M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9Z'],
    heart: ['M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z'],
    book: ['M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2Z', 'M8 7h7'],
    graduation: ['M2 9l10-5 10 5-10 5Z', 'M6 11v5c3 2 9 2 12 0v-5', 'M22 9v5'],
    code: ['M8 8l-4 4 4 4', 'M16 8l4 4-4 4', 'M13.5 6l-3 12'],
    terminal: ['M4 5h16v14H4Z', 'M7 9l3 3-3 3', 'M12 15h5'],
    briefcase: ['M4 7h16v12H4Z', 'M9 7V5h6v2', 'M4 12h16'],
    chart: ['M4 20V4', 'M4 20h16', 'M7 15l4-4 3 3 5-6'],
    money: ['M3 7h18v10H3Z', 'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z', 'M6 10v4M18 10v4'],
    wallet: ['M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4Z', 'M4 7l11-3v3', 'M16 13h1'],
    cart: ['M3 4h2l2.5 11h11L21 7H6.2', 'M9 19.5h.01M18 19.5h.01'],
    home: ['M3 11l9-7 9 7', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
    dumbbell: ['M6 8v8M3 10v4M18 8v8M21 10v4', 'M6 12h12'],
    activity: ['M3 12h4l3-7 4 14 3-7h4'],
    bike: [
        'M6 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
        'M18 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
        'M6 14l4-7h4l4 7M10 7l3 7',
    ],
    apple: [
        'M12 7c-2-2-7-1.5-7 4 0 4.5 3 9 5 9 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4.5 5-9 0-5.5-5-6-7-4Z',
        'M12 7c0-2 1-3.5 3-4',
    ],
    droplet: ['M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z'],
    moon: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z'],
    sun: [
        'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
        'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
    ],
    leaf: ['M5 19c0-9 6-14 15-14 0 9-5 15-14 15', 'M5 19l8-8'],
    globe: [
        'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
        'M3 12h18',
        'M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
    ],
    plane: ['M3 11l18-7-7 18-3-8Z', 'M11 14l10-10'],
    music: [
        'M9 18V5l11-2v13',
        'M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
        'M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    ],
    camera: ['M3 8h4l2-3h6l2 3h4v11H3Z', 'M12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z'],
    palette: [
        'M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8Z',
        'M7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
    ],
    lightbulb: [
        'M9 18h6M10 21h4',
        'M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
    ],
    chat: ['M4 5h16v11H9l-5 4Z'],
    users: [
        'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
        'M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20',
        'M16 4.5a3.5 3.5 0 0 1 0 7M18 13.2a6.5 6.5 0 0 1 3.5 5.8V20',
    ],
    rocket: [
        'M12 2c3 2 5 6 5 10l-2 4H9l-2-4c0-4 2-8 5-10Z',
        'M9 16l-3 4M15 16l3 4',
        'M12 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z',
    ],
    trophy: [
        'M8 4h8v5a4 4 0 0 1-8 0Z',
        'M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4',
        'M12 13v4M8 20h8',
    ],
    mountain: ['M3 19l6-10 4 6 3-4 5 8Z'],
    compass: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M15.5 8.5l-2 5-5 2 2-5Z'],
    clock: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z', 'M12 7v5l3 2'],
    pen: ['M4 20h4L19 9l-4-4L4 16v4Z', 'M13.5 6.5l4 4'],
    flask: ['M9 3h6M10 3v6L5 19a1 1 0 0 0 1 1.5h12a1 1 0 0 0 1-1.5l-5-10V3', 'M7.5 14h9'],
    shield: ['M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6Z'],
    language: [
        'M4 5h9M8.5 3v2',
        'M6 5c1 4 3.5 6.5 7 8M11 5c-.8 3.5-3 6.5-6 8.5',
        'M13 20l4-9 4 9M14.3 17h5.4',
    ],
};

export const COLORS = {
    amber: 37,
    violet: 270,
    sky: 195,
    coral: 17,
    rose: 0,
    teal: 171,
    blue: 218,
    purple: 293,
};
const COLOR_NAMES = Object.keys(COLORS);

function svgIcon(name) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('ui-icon', 'entity-icon-svg');
    for (const d of ICONS[name] || ICONS.target) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', d);
        svg.append(path);
    }
    return svg;
}

/**
 * The badge shown for an Area/Goal/Milestone/Habit. Without a choice it falls back to the
 * caller's automatic icon and hue (index-based on roadmaps), so nothing changes until chosen.
 */
export function entityIcon(
    entity,
    { fallbackIcon = 'target', fallbackHue = COLORS.teal, size = 'md' } = {},
) {
    const badge = document.createElement('span');
    badge.className = `entity-icon is-${size}`;
    const hue = COLORS[entity?.icon_color] ?? fallbackHue;
    badge.style.setProperty('--icon-hue', String(hue));
    badge.append(svgIcon(ICONS[entity?.icon] ? entity.icon : fallbackIcon));
    return badge;
}

/** An automatic hue for the n-th item, matching the roadmap's eight-colour cycle. */
export function cycleHue(index) {
    return COLORS[COLOR_NAMES[index % COLOR_NAMES.length]];
}

let openPicker = null;
export function closeIconPicker() {
    openPicker?.remove();
    openPicker = null;
}
globalThis.document?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openPicker) return;
    // Escape closes the picker only, not a dialog it sits in.
    event.preventDefault();
    closeIconPicker();
});
globalThis.document?.addEventListener('click', (event) => {
    if (
        openPicker &&
        !openPicker.contains(event.target) &&
        !event.target.closest?.('[data-icon-picker-open]')
    )
        closeIconPicker();
});

/**
 * Opens the icon/colour popover next to `anchor`. onSelect({icon, icon_color}) receives the
 * full choice; "Default" clears both back to the automatic look.
 */
export function openIconPicker(anchor, { icon = null, color = null, onSelect }) {
    if (
        openPicker?.dataset.anchorId &&
        openPicker.dataset.anchorId === anchor.dataset.iconPickerOpen
    ) {
        closeIconPicker();
        return;
    }
    closeIconPicker();
    let chosenColor = color;
    const panel = document.createElement('div');
    panel.className = 'icon-picker';
    panel.dataset.anchorId = anchor.dataset.iconPickerOpen || '';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('Choose an icon'));
    const colors = document.createElement('div');
    colors.className = 'icon-picker-colors';
    colors.setAttribute('role', 'radiogroup');
    colors.setAttribute('aria-label', t('Colour'));
    const grid = document.createElement('div');
    grid.className = 'icon-picker-grid';
    const paint = () => {
        grid.style.setProperty('--icon-hue', String(COLORS[chosenColor] ?? COLORS.teal));
        for (const swatch of colors.children)
            swatch.setAttribute('aria-checked', String(swatch.dataset.color === chosenColor));
    };
    for (const name of COLOR_NAMES) {
        const swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'icon-picker-swatch';
        swatch.dataset.color = name;
        swatch.setAttribute('role', 'radio');
        swatch.setAttribute('aria-label', t(name));
        swatch.style.setProperty('--icon-hue', String(COLORS[name]));
        swatch.addEventListener('click', () => {
            chosenColor = name;
            paint();
        });
        colors.append(swatch);
    }
    for (const name of Object.keys(ICONS)) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'icon-picker-option';
        option.setAttribute('aria-label', name);
        option.title = name;
        option.setAttribute('aria-pressed', String(name === icon));
        option.append(svgIcon(name));
        option.addEventListener('click', () => {
            closeIconPicker();
            onSelect({ icon: name, icon_color: chosenColor || 'teal' });
        });
        grid.append(option);
    }
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'text-button icon-picker-reset';
    reset.textContent = t('Use default icon');
    reset.addEventListener('click', () => {
        closeIconPicker();
        onSelect({ icon: null, icon_color: null });
    });
    panel.append(colors, grid, reset);
    paint();
    // Inside a modal dialog the page body is inert, so the picker joins the dialog's top layer
    // and is placed against the viewport.
    const host = anchor.closest('dialog[open]');
    (host || document.body).append(panel);
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(312, window.innerWidth - 16);
    const scrollX = host ? 0 : window.scrollX;
    const scrollY = host ? 0 : window.scrollY;
    panel.classList.toggle('is-fixed', Boolean(host));
    panel.style.width = `${width}px`;
    panel.style.left = `${Math.max(8, Math.min(rect.left + scrollX, scrollX + window.innerWidth - width - 8))}px`;
    panel.style.top = `${rect.bottom + scrollY + 6}px`;
    openPicker = panel;
    grid.querySelector('[aria-pressed="true"]')?.focus() || grid.firstChild.focus();
}

/** A button wrapping the badge that opens the picker; `save` persists the choice. */
export function iconButton(entity, { label, save, ...options }) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'entity-icon-button';
    button.dataset.iconPickerOpen = `${label}:${entity.id}`;
    button.setAttribute('aria-label', `${t('Change icon')}: ${label}`);
    button.title = t('Change icon');
    button.append(entityIcon(entity, options));
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        openIconPicker(button, {
            icon: entity.icon,
            color: entity.icon_color,
            onSelect: (choice) => save(choice),
        });
    });
    return button;
}
