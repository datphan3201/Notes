import { referenceDecoration } from './reference-decoration.js';
import mountain from '../../images/themes/mountain.webp';
import forest from '../../images/themes/forest.webp';
import ocean from '../../images/themes/ocean.webp';
import pisces from '../../images/themes/pisces.webp';
import stars from '../../images/themes/stars.webp';

export const visualThemes = [
    {
        id: 'mountain',
        name: 'Mountain journey',
        image: mountain,
        quote: 'Small steps compound into big results.',
    },
    {
        id: 'forest',
        name: 'Forest',
        image: forest,
        quote: 'Consistency grows quietly, one day at a time.',
    },
    {
        id: 'ocean',
        name: 'Ocean',
        image: ocean,
        quote: 'Find your rhythm. Let each small wave move you forward.',
    },
    {
        id: 'pisces',
        name: 'Pisces · Song Ngư',
        image: pisces,
        quote: 'Let curiosity guide you, and practice give it direction.',
    },
    {
        id: 'stars',
        name: 'Starry sky',
        image: stars,
        quote: 'Keep your direction in sight. Take the next small step.',
    },
];

export function applyAppearance(preferences) {
    const theme =
        visualThemes.find((item) => item.id === preferences.visual_theme) || visualThemes[0];
    const root = document.documentElement;
    root.dataset.visualTheme = theme.id;
    root.dataset.theme = preferences.theme || 'light';
    root.dataset.fontSize = preferences.note_font_size;
    root.style.setProperty('--font-size-note', `${preferences.note_font_size}px`);
    root.style.setProperty('--theme-scene', `url("${theme.image}")`);
    for (const [key, attribute] of [
        ['show_background', 'showBackground'],
        ['show_illustrations', 'showIllustrations'],
        ['show_quote', 'showQuote'],
    ]) {
        root.dataset[attribute] = String(preferences[key] !== false);
    }
    document.querySelectorAll('[data-theme-quote]').forEach((element) => {
        element.textContent = preferences.custom_quote?.trim() || theme.quote;
    });
    document.querySelectorAll('[data-theme-preview]').forEach((image) => {
        image.src = theme.image;
        image.alt = `${theme.name} illustration`;
        image.classList.toggle('is-hidden', theme.id === 'mountain');
        let preview = image.parentElement.querySelector('.reference-theme-preview');
        if (!preview) {
            preview = referenceDecoration('landscape');
            preview.classList.add('reference-theme-preview');
            preview.removeAttribute('aria-hidden');
            preview.setAttribute('role', 'img');
            preview.setAttribute('aria-label', 'Mountain journey illustration from UI.png');
            image.after(preview);
        }
        preview.classList.toggle('is-hidden', theme.id !== 'mountain');
    });
    document.dispatchEvent(new CustomEvent('planner:appearance-changed'));
}
