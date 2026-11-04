import { lineIcon } from '../lib/line-icons.js';
import { t } from '../lib/i18n.js';

// Native disclosure supplies Enter/Space and Tab; Escape/outside clicks close and restore focus.
export function actionMenu(name, items) {
    const menu = document.createElement('details');
    menu.className = 'task-row-menu';
    const trigger = document.createElement('summary');
    trigger.className = 'icon-button task-row-icon';
    trigger.setAttribute('aria-label', `${t('More options')}: ${name}`);
    trigger.title = t('More options');
    trigger.append(lineIcon('more'));
    const panel = document.createElement('div');
    panel.className = 'task-row-menu-panel';
    for (const { label, icon, action, danger = false } of items) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `menu-item${danger ? ' is-danger' : ''}`;
        button.append(
            lineIcon(icon),
            Object.assign(document.createElement('span'), { textContent: label }),
        );
        button.addEventListener('click', () => {
            menu.open = false;
            trigger.focus();
            action();
        });
        panel.append(button);
    }
    menu.append(trigger, panel);
    return menu;
}

export function initActionMenus(root) {
    const close = (except, restore = false) =>
        root.querySelectorAll('.task-row-menu[open]').forEach((menu) => {
            if (menu === except) return;
            menu.open = false;
            if (restore) menu.querySelector('summary').focus();
        });
    document.addEventListener('click', (event) => close(event.target.closest?.('.task-row-menu')));
    root.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && event.target.closest('.task-row-menu[open]')) {
            event.preventDefault();
            event.stopPropagation();
            close(null, true);
        }
    });
}
