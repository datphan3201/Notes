import { t } from '../lib/i18n.js';

/** Calendar DATE values are padded with UTC arithmetic, never the host timezone. */
export function recentActivityCalendar(from, to, facts) {
    const byDate = new Map(facts.map((day) => [day.date, day]));
    const first = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const days = Array.from({ length: (first.getUTCDay() + 6) % 7 }, () => null);
    for (const date = first; date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
        const key = date.toISOString().slice(0, 10);
        days.push(byDate.get(key) || { date: key, total: 0, counts: {} });
    }
    while (days.length % 7) days.push(null);
    return days;
}

export function renderRecentActivity(root, activity, { levelFor, describe }) {
    const grid = root.querySelector('[data-recent-activity-grid]');
    grid.replaceChildren();
    root.querySelector('[data-recent-activity-total]').textContent = activity.total;
    root.querySelector('[data-recent-activity-unit]').textContent = t(
        activity.total === 1 ? 'contribution' : 'contributions',
    );
    root.querySelector('[data-recent-activity-days]').textContent =
        `${activity.active_days} / 30 ${t('active days')}`;
    for (const day of recentActivityCalendar(activity.from, activity.to, activity.days)) {
        if (day === null) {
            const blank = document.createElement('span');
            blank.setAttribute('aria-hidden', 'true');
            grid.append(blank);
            continue;
        }
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'activity-day';
        cell.dataset.level = String(levelFor(day.total));
        const label = describe(day);
        cell.title = label;
        cell.setAttribute('aria-label', label);
        cell.setAttribute('aria-pressed', 'false');
        cell.addEventListener('click', () => {
            for (const item of grid.querySelectorAll('button'))
                item.setAttribute('aria-pressed', String(item === cell));
            root.querySelector('[data-recent-activity-detail]').textContent = label;
        });
        grid.append(cell);
    }
}
