import { referenceDecoration } from '../settings/reference-decoration.js';
export function renderRing(container, percentage, label) {
    container.replaceChildren();
    const ring = document.createElement('div');
    ring.className = 'progress-ring';
    const value = percentage == null ? null : Math.max(0, Math.min(100, percentage));
    ring.style.setProperty('--progress', `${value || 0}%`);
    ring.setAttribute('role', 'img');
    ring.setAttribute(
        'aria-label',
        value == null ? `${label}: no denominator available` : `${label}: ${value}%`,
    );
    const copy = document.createElement('strong');
    copy.textContent = value == null ? '—' : `${Math.round(value)}%`;
    ring.append(copy);
    container.append(ring);
}

export function renderDayBars(container, from, to, counts) {
    container.replaceChildren();
    const values = [];
    const end = new Date(`${to}T00:00:00Z`);
    for (
        const date = new Date(`${from}T00:00:00Z`);
        date <= end;
        date.setUTCDate(date.getUTCDate() + 1)
    ) {
        const key = date.toISOString().slice(0, 10);
        values.push({ date: key, count: counts[key] || 0 });
    }
    const maximum = Math.max(1, ...values.map((day) => day.count));
    for (const day of values) {
        const bar = document.createElement('div');
        bar.className = 'day-bar';
        bar.tabIndex = 0;
        bar.title = `${day.date}: ${day.count} completions`;
        bar.setAttribute('aria-label', bar.title);
        const fill = document.createElement('i');
        fill.style.setProperty('--bar-height', `${(day.count / maximum) * 100}%`);
        const label = document.createElement('small');
        label.textContent =
            values.length > 7
                ? day.date.slice(-2)
                : new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'narrow',
                      timeZone: 'UTC',
                  });
        bar.append(fill, label);
        container.append(bar);
    }
}

export function renderStreak(container, streak, today) {
    container.replaceChildren();
    const value = document.createElement('strong');
    value.className = 'streak-value';
    const flame = referenceDecoration('flame');
    flame.classList.add('streak-flame');
    value.textContent = `${streak.days} ${streak.days === 1 ? 'day' : 'days'}`;
    value.prepend(flame);
    const description = document.createElement('p');
    description.className = 'subtle-copy';
    description.textContent =
        streak.through_date && streak.through_date !== today
            ? `Through ${streak.through_date} · check in today`
            : 'At least one Habit check-in per day';
    const days = document.createElement('div');
    days.className = 'streak-days';
    for (const day of streak.recent_days) {
        const dot = document.createElement('span');
        dot.className = day.checked ? 'is-checked' : '';
        dot.tabIndex = 0;
        dot.title = `${day.date}: ${day.checked ? 'checked in' : 'no check-in'}`;
        dot.setAttribute('aria-label', dot.title);
        dot.textContent = day.checked ? '✓' : '○';
        const label = document.createElement('small');
        label.textContent = new Date(`${day.date}T00:00:00Z`).toLocaleDateString('en-US', {
            weekday: 'narrow',
            timeZone: 'UTC',
        });
        const cell = document.createElement('div');
        cell.append(dot, label);
        days.append(cell);
    }
    container.append(value, description, days);
}
