// Pure Gantt projection for the Calendar: the span of each Task, Milestone and Goal, the rows
// shown for "by Task / Milestone / Goal", the visible date range and what a drag changes.
// Dates are local calendar strings (YYYY-MM-DD); scheduled instants are projected into the
// account timezone first, as in calendar-model.
import { addDays } from '../lib/calendar.js';
import { daysBetween, shiftInstant, weekStart } from './calendar-model.js';
import { localDate } from './task-views.js';

/** Pixels per day for each zoom level. */
export const ZOOMS = { day: 36, week: 16, month: 5 };
/** Days before today shown first, and how many days are added each time the end comes into view. */
const LEAD = { day: 7, week: 21, month: 60 };
const CHUNK = { day: 90, week: 182, month: 365 };

const earliest = (dates) => dates.filter(Boolean).sort()[0] ?? null;
const latest = (dates) => dates.filter(Boolean).sort().at(-1) ?? null;
const isDone = (type, item) => item.status === (type === 'task' ? 'Done' : 'Completed');

/**
 * Where a Task sits on the timeline. Its start is the start date or the day its work slot
 * begins; its end is the due date or the day the slot ends. With only one of them it is a
 * single-day point (a diamond); with neither it has no span.
 */
export function taskSpan(task, timezone) {
    const slotStart = task.scheduled_start ? localDate(task.scheduled_start, timezone) : null;
    const slotEnd = task.scheduled_end ? localDate(task.scheduled_end, timezone) : slotStart;
    const start = earliest([task.start_date, slotStart]);
    const end = latest([task.deadline, slotEnd]);
    const only = start || end || task.occurrence_date || null;
    if (!only) return null;
    if (start && end) return { start, end: end < start ? start : end, point: false };
    return { start: only, end: only, point: true };
}

/**
 * A Milestone's or Goal's span: its own start date and deadline, with whichever is missing
 * taken from the work inside it (marked `derived`, drawn faded and not draggable).
 */
export function containerSpan(item, children) {
    const inner = children.filter(Boolean);
    const derivedStart = earliest(inner.map((span) => span.start));
    const derivedEnd = latest(inner.map((span) => span.end));
    const start = item.start_date || derivedStart;
    const end = item.deadline || derivedEnd;
    if (!start && !end) return null;
    if (!start || !end) return { start: start || end, end: start || end, point: true, derived: {} };
    return {
        start,
        end: end < start ? start : end,
        point: false,
        derived: { start: !item.start_date, end: !item.deadline },
    };
}

function progressOf(type, item) {
    if (type === 'task') return isDone(type, item) ? 100 : 0;
    if (type === 'milestone') return Number(item.progress?.percentage ?? 0);
    return Number(item.progress ?? 0);
}

/**
 * The rows for one grouping. `by` is task, milestone or goal; `expanded` holds "type:id"
 * keys of opened Goals and Milestones; `visible(type, item)` applies the Calendar's Goal filter.
 * Rows are ordered by start date, then name; items without any date sink to the end. By Task,
 * work that ended before `from` (the timeline's first day) is left out.
 */
export function ganttRows({ tasks = [], milestones = [], goals = [] }, options, timezone) {
    const {
        by = 'task',
        expanded = new Set(),
        visible = () => true,
        today = '',
        from = '',
    } = options;
    const taskSpans = new Map(tasks.map((task) => [task.id, taskSpan(task, timezone)]));
    const tasksIn = (field, id) => tasks.filter((task) => task[field] === id);
    const milestoneSpans = new Map(
        milestones.map((milestone) => [
            milestone.id,
            containerSpan(
                milestone,
                tasksIn('milestone_id', milestone.id).map((task) => taskSpans.get(task.id)),
            ),
        ]),
    );
    const goalSpans = new Map();
    const goalSpan = (goal) => {
        if (!goalSpans.has(goal.id)) {
            goalSpans.set(goal.id, null);
            const children = [
                ...milestones
                    .filter((m) => m.goal_id === goal.id)
                    .map((m) => milestoneSpans.get(m.id)),
                ...tasksIn('goal_id', goal.id).map((task) => taskSpans.get(task.id)),
                ...goals.filter((child) => child.parent_goal_id === goal.id).map(goalSpan),
            ];
            goalSpans.set(goal.id, containerSpan(goal, children));
        }
        return goalSpans.get(goal.id);
    };
    goals.forEach(goalSpan);
    const spanOf = (type, item) =>
        (type === 'task' ? taskSpans : type === 'milestone' ? milestoneSpans : goalSpans).get(
            item.id,
        );
    const goalNames = new Map(goals.map((goal) => [goal.id, goal.name]));
    const milestoneById = new Map(milestones.map((m) => [m.id, m]));

    const row = (type, item, depth, children = []) => {
        const span = spanOf(type, item) || null;
        const done = isDone(type, item);
        const goalId =
            type === 'goal'
                ? item.id
                : type === 'milestone'
                  ? item.goal_id
                  : item.goal_id || milestoneById.get(item.milestone_id)?.goal_id || null;
        return {
            key: `${type}:${item.id}`,
            type,
            item,
            depth,
            span,
            done,
            overdue: Boolean(!done && span && span.end < today && (item.deadline || span.point)),
            progress: progressOf(type, item),
            goalId,
            context:
                type === 'goal'
                    ? ''
                    : type === 'milestone'
                      ? goalNames.get(item.goal_id) || ''
                      : milestoneById.get(item.milestone_id)?.name || goalNames.get(goalId) || '',
            hasChildren: children.length > 0,
            expanded: expanded.has(`${type}:${item.id}`),
            children,
        };
    };
    const byStart = (a, b) =>
        (a.span?.start || '9999').localeCompare(b.span?.start || '9999') ||
        a.item.name.localeCompare(b.item.name);
    const flatten = (rows) =>
        rows.flatMap((entry) => [entry, ...(entry.expanded ? flatten(entry.children) : [])]);

    const taskRow = (task, depth) => row('task', task, depth);
    const milestoneRow = (milestone, depth) =>
        row(
            'milestone',
            milestone,
            depth,
            tasksIn('milestone_id', milestone.id)
                .map((task) => taskRow(task, depth + 1))
                .sort(byStart),
        );

    if (by === 'task') {
        // Work that ended before the timeline begins would only add empty rows.
        return tasks
            .filter((task) => {
                const span = taskSpans.get(task.id);
                return visible('task', task) && span && (!from || span.end >= from);
            })
            .map((task) => taskRow(task, 0))
            .sort(byStart);
    }
    if (by === 'milestone') {
        return flatten(
            milestones
                .filter((milestone) => visible('milestone', milestone))
                .map((milestone) => milestoneRow(milestone, 0))
                .sort(byStart),
        );
    }
    const goalRow = (goal, depth) =>
        row('goal', goal, depth, [
            ...milestones
                .filter((milestone) => milestone.goal_id === goal.id)
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((milestone) => milestoneRow(milestone, depth + 1)),
            ...tasksIn('goal_id', goal.id)
                .map((task) => taskRow(task, depth + 1))
                .sort(byStart),
            ...goals
                .filter((child) => child.parent_goal_id === goal.id)
                .map((child) => goalRow(child, depth + 1))
                .sort(byStart),
        ]);
    const ids = new Set(goals.map((goal) => goal.id));
    return flatten(
        goals
            .filter((goal) => !goal.parent_goal_id || !ids.has(goal.parent_goal_id))
            .filter((goal) => visible('goal', goal))
            .map((goal) => goalRow(goal, 0))
            .sort(byStart),
    );
}

/** The first range shown: from a little before today (on a Monday) for one chunk of days. */
export function initialRange(today, zoom) {
    const start = weekStart(addDays(today, -LEAD[zoom]));
    return { start, days: CHUNK[zoom] };
}

/** The same range with another chunk of days added at the end. */
export function extendRange(range, zoom) {
    return { start: range.start, days: range.days + CHUNK[zoom] };
}

/** Horizontal position (px) of the start of a day, and the width of an inclusive span. */
export function dayOffset(range, date, zoom) {
    return daysBetween(range.start, date) * ZOOMS[zoom];
}
export function spanWidth(start, end, zoom) {
    return (daysBetween(start, end) + 1) * ZOOMS[zoom];
}

/** Header segments for the range: [label key, start date, length in days] per month or day. */
export function scaleSegments(range, zoom) {
    const end = addDays(range.start, range.days - 1);
    const months = [];
    for (let day = range.start; day <= end;) {
        const next = `${day.slice(0, 7)}-01`;
        const nextMonth = addDays(next, 32).slice(0, 7) + '-01';
        const stop = nextMonth > end ? addDays(end, 1) : nextMonth;
        months.push({ start: day, days: daysBetween(day, stop) });
        day = stop;
    }
    let units;
    if (zoom === 'day')
        units = Array.from({ length: range.days }, (_, i) => ({
            start: addDays(range.start, i),
            days: 1,
        }));
    else if (zoom === 'week')
        units = Array.from({ length: Math.ceil(range.days / 7) }, (_, i) => ({
            start: addDays(range.start, i * 7),
            days: Math.min(7, range.days - i * 7),
        }));
    else units = months;
    return { months, units };
}

/**
 * The fields a drag sends, or null when nothing changes. `mode` is move (the whole bar),
 * start (its left edge) or end (its right edge). Moving shifts every own date by the same
 * number of days and keeps a work slot's clock times; derived ends never move; an edge never
 * crosses the other one.
 */
export function dragChanges(type, item, mode, days, timezone) {
    if (!days || isDone(type, item)) return null;
    const changes = {};
    if (mode === 'move') {
        for (const field of ['start_date', 'deadline']) {
            if (item[field]) changes[field] = addDays(item[field], days);
        }
        if (type === 'task') {
            for (const field of ['scheduled_start', 'scheduled_end']) {
                if (item[field]) changes[field] = shiftInstant(item[field], days, timezone);
            }
        }
    } else if (mode === 'start' && item.start_date) {
        let start = addDays(item.start_date, days);
        if (item.deadline && start > item.deadline) start = item.deadline;
        if (start !== item.start_date) changes.start_date = start;
    } else if (mode === 'end' && item.deadline) {
        let end = addDays(item.deadline, days);
        if (item.start_date && end < item.start_date) end = item.start_date;
        if (end !== item.deadline) changes.deadline = end;
    }
    return Object.keys(changes).length ? changes : null;
}

/** Which edges of a row's bar can be dragged (own dates only, never completed work). */
export function draggable(row) {
    if (row.done || !row.span) return { move: false, start: false, end: false };
    const own = (field) => Boolean(row.item[field]);
    const slot = row.type === 'task' && Boolean(row.item.scheduled_start);
    return {
        move: own('start_date') || own('deadline') || slot,
        start: own('start_date') && !row.span.point,
        end: own('deadline') && !row.span.point,
    };
}
