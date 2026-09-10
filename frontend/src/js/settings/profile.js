import { patch, remove, upload } from '../lib/http';

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
            image.alt = 'Ảnh đại diện';
            avatar.append(image);
            return;
        }
        const fallback = document.createElement('span');
        fallback.textContent = (input.value || '?').trim().slice(0, 1).toUpperCase();
        avatar.append(fallback);
    };

    renderAvatar(initialAvatarUrl);
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Đang lưu…';
        try {
            const result = await patch('/api/v1/profile', { display_name: input.value });
            input.value = result.payload.data.display_name;
            status.textContent = 'Đã lưu';
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
        status.textContent = 'Đang tải ảnh…';
        try {
            const result = await upload('/api/v1/profile/avatar', formData);
            renderAvatar(result.payload.data.avatar_url);
            status.textContent = 'Đã cập nhật ảnh';
            status.className = 'save-status is-success';
        } catch (requestError) {
            status.textContent = requestError.payload?.errors?.avatar?.[0] || requestError.message;
            status.className = 'save-status is-error';
        }
    });

    avatarRemove?.addEventListener('click', async () => {
        status.textContent = 'Đang xóa ảnh…';
        try {
            await remove('/api/v1/profile/avatar');
            renderAvatar(null);
            status.textContent = 'Đã xóa ảnh';
            status.className = 'save-status is-success';
        } catch (requestError) {
            status.textContent = requestError.message || 'Không thể xóa ảnh.';
            status.className = 'save-status is-error';
        }
    });
}
