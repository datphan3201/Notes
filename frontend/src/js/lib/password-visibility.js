import { t } from './i18n.js';

const svg = 'http://www.w3.org/2000/svg';
const eyePaths = {
    show: [
        'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z',
        'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
    ],
    hide: [
        'M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6',
        'M9.9 9.9a3 3 0 0 0 4.2 4.2',
        'm3 3 18 18',
    ],
};

function eyeIcon(kind) {
    const icon = document.createElementNS(svg, 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add('ui-icon');
    for (const d of eyePaths[kind]) {
        const path = document.createElementNS(svg, 'path');
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'currentColor');
        path.setAttribute('stroke-width', '1.8');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        icon.append(path);
    }
    return icon;
}

// Each password field gets an eye toggle inside its right edge.
export function initPasswordVisibility(root = document) {
    root.querySelectorAll('input[type="password"]').forEach((input) => {
        if (!input.id || input.closest('.password-field')) return;
        const wrapper = document.createElement('span');
        wrapper.className = 'password-field';
        input.before(wrapper);
        wrapper.append(input);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'password-visibility';
        button.setAttribute('aria-controls', input.id);
        const render = () => {
            const visible = input.type === 'text';
            const label = visible ? t('Hide password') : t('Show password');
            button.replaceChildren(eyeIcon(visible ? 'hide' : 'show'));
            button.setAttribute('aria-label', label);
            button.title = label;
            button.setAttribute('aria-pressed', String(visible));
        };
        button.addEventListener('click', () => {
            input.type = input.type === 'password' ? 'text' : 'password';
            render();
            input.focus();
        });
        render();
        wrapper.append(button);
    });
}
