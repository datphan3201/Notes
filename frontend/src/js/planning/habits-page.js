import { get, patch, post, put, remove } from '../lib/http.js';
import { t } from '../lib/i18n.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderStreak } from './insights-ui.js';
import { LatestRequest } from '../lib/read-coordinator.js';
import {
    creationState,
    createWithForm,
    finishCreation,
    reportWorkspaceError,
} from '../lib/workspace-ui.js';
import { checkMark, crossMark } from '../lib/check-mark.js';
import { createTagPicker, loadTags, sameTagIds, tagChips } from './tag-picker.js';
import {
    habitDayDescriptions,
    habitDayState,
    restWindow,
    shiftDate,
    streakLabel,
} from '../lib/habit-days.js';

function showError(root, error) {
    reportWorkspaceError(root, error);
}

const locale = () => (window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US');
const dayName = (date, style = 'short') =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), { weekday: style, timeZone: 'UTC' });

// One popover at a time: "done today" plus the Rest Day window.
let openMenu = null;
function closeHabitMenu() {
    openMenu?.remove();
    openMenu = null;
}
globalThis.document?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openMenu) closeHabitMenu();
});
globalThis.document?.addEventListener('pointerdown', (event) => {
    if (openMenu && !openMenu.contains(event.target) && !event.target.closest('[data-habit-menu]'))
        closeHabitMenu();
});

function menuButton(label, onClick, { pressed = null, className = '' } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `schedule-option ${className}`.trim();
    if (pressed !== null) button.setAttribute('aria-pressed', String(pressed));
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

export function initHabitsPage(root) {
    const reads = new LatestRequest();
    const habitList = root.querySelector('[data-habit-list]');
    const editDialog = root.querySelector('#edit-habit-dialog');
    const editForm = root.querySelector('[data-habit-edit-form]');
    let editing = null;
    let goals = [];
    let tags = [];
    const createTags = createTagPicker();
    const editTags = createTagPicker();
    root.querySelector('[data-habit-create-form] [data-habit-tags]').append(createTags.element);
    editForm.querySelector('[data-habit-tags]').append(editTags.element);
    const fillGoalSelects = () => {
        for (const select of root.querySelectorAll('[data-habit-goal-select]')) {
            const value = select.value;
            select.replaceChildren(new Option(t('No goal'), ''));
            for (const goal of goals) select.add(new Option(goal.name, goal.id));
            select.value = goals.some((goal) => goal.id === value) ? value : '';
        }
    };

    const act = async (control, operation) => {
        control.disabled = true;
        closeHabitMenu();
        try {
            await operation();
            await load();
        } catch (error) {
            showError(root, error);
        } finally {
            control.disabled = false;
        }
    };
    const checkIn = (habit, date, done) =>
        done
            ? remove(`/api/v1/habits/${habit.id}/check-ins/${date}`)
            : put(`/api/v1/habits/${habit.id}/check-ins/${date}`);
    const toggleRest = (habit, date, rested) =>
        rested
            ? remove(`/api/v1/habits/${habit.id}/rest-days/${date}`)
            : put(`/api/v1/habits/${habit.id}/rest-days/${date}`);

    const openMenuFor = (anchor, habit, doneToday, restDays) => {
        if (openMenu?.dataset.habitId === habit.id) return closeHabitMenu();
        closeHabitMenu();
        const menu = document.createElement('div');
        menu.className = 'schedule-menu habit-action-menu';
        menu.dataset.habitId = habit.id;
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', `${habit.name}: ${t('Check in or plan a rest day')}`);
        const done = menuButton(
            doneToday ? t('Undo today’s check-in') : t('Mark today as done'),
            () => act(anchor, () => checkIn(habit, habit.today, doneToday)),
            { className: doneToday ? '' : 'is-primary' },
        );
        const heading = document.createElement('strong');
        heading.className = 'habit-menu-heading';
        heading.textContent = t('Rest day');
        const hint = document.createElement('small');
        hint.className = 'habit-menu-hint';
        hint.textContent = t(
            'Plan a rest day for one of the next 3 days. It keeps your streak but does not add to it.',
        );
        const days = document.createElement('div');
        days.className = 'habit-rest-options';
        for (const date of restWindow(habit.today)) {
            const rested = restDays.has(date);
            const option = menuButton(
                `${dayName(date)} ${Number(date.slice(8))}`,
                () => act(anchor, () => toggleRest(habit, date, rested)),
                { pressed: rested, className: 'habit-rest-option' },
            );
            option.title = rested ? t('Cancel this rest day') : t('Rest on this day');
            if (rested) option.prepend(checkMark());
            days.append(option);
        }
        menu.append(done, heading, hint, days);
        document.body.append(menu);
        const rect = anchor.getBoundingClientRect();
        menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8))}px`;
        menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`;
        openMenu = menu;
        done.focus();
    };

    const habitRow = (habit, checkedDates) => {
        const today = habit.today;
        const restDays = new Set(habit.rest_days || []);
        const doneToday = checkedDates.has(today);
        const row = document.createElement('article');
        row.className = 'planning-list-item planning-list-item-wrap habit-row';

        const copy = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = habit.name;
        copy.append(name);
        if (habit.description) {
            const description = document.createElement('p');
            description.className = 'subtle-copy';
            description.textContent = habit.description;
            copy.append(description);
        }
        const periodStart = habit.period === 'daily' ? today : weekStartOf(today);
        const count = [...checkedDates].filter(
            (date) => date >= periodStart && date <= today,
        ).length;
        const progress = document.createElement('small');
        progress.textContent = `${count}/${habit.target_frequency} ${t(habit.period === 'daily' ? 'today' : 'this week')} · ${t('Streak')}: ${streakLabel(habit.streak, t)}`;
        copy.append(progress);
        const goal = goals.find((item) => item.id === habit.primary_goal_id);
        if (goal) {
            const chip = document.createElement('a');
            chip.className = 'context-chip';
            chip.href = `/goals/${encodeURIComponent(goal.id)}`;
            chip.textContent = goal.name;
            copy.append(chip);
        }
        copy.append(...tagChips(habit.tag_ids, tags));
        if (restDays.has(today)) {
            const rest = document.createElement('small');
            rest.className = 'habit-rest-note';
            rest.textContent = t('Rest day today · your streak is protected');
            copy.append(rest);
        }

        // The last 7 days plus the 3-day Rest Day window.
        const days = document.createElement('div');
        days.className = 'habit-checkin-days';
        days.setAttribute('role', 'group');
        days.setAttribute('aria-label', `${habit.name}: ${t('recent days and rest days')}`);
        for (let offset = -6; offset <= 3; offset++) {
            const date = shiftDate(today, offset);
            const checked = checkedDates.has(date);
            const rested = restDays.has(date);
            const state = habitDayState(date, checked, today, habit.tracking_since, rested);
            const future = date > today;
            const button = document.createElement('button');
            button.type = 'button';
            button.classList.add(`is-${state}`);
            button.classList.toggle('is-future', future);
            button.classList.toggle('is-today', date === today);
            button.title = `${date} · ${t(habitDayDescriptions[state])}`;
            if (future) {
                button.setAttribute('aria-pressed', String(rested));
                button.setAttribute(
                    'aria-label',
                    `${rested ? t('Cancel rest day') : t('Rest day')} ${habit.name} ${date}`,
                );
                button.addEventListener('click', () =>
                    act(button, () => toggleRest(habit, date, rested)),
                );
            } else {
                button.setAttribute('aria-pressed', String(checked));
                button.setAttribute(
                    'aria-label',
                    `${checked ? t('Undo') : t('Check in')} ${habit.name} ${date}`,
                );
                button.addEventListener('click', () =>
                    act(button, () => checkIn(habit, date, checked)),
                );
            }
            const dot = document.createElement('span');
            dot.className = 'habit-checkin-dot';
            if (state === 'checked') dot.append(checkMark());
            if (state === 'missed') dot.append(crossMark());
            if (state === 'rest') dot.textContent = 'R';
            const weekday = document.createElement('small');
            weekday.textContent = dayName(date, 'narrow');
            button.append(dot, weekday);
            days.append(button);
        }

        const actions = document.createElement('div');
        actions.className = 'habit-row-actions';
        const tick = document.createElement('button');
        tick.type = 'button';
        tick.className = 'habit-tick';
        tick.dataset.habitMenu = '';
        tick.classList.toggle('is-checked', doneToday);
        tick.classList.toggle('is-rest', !doneToday && restDays.has(today));
        tick.setAttribute('aria-haspopup', 'dialog');
        tick.setAttribute(
            'aria-label',
            `${habit.name}: ${doneToday ? t('done today') : t('check in or plan a rest day')}`,
        );
        tick.title = tick.getAttribute('aria-label');
        const circle = document.createElement('span');
        circle.className = 'habit-tick-circle';
        circle.append(checkMark());
        tick.append(circle);
        tick.addEventListener('click', () => openMenuFor(tick, habit, doneToday, restDays));
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button button-quiet';
        edit.textContent = t('Edit');
        edit.setAttribute('aria-label', `${t('Edit')} ${habit.name}`);
        edit.addEventListener('click', () => openEdit(habit));
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'button button-quiet';
        removeButton.textContent = t('Delete');
        removeButton.setAttribute('aria-label', `${t('Delete')} ${habit.name}`);
        removeButton.addEventListener('click', () => {
            if (!window.confirm(`${t('Delete habit')} “${habit.name}”?`)) return;
            act(removeButton, () =>
                remove(`/api/v1/habits/${habit.id}`, { base_version: habit.version }),
            );
        });
        actions.append(tick, edit, removeButton);
        row.append(copy, days, actions);
        return row;
    };

    const load = async () => {
        const ticket = reads.begin();
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const [habits, dashboard, goalList] = await Promise.all([
                get('/api/v1/habits', { signal: ticket.signal }),
                get('/api/v1/dashboard', { signal: ticket.signal }),
                get('/api/v1/goals', { signal: ticket.signal }),
            ]);
            goals = goalList.payload.data.filter((goal) => goal.status !== 'Completed');
            tags = await loadTags().catch(() => []);
            fillGoalSelects();
            const histories = await Promise.all(
                habits.payload.data.map((habit) =>
                    get(`/api/v1/habits/${habit.id}/history`, { signal: ticket.signal }),
                ),
            );
            if (!reads.isCurrent(ticket)) return;
            renderStreak(
                root.querySelector('[data-habit-streak]'),
                dashboard.payload.data.habit_streak,
                dashboard.payload.data.today,
            );
            habitList.replaceChildren(
                ...habits.payload.data.map((habit, index) =>
                    habitRow(
                        habit,
                        new Set(histories[index].payload.data.map((entry) => entry.date)),
                    ),
                ),
            );
            if (!habits.payload.data.length)
                renderEmptyState(habitList, {
                    title: 'A fresh start, every day.',
                    description: 'Create a habit and start checking in. Small steps add up.',
                    icon: 'habits',
                    href: '#habit-name',
                    action: 'Create your first habit',
                });
        } catch (error) {
            if (reads.shouldIgnore(ticket, error)) return;
            showError(root, error);
        } finally {
            if (reads.isCurrent(ticket)) root.setAttribute('aria-busy', 'false');
        }
    };

    const syncTarget = (form) => {
        const daily = form.elements.period.value === 'daily';
        form.elements.target_frequency.disabled = daily;
        if (daily) form.elements.target_frequency.value = '1';
    };

    function openEdit(habit) {
        editing = habit;
        editForm.elements.name.value = habit.name;
        editForm.elements.description.value = habit.description || '';
        editForm.elements.period.value = habit.period;
        editForm.elements.target_frequency.value = String(habit.target_frequency);
        editForm.elements.primary_goal_id.value = goals.some(
            (goal) => goal.id === habit.primary_goal_id,
        )
            ? habit.primary_goal_id
            : '';
        editTags.value = habit.tag_ids;
        // The server freezes the period once the Habit has a check-in.
        const locked = !!habit.first_check_in_at;
        editForm.elements.period.disabled = locked;
        editDialog.querySelector('[data-habit-period-locked]').hidden = !locked;
        syncTarget(editForm);
        editDialog.querySelector('[data-dialog-error]').classList.add('is-hidden');
        creationState(editForm).markSaved();
        editDialog.showModal();
        editForm.elements.name.focus();
    }
    editForm.elements.period.addEventListener('change', () => syncTarget(editForm));
    editForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!editing) return;
        const habit = editing;
        const data = new FormData(editForm);
        const period = editForm.elements.period.value;
        const input = {
            base_version: habit.version,
            name: data.get('name'),
            description: data.get('description') || '',
            target_frequency:
                period === 'daily' ? 1 : Number(editForm.elements.target_frequency.value),
        };
        if (period !== habit.period) input.period = period;
        const goalId = editForm.elements.primary_goal_id.value || null;
        if (goalId !== (habit.primary_goal_id ?? null)) input.primary_goal_id = goalId;
        if (!sameTagIds(editTags.value, habit.tag_ids)) input.tag_ids = editTags.value;
        createWithForm(editForm, async () => {
            try {
                await patch(`/api/v1/habits/${habit.id}`, input);
                finishCreation(editForm);
                editing = null;
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });

    const habitForm = root.querySelector('[data-habit-create-form]');
    habitForm.elements.period.addEventListener('change', () => syncTarget(habitForm));
    syncTarget(habitForm);
    creationState(habitForm).markSaved();
    habitForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        createWithForm(form, async () => {
            try {
                await post('/api/v1/habits', {
                    name: data.get('name'),
                    period: data.get('period'),
                    target_frequency:
                        data.get('period') === 'daily' ? 1 : Number(data.get('target_frequency')),
                    description: data.get('description') || '',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    primary_goal_id: data.get('primary_goal_id') || null,
                    tag_ids: createTags.value,
                });
                form.reset();
                createTags.value = [];
                syncTarget(form);
                finishCreation(form);
                load();
            } catch (error) {
                showError(root, error);
            }
        });
    });
    root.querySelector('[data-planning-retry]').addEventListener('click', load);
    load();
}

function weekStartOf(date) {
    const day = new Date(`${date}T00:00:00Z`).getUTCDay();
    return shiftDate(date, -((day + 6) % 7));
}
