import { get, patch, post } from '../lib/http.js';
import { renderEmptyState } from '../lib/empty-state.js';

function message(root, error) {
    const output = root.querySelector('[data-planning-error]');
    output.textContent = Object.values(error.payload?.errors || {}).flat()[0] || error.message;
    output.classList.remove('is-hidden');
}

function rows(container, items, empty, type = 'task') {
    container.replaceChildren();
    if (!items.length) renderEmptyState(container, empty);
    for (const item of items) {
        const row = document.createElement('a');
        row.className = 'dashboard-item';
        row.href =
            type === 'habit'
                ? '/habits'
                : type === 'milestone'
                  ? `/goals/${encodeURIComponent(item.goal_id)}`
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
        if (loading) return;
        loading = true;
        previous.disabled = next.disabled = refresh.disabled = true;
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
        }
    };
    previous.addEventListener('click', () => load(shiftMonth(displayedMonth, -1)));
    next.addEventListener('click', () => load(shiftMonth(displayedMonth, 1)));
    refresh.addEventListener('click', () => load());
    load(null);
}

export function initReviewsPage(root) {
    let current = null;
    const list = root.querySelector('[data-review-list]');
    const editor = root.querySelector('[data-review-editor]');
    const form = root.querySelector('[data-review-edit-form]');
    root.querySelector('[name="date"]').value = new Date().toISOString().slice(0, 10);
    const display = (review) => {
        current = review;
        editor.classList.remove('is-hidden');
        root.querySelector('[data-review-heading]').textContent =
            `${review.kind} · ${review.period_start}`;
        root.querySelector('[data-review-facts]').textContent =
            `${review.snapshot.activities.length} completed activities · generated ${review.snapshot.generated_at}`;
        for (const field of ['reflection', 'went_well', 'went_wrong', 'change_next'])
            form.elements[field].value = review[field];
        const finalized = review.status === 'Finalized';
        for (const control of form.elements) control.disabled = finalized;
        root.querySelector('[data-review-finalize]').classList.toggle('is-hidden', finalized);
        root.querySelector('[data-review-refresh]').classList.toggle('is-hidden', finalized);
        root.querySelector('[data-review-reopen]').classList.toggle('is-hidden', !finalized);
    };
    const load = async () => {
        try {
            const { payload } = await get('/api/v1/reviews');
            list.replaceChildren();
            for (const review of payload.data) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'planning-list-item';
                button.textContent = `${review.kind} · ${review.period_start} · ${review.status}`;
                button.addEventListener('click', () => display(review));
                list.append(button);
            }
            if (!payload.data.length)
                renderEmptyState(list, {
                    title: 'Take a moment to look back.',
                    description:
                        'Create a daily, weekly, or monthly review to collect your progress and reflections.',
                    icon: 'reviews',
                    href: '#review-kind',
                    action: 'Start your first review',
                });
        } catch (error) {
            message(root, error);
        }
    };
    root.querySelector('[data-review-create-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        try {
            const { payload } = await post('/api/v1/reviews', {
                kind: data.get('kind'),
                date: data.get('date'),
            });
            display(payload.data);
            await load();
        } catch (error) {
            message(root, error);
        }
    });
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        try {
            const { payload } = await patch(`/api/v1/reviews/${current.id}`, {
                base_version: current.version,
                reflection: data.get('reflection'),
                went_well: data.get('went_well'),
                went_wrong: data.get('went_wrong'),
                change_next: data.get('change_next'),
            });
            display(payload.data);
            await load();
        } catch (error) {
            message(root, error);
        }
    });
    for (const action of ['refresh', 'finalize', 'reopen'])
        root.querySelector(`[data-review-${action}]`).addEventListener('click', async () => {
            try {
                const { payload } = await post(`/api/v1/reviews/${current.id}/${action}`, {
                    base_version: current.version,
                });
                display(payload.data);
                await load();
            } catch (error) {
                message(root, error);
            }
        });
    load();
}
