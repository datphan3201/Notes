import { referenceDecoration } from '../settings/reference-decoration.js';
import { t } from '../lib/i18n.js';
import { checkMark, crossMark } from '../lib/check-mark.js';
import { habitDayDescriptions, habitDayState } from '../lib/habit-days.js';
export function renderRing(container, percentage, label) {
    container.replaceChildren();
    const ring = document.createElement('div');
    ring.className = 'progress-ring';
    const value = percentage == null ? null : Math.max(0, Math.min(100, percentage));
    ring.style.setProperty('--progress', `${value || 0}%`);
    ring.setAttribute('role', 'img');
    ring.setAttribute(
        'aria-label',
        value == null ? `${label}: ${t('no denominator available')}` : `${label}: ${value}%`,
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
        bar.title = `${day.date}: ${day.count} ${t('completions')}`;
        bar.setAttribute('aria-label', bar.title);
        const fill = document.createElement('i');
        fill.style.setProperty('--bar-height', `${(day.count / maximum) * 100}%`);
        const label = document.createElement('small');
        label.textContent =
            values.length > 7
                ? day.date.slice(-2)
                : new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                      document.documentElement.lang === 'vi' ? 'vi-VN' : 'en-US',
                      {
                          weekday: 'narrow',
                          timeZone: 'UTC',
                      },
                  );
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
    value.textContent = `${streak.days} ${t(streak.days === 1 ? 'day' : 'days')}`;
    value.prepend(flame);
    const description = document.createElement('p');
    description.className = 'subtle-copy';
    description.textContent =
        streak.through_date && streak.through_date !== today
            ? `${t('Through')} ${streak.through_date} · ${t('finish every daily habit today')}`
            : t('A day counts only when every daily habit is done or on a rest day.');
    const days = document.createElement('div');
    days.className = 'streak-days';
    for (const day of streak.recent_days) {
        // The server judges each day across all daily Habits.
        const state =
            day.state ?? habitDayState(day.date, day.checked, today, streak.tracking_since);
        const dot = document.createElement('span');
        dot.className = `is-${state}`;
        dot.tabIndex = 0;
        dot.title = `${day.date}: ${t(habitDayDescriptions[state])}${day.total ? ` · ${day.done}/${day.total} ${t('daily habits done')}` : ''}`;
        dot.setAttribute('aria-label', dot.title);
        if (state === 'checked') dot.append(checkMark());
        if (state === 'missed') dot.append(crossMark());
        if (state === 'rest') dot.textContent = 'R';
        const label = document.createElement('small');
        label.textContent = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
            document.documentElement.lang === 'vi' ? 'vi-VN' : 'en-US',
            {
                weekday: 'narrow',
                timeZone: 'UTC',
            },
        );
        const cell = document.createElement('div');
        cell.append(dot, label);
        days.append(cell);
    }
    container.append(value, description, days);
}
