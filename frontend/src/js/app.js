import Alpine from 'alpinejs';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/500.css';
import '@fontsource/noto-sans/600.css';
import './lib/normalization';
import { RecoveryStore } from './lib/recovery-store';
import { NotesPage } from './notes/notes-page';
import { initPassword } from './settings/password';
import { initPreferences } from './settings/preferences';
import { initProfile } from './settings/profile';

window.Alpine = Alpine;

// Alpine remains intentionally small: this app's multi-request state lives in
// plain modules so it can be tested with fake clocks and transports.
Alpine.start();

window.notesSessionChannel =
    typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('notes-r1-session');
window.notesSessionChannel?.addEventListener('message', (event) => {
    if (String(event.data?.userId) !== String(window.notesBootstrap?.user?.id)) return;
    RecoveryStore.clearAll();
    document.dispatchEvent(new CustomEvent('notes:session-changed'));
});

// Settings pages do not have an editor to ask for a leave decision, but logout
// still needs to erase this tab's account-scoped recovery record.
document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-leave-guard-form]');
    if (!form || document.querySelector('[data-notes-workspace]')) return;
    RecoveryStore.clearAll();
    window.notesSessionChannel?.postMessage({
        userId: String(window.notesBootstrap?.user?.id),
        type: 'logout',
    });
});

document.addEventListener('DOMContentLoaded', () => {
    const notes = document.querySelector('[data-notes-workspace]');
    if (notes) new NotesPage(notes).init();
    const profile = document.querySelector('[data-profile-settings]');
    if (profile) initProfile(profile);
    const preferences = document.querySelector('[data-preference-settings]');
    if (preferences) initPreferences(preferences);
    const password = document.querySelector('[data-password-settings]');
    if (password) initPassword(password);

    document.querySelectorAll('[data-avatar-fallback]').forEach((avatar) => {
        const url = window.notesBootstrap?.user?.avatar_url;
        if (!url) return;
        const image = document.createElement('img');
        image.alt = 'Ảnh đại diện';
        image.src = url;
        avatar.replaceChildren(image);
    });
});
