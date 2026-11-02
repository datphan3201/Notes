import { t } from '../lib/i18n.js';

/** The shared workspace dialog keeps a deadline decision separate from completion. */
export function chooseReopenDeadline(task, today) {
    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'workspace-dialog';
        dialog.setAttribute('aria-labelledby', 'reopen-task-title');
        const heading = document.createElement('header');
        heading.className = 'section-heading';
        const title = document.createElement('h2');
        title.id = 'reopen-task-title';
        title.textContent = t('Reopen task');
        heading.append(title);
        const description = document.createElement('p');
        description.textContent = `${task.name} · ${t('Choose a new due date or remove the previous overdue date.')}`;
        const form = document.createElement('form');
        form.className = 'stack-form';
        const field = document.createElement('div');
        field.className = 'field';
        const label = document.createElement('label');
        label.htmlFor = 'reopen-task-deadline';
        label.textContent = t('Due date');
        const date = document.createElement('input');
        date.type = 'date';
        date.id = 'reopen-task-deadline';
        date.min = task.start_date && task.start_date > today ? task.start_date : today;
        const help = document.createElement('small');
        help.id = 'reopen-task-deadline-help';
        help.textContent = t('Leave empty to remove the old due date.');
        date.setAttribute('aria-describedby', help.id);
        field.append(label, date, help);
        const footer = document.createElement('div');
        footer.className = 'dialog-footer';
        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'button button-quiet';
        cancel.textContent = t('Cancel');
        cancel.addEventListener('click', () => dialog.close());
        const save = document.createElement('button');
        save.type = 'submit';
        save.className = 'button button-primary';
        save.textContent = t('Reopen');
        footer.append(cancel, save);
        form.append(field, footer);
        dialog.append(heading, description, form);
        let result = null;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            result = { deadline: date.value || null };
            dialog.close();
        });
        dialog.addEventListener(
            'close',
            () => {
                dialog.remove();
                previousFocus?.focus();
                resolve(result);
            },
            { once: true },
        );
        document.body.append(dialog);
        dialog.showModal();
        date.focus();
    });
}
