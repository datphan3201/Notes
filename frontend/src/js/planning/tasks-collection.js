import { collectionPage } from './collection-page.js';
import { localDate, taskMatchesView } from './task-views.js';

// Keep sorting stable for equal values and leave the server collection untouched.
export function sortTasks(tasks, sort, timezone) {
    const key = (task) => {
        if (task.scheduled_start) {
            const date = localDate(task.scheduled_start, timezone);
            const time = new Intl.DateTimeFormat('en-GB', {
                timeZone: timezone,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hourCycle: 'h23',
            }).format(new Date(task.scheduled_start));
            return `${date}T${time}`;
        }
        const date = task.start_date || task.occurrence_date;
        return date ? `${date}T00:00:00` : '9999';
    };
    return [...tasks].sort((a, b) =>
        sort === 'scheduled'
            ? key(a).localeCompare(key(b))
            : Number(b.importance || 0) - Number(a.importance || 0),
    );
}

export function completedInView(tasks, view, today, timezone, weekIds, dailyIds) {
    return tasks.filter(
        (task) =>
            taskMatchesView(task, 'completed', today, timezone, weekIds, dailyIds) &&
            taskMatchesView(task, view, today, timezone, weekIds, dailyIds),
    );
}

export function seriesPage(series, { query = '', state = 'all', page = 0, size = 8 } = {}) {
    return collectionPage(
        series.filter((item) => state === 'all' || item.state === state),
        {
            query,
            page,
            size,
        },
    );
}

/**
 * Groups already filtered and sorted Tasks by their Goal: a Task inside a Milestone belongs to
 * that Milestone's Goal. Groups follow the first appearance of their Tasks, so the chosen sort
 * still decides what comes first; Tasks without a Goal form a trailing Inbox group (goal null).
 * Inside a Goal, Tasks follow the roadmap (Milestone position, then Tasks directly in the Goal);
 * the chosen sort only orders Tasks within one Milestone.
 *
 * @param {Array<object>} tasks
 * @param {{ goals: Map<string, object>, milestones: Map<string, object> }} parents
 */
export function groupTasksByGoal(tasks, { goals, milestones }) {
    const groups = new Map();
    const inbox = [];
    for (const task of tasks) {
        const goalId = task.goal_id || milestones.get(task.milestone_id)?.goal_id || null;
        const goal = goalId ? goals.get(goalId) : null;
        if (!goal) {
            inbox.push(task);
            continue;
        }
        if (!groups.has(goal.id)) groups.set(goal.id, { goal, tasks: [] });
        groups.get(goal.id).tasks.push(task);
    }
    const rank = (task) => {
        const position = milestones.get(task.milestone_id)?.position;
        return task.milestone_id && position !== undefined
            ? Number(position)
            : Number.MAX_SAFE_INTEGER;
    };
    const result = [...groups.values()].map((group) => ({
        ...group,
        // Array.prototype.sort is stable, so equal ranks keep the chosen sort.
        tasks: [...group.tasks].sort((a, b) => rank(a) - rank(b)),
    }));
    if (inbox.length) result.push({ goal: null, tasks: inbox });
    return result;
}
