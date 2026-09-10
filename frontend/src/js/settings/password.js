import { post } from '../lib/http';
import { RecoveryStore } from '../lib/recovery-store';

export function initPassword(root) {
    const form = root.querySelector('[data-password-form]');
    const status = root.querySelector('[data-password-status]');
    const error = root.querySelector('[data-password-error]');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        status.textContent = 'Đang đổi mật khẩu…';
        try {
            const result = await post('/api/v1/password', data);
            RecoveryStore.clearAll();
            window.location.assign(result.payload.data.redirect_to);
        } catch (requestError) {
            form.querySelectorAll('input[type="password"]').forEach((input) => {
                input.value = '';
            });
            error.textContent =
                requestError.payload?.errors?.current_password?.[0] ||
                requestError.payload?.errors?.password?.[0] ||
                requestError.message;
            error.classList.remove('is-hidden');
            status.textContent = '';
        }
    });
}
