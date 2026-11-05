import { t } from '../lib/i18n.js';
import mountain from '../../images/themes/mountain.webp';
import forest from '../../images/themes/forest.webp';
import ocean from '../../images/themes/ocean.webp';
import pisces from '../../images/themes/pisces.webp';
import stars from '../../images/themes/stars.webp';

export const visualThemes = [
    {
        id: 'mountain',
        name: 'Summit trail',
        image: mountain,
        quote: 'Small steps compound into big results.',
    },
    {
        id: 'forest',
        name: 'Forest path',
        image: forest,
        quote: 'Consistency grows quietly, one day at a time.',
    },
    {
        id: 'ocean',
        name: 'Coastal cove',
        image: ocean,
        quote: 'Find your rhythm. Let each small wave move you forward.',
    },
    {
        id: 'pisces',
        name: 'Pisces',
        image: pisces,
        quote: 'Let curiosity guide you, and practice give it direction.',
    },
    {
        id: 'stars',
        name: 'Starlit lake',
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
    root.style.setProperty(
        '--theme-scene',
        preferences.background_color
            ? 'none'
            : `url("${preferences.background_url || theme.image}")`,
    );
    root.style.setProperty('--personal-background', preferences.background_color || 'transparent');
    root.dataset.personalBackground = String(!!preferences.background_color);
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
        // Every scenery, Summit trail included, previews its own illustration.
        image.src = theme.image;
        image.alt = `${t(theme.name)} — ${t('illustration')}`;
    });
    document.dispatchEvent(new CustomEvent('planner:appearance-changed'));
}
