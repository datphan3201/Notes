import { t, statusLabel } from '../lib/i18n.js';
import { checkMark } from '../lib/check-mark.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { localDate, taskIsOverdue } from './task-views.js';

export function taskScheduledOn(task, today, timezone) {
    const start = localDate(task.scheduled_start, timezone);
    const end = localDate(task.scheduled_end, timezone) || start;
    return (
        task.start_date === today ||
        task.occurrence_date === today ||
        !!(start && start <= today && end >= today)
    );
}

function scheduleKey(task, timezone) {
    if (task.scheduled_start) {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).formatToParts(new Date(task.scheduled_start));
        const value = (type) => parts.find((part) => part.type === type).value;
        return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}`;
    }
    return task.start_date || task.occurrence_date || '9999';
}

/** Sorting and status filtering are independent and never rewrite the underlying order. */
export function dashboardTaskList(
    tasks,
    { sort = 'importance', status = 'all', timezone = 'UTC' } = {},
) {
    return tasks
        .filter((task) => status === 'all' || task.status === status)
        .sort((left, right) => {
            const primary =
                sort === 'scheduled'
                    ? scheduleKey(left, timezone).localeCompare(scheduleKey(right, timezone))
                    : Number(right.importance) - Number(left.importance);
            return (
                primary ||
                Number(left.selection_position || 0) - Number(right.selection_position || 0) ||
                left.id.localeCompare(right.id)
            );
        });
}

export function weeklyTaskList(tasks, options) {
    return dashboardTaskList(tasks, options);
}

/** Uses the same completion button and context chips as the existing Task rows. */
export function renderTaskChecklist(
    container,
    items,
    {
        today,
        timezone,
        mode,
        todayIds,
        dailyIds,
        onToggle,
        onAddToday,
        onRemoveToday,
        busy = false,
        limit = 4,
    },
) {
    container.replaceChildren();
    if (!items.length) {
        renderEmptyState(
            container,
            mode === 'today'
                ? {
                      title: 'A little room to focus.',
                      description: 'Choose a task for today or add one from this week.',
                  }
                : {
                      title: 'Choose your focus.',
                      description: 'Select tasks for this week from your task list.',
                      href: '/tasks?view=all',
                      action: 'Select tasks',
                  },
        );
    }
    for (const task of items.slice(0, limit)) {
        const row = document.createElement('article');
        row.className = 'dashboard-item dashboard-checklist-row';
        const done = task.status === 'Done';
        row.classList.toggle('is-done', done);
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'task-completion-button';
        tick.setAttribute('role', 'checkbox');
        tick.setAttribute('aria-checked', String(done));
        tick.setAttribute('aria-label', `${done ? t('Reopen') : t('Complete')} ${task.name}`);
        tick.dataset.dashboardTaskControl = `${mode}:complete:${task.id}`;
        tick.disabled = busy;
        if (done) tick.append(checkMark());
        tick.addEventListener('click', () => onToggle(task));
        const copy = document.createElement('a');
        copy.className = 'dashboard-item-copy';
        copy.href = `/tasks/${encodeURIComponent(task.id)}`;
        const name = document.createElement('strong');
        name.textContent = task.name;
        const meta = document.createElement('small');
        meta.textContent = [
            task.status === 'InProgress' ? t('On progress') : statusLabel(task.status),
            task.deadline ? `${t('Due')} ${task.deadline}` : '',
        ]
            .filter(Boolean)
            .join(' · ');
        if (task.scheduled_start) {
            const format = new Intl.DateTimeFormat(
                window.notesBootstrap.preferences.locale === 'vi' ? 'vi-VN' : 'en-US',
                {
                    timeZone: timezone,
                    dateStyle: 'short',
                    timeStyle: 'short',
                },
            );
            meta.textContent += ` · ${t('Scheduled')} ${format.format(new Date(task.scheduled_start))}${task.scheduled_end ? ` – ${format.format(new Date(task.scheduled_end))}` : ''}`;
        } else if (task.start_date || task.occurrence_date) {
            meta.textContent += ` · ${t('Scheduled')} ${task.start_date || task.occurrence_date}`;
        }
        copy.append(name, meta);
        if (mode === 'today') {
            const labels = [];
            if (!done && taskScheduledOn(task, today, timezone)) labels.push('Scheduled');
            if (taskIsOverdue(task, today)) labels.push('Overdue');
            if (!done && task.deadline === today) labels.push('Due today');
            if (labels.length) {
                const badges = document.createElement('span');
                badges.className = 'dashboard-task-labels';
                for (const label of labels) {
                    const badge = document.createElement('span');
                    badge.className = 'context-chip';
                    badge.classList.toggle('is-overdue', label === 'Overdue');
                    badge.textContent = t(label);
                    badges.append(badge);
                }
                copy.append(badges);
            }
        }
        row.append(tick, copy);
        if (mode === 'week' && !done) {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'icon-button dashboard-plan-button';
            add.textContent = '+';
            add.title = t('Add for today');
            add.disabled = busy || todayIds.has(task.id);
            add.setAttribute('aria-pressed', String(todayIds.has(task.id)));
            add.setAttribute('aria-label', `${t('Add for today')}: ${task.name}`);
            add.dataset.dashboardTaskControl = `${mode}:add:${task.id}`;
            if (todayIds.has(task.id)) add.replaceChildren(checkMark());
            add.addEventListener('click', () => onAddToday(task));
            row.append(add);
        } else if (mode === 'today' && dailyIds.has(task.id)) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'icon-button';
            remove.textContent = '×';
            remove.setAttribute('aria-label', `${t('Remove from today')}: ${task.name}`);
            remove.title = t("Remove today's selection; scheduled tasks remain in Today.");
            remove.dataset.dashboardTaskControl = `${mode}:remove:${task.id}`;
            remove.disabled = busy;
            remove.addEventListener('click', () => onRemoveToday(task));
            row.append(remove);
        }
        container.append(row);
    }
    if (items.length > limit) {
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href = `/tasks?view=${mode === 'today' ? 'today' : 'week'}`;
        link.textContent = `${t('View all')} ${items.length} ${t('tasks')} →`;
        container.append(link);
    }
}
