import { post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

/** Settings › Security › Delete account: password and an explicit acknowledgement, then sign-in. */
export function initAccountDeletion(root) {
    const form = root.querySelector('[data-account-delete-form]');
    if (!form) return;
    const status = root.querySelector('[data-account-delete-status]');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        if (!data.get('understood')) {
            status.textContent = t('Tick the box to confirm.');
            return;
        }
        if (!window.confirm(t('Delete your account and all of its data for good?'))) return;
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        status.textContent = t('Deleting…');
        try {
            const { payload } = await post('/api/v1/account/delete', {
                password: String(data.get('password') || ''),
            });
            window.location.assign(payload?.data?.redirect || '/login');
        } catch (error) {
            status.textContent =
                Object.values(error.payload?.errors || {})[0]?.[0] || error.message;
            button.disabled = false;
        }
    });
}
