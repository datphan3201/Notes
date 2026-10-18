import { t } from './i18n.js';
export function initPasswordVisibility(root = document) {
    root.querySelectorAll('input[type="password"]').forEach((input) => {
        if (!input.id) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'text-button password-visibility';
        button.textContent = t('Show password');
        button.setAttribute('aria-controls', input.id);
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
            const visible = input.type === 'password';
            input.type = visible ? 'text' : 'password';
            button.textContent = visible ? t('Hide password') : t('Show password');
            button.setAttribute('aria-pressed', String(visible));
        });
        input.after(button);
    });
}
