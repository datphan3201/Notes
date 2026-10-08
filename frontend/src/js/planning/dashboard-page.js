import { referenceDecoration } from '../settings/reference-decoration.js';
import { get } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';
import { renderRing, renderDayBars, renderStreak } from './insights-ui.js';
import { transitionEntity } from './transitions.js';

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
        const complete = item.status === 'Done' || item.status === 'Completed';
        marker.classList.toggle('is-complete', complete);
        marker.textContent = complete ? '✓' : '';
        const copy = document.createElement('span');
        copy.className = 'dashboard-item-copy';
        const name = document.createElement('strong');
        name.textContent = item.name;
        const meta = document.createElement('small');
        meta.textContent =
            type === 'habit'
                ? `${item.completed_days} of ${item.target_frequency} days completed`
                : `${(item.status || 'Not started').replace(/([a-z])([A-Z])/g, '$1 $2')}${item.deadline ? ` · Due ${item.deadline}` : ''}`;
        copy.append(name, meta);
        row.append(marker, copy);
        container.append(row);
    }
    if (items.length > 4) {
        const link = document.createElement('a');
        link.className = 'section-link';
        link.href =
            type === 'habit' ? '/habits' : type === 'milestone' ? '/goals' : '/tasks?view=all';
        link.textContent = `View all ${items.length} ${type === 'milestone' ? 'milestones' : type === 'habit' ? 'habits' : 'tasks'} →`;
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

export function calendarDays(month, activityDays) {
    const first = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(first);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const active = new Map(activityDays.map((day) => [day.date, day]));
    const days = Array.from({ length: first.getUTCDay() }, () => null);

    for (const cursor = new Date(first); cursor < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        const date = cursor.toISOString().slice(0, 10);
        days.push(active.get(date) || { date, active: false, total: 0, counts: {} });
    }
    while (days.length % 7 !== 0) days.push(null);

    return days;
}

function shiftMonth(month, change) {
    const date = new Date(`${month}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + change);
    return date.toISOString().slice(0, 7);
}

function monthLabel(month) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${month}-01T00:00:00Z`));
}

function dayLabel(day) {
    const date = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${day.date}T00:00:00Z`));
    if (!day.total) return `No contributions on ${date}`;

    const details = Object.entries(day.counts)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => {
            const labels = activityTypes[type] || [type, `${type}s`];
            return `${count} ${count === 1 ? labels[0] : labels[1]}`;
        })
        .join(', ');
    const contribution = day.total === 1 ? 'contribution' : 'contributions';
    return `${day.total} ${contribution} on ${date}${details ? ` — ${details}` : ''}`;
}

function renderActivity(root, data) {
    const grid = root.querySelector('[data-activity-grid]');
    const total = data.activity_days.reduce((sum, day) => sum + day.total, 0);
    const label = monthLabel(data.month);
    root.querySelector('[data-activity-month]').textContent = label;
    root.querySelector('[data-activity-summary]').textContent =
        `${total} ${total === 1 ? 'contribution' : 'contributions'} in ${label}`;
    root.querySelector('[data-activity-total]').textContent = total;
    root.querySelector('[data-activity-unit]').textContent =
        total === 1 ? 'contribution' : 'contributions';
    const activeDays = data.activity_days.filter((day) => day.total > 0).length;
    root.querySelector('[data-activity-days]').textContent =
        `Across ${activeDays} active ${activeDays === 1 ? 'day' : 'days'}`;
    root.querySelector('[data-activity-tooltip]').classList.add('is-hidden');
    grid.replaceChildren();

    for (const day of calendarDays(data.month, data.activity_days)) {
        if (!day) {
            const blank = document.createElement('span');
            blank.className = 'activity-day-placeholder';
            blank.setAttribute('aria-hidden', 'true');
            grid.append(blank);
            continue;
        }
        const level = activityLevel(day.total);
        const description = dayLabel(day);
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'activity-day';
        cell.dataset.level = String(level);
        cell.dataset.tooltip = description;
        cell.setAttribute('aria-label', `${description}. Activity level ${level} of 4.`);
        grid.append(cell);
    }
}

export function initDashboardPage(root) {
    let displayedMonth = null;
    let currentMonth = null;
    const previous = root.querySelector('[data-activity-previous]');
    const next = root.querySelector('[data-activity-next]');
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
        previous.disabled = next.disabled = refresh.disabled = true;
        const previousFocus = root.querySelector('[data-focus-complete]');
        if (previousFocus) previousFocus.disabled = true;
        root.setAttribute('aria-busy', 'true');
        root.querySelector('[data-planning-error]').classList.add('is-hidden');
        try {
            const query = requestedMonth ? `?month=${requestedMonth}` : '';
            const { payload } = await get(`/api/v1/dashboard${query}`);
            const data = payload.data;
            displayedMonth = data.month;
            currentMonth = data.today.slice(0, 7);
            root.querySelector('[data-dashboard-timezone]').textContent =
                `Your time zone: ${data.timezone}`;
            root.querySelector('[data-dashboard-date]').textContent = new Intl.DateTimeFormat(
                'en-US',
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
            renderActivity(root, data);
            const hour = Number(
                new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    hourCycle: 'h23',
                    timeZone: data.timezone,
                }).format(new Date()),
            );
            root.querySelector('[data-dashboard-greeting]').textContent =
                hour < 12 ? 'Good morning!' : hour < 18 ? 'Good afternoon!' : 'Good evening!';
            root.querySelector('[data-dashboard-greeting]').append(referenceDecoration('greeting'));
            renderRing(
                root.querySelector('[data-week-ring]'),
                data.week_summary.percentage,
                'Selected tasks completed',
            );
            root.querySelector('[data-week-completed]').textContent =
                `${data.week_summary.completed} / ${data.week_summary.total}`;
            root.querySelector('[data-week-change]').textContent =
                data.week_summary.change_points == null
                    ? data.week_summary.total
                        ? 'No previous-week selections'
                        : 'Select tasks to shape your week'
                    : `${data.week_summary.change_points > 0 ? '+' : ''}${data.week_summary.change_points} points vs previous week’s selections`;
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
                    'Open this task and take the next small step.';
                const actions = document.createElement('div');
                actions.className = 'focus-actions';
                const edit = document.createElement('a');
                edit.className = 'button button-quiet';
                edit.href = `/tasks/${focus.id}#edit`;
                edit.textContent = '✎';
                edit.setAttribute('aria-label', `Edit ${focus.name}`);
                edit.title = 'Edit task';
                const complete = document.createElement('button');
                complete.type = 'button';
                complete.dataset.focusComplete = '';
                complete.disabled = true;
                complete.className = 'button button-primary';
                complete.textContent = '✓ Complete';
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
                        'View full roadmap →';
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
                } else preview.textContent = 'Create a goal to give your next steps a direction.';
            } catch {
                root.querySelector('[data-dashboard-roadmap]').textContent =
                    'Roadmap unavailable. Open Goals or refresh to try again.';
            }
            next.disabled = displayedMonth >= currentMonth;
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
                    description: 'Habits linked to your goals will appear here.',
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
                    node.textContent = 'Unable to load. Use Refresh to try again.';
                });
                root.querySelector('[data-activity-days]').textContent = 'Activity unavailable';
                root.querySelector('[data-activity-summary]').textContent =
                    'Activity unavailable. Use Refresh to try again.';
            }
        } finally {
            loading = false;
            root.setAttribute('aria-busy', 'false');
            previous.disabled = !displayedMonth;
            next.disabled = !displayedMonth || displayedMonth >= currentMonth;
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
    previous.addEventListener('click', () => load(shiftMonth(displayedMonth, -1)));
    next.addEventListener('click', () => load(shiftMonth(displayedMonth, 1)));
    refresh.addEventListener('click', () => load());
    load(null);
}

export { initReviewsPage } from './reviews-page.js';
