import { t } from './i18n.js';
import { OfflineStore } from './offline-store.js';

/**
 * Registers the service worker (offline pages and assets), shows a small
 * offline indicator on every page and clears offline data on logout.
 */
export function initPwa() {
    if ('serviceWorker' in navigator && window.isSecureContext && !import.meta.env?.DEV) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').catch(() => {
                // Offline support is an enhancement; the app works without it.
            });
        });
    }
    const topbar = document.querySelector('.topbar-actions, [data-topbar-actions]');
    let pill = null;
    const render = () => {
        const offline = navigator.onLine === false;
        document.documentElement.classList.toggle('is-offline', offline);
        if (!topbar) return;
        if (offline && !pill) {
            pill = document.createElement('span');
            pill.className = 'offline-pill';
            pill.setAttribute('role', 'status');
            pill.textContent = t('Offline');
            topbar.prepend(pill);
        } else if (!offline && pill) {
            pill.remove();
            pill = null;
        }
    };
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    render();
}

/** Deletes cached pages/files and every account's IndexedDB copy (logout). */
export async function clearOfflineData() {
    const tasks = [OfflineStore.clearAll()];
    if ('caches' in window) {
        tasks.push(
            caches
                .keys()
                .then((keys) =>
                    Promise.all(
                        keys
                            .filter((key) => key.startsWith('planner-'))
                            .map((key) => caches.delete(key)),
                    ),
                )
                .catch(() => {}),
        );
    }
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear' });
    // Never let cleanup block logout for long.
    await Promise.race([Promise.all(tasks), new Promise((resolve) => setTimeout(resolve, 1500))]);
}
