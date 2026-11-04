import { t } from './i18n.js';

const STAR = 'M12 3.6l2.6 5.2 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9Z';

function star(filled) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('star-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', STAR);
    path.setAttribute('fill', filled ? 'currentColor' : 'none');
    svg.append(path);
    return svg;
}

/** Clamps any stored importance to the 1-5 star scale. */
export function starCount(value) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.min(5, Math.max(1, number)) : 3;
}

/**
 * Importance as 1-5 stars at every planning level. With onChange it is a keyboard-accessible
 * radio group (click a star or use the arrow keys); without it, a read-only label.
 */
export function starRating(value, { label = t('Importance'), onChange = null, size = 'sm' } = {}) {
    const current = starCount(value);
    const rating = document.createElement('span');
    rating.className = `star-rating is-${size}${onChange ? ' is-editable' : ''}`;
    if (!onChange) {
        rating.setAttribute('role', 'img');
        rating.setAttribute('aria-label', `${label}: ${current}/5`);
        rating.title = `${label}: ${current}/5`;
        for (let index = 1; index <= 5; index += 1) rating.append(star(index <= current));
        return rating;
    }
    rating.setAttribute('role', 'radiogroup');
    rating.setAttribute('aria-label', label);
    const buttons = [];
    for (let index = 1; index <= 5; index += 1) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'star-rating-option';
        button.setAttribute('role', 'radio');
        button.setAttribute('aria-checked', String(index === current));
        button.setAttribute('aria-label', `${index}/5`);
        button.title = `${label}: ${index}/5`;
        button.tabIndex = index === current ? 0 : -1;
        button.append(star(index <= current));
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (index !== current) onChange(index);
        });
        button.addEventListener('keydown', (event) => {
            const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
            if (!step) return;
            event.preventDefault();
            const next = Math.min(5, Math.max(1, current + step));
            buttons[next - 1].focus();
            if (next !== current) onChange(next);
        });
        buttons.push(button);
        rating.append(button);
    }
    return rating;
}
