import { get, post } from './http.js';
import { t } from './i18n.js';

const POLL_MS = 60000;

// Pure helper so the unread badge stays testable: reminders are always pending.
export function unreadLabel(count) {
    if (!count) return '';
    return count > 99 ? '99+' : String(count);
}

export function initNotifications(root = document.querySelector('[data-notifications]')) {
    if (!root) return;
    const toggle = root.querySelector('[data-notifications-toggle]');
    const panel = root.querySelector('[data-notifications-panel]');
    const list = root.querySelector('[data-notifications-list]');
    const badge = root.querySelector('[data-notifications-count]');
    let timer = null;

    const showCount = (count) => {
        badge.textContent = unreadLabel(count);
        badge.hidden = !count;
        toggle.setAttribute(
            'aria-label',
            count ? `${t('Notifications')} (${count} ${t('unread')})` : t('Notifications'),
        );
    };
    const item = ({ title, body, url, unread, onOpen }) => {
        const link = document.createElement('a');
        link.className = `notification-item${unread ? ' is-unread' : ''}`;
        link.href = url || '#';
        const heading = document.createElement('strong');
        heading.textContent = title;
        link.append(heading);
        if (body) {
            const detail = document.createElement('small');
            detail.textContent = body;
            link.append(detail);
        }
        if (onOpen) link.addEventListener('click', onOpen);
        return link;
    };
    const load = async () => {
        if (document.hidden) return;
        try {
            const { items, unread, reminders } = (await get('/api/v1/notifications')).payload.data;
            showCount(unread);
            if (panel.hidden) return;
            list.replaceChildren();
            for (const task of reminders) {
                list.append(
                    item({
                        title: `${t('Reminder')}: ${task.name}`,
                        body: new Date(task.reminder_at).toLocaleString(),
                        url: task.url || `/tasks/${encodeURIComponent(task.id)}`,
                        unread: true,
                    }),
                );
            }
            for (const notification of items) {
                list.append(
                    item({
                        title: notification.payload.title || notification.type,
                        body: notification.payload.body,
                        url: notification.payload.url,
                        unread: !notification.read_at,
                        onOpen: () => {
                            if (!notification.read_at)
                                post(`/api/v1/notifications/${notification.id}/read`, {}).catch(
                                    () => {},
                                );
                        },
                    }),
                );
            }
            if (!list.children.length) list.textContent = t('You are all caught up.');
        } catch {
            // Notifications are advisory; a failed poll retries on the next tick.
        }
    };
    toggle.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        toggle.setAttribute('aria-expanded', String(!panel.hidden));
        if (!panel.hidden) {
            list.textContent = t('Loading…');
            load();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !panel.hidden) {
            panel.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
        }
    });
    document.addEventListener('click', (event) => {
        if (!panel.hidden && !root.contains(event.target)) {
            panel.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
        }
    });
    root.querySelector('[data-notifications-read-all]').addEventListener('click', async () => {
        await post('/api/v1/notifications/read', {}).catch(() => {});
        load();
    });
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) load();
    });
    load();
    timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
}
