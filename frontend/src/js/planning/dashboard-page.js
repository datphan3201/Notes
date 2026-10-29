import { t, statusLabel } from '../lib/i18n.js';
import { referenceDecoration } from '../settings/reference-decoration.js';
import { get } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderRing, renderDayBars, renderStreak } from './insights-ui.js';
import { transitionEntity } from './transitions.js';
import { checkMark, setCheckedLabel } from '../lib/check-mark.js';
import { streakLabel } from '../lib/habit-days.js';

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
            type === 'habit'
                ? '/habits'
                : type === 'milestone'
                  ? `/goals/${encodeURIComponent(item.goal_id)}#milestone=${encodeURIComponent(item.id)}`
                  : `/tasks/${encodeURIComponent(item.id)}`;
        const marker = document.createElement('span');
        marker.className = 'task-marker';
        marker.setAttribute('aria-hidden', 'true');
        const complete =
            type === 'habit'
                ? item.done_today
                : item.status === 'Done' || item.status === 'Completed';
        marker.classList.toggle('is-complete', complete);
        if (complete) marker.append(checkMark());
        const copy = document.createElement('span');
        copy.className = 'dashboard-item-copy';
        const name = document.createElement('strong');
        name.textContent = item.name;
        const meta = document.createElement('small');
        meta.textContent =
            type === 'habit'
                ? `${item.completed_days}/${item.target_frequency} ${t(item.period === 'weekly' ? 'this week' : 'today')} · ${t('Streak')}: ${streakLabel(item.streak, t)}${item.rest_today ? ` · ${t('Rest day')}` : ''}`
                : `${statusLabel(item.status || 'NotStarted')}${item.deadline ? ` · ${t('Due')} ${item.deadline}` : ''}`;
        copy.append(name, meta);
        row.append(marker, copy);
        container.append(row);
    }
    if (items.length > 4) {
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href =
            type === 'habit' ? '/habits' : type === 'milestone' ? '/goals' : '/tasks?view=all';
        link.textContent = `${t('View all')} ${items.length} ${t(type === 'milestone' ? 'milestones' : type === 'habit' ? 'habits' : 'tasks')} →`;
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

export function initDashboardPage(root) {
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
            previous.disabled = displayedYear >= currentYear;
            next.disabled = displayedYear <= oldestActivityYear;
        } catch (error) {
            root.querySelector('[data-activity-days]').textContent = error.message;
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
    root.querySelector('.activity-year-list').addEventListener(
        'wheel',
        (event) => {
            if (!event.deltaY) return;
            event.preventDefault();
            moveYear(event.deltaY < 0 ? 1 : -1);
        },
        { passive: false },
    );
    root.querySelector('[data-activity-years]').addEventListener('click', (event) => {
        const year = event.target.closest('[data-year]')?.dataset.year;
        if (year) loadActivity(Number(year));
    });
    const refresh = root.querySelector('[data-planning-retry]');
    const tooltip = root.querySelector('[data-activity-tooltip]');
    const grid = root.querySelector('[data-activity-grid]');
    let loading = false;
    let reloadRequested = false;

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
    grid.addEventListener('pointerover', showTooltip);
    grid.addEventListener('focusin', showTooltip);
    grid.addEventListener('pointerout', hideTooltip);
    grid.addEventListener('focusout', hideTooltip);
    document.addEventListener('scroll', hideTooltip, true);
    window.addEventListener('resize', hideTooltip);
    grid.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') hideTooltip();
    });

    const load = async (requestedMonth = displayedMonth) => {
        if (loading) {
            reloadRequested = true;
            return;
        }
        loading = true;
        refresh.disabled = true;
        const previousFocus = root.querySelector('[data-focus-complete]');
        if (previousFocus) previousFocus.disabled = true;
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const query = requestedMonth ? `?month=${requestedMonth}` : '';
            const { payload } = await get(`/api/v1/dashboard${query}`);
            const data = payload.data;
            displayedMonth = data.month;
            root.querySelector('[data-dashboard-timezone]').textContent =
                `${t('Your time zone')}: ${data.timezone}`;
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
            root.querySelector('[data-today-count]').textContent = data.today_tasks.length;
            root.querySelector('[data-weekly-task-count]').textContent = data.selected_tasks.length;
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
            root.querySelector('[data-dashboard-greeting]').append(referenceDecoration('greeting'));
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
            );
            renderStreak(root.querySelector('[data-habit-streak]'), data.habit_streak, data.today);
            const focus = [...data.selected_tasks, ...data.today_tasks, ...data.overdue_tasks].find(
                (task) => task.status !== 'Done' && task.status !== 'Blocked',
            );
            const focusContainer = root.querySelector('[data-current-focus]');
            focusContainer.replaceChildren();
            if (focus) {
                const name = document.createElement('a');
                name.className = 'focus-name';
                name.href = `/tasks/${focus.id}`;
                name.textContent = focus.name;
                const chip = document.createElement('span');
                chip.className = 'context-chip';
                chip.textContent = focus.estimated_minutes
                    ? `${focus.estimated_minutes} min · ${focus.status.replace(/([a-z])([A-Z])/g, '$1 $2')}`
                    : focus.status.replace(/([a-z])([A-Z])/g, '$1 $2');
                const description = document.createElement('p');
                description.className = 'focus-description';
                description.textContent =
                    focus.description ||
                    focus.completion_criteria ||
                    t('Open this task and take the next small step.');
                const actions = document.createElement('div');
                actions.className = 'focus-actions';
                const edit = document.createElement('a');
                edit.className = 'button button-quiet';
                edit.href = `/tasks/${focus.id}#edit`;
                edit.textContent = '✎';
                edit.setAttribute('aria-label', `${t('Edit')} ${focus.name}`);
                edit.title = t('Edit task');
                const complete = document.createElement('button');
                complete.type = 'button';
                complete.dataset.focusComplete = '';
                complete.disabled = true;
                complete.className = 'button button-primary';
                setCheckedLabel(complete, t('Complete'));
                complete.addEventListener('click', async () => {
                    complete.disabled = true;
                    try {
                        if (await transitionEntity('task', focus, 'complete')) await load();
                    } catch (error) {
                        message(root, error);
                    } finally {
                        complete.disabled = false;
                    }
                });
                actions.append(edit, complete);
                focusContainer.append(name, chip, description, actions);
            } else
                renderEmptyState(focusContainer, {
                    title: 'A little room to focus.',
                    description: 'Choose an open task for this week.',
                    href: '/tasks',
                    action: 'Choose a task',
                });
            // Scenery is decorative; links and progress come from the owned roadmap.
            try {
                const goals = (await get('/api/v1/goals')).payload.data.filter(
                    (goal) => !goal.parent_goal_id && goal.status !== 'Completed',
                );
                goals.sort((a, b) => b.importance - a.importance);
                const preview = root.querySelector('[data-dashboard-roadmap]');
                preview.replaceChildren();
                if (goals.length) {
                    const goal = goals[0];
                    const roadmap = (await get(`/api/v1/goals/${goal.id}/roadmap`)).payload.data;
                    const branch =
                        focus &&
                        roadmap.milestones.find((milestone) => milestone.id === focus.milestone_id);
                    if (branch || focus?.goal_id === goal.id) {
                        const context = document.createElement('a');
                        context.className = 'context-chip';
                        context.href = `/goals/${goal.id}${branch ? `#milestone=${branch.id}` : ''}`;
                        context.textContent = branch ? branch.name : goal.name;
                        focusContainer.querySelector('.focus-name').after(context);
                    }
                    root.querySelector('[data-dashboard-roadmap-link]').href = `/goals/${goal.id}`;
                    root.querySelector('[data-dashboard-roadmap-link]').textContent =
                        t('View full roadmap →');
                    for (const milestone of (roadmap.milestones || []).slice(0, 6)) {
                        const link = document.createElement('a');
                        link.href = `/goals/${goal.id}#milestone=${milestone.id}`;
                        link.textContent = milestone.name;
                        link.classList.toggle('is-complete', milestone.status === 'Completed');
                        preview.append(link);
                    }
                    if (!preview.childNodes.length) {
                        const link = document.createElement('a');
                        link.href = `/goals/${goal.id}`;
                        link.textContent = goal.name;
                        preview.append(link);
                    }
                } else
                    preview.textContent = t('Create a goal to give your next steps a direction.');
            } catch {
                root.querySelector('[data-dashboard-roadmap]').textContent = t(
                    'Roadmap unavailable. Open Goals or refresh to try again.',
                );
            }
            rows(root.querySelector('[data-today-tasks]'), data.today_tasks, {
                title: 'A little room to focus.',
                description:
                    'No tasks are scheduled for today. Choose your next step from your task list.',
                href: '/tasks',
                action: 'Explore your tasks',
            });
            rows(root.querySelector('[data-overdue-tasks]'), data.overdue_tasks, {
                title: 'All caught up.',
                description: 'No overdue tasks to carry forward.',
                icon: 'check',
            });
            rows(root.querySelector('[data-weekly-tasks]'), data.selected_tasks, {
                title: 'Choose your focus.',
                description: 'Select tasks for this week from your task list.',
                href: '/tasks',
                action: 'Select tasks',
            });
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
            rows(
                root.querySelector('[data-dashboard-habits]'),
                data.habits,
                {
                    title: 'Build a steady rhythm.',
                    description: 'Create a habit and it will appear here with its own streak.',
                    icon: 'habits',
                    href: '/habits',
                    action: 'Explore habits',
                },
                'habit',
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
            root.setAttribute('aria-busy', 'false');
            refresh.disabled = false;
            const complete = root.querySelector('[data-focus-complete]');
            if (complete) complete.disabled = false;
            // A mutation finishing during another read must still get a fresh view.
            if (reloadRequested) {
                reloadRequested = false;
                await load();
            }
        }
    };
    previous.addEventListener('click', () => moveYear(1));
    next.addEventListener('click', () => moveYear(-1));
    refresh.addEventListener('click', () => load());
    load(null);
}

export { initReviewsPage } from './reviews-page.js';
