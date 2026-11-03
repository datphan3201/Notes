import { formatDay } from '../lib/format.js';
import { t, statusLabel } from '../lib/i18n.js';
import { lineIcon } from '../lib/line-icons.js';
import { get, post, put, remove } from '../lib/http.js';
import { dashboardTaskList, weeklyTaskList, renderTaskChecklist } from './dashboard-tasks.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderRing, renderDayBars, renderStreak } from './insights-ui.js';
import { transitionEntity } from './transitions.js';
import { checkMark } from '../lib/check-mark.js';
import {
    habitCheckInSummary,
    renderHabitChecklist,
    renderHabitTargets,
} from './dashboard-habits.js';
import { initDashboardRoadmap } from './dashboard-roadmap.js';
import { renderRecentActivity } from './recent-activity.js';

function message(root, error) {
    const output = root.querySelector('[data-planning-error]');
    output.textContent = Object.values(error.payload?.errors || {}).flat()[0] || error.message;
    output.classList.remove('is-hidden');
}

function rows(container, items, empty, type = 'task') {
    container.replaceChildren();
    if (!items.length) renderEmptyState(container, empty);
    for (const item of items.slice(0, 4)) {
        const row = document.createElement('a');
        row.className = 'dashboard-item';
        row.href =
            type === 'milestone'
                ? `/goals/${encodeURIComponent(item.goal_id)}#milestone=${encodeURIComponent(item.id)}`
                : `/tasks/${encodeURIComponent(item.id)}`;
        const marker = document.createElement('span');
        marker.className = 'task-marker';
        marker.setAttribute('aria-hidden', 'true');
        const complete = item.status === 'Done' || item.status === 'Completed';
        marker.classList.toggle('is-complete', complete);
        if (complete) marker.append(checkMark());
        const copy = document.createElement('span');
        copy.className = 'dashboard-item-copy';
        const name = document.createElement('strong');
        name.textContent = item.name;
        const meta = document.createElement('small');
        meta.textContent = `${statusLabel(item.status || 'NotStarted')}${item.deadline ? ` · ${t('Due')} ${formatDay(item.deadline)}` : ''}`;
        copy.append(name, meta);
        row.append(marker, copy);
        container.append(row);
    }
    if (items.length > 4) {
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href = type === 'milestone' ? '/goals' : '/tasks?view=all';
        link.textContent = `${t('View all')} ${items.length} ${t(type === 'milestone' ? 'milestones' : 'tasks')} →`;
        container.append(link);
    }
}

const activityTypes = {
    task: ['task', 'tasks'],
    checklist: ['checklist item', 'checklist items'],
    habit: ['habit check-in', 'habit check-ins'],
    milestone: ['milestone', 'milestones'],
};

export function activityLevel(total) {
    if (total < 1) return 0;
    if (total === 1) return 1;
    if (total <= 3) return 2;
    if (total <= 6) return 3;
    return 4;
}

/**
 * A whole year as one block per month. Each block holds Monday-first week
 * columns (rows Mon…Sun) with null cells outside that month, so every
 * square sits under its own month label. `column` is the block's first
 * week column counted across the whole year.
 */
export function yearCalendar(year, activityDays) {
    const active = new Map(activityDays.map((day) => [day.date, day]));
    const pad = (value) => String(value).padStart(2, '0');
    const months = [];
    let column = 0;
    for (let month = 0; month < 12; month += 1) {
        const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const cells = Array.from(
            { length: (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7 },
            () => null,
        );
        for (let day = 1; day <= length; day += 1) {
            const date = `${year}-${pad(month + 1)}-${pad(day)}`;
            cells.push(active.get(date) || { date, total: 0, counts: {} });
        }
        while (cells.length % 7 !== 0) cells.push(null);
        months.push({ month, column, weeks: cells.length / 7, cells });
        column += cells.length / 7;
    }
    return { months, columns: column };
}

const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function renderYearActivity(root, data, direction = 0) {
    const grid = root.querySelector('[data-activity-grid]');
    const label = String(data.year);
    root.querySelector('[data-activity-summary]').textContent =
        `${data.total} ${data.total === 1 ? t('contribution') : t('contributions')} · ${label}`;
    root.querySelector('[data-activity-total]').textContent = data.total;
    root.querySelector('[data-activity-unit]').textContent =
        data.total === 1 ? t('contribution') : t('contributions');
    root.querySelector('[data-activity-days]').textContent =
        `${t('Across')} ${data.active_days} ${data.active_days === 1 ? t('active day') : t('active days')}`;
    root.querySelector('[data-activity-tooltip]').classList.add('is-hidden');
    const calendar = yearCalendar(data.year, data.days);
    const monthName = new Intl.DateTimeFormat(
        window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US',
        { month: 'short', timeZone: 'UTC' },
    );
    // Column 1 holds weekday names; a narrow gutter column separates months.
    grid.style.gridTemplateColumns = `var(--activity-label-width) ${calendar.months
        .map(({ weeks }) => `repeat(${weeks}, var(--activity-cell))`)
        .join(' var(--activity-month-gap) ')}`;
    grid.replaceChildren();
    weekdayNames.forEach((name, row) => {
        const weekday = document.createElement('span');
        weekday.className = 'activity-weekday';
        weekday.setAttribute('aria-hidden', 'true');
        weekday.style.gridArea = `${row + 2} / 1`;
        weekday.textContent = row % 2 === 0 ? t(name) : '';
        grid.append(weekday);
    });
    calendar.months.forEach(({ month, column, weeks, cells }, index) => {
        const first = 2 + column + index;
        const heading = document.createElement('span');
        heading.className = 'activity-month';
        heading.setAttribute('aria-hidden', 'true');
        heading.style.gridArea = `1 / ${first} / 2 / span ${weeks}`;
        heading.textContent = monthName.format(new Date(Date.UTC(data.year, month, 1)));
        grid.append(heading);
        cells.forEach((day, position) => {
            if (!day) return;
            const area = `${(position % 7) + 2} / ${first + Math.floor(position / 7)}`;
            if (day.date > data.today) {
                const blank = document.createElement('span');
                blank.className = 'activity-day-placeholder';
                blank.setAttribute('aria-hidden', 'true');
                blank.style.gridArea = area;
                grid.append(blank);
                return;
            }
            const level = activityLevel(day.total);
            const description = dayLabel(day);
            const cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'activity-day';
            cell.style.gridArea = area;
            cell.dataset.level = String(level);
            cell.dataset.tooltip = description;
            cell.setAttribute('aria-label', `${description}. Activity level ${level} of 4.`);
            grid.append(cell);
        });
    });
    const years = root.querySelector('[data-activity-years]');
    years.replaceChildren(
        ...yearWindow(data.year, data.years[0]).map(({ year, selected, selectable }) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `activity-year${selected ? ' is-selected' : ''}`;
            button.dataset.year = String(year);
            button.disabled = !selectable;
            button.setAttribute('aria-pressed', String(selected));
            button.textContent = String(year);
            return button;
        }),
    );
    // Slide the three rows in the direction the year moved.
    years.classList.remove('is-sliding-up', 'is-sliding-down');
    if (direction) {
        void years.offsetWidth;
        years.classList.add(direction > 0 ? 'is-sliding-up' : 'is-sliding-down');
    }
}

export const oldestActivityYear = 2000;

/**
 * The year spinner shows the next year, the selected year in the middle,
 * and the previous year. Rows outside [2000, current year] stay visible but
 * cannot be chosen.
 */
export function yearWindow(year, currentYear) {
    return [year + 1, year, year - 1].map((value) => ({
        year: value,
        selected: value === year,
        selectable: value >= oldestActivityYear && value <= currentYear,
    }));
}

function dayLabel(day) {
    const date = new Intl.DateTimeFormat(
        window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US',
        {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC',
        },
    ).format(new Date(`${day.date}T00:00:00Z`));
    if (!day.total) return `${t('No completions on')} ${date}`;

    const details = Object.entries(day.counts)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => {
            const labels = activityTypes[type] || [type, `${type}s`];
            return `${count} ${t(count === 1 ? labels[0] : labels[1])}`;
        })
        .join(', ');
    const contribution = day.total === 1 ? t('contribution') : t('contributions');
    return `${day.total} ${contribution} · ${date}${details ? ` — ${details}` : ''}`;
}

function weekRangeLabel(weekStart) {
    const format = new Intl.DateTimeFormat(
        window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US',
        { month: 'short', day: 'numeric', timeZone: 'UTC' },
    );
    const start = new Date(`${weekStart}T00:00:00Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${format.format(start)} – ${format.format(end)}`;
}

export function initDashboardPage(root) {
    const roadmap = initDashboardRoadmap(root, (error) => message(root, error));
    root.querySelector('[data-dashboard-open-activity]')?.addEventListener('click', () => {
        root.querySelector('[data-workspace-tab="activity"]')?.click();
        root.querySelector('[data-workspace-tab="activity"]')?.focus();
    });
    let displayedMonth = null;
    let displayedYear = null;
    let currentYear = null;
    let yearLoading = false;
    const previous = root.querySelector('[data-activity-previous]');
    const next = root.querySelector('[data-activity-next]');
    const loadActivity = async (year) => {
        yearLoading = true;
        try {
            const data = (await get(`/api/v1/dashboard/activity${year ? `?year=${year}` : ''}`))
                .payload.data;
            const direction = displayedYear === null ? 0 : Math.sign(data.year - displayedYear);
            displayedYear = data.year;
            currentYear = data.years[0];
            renderYearActivity(root, data, direction);
            // The arrows step one calendar year at a time.
            if (previous) previous.disabled = displayedYear >= currentYear;
            if (next) next.disabled = displayedYear <= oldestActivityYear;
        } catch (error) {
            const days = root.querySelector('[data-activity-days]');
            if (days) days.textContent = error.message;
        } finally {
            yearLoading = false;
        }
    };
    const moveYear = (direction) => {
        if (displayedYear === null || yearLoading) return;
        const year = displayedYear + direction;
        if (year >= oldestActivityYear && year <= currentYear) loadActivity(year);
    };
    // Scrolling over the spinner turns it like a wheel: scrolling up shows newer years.
    root.querySelector('.activity-year-list')?.addEventListener(
        'wheel',
        (event) => {
            if (!event.deltaY) return;
            event.preventDefault();
            moveYear(event.deltaY < 0 ? 1 : -1);
        },
        { passive: false },
    );
    root.querySelector('[data-activity-years]')?.addEventListener('click', (event) => {
        const year = event.target.closest('[data-year]')?.dataset.year;
        if (year) loadActivity(Number(year));
    });
    const refresh = root.querySelector('[data-planning-retry]');
    const tooltip = root.querySelector('[data-activity-tooltip]');
    const grid = root.querySelector('[data-activity-grid]');
    let loading = false;
    let reloadRequested = false;
    let taskBusy = false;
    let taskData = null;
    const todaySort = root.querySelector('[data-dashboard-today-sort]');
    const todayStatus = root.querySelector('[data-dashboard-today-status]');
    const weekSort = root.querySelector('[data-dashboard-week-sort]');
    const weekStatus = root.querySelector('[data-dashboard-week-status]');
    const addToday = root.querySelector('[data-dashboard-add-today]');
    const todayDialog = root.querySelector('#dashboard-today-dialog');
    const dialogError = root.querySelector('[data-today-dialog-error]');
    const selectForm = root.querySelector('[data-today-select-form]');
    const createForm = root.querySelector('[data-today-create-form]');

    const renderTaskPanels = () => {
        if (!taskData) return;
        const options = {
            today: taskData.today,
            timezone: taskData.timezone,
            todayIds: new Set(taskData.today_tasks.map((task) => task.id)),
            dailyIds: new Set(taskData.daily_task_ids),
            busy: loading || taskBusy,
            onToggle: (task) =>
                runTaskAction(() =>
                    transitionEntity('task', task, task.status === 'Done' ? 'reopen' : 'complete'),
                ),
            onAddToday: (task) =>
                runTaskAction(() => post('/api/v1/daily-selections/task', { id: task.id })),
            onRemoveToday: (task) =>
                runTaskAction(() => remove(`/api/v1/daily-selections/task/${task.id}`)),
        };
        const filteredToday = dashboardTaskList(taskData.today_tasks, {
            sort: todaySort ? todaySort.value : 'importance',
            status: todayStatus ? todayStatus.value : 'all',
            timezone: taskData.timezone,
        });
        renderTaskChecklist(root.querySelector('[data-today-tasks]'), filteredToday, {
            ...options,
            mode: 'today',
            limit: Infinity,
        });
        // The ring already counts today's tasks; the badge only explains an active status filter.
        const todayCount = root.querySelector('[data-today-count]');
        const filtering = Boolean(todayStatus && todayStatus.value !== 'all');
        todayCount.hidden = !filtering;
        todayCount.textContent = filtering
            ? `${filteredToday.length} / ${taskData.today_tasks.length}`
            : String(filteredToday.length);
        const filtered = weeklyTaskList(taskData.selected_tasks, {
            sort: weekSort.value,
            status: weekStatus.value,
            timezone: taskData.timezone,
        });
        renderTaskChecklist(root.querySelector('[data-weekly-tasks]'), filtered, {
            ...options,
            mode: 'week',
            limit: Infinity,
        });
        root.querySelector('[data-weekly-task-count]').textContent =
            weekStatus.value === 'all'
                ? String(filtered.length)
                : `${filtered.length} / ${taskData.selected_tasks.length}`;
        const summary = habitCheckInSummary(taskData.habits);
        root.querySelector('[data-habits-today-count]').textContent = summary.total
            ? `${summary.done} / ${summary.total}`
            : '—';
        renderHabitChecklist(root.querySelector('[data-habits-today]'), taskData.habits, {
            busy: loading || taskBusy,
            onToggle: (habit) =>
                runTaskAction(() => {
                    const path = `/api/v1/habits/${habit.id}/check-ins/${habit.today}`;
                    return habit.done_today ? remove(path) : put(path);
                }),
        });
        renderHabitTargets(root.querySelector('[data-dashboard-habits]'), taskData.habits);
        const reminder = root.querySelector('[data-overdue-reminder]');
        reminder.replaceChildren();
        reminder.hidden = taskData.overdue_tasks.length === 0;
        const text = document.createElement('span');
        text.textContent = `${taskData.overdue_tasks.length} ${t(taskData.overdue_tasks.length === 1 ? 'overdue task to review' : 'overdue tasks to review')}`;
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href = '/tasks?view=overdue';
        link.textContent = t('Overdue tasks');
        reminder.append(text, link);
    };
    const runTaskAction = async (action) => {
        if (taskBusy || loading) return false;
        const focusKey = document.activeElement?.dataset.dashboardTaskControl;
        taskBusy = true;
        addToday.disabled = true;
        refresh.disabled = true;
        renderTaskPanels();
        let success = false;
        try {
            const result = await action();
            if (result !== null) await load();
            success = result !== null;
        } catch (error) {
            if (error.status === 409) await load();
            message(root, error);
            if (todayDialog.open) {
                dialogError.textContent =
                    Object.values(error.payload?.errors || {}).flat()[0] || error.message;
                dialogError.classList.remove('is-hidden');
            }
        } finally {
            taskBusy = false;
            addToday.disabled = loading;
            refresh.disabled = loading;
            renderTaskPanels();
            if (focusKey)
                [...root.querySelectorAll('[data-dashboard-task-control]')]
                    .find(
                        (control) =>
                            control.dataset.dashboardTaskControl === focusKey && !control.disabled,
                    )
                    ?.focus();
        }
        return success;
    };
    todaySort?.addEventListener('change', renderTaskPanels);
    todayStatus?.addEventListener('change', renderTaskPanels);
    weekSort.addEventListener('change', renderTaskPanels);
    weekStatus.addEventListener('change', renderTaskPanels);
    addToday.addEventListener('click', async () => {
        dialogError.classList.add('is-hidden');
        selectForm.elements.id.replaceChildren(new Option(t('Loading tasks…'), ''));
        selectForm.querySelector('button').disabled = true;
        todayDialog.showModal();
        try {
            const tasks = (await get('/api/v1/tasks')).payload.data;
            const ids = new Set(taskData.today_tasks.map((task) => task.id));
            selectForm.elements.id.replaceChildren(new Option(t('Select task'), ''));
            for (const task of tasks.filter(
                (task) => task.status !== 'Done' && !ids.has(task.id),
            )) {
                selectForm.elements.id.add(new Option(task.name, task.id));
            }
            selectForm.querySelector('button').disabled =
                selectForm.elements.id.options.length === 1;
        } catch (error) {
            dialogError.textContent = error.message;
            dialogError.classList.remove('is-hidden');
        }
    });
    for (const form of [selectForm, createForm]) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (taskBusy || loading) return;
            const data = new FormData(form);
            const body = form === selectForm ? { id: data.get('id') } : { name: data.get('name') };
            const controls = [...todayDialog.querySelectorAll('button, input, select')];
            controls.forEach((control) => {
                control.disabled = true;
            });
            const success = await runTaskAction(() => post('/api/v1/daily-selections/task', body));
            controls.forEach((control) => {
                control.disabled = false;
            });
            if (success) {
                form.reset();
                todayDialog.close();
            }
        });
    }
    todayDialog.addEventListener('cancel', (event) => {
        if (taskBusy) event.preventDefault();
    });

    const hideTooltip = () => {
        tooltip.classList.add('is-hidden');
        grid.querySelector('[aria-describedby]')?.removeAttribute('aria-describedby');
    };
    const showTooltip = (event) => {
        const cell = event.target.closest('.activity-day');
        if (!cell) return;
        hideTooltip();
        tooltip.textContent = cell.dataset.tooltip;
        tooltip.classList.remove('is-hidden');
        cell.setAttribute('aria-describedby', tooltip.id);
        const bounds = cell.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        tooltip.style.left = `${Math.max(12, Math.min(window.innerWidth - width - 12, bounds.left + bounds.width / 2 - width / 2))}px`;
        tooltip.style.top = `${Math.max(8, bounds.top - tooltip.offsetHeight - 10)}px`;
    };
    grid?.addEventListener('pointerover', showTooltip);
    grid?.addEventListener('focusin', showTooltip);
    grid?.addEventListener('pointerout', hideTooltip);
    grid?.addEventListener('focusout', hideTooltip);
    document.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('resize', hideTooltip);
    grid?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideTooltip();
    });

    // Open team Tasks assigned to the user; the card stays hidden when there are none.
    const loadTeamTasks = async () => {
        const panel = root.querySelector('[data-dashboard-team]');
        if (!panel) return;
        try {
            const tasks = (await get('/api/v1/team-tasks/assigned')).payload.data;
            panel.hidden = tasks.length === 0;
            root.querySelector('[data-dashboard-team-count]').textContent = String(tasks.length);
            const list = root.querySelector('[data-dashboard-team-list]');
            list.replaceChildren(
                ...tasks.slice(0, 6).map((task) => {
                    const row = document.createElement('a');
                    row.className = 'dashboard-team-task';
                    row.href = `/teamwork?goal=${encodeURIComponent(task.team_goal.id)}`;
                    const overdue = Boolean(
                        task.due_date && taskData?.today && task.due_date < taskData.today,
                    );
                    row.classList.toggle('is-overdue', overdue);
                    const name = document.createElement('strong');
                    name.textContent = task.name;
                    const meta = document.createElement('small');
                    meta.textContent = [
                        task.team_goal.name,
                        t(task.status === 'in_progress' ? 'In progress' : 'To do'),
                        task.due_date
                            ? `${t(overdue ? 'Overdue' : 'Due')} ${formatDay(task.due_date)}`
                            : '',
                    ]
                        .filter(Boolean)
                        .join(' · ');
                    row.append(name, meta);
                    return row;
                }),
            );
        } catch {
            panel.hidden = true;
        }
    };
    const load = async (requestedMonth = displayedMonth) => {
        if (loading) {
            reloadRequested = true;
            return;
        }
        loading = true;
        refresh.disabled = true;
        addToday.disabled = true;
        renderTaskPanels();
        const roadmapRevision = roadmap.revision;
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const query = requestedMonth ? `?month=${requestedMonth}` : '';
            const { payload } = await get(`/api/v1/dashboard${query}`);
            const data = payload.data;
            taskData = data;
            displayedMonth = data.month;
            loadTeamTasks();
            root.querySelector('[data-dashboard-timezone]').textContent = data.timezone;
            root.querySelector('[data-dashboard-date]').textContent = new Intl.DateTimeFormat(
                window.notesBootstrap?.preferences?.locale === 'vi' ? 'vi-VN' : 'en-US',
                {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                },
            ).format(new Date(`${data.today}T00:00:00Z`));
            root.querySelector('[data-week-range]').textContent = weekRangeLabel(data.week_start);
            root.querySelector('[data-weekly-milestone-count]').textContent =
                data.selected_milestones.length;
            loadActivity(displayedYear);
            const hour = Number(
                new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    hourCycle: 'h23',
                    timeZone: data.timezone,
                }).format(new Date()),
            );
            root.querySelector('[data-dashboard-greeting]').textContent = t(
                hour < 12 ? 'Good morning!' : hour < 18 ? 'Good afternoon!' : 'Good evening!',
            );
            const sparkle = lineIcon('sparkle', { solid: true });
            sparkle.classList.add('greeting-sparkle');
            root.querySelector('[data-dashboard-greeting]').append(sparkle);
            renderRing(
                root.querySelector('[data-today-ring]'),
                data.today_summary.percentage,
                t('Tasks completed today'),
            );
            root.querySelector('[data-today-completed]').textContent =
                `${data.today_summary.completed} / ${data.today_summary.total}`;
            renderRecentActivity(root, data.recent_activity, {
                levelFor: activityLevel,
                describe: dayLabel,
            });
            roadmap.load(data.roadmap_goal_id, roadmapRevision);
            renderRing(
                root.querySelector('[data-week-ring]'),
                data.week_summary.percentage,
                t('Selected tasks completed'),
            );
            root.querySelector('[data-week-completed]').textContent =
                `${data.week_summary.completed} / ${data.week_summary.total}`;
            root.querySelector('[data-week-change]').textContent =
                data.week_summary.change_points == null
                    ? data.week_summary.total
                        ? t('No previous-week selections')
                        : t('Select tasks to shape your week')
                    : `${data.week_summary.change_points > 0 ? '+' : ''}${data.week_summary.change_points} ${t('points vs previous week’s selections')}`;
            const weekEnd = new Date(`${data.week_start}T00:00:00Z`);
            weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
            renderDayBars(
                root.querySelector('[data-week-bars]'),
                data.week_start,
                weekEnd.toISOString().slice(0, 10),
                data.week_summary.daily_activity,
                { showCounts: true, today: data.today },
            );
            const weekContributions = Object.values(data.week_summary.daily_activity).reduce(
                (total, count) => total + count,
                0,
            );
            root.querySelector('[data-week-activity-total]').textContent =
                weekContributions.toLocaleString();
            root.querySelector('[data-week-activity-unit]').textContent = t(
                weekContributions === 1 ? 'contribution' : 'contributions',
            );
            renderStreak(root.querySelector('[data-habit-streak]'), data.habit_streak, data.today);
            renderTaskPanels();
            rows(
                root.querySelector('[data-weekly-milestones]'),
                data.selected_milestones,
                {
                    title: 'Set your next checkpoint.',
                    description: 'Choose a milestone from one of your goals.',
                    icon: 'goals',
                    href: '/goals',
                    action: 'Explore goals',
                },
                'milestone',
            );
        } catch (error) {
            message(root, error);
            if (!displayedMonth) {
                root.querySelectorAll('.loading-copy').forEach((node) => {
                    node.textContent = t('Unable to load. Use Refresh to try again.');
                });
                root.querySelector('[data-activity-days]').textContent = 'Activity unavailable';
                root.querySelector('[data-activity-summary]').textContent = t(
                    'Activity unavailable. Use Refresh to try again.',
                );
            }
        } finally {
            loading = false;
            addToday.disabled = taskBusy;
            renderTaskPanels();
            root.setAttribute('aria-busy', 'false');
            refresh.disabled = false;
            // A mutation finishing during another read must still get a fresh view.
            if (reloadRequested) {
                reloadRequested = false;
                await load();
            }
        }
    };
    previous?.addEventListener('click', () => moveYear(1));
    next?.addEventListener('click', () => moveYear(-1));
    refresh?.addEventListener('click', () => load());
    load(null);
}

export { initReviewsPage } from './reviews-page.js';
