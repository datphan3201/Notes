import type { Entity, WorkspacePreferences } from "./api";
import { localDate, zonedInput } from "./dates.ts";
import { matchesView } from "./task-views.ts";
import type { TaskRecord } from "../components/preview/task-data";
import type {
    Goal,
    Habit,
    Milestone,
} from "../components/preview/workspace-data";
import type { TaskStatus } from "../components/preview/dashboard-data";

export const dashboardLabel = (value = ""): [string, string] => [value, value];
export function dashboardStatus(value: Entity["status"]): TaskStatus {
    return value === "done" || value === "completed"
        ? "Done"
        : value === "doing"
          ? "InProgress"
          : value === "blocked"
            ? "Blocked"
            : "NotStarted";
}
export function dashboardTask(
    row: Entity,
    index: number,
    today: string,
    timezone: string,
    plan: { daily: string[]; weekly: string[] },
    preferences: WorkspacePreferences,
): TaskRecord {
    return {
        id: index,
        title: dashboardLabel(row.title),
        description: dashboardLabel(row.content),
        criteria: dashboardLabel(row.completion_criteria),
        outcome: dashboardLabel(row.expected_result),
        working: dashboardLabel(row.working_note),
        status: dashboardStatus(row.status),
        importance: row.importance,
        parent: row.milestone_id || row.goal_id || "",
        start: row.start_date || "",
        due: row.due_date || "",
        scheduledStart: zonedInput(row.scheduled_at, timezone),
        scheduledEnd: zonedInput(row.scheduled_end, timezone),
        estimate: row.estimated_minutes?.toString() || "",
        reminder: "none",
        reminderAt: row.reminder_at || "",
        tags: row.tags || [],
        pinned: false,
        archived: !!row.archived_at,
        related: [],
        linkedNotes: [],
        daily: matchesView(
            row,
            "today",
            today,
            timezone,
            new Set(plan.weekly),
            new Set(plan.daily),
            preferences,
        ),
        weekly: matchesView(
            row,
            "week",
            today,
            timezone,
            new Set(plan.weekly),
            new Set(plan.daily),
            preferences,
        ),
        checklist: (row.checklist || []).map((item, id) => ({ ...item, id })),
    };
}
export function dashboardGoal(row: Entity): Goal {
    return {
        id: row.id,
        title: dashboardLabel(row.title),
        area: row.area_id || "",
        parent: row.parent_goal_id || "",
        status: dashboardStatus(row.status),
        importance: row.importance,
        icon: "target",
        color: "",
        start: row.start_date || "",
        due: row.due_date || "",
        description: dashboardLabel(row.content),
        outcome: dashboardLabel(row.expected_result),
        criteria: dashboardLabel(row.completion_criteria),
        strategy: "",
        related: [],
        archived: !!row.archived_at,
    };
}
export function dashboardMilestone(row: Entity): Milestone {
    return {
        id: row.id,
        title: dashboardLabel(row.title),
        goal: row.goal_id || "",
        status: dashboardStatus(row.status),
        importance: row.importance,
        icon: "flag",
        color: "",
        start: row.start_date || "",
        due: row.due_date || "",
        criteria: row.completion_criteria || "",
        prerequisites: [],
        archived: !!row.archived_at,
    };
}
export function dashboardHabit(
    row: Entity,
    days: { day: string; state: string }[],
    now = new Date(),
): Habit {
    const timezone = row.timezone || "UTC";
    return {
        id: row.id,
        title: dashboardLabel(row.title),
        description: row.content,
        goal: "",
        frequency: row.frequency === "weekly" ? "weekly" : "daily",
        target: row.target || 1,
        timezone,
        today: localDate(timezone, now),
        importance: row.importance,
        icon: "leaf",
        color: "",
        checkins: days.filter((d) => d.state === "done").map((d) => d.day),
        rests: days.filter((d) => d.state === "rest").map((d) => d.day),
        archived: !!row.archived_at,
    };
}
