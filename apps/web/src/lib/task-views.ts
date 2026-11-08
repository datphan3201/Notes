import type { Entity, WorkspacePreferences } from "./api";
import { localDate } from "./dates.ts";

export function addDays(day: string, count: number) {
    const value = new Date(day + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
}
export function monday(day: string) {
    return addDays(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7));
}
export function inHistory(
    task: Entity,
    today: string,
    preferences: WorkspacePreferences = {},
    now = Date.now(),
) {
    if (task.status === "done")
        return (
            !!task.completed_at &&
            now - Date.parse(task.completed_at) >=
                (preferences.history_completed_hours || 24) * 3600000
        );
    return (
        !!task.due_date &&
        task.due_date <=
            addDays(today, -(preferences.history_overdue_days || 3))
    );
}
export function matchesView(
    task: Entity,
    view: string,
    today: string,
    timezone: string,
    weekly = new Set<string>(),
    daily = new Set<string>(),
    preferences: WorkspacePreferences = {},
) {
    if (view === "history") return inHistory(task, today, preferences);
    if (view === "overdue")
        return (
            task.status !== "done" && !!task.due_date && task.due_date < today
        );
    if (view === "week") return weekly.has(task.id);
    if (view === "today" && daily.has(task.id)) return true;
    if (inHistory(task, today, preferences)) return false;
    const scheduled = task.scheduled_at
        ? localDate(timezone, new Date(task.scheduled_at))
        : null;
    const end = task.scheduled_end
        ? localDate(timezone, new Date(task.scheduled_end))
        : scheduled;
    const dates = [
        task.due_date,
        task.start_date,
        task.occurrence_date,
        scheduled,
    ];
    if (view === "today")
        return (
            dates.includes(today) ||
            (!!scheduled && scheduled <= today && !!end && end >= today) ||
            (task.status !== "done" && !!task.due_date && task.due_date < today)
        );
    if (view === "next")
        return [...dates, end].some((day) => !!day && day > today);
    if (view === "backlog")
        return dates.every((day) => !day) && !end && !weekly.has(task.id);
    return true;
}
