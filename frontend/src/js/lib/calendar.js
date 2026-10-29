// Pure date helpers for the schedule pickers. Dates are local calendar
// strings (YYYY-MM-DD); arithmetic runs in UTC so DST never shifts a day.

const pad = (value) => String(value).padStart(2, '0');

export function addDays(date, days) {
    const cursor = new Date(`${date}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + days);
    return cursor.toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(date) {
    return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The Monday after today (a week from today when today is Monday). */
export function nextWeek(date) {
    return addDays(date, 8 - (weekday(date) || 7));
}

/** Six Sunday-first weeks covering the month, as the reference calendar shows. */
export function monthMatrix(year, month) {
    const first = `${year}-${pad(month)}-01`;
    const start = addDays(first, -weekday(first));
    return Array.from({ length: 6 }, (_, row) =>
        Array.from({ length: 7 }, (_, column) => addDays(start, row * 7 + column)),
    );
}

export function shiftMonth(year, month, delta) {
    const index = year * 12 + (month - 1) + delta;
    return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Local datetime-local value ("YYYY-MM-DDTHH:MM") for reminder presets. */
export function reminderPreset(kind, now = new Date()) {
    const value = new Date(now.getTime());
    if (kind === 'later') {
        if (value.getHours() < 19) value.setHours(19, 0, 0, 0);
        else value.setHours(value.getHours() + 1, 0, 0, 0);
    } else {
        const days = kind === 'week' ? 8 - (value.getDay() || 7) : 1;
        value.setDate(value.getDate() + days);
        value.setHours(9, 0, 0, 0);
    }
    return localDateTime(value);
}

export function localDateTime(value) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

/** Converts a 12-hour picker choice to 24-hour "HH:MM". */
export function to24Hour(hour, minute, meridiem) {
    const base = Number(hour) % 12;
    return `${pad(meridiem === 'PM' ? base + 12 : base)}:${pad(minute)}`;
}

/**
 * Normalizes a repeat choice into a task-series rule.
 * Custom choices carry unit (daily/weekly/monthly/yearly), interval and weekdays.
 */
export function repeatRule(choice, startDate) {
    const startDay = weekday(startDate) || 7;
    if (!choice || !choice.kind) return null;
    if (choice.kind === 'weekdays')
        return { frequency: 'weekly', interval_count: 1, weekdays: [1, 2, 3, 4, 5] };
    if (choice.kind === 'custom') {
        const weekdays =
            choice.unit === 'weekly'
                ? choice.weekdays?.length
                    ? [...choice.weekdays].sort()
                    : [startDay]
                : [];
        return {
            frequency: choice.unit,
            interval_count: Math.max(1, Number(choice.interval) || 1),
            weekdays,
        };
    }
    return {
        frequency: choice.kind,
        interval_count: 1,
        weekdays: choice.kind === 'weekly' ? [startDay] : [],
    };
}
