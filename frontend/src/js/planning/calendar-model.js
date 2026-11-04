// Pure Calendar projection: which planning dates fall on which day, and what a move changes.
// Dates are local calendar strings (YYYY-MM-DD); scheduled instants are projected into the
// account timezone first. Weeks start on Monday, like the Dashboard's This week.
import { addDays, weekday } from '../lib/calendar.js';
import { localDate } from './task-views.js';

const pad = (value) => String(value).padStart(2, '0');

export function weekStart(date) {
    return addDays(date, -((weekday(date) + 6) % 7));
}

export function weekDays(date) {
    const start = weekStart(date);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

/** Monday-first weeks covering the month (four to six rows, never a trailing empty week). */
export function monthWeeks(year, month) {
    const first = `${year}-${pad(month)}-01`;
    const last = addDays(`${month === 12 ? year + 1 : year}-${pad((month % 12) + 1)}-01`, -1);
    const weeks = [];
    for (let start = weekStart(first); start <= last; start = addDays(start, 7))
        weeks.push(weekDays(start));
    return weeks;
}

export function daysBetween(from, to) {
    return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

/** Minutes east of UTC for an instant in a time zone. */
function zoneOffset(instant, timeZone) {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })
            .formatToParts(instant)
            .map((part) => [part.type, part.value]),
    );
    const wall = Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
    );
    return Math.round((wall - Math.floor(instant.getTime() / 1000) * 1000) / 60000);
}

/** Moves an instant by whole local days, keeping its wall-clock time across DST changes. */
export function shiftInstant(value, days, timeZone) {
    const instant = new Date(value);
    const moved = new Date(instant.getTime() + days * 86400000);
    const drift = zoneOffset(instant, timeZone) - zoneOffset(moved, timeZone);
    return new Date(moved.getTime() + drift * 60000).toISOString();
}

// One entry per item and day; when several dates of a Task share a day the most specific wins.
const PRIORITY = { scheduled: 0, due: 1, occurrence: 2, start: 3 };

/**
 * Calendar entries for Tasks (scheduled block, due, start, repeat occurrence) and for
 * Milestone and Goal deadlines. A scheduled block spanning days appears on each of them.
 */
export function calendarEntries({ tasks = [], milestones = [], goals = [] }, timezone) {
    const entries = [];
    for (const task of tasks) {
        const days = new Map();
        const add = (date, kind, extra = {}) => {
            if (!date) return;
            const current = days.get(date);
            if (!current || PRIORITY[kind] < PRIORITY[current.kind])
                days.set(date, { kind, ...extra });
        };
        if (task.scheduled_start) {
            const start = localDate(task.scheduled_start, timezone);
            const end = localDate(task.scheduled_end, timezone) || start;
            for (let date = start; date <= end; date = addDays(date, 1))
                add(date, 'scheduled', { continued: date !== start });
        }
        add(task.deadline, 'due');
        add(task.occurrence_date, 'occurrence');
        add(task.start_date, 'start');
        for (const [date, entry] of days)
            entries.push({
                type: 'task',
                item: task,
                date,
                done: task.status === 'Done',
                ...entry,
            });
    }
    for (const milestone of milestones)
        if (milestone.deadline)
            entries.push({
                type: 'milestone',
                item: milestone,
                date: milestone.deadline,
                kind: 'deadline',
                done: milestone.status === 'Completed',
            });
    for (const goal of goals)
        if (goal.deadline)
            entries.push({
                type: 'goal',
                item: goal,
                date: goal.deadline,
                kind: 'deadline',
                done: goal.status === 'Completed',
            });
    return entries;
}

// Within a day: Goal and Milestone deadlines first, then timed blocks by time, then the rest.
const ORDER = { goal: 0, milestone: 1, task: 2 };
export function entriesOn(entries, date) {
    return entries
        .filter((entry) => entry.date === date)
        .sort(
            (a, b) =>
                ORDER[a.type] - ORDER[b.type] ||
                Number(a.done) - Number(b.done) ||
                (a.kind === 'scheduled' ? 0 : 1) - (b.kind === 'scheduled' ? 0 : 1) ||
                String(a.item.scheduled_start || '').localeCompare(
                    String(b.item.scheduled_start || ''),
                ) ||
                (b.item.importance || 0) - (a.item.importance || 0) ||
                a.item.name.localeCompare(b.item.name),
        );
}

/** Open Tasks with no date at all: what the Unscheduled tray offers for planning. */
export function unscheduledTasks(tasks) {
    return tasks
        .filter(
            (task) =>
                task.status !== 'Done' &&
                !task.series_id &&
                !task.deadline &&
                !task.start_date &&
                !task.scheduled_start &&
                !task.occurrence_date,
        )
        .sort((a, b) => (b.importance || 0) - (a.importance || 0) || a.name.localeCompare(b.name));
}

/**
 * The PATCH fields for moving an item from one day to another: every date of the item on the
 * source day moves by the same number of days (a scheduled block moves whole, keeping its
 * times). A Task without any date gets the target day as its due date. A repeat occurrence's
 * own date belongs to its series and does not move.
 */
export function moveChanges(type, item, from, to, timezone) {
    if (from === to) return null;
    if (type !== 'task') return item.deadline === from ? { deadline: to } : null;
    if (from == null) return { deadline: to };
    const days = daysBetween(from, to);
    const changes = {};
    if (item.deadline === from) changes.deadline = to;
    if (item.start_date === from) changes.start_date = to;
    if (item.scheduled_start) {
        const start = localDate(item.scheduled_start, timezone);
        const end = localDate(item.scheduled_end, timezone) || start;
        if (from >= start && from <= end) {
            changes.scheduled_start = shiftInstant(item.scheduled_start, days, timezone);
            if (item.scheduled_end)
                changes.scheduled_end = shiftInstant(item.scheduled_end, days, timezone);
        }
    }
    return Object.keys(changes).length ? changes : null;
}

/** Whether a calendar entry can be moved at all (completed work and occurrences stay put). */
export function canMove(entry, timezone) {
    if (entry.done) return false;
    if (entry.date == null) return entry.type === 'task';
    return (
        moveChanges(entry.type, entry.item, entry.date, addDays(entry.date, 1), timezone) != null
    );
}
