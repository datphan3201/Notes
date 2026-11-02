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
