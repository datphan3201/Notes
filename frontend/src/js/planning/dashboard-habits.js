import { t } from '../lib/i18n.js';
import { checkMark } from '../lib/check-mark.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { streakLabel } from '../lib/habit-days.js';

const visibleHabits = 5;

/** Checked-in Habits over all Habits, judged by each Habit's own local date. */
export function habitCheckInSummary(habits) {
    return { done: habits.filter((habit) => habit.done_today).length, total: habits.length };
}

/** Weekly Habits report progress toward their weekly target, not a daily check. */
export function weeklyHabitTargets(habits) {
    return habits.filter((habit) => habit.period === 'weekly');
}

export function habitProgressText(habit) {
    return `${habit.completed_days}/${habit.target_frequency} ${t(habit.period === 'weekly' ? 'this week' : 'today')} · ${t('Streak')}: ${streakLabel(habit.streak, t)}${habit.rest_today ? ` · ${t('Rest day')}` : ''}`;
}

/** Today card: each Habit can be checked in or undone for its own local today. */
export function renderHabitChecklist(container, habits, { onToggle, busy = false }) {
    container.replaceChildren();
    if (!habits.length) {
        renderEmptyState(container, {
            title: 'Build a steady rhythm.',
            description: 'Create a habit and it will appear here with its own streak.',
            icon: 'habits',
            href: '/habits',
            action: 'Explore habits',
        });
        return;
    }
    for (const habit of habits.slice(0, visibleHabits)) {
        const row = document.createElement('article');
        row.className = 'dashboard-item dashboard-checklist-row';
        row.classList.toggle('is-done', habit.done_today);
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'task-completion-button';
        tick.setAttribute('role', 'checkbox');
        tick.setAttribute('aria-checked', String(habit.done_today));
        tick.setAttribute(
            'aria-label',
            `${habit.done_today ? t('Undo today’s check-in') : t('Mark today as done')}: ${habit.name}`,
        );
        tick.dataset.dashboardTaskControl = `habit:${habit.id}`;
        tick.disabled = busy;
        if (habit.done_today) tick.append(checkMark());
        tick.addEventListener('click', () => onToggle(habit));
        const copy = document.createElement('a');
        copy.className = 'dashboard-item-copy';
        copy.href = '/habits';
        const name = document.createElement('strong');
        name.textContent = habit.name;
        const meta = document.createElement('small');
        meta.textContent = habitProgressText(habit);
        copy.append(name, meta);
        row.append(tick, copy);
        container.append(row);
    }
    if (habits.length > visibleHabits) {
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href = '/habits';
        link.textContent = `${t('View all')} ${habits.length} ${t('habits')} →`;
        container.append(link);
    }
}

/** This week card: read-only progress toward weekly Habit targets. */
export function renderHabitTargets(container, habits) {
    container.replaceChildren();
    const weekly = weeklyHabitTargets(habits);
    if (!weekly.length) {
        const empty = document.createElement('p');
        empty.className = 'subtle-copy';
        empty.textContent = t('No weekly habit targets yet.');
        container.append(empty);
        return;
    }
    for (const habit of weekly) {
        const row = document.createElement('a');
        row.className = 'dashboard-item';
        row.href = '/habits';
        const marker = document.createElement('span');
        marker.className = 'task-marker';
        marker.setAttribute('aria-hidden', 'true');
        const reached = habit.completed_days >= habit.target_frequency;
        marker.classList.toggle('is-complete', reached);
        if (reached) marker.append(checkMark());
        const copy = document.createElement('span');
        copy.className = 'dashboard-item-copy';
        const name = document.createElement('strong');
        name.textContent = habit.name;
        const meta = document.createElement('small');
        meta.textContent = habitProgressText(habit);
        copy.append(name, meta);
        row.append(marker, copy);
        container.append(row);
    }
}
