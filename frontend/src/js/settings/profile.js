import { t } from '../lib/i18n.js';
import { get, patch, post, remove, upload } from '../lib/http';

export function initProfile(root) {
    const form = root.querySelector('[data-profile-form]');
    const input = root.querySelector('[data-profile-name]');
    const status = root.querySelector('[data-profile-status]');
    const error = root.querySelector('[data-profile-error]');
    const avatar = root.querySelector('[data-profile-avatar]');
    const avatarInput = root.querySelector('[data-avatar-input]');
    const avatarRemove = root.querySelector('[data-avatar-remove]');
    const initialAvatarUrl = window.notesBootstrap.user.avatar_url;

    const renderAvatar = (url) => {
        avatar.replaceChildren();
        if (url) {
            const image = document.createElement('img');
            image.src = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
            image.alt = t('Profile picture');
            avatar.append(image);
            return;
        }
        const fallback = document.createElement('span');
        fallback.textContent = (input.value || '?').trim().slice(0, 1).toUpperCase();
        avatar.append(fallback);
    };

    renderAvatar(initialAvatarUrl);

    // Email ownership: verification state, resend, and a confirmed change.
    const emailState = root.querySelector('[data-email-state]');
    const verify = root.querySelector('[data-email-verify]');
    const changeForm = root.querySelector('[data-email-change-form]');
    const changeStatus = root.querySelector('[data-email-change-status]');
    const deliveryNote = (delivered) =>
        delivered
            ? ''
            : ` ${t('Email is not set up on this server yet; the message was saved to its local outbox.')}`;
    const renderEmail = (state) => {
        root.querySelector('[data-profile-email]').value = state.email;
        emailState.textContent = [
            state.verified
                ? `✓ ${t('Verified')}`
                : t('Not verified yet. Check your inbox for the confirmation link.'),
            state.pending_email
                ? `${t('Waiting for confirmation at')} ${state.pending_email}.`
                : '',
        ]
            .filter(Boolean)
            .join(' ');
        verify.hidden = state.verified;
    };
    const loadEmail = async () => {
        try {
            renderEmail((await get('/api/v1/email')).payload.data);
        } catch {
            emailState.textContent = '';
        }
    };
    verify.addEventListener('click', async () => {
        verify.disabled = true;
        try {
            const result = (await post('/api/v1/email/verification', {})).payload.data;
            emailState.textContent = `${t('Verification email sent.')}${deliveryNote(result.delivered)}`;
        } catch (requestError) {
            emailState.textContent = requestError.message;
        } finally {
            verify.disabled = false;
        }
    });
    changeForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(changeForm).entries());
        changeStatus.textContent = t('Sending…');
        changeStatus.className = 'save-status';
        try {
            const result = (await post('/api/v1/email/change', data)).payload.data;
            changeForm.reset();
            changeStatus.textContent = `${t('Confirmation link sent to')} ${result.pending_email}.${deliveryNote(result.delivered)}`;
            changeStatus.className = 'save-status is-success';
            await loadEmail();
        } catch (requestError) {
            changeForm.elements.current_password.value = '';
            changeStatus.textContent =
                requestError.payload?.errors?.current_password?.[0] ||
                requestError.payload?.errors?.email?.[0] ||
                requestError.message;
            changeStatus.textContent = t(changeStatus.textContent);
            changeStatus.className = 'save-status is-error';
        }
    });
    loadEmail();
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = t('Saving…');
        try {
            const result = await patch('/api/v1/profile', {
                display_name: input.value,
                biography: root.querySelector('[data-profile-biography]').value,
            });
            input.value = result.payload.data.display_name;
            status.textContent = t('Saved');
            status.className = 'save-status is-success';
            error.classList.add('is-hidden');
        } catch (requestError) {
            error.textContent =
                requestError.payload?.errors?.display_name?.[0] || requestError.message;
            error.classList.remove('is-hidden');
            status.textContent = '';
        }
    });

    avatarInput?.addEventListener('change', async () => {
        const file = avatarInput.files?.[0];
        avatarInput.value = '';
        if (!file) return;
        const formData = new FormData();
        formData.append('avatar', file, file.name);
        status.textContent = t('Uploading image…');
        try {
            const result = await upload('/api/v1/profile/avatar', formData);
            renderAvatar(result.payload.data.avatar_url);
            status.textContent = t('Profile picture updated');
            status.className = 'save-status is-success';
        } catch (requestError) {
            status.textContent = requestError.payload?.errors?.avatar?.[0] || requestError.message;
            status.className = 'save-status is-error';
        }
    });

    avatarRemove?.addEventListener('click', async () => {
        status.textContent = t('Removing image…');
        try {
            await remove('/api/v1/profile/avatar');
            renderAvatar(null);
            status.textContent = t('Profile picture removed');
            status.className = 'save-status is-success';
        } catch (requestError) {
            status.textContent = requestError.message || t('Unable to remove the profile picture.');
            status.className = 'save-status is-error';
        }
    });
}
