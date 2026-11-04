import { t } from './i18n.js';

// One place for user-facing dates, times, percentages and counts, so every screen reads the
// same way ("Nov 2", "Nov 2, 9:00 AM – 12:00 PM", "17%", "1 task") in the user's language.

export function intlLocale() {
    const preferred =
        globalThis.window?.notesBootstrap?.preferences?.locale ||
        globalThis.document?.documentElement?.lang;
    return preferred === 'vi' ? 'vi-VN' : 'en-US';
}

function calendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** A calendar date (YYYY-MM-DD); the year is shown only when it is not the current one. */
export function formatDay(value, { now = new Date(), locale = intlLocale() } = {}) {
    const date = calendarDate(value);
    if (!date) return value || '';
    const sameYear = date.getUTCFullYear() === now.getUTCFullYear();
    return new Intl.DateTimeFormat(locale, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
        timeZone: 'UTC',
    }).format(date);
}

/** A date range of calendar dates, e.g. "Oct 26 – Nov 1". */
export function formatDayRange(start, end, options = {}) {
    if (!end || end === start) return formatDay(start, options);
    return `${formatDay(start, options)} – ${formatDay(end, options)}`;
}

function parts(value, timeZone, locale) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const day = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
    const time = new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
    return { day, time };
}

/** A moment (ISO date-time) in the user's time zone, e.g. "Nov 2, 9:00 AM". */
export function formatMoment(value, { timeZone, now = new Date(), locale = intlLocale() } = {}) {
    const moment = parts(value, timeZone, locale);
    if (!moment) return value || '';
    return `${formatDay(moment.day, { now, locale })}, ${moment.time}`;
}

/** A start–end window; the date is written once when both ends fall on the same day. */
export function formatMomentRange(start, end, options = {}) {
    if (!end) return formatMoment(start, options);
    const locale = options.locale || intlLocale();
    const from = parts(start, options.timeZone, locale);
    const to = parts(end, options.timeZone, locale);
    if (!from || !to) return [start, end].filter(Boolean).join(' – ');
    return from.day === to.day
        ? `${formatMoment(start, options)} – ${to.time}`
        : `${formatMoment(start, options)} – ${formatMoment(end, options)}`;
}

export function formatPercent(value) {
    const number = Number(value);
    return `${Number.isFinite(number) ? Math.round(number) : 0}%`;
}

/** "1 task" / "3 tasks", with both forms passed through the dictionary. */
export function countLabel(count, one, many) {
    return `${count} ${t(count === 1 ? one : many)}`;
}
