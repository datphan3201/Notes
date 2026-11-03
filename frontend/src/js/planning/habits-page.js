import { lineIcon } from '../lib/line-icons.js';
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

// Secondary actions share the existing Rest Day popover; today check-in is direct.
let openMenu = null;
let menuAnchor = null;
function closeHabitMenu(restoreFocus = false) {
    openMenu?.remove();
    openMenu = null;
    menuAnchor?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) menuAnchor?.focus();
    menuAnchor = null;
}
globalThis.document?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openMenu) {
        event.preventDefault();
        closeHabitMenu(true);
    }
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
        const focusKey = control.dataset.habitControl;
        control.disabled = true;
        closeHabitMenu();
        try {
            await operation();
            await load();
        } catch (error) {
            showError(root, error);
        } finally {
            control.disabled = false;
            if (focusKey) {
                const nextControl = root.querySelector(
                    `[data-habit-control="${CSS.escape(focusKey)}"]`,
                );
                (nextControl || root.querySelector('[data-planning-retry]'))?.focus();
            }
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

    const openMenuFor = (anchor, habit, restDays) => {
        if (openMenu?.dataset.habitId === habit.id) return closeHabitMenu();
        closeHabitMenu();
        const menu = document.createElement('div');
        menu.className = 'schedule-menu habit-action-menu';
        menu.dataset.habitId = habit.id;
        menu.setAttribute('role', 'dialog');
        menu.setAttribute('aria-label', `${t('More options')}: ${habit.name}`);
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
        const archive = menuButton(t('Archive'), () => {
            if (
                !window.confirm(
                    `${t('Archive')} “${habit.name}”? ${t('This removes it from active lists without deleting its data.')}`,
                )
            )
                return;
            act(anchor, () =>
                remove(`/api/v1/habits/${habit.id}`, { base_version: habit.version }),
            );
        });
        archive.setAttribute('aria-label', `${t('Archive')} ${habit.name}`);
        menu.append(heading, hint, days, archive);
        document.body.append(menu);
        const rect = anchor.getBoundingClientRect();
        menu.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - menu.offsetHeight - 8))}px`;
        menu.style.left = `${Math.max(8, Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - 8))}px`;
        openMenu = menu;
        menuAnchor = anchor;
        anchor.setAttribute('aria-expanded', 'true');
        days.querySelector('button').focus();
    };

    const habitRow = (habit, checkedDates) => {
        const today = habit.today;
        const restDays = new Set(habit.rest_days || []);
        const doneToday = checkedDates.has(today);
        const row = document.createElement('article');
        row.className = 'planning-list-item planning-list-item-wrap habit-row';

        const copy = document.createElement('div');
        copy.className = 'habit-row-copy';
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
            button.dataset.habitControl = `${habit.id}:${date}`;
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
        tick.dataset.habitControl = `${habit.id}:today`;
        tick.setAttribute('role', 'checkbox');
        tick.setAttribute('aria-checked', String(doneToday));
        tick.classList.toggle('is-checked', doneToday);
        tick.classList.toggle('is-rest', !doneToday && restDays.has(today));
        tick.setAttribute(
            'aria-label',
            `${doneToday ? t('Undo today’s check-in') : t('Mark today as done')}: ${habit.name}`,
        );
        tick.title = tick.getAttribute('aria-label');
        const circle = document.createElement('span');
        circle.className = 'habit-tick-circle';
        circle.append(checkMark());
        tick.append(circle);
        tick.addEventListener('click', () => act(tick, () => checkIn(habit, today, doneToday)));
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'button button-quiet';
        edit.textContent = t('Edit');
        edit.setAttribute('aria-label', `${t('Edit')} ${habit.name}`);
        edit.addEventListener('click', () => openEdit(habit));
        const more = document.createElement('button');
        more.type = 'button';
        // Same ⋯ affordance as Task rows.
        more.className = 'icon-button task-row-icon';
        more.dataset.habitMenu = '';
        more.dataset.habitControl = `${habit.id}:options`;
        more.title = t('More options');
        more.append(lineIcon('more'));
        more.setAttribute('aria-label', `${t('More options')}: ${habit.name}`);
        more.setAttribute('aria-haspopup', 'dialog');
        more.setAttribute('aria-expanded', 'false');
        more.addEventListener('click', () => openMenuFor(more, habit, restDays));
        actions.append(edit, more);
        row.append(tick, copy, days, actions);
        return row;
    };

    const load = async () => {
        closeHabitMenu();
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
