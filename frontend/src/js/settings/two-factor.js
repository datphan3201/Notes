import { post } from '../lib/http.js';
import { t } from '../lib/i18n.js';

export function twoFactorSummary(method) {
    if (method === 'totp') return t('On: codes come from your authenticator app.');
    if (method === 'email') return t('On: codes are sent to your email address.');
    return t('Off: only your password protects sign-in.');
}

export function initTwoFactor(root) {
    let method = root.dataset.method || null;
    let pending = null;
    const summary = root.querySelector('[data-two-factor-summary]');
    const choices = root.querySelector('[data-two-factor-choices]');
    const confirm = root.querySelector('[data-two-factor-confirm]');
    const disable = root.querySelector('[data-two-factor-disable]');
    const status = root.querySelector('[data-two-factor-status]');
    const render = () => {
        summary.textContent = twoFactorSummary(method);
        choices.hidden = !!method || !!pending;
        confirm.hidden = !pending;
        disable.hidden = !method;
        confirm.querySelector('[data-totp-setup]').hidden = pending !== 'totp';
        confirm.querySelector('[data-email-setup]').hidden = pending !== 'email';
    };
    const fail = (error) => {
        status.textContent =
            error.payload?.errors?.code?.[0] ||
            error.payload?.errors?.password?.[0] ||
            error.message;
    };
    root.querySelectorAll('[data-two-factor-start]').forEach((button) =>
        button.addEventListener('click', async () => {
            status.textContent = '';
            button.disabled = true;
            try {
                if (button.dataset.twoFactorStart === 'totp') {
                    const { secret, uri } = (await post('/api/v1/two-factor/totp', {})).payload
                        .data;
                    confirm.querySelector('[data-totp-secret]').textContent = secret
                        .match(/.{1,4}/g)
                        .join(' ');
                    confirm.querySelector('[data-totp-link]').href = uri;
                } else {
                    await post('/api/v1/two-factor/email', {});
                }
                pending = button.dataset.twoFactorStart;
                render();
                confirm.elements.code.focus();
            } catch (error) {
                fail(error);
            } finally {
                button.disabled = false;
            }
        }),
    );
    root.querySelector('[data-two-factor-cancel]').addEventListener('click', () => {
        pending = null;
        confirm.reset();
        render();
    });
    confirm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const path =
                pending === 'totp'
                    ? '/api/v1/two-factor/totp/confirm'
                    : '/api/v1/two-factor/email/confirm';
            method = (await post(path, { code: confirm.elements.code.value })).payload.data.method;
            pending = null;
            confirm.reset();
            status.textContent = t('Two-step verification is on.');
            render();
        } catch (error) {
            fail(error);
        }
    });
    disable.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await post('/api/v1/two-factor/disable', { password: disable.elements.password.value });
            method = null;
            disable.reset();
            status.textContent = t('Two-step verification is off.');
            render();
        } catch (error) {
            disable.reset();
            fail(error);
        }
    });
    render();
}
