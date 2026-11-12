import { DEFAULT_DASHBOARD } from "@/lib/dashboard-preferences";
import type { Entity, Identity, Kind } from "@/lib/api";
import { localDate, zonedInput, zonedInstant } from "@/lib/dates";
import { inHistory, addDays, monday } from "@/lib/task-views";
import {
    dashboardHabit,
    dashboardTask,
    dashboardStatus,
} from "@/lib/dashboard-model";
import type { Data, Nav, Note, ActivityFact } from "./preview/workspace-data";
import type { TaskRecord } from "./preview/task-data";

export type Row = Entity & {
    body_loaded?: boolean;
    client_key?: string;
    weekly_for?: string;
    pinned?: boolean;
    reminder_mode?: string;
    files?: Note["files"];
    shares?: Note["shares"];
    icon?: string;
    accent?: string;
    related?: string[];
    strategy?: string;
    weekly?: boolean;
    primary_goal_id?: string | null;
    background_id?: string | null;
    unlocked?: boolean;
    reflection?: string;
    went_well?: string;
    improve?: string;
    next_steps?: string;
    finalized?: boolean;
    snapshot?: Data["reviews"][number]["snapshot"];
    template?: Row;
    summary?: string;
    summary_version?: number;
};
export type Snapshot = Record<Kind, Row[]> & {
    account_files: { id: string; purpose: string; url: string }[];
    invitations: {
        note_id: string;
        title: string;
        owner: string;
        can_edit: boolean;
    }[];
    identity: Identity;
    focus: string | null;
    selections: { task_id: string; period: string; day: string }[];
    habit_days: { habit_id: string; day: string; state: string }[];
    dependencies: { milestone_id: string; prerequisite_id: string }[];
    activity: {
        id: string;
        kind: string;
        entity_id: string;
        created_at: string;
    }[];
    activity_counts?: import("./preview/workspace-data").ActivityCount[];
};
export type Change = {
    action: string;
    kind: Kind;
    id?: string;
    client_id?: string;
    version?: number;
    fields: Record<string, unknown>;
    acknowledgements?: string[];
};
export class WorkspaceIds {
    private byId = new Map<string, number>();
    private byNumber = new Map<number, string>();
    private redirects = new Map<string, string>();
    private display = new Map<string, string>();
    server(id: string) {
        return this.redirects.get(id) || id;
    }
    view(id: string) {
        return this.display.get(id) || id;
    }
    number(id: string) {
        if (!this.byId.has(id)) {
            const value = this.byId.size + 1;
            this.byId.set(id, value);
            this.byNumber.set(value, id);
        }
        return this.byId.get(id)!;
    }
    id(value: number) {
        return this.byNumber.get(value) || `new:${value}`;
    }
    aliases(values: Record<string, string>) {
        for (const [from, to] of Object.entries(values)) {
            this.redirects.set(from, to);
            this.display.set(to, from);
            const n = from.startsWith("new:")
                ? Number(from.slice(4))
                : this.byId.get(from);
            if (n !== undefined) {
                this.byId.set(from, n);
                this.byId.set(to, n);
                this.byNumber.set(n, to);
            }
        }
    }
}
const pair = (value = ""): [string, string] => [value, value];
export const backendStatus = (status: string, kind: Kind) =>
    kind === "tasks" ? (status === "Done" ? "done" : "todo") :
    status === "Done"
        ? kind === "goals"
            ? "completed"
            : "done"
        : status === "InProgress"
          ? "doing"
          : status === "Blocked"
            ? "blocked"
            : "todo";
export function fromSnapshot(s: Snapshot, ids: WorkspaceIds, nav: Nav): Data {
    const display = (value: unknown, key = ""): unknown => {
        if (Array.isArray(value))
            return value.map((item) => display(item, key));
        if (value && typeof value === "object")
            return Object.fromEntries(
                Object.entries(value).map(([name, item]) => [
                    name,
                    display(item, name),
                ]),
            );
        return typeof value === "string" &&
            (key === "id" ||
                key.endsWith("_id") ||
                ["related", "focus"].includes(key))
            ? ids.view(value)
            : value;
    };
    s = display(s) as Snapshot;
    const archivedRows = new Map<string, { kind: Kind; row: Row }>();
    for (const kind of [
        "areas",
        "goals",
        "milestones",
        "tasks",
        "habits",
        "task-series",
        "notes",
        "reviews",
    ] as const)
        for (const row of s[kind]) archivedRows.set(row.id, { kind, row });
    function archiveRoot(kind: Kind, row: Row): string {
        const parentId =
            row.parent_goal_id ||
            row.area_id ||
            row.milestone_id ||
            row.goal_id ||
            row.primary_goal_id || row.template?.milestone_id || row.template?.goal_id;
        const parent = parentId ? archivedRows.get(parentId) : undefined;
        return parent && parent.row.archived_at === row.archived_at
            ? archiveRoot(parent.kind, parent.row)
            : `${kind}:${(kind === "tasks" || kind === "task-series") ? ids.number(row.id) : row.id}`;
    }
    const archive = (row: Row) => ({
        archived: !!row.archived_at,
        archivedWith: row.archived_at
            ? archiveRoot(archivedRows.get(row.id)?.kind || "tasks", row)
            : undefined,
    });
    const { user } = s.identity,
        prefs = user.preferences,
        profile = user.profile || {},
        today = localDate(user.timezone);
    const plan = {
        daily: s.selections
            .filter((r) => r.period === "daily" && r.day === today)
            .map((r) => r.task_id),
        weekly: s.selections
            .filter((r) => r.period === "weekly" && r.day === monday(today))
            .map((r) => r.task_id),
    };
    const task = (row: Row): TaskRecord => ({
        ...dashboardTask(
            row,
            ids.number(row.id),
            today,
            user.timezone,
            plan,
            prefs,
        ),
        ...archive(row),
        noteIds: (row.note_ids || []).map(id => ids.view(id)),
        resourceNoteIds: (row.resource_note_ids || []).map(id => ids.view(id)),
        history: inHistory(row, today, prefs),
        pinned: !!row.pinned,
        seriesId: row.series_id ? ids.number(row.series_id) : undefined,
        related: row.related || [],
        tags: row.tags || [],
        reminder:
            row.reminder_mode && !["none", "start", "before15", "before60"].includes(row.reminder_mode)
                ? row.reminder_mode
                : row.reminder_at
                  ? "custom"
                  : "none",
        reminderAt: zonedInput(row.reminder_at, user.timezone),
    });
    const notes: Note[] = s.notes.map((row) => ({
        bodyLoaded: row.body_loaded !== false,
        archived: !!row.archived_at,
        id: row.id,
        title: row.title,
        content: row.content,
        document: row.document || null,
        color: row.color || "neutral",
        pinned: !!row.pinned,
        tags: row.tags || [],
        goal: row.goal_id || "",
        task: row.task_id ? ids.number(row.task_id) : null,
        locked: !!row.locked,
        lockPassword: "",
        unlocked: !!row.unlocked,
        permission: row.shared ? (row.can_edit ? "edit" : "read") : "owner",
        shared: !!row.shared || !!row.shares?.length,
        shares: row.shares || [],
        files: row.files || [],
        background: row.background_id
            ? `/api/v1/files/${row.background_id}`
            : "",
        summary: row.summary || "",
        summaryOutdated: !!row.summary && row.summary_version !== row.version,
        updatedAt: row.updated_at,
    }));
    const titles = new Map(
        [...s.tasks, ...s.habits, ...s.goals, ...s.milestones, ...s.notes].map(
            (r) => [r.id, r.title],
        ),
    );
    const events: ActivityFact[] = s.activity
        .filter((r) => /^(task|habit|checklist)\./.test(r.kind))
        .map((r) => {
            const title = titles.get(r.entity_id) || "—",
                undo = /reopened|undone|cleared/.test(r.kind);
            return {
                id: r.id,
                title: [
                    `${undo ? "Reversed" : "Completed"}: ${title}`,
                    `${undo ? "Hoàn tác" : "Hoàn thành"}: ${title}`,
                ],
                kind: r.kind.split(".")[0] as ActivityFact["kind"],
                target: /^(task|checklist)\./.test(r.kind)
                    ? String(ids.number(r.entity_id))
                    : r.entity_id,
                date: localDate(user.timezone, new Date(r.created_at)),
                at: r.created_at,
                reversed: undo,
            };
        });
    return {
        planningAction: null,
        taskAction: null,
        assistantOpen: false,
        assistantContext: "",
        message: "",
        locale: user.locale,
        nav,
        tasks: s.tasks.map(task),
        series: s["task-series"].map((row) => ({
            id: ids.number(row.id),
            state: row.state as "active" | "paused" | "ended",
            template: task({
                ...row,
                ...row.template,
                id: row.id,
                title: row.template?.title || row.title,
            }),
            rule: {
                frequency: row.frequency as "daily",
                interval: row.interval_count || 1,
                weekdays: (row.weekdays || []).map((n) => n - 1),
                start: row.start_date || today,
                end: row.end_date || "",
            },
        })),
        areas: s.areas.map((row) => ({
            id: row.id,
            title: pair(row.title),
            importance: row.importance,
            icon: row.icon || "leaf",
            color: row.accent || "#067287",
            ...archive(row),
        })),
        goals: s.goals.map((row) => ({
            id: row.id,
            title: pair(row.title),
            area: row.area_id || "",
            parent: row.parent_goal_id || "",
            status: dashboardStatus(row.status),
            importance: row.importance,
            icon: row.icon || "target",
            color: row.accent || "#067287",
            start: row.start_date || "",
            due: row.due_date || "",
            description: pair(row.content),
            outcome: pair(row.expected_result),
            criteria: pair(row.completion_criteria),
            strategy: row.strategy || "",
            related: row.related || [],
            ...archive(row),
        })),
        milestones: s.milestones.map((row) => ({
            id: row.id,
            title: pair(row.title),
            goal: row.goal_id || "",
            status: dashboardStatus(row.status),
            importance: row.importance,
            icon: row.icon || "flag",
            color: row.accent || "#067287",
            start: row.start_date || "",
            due: row.due_date || "",
            criteria: row.completion_criteria || "",
            related: row.related || [],
            prerequisites: s.dependencies
                .filter((r) => r.milestone_id === row.id)
                .map((r) => r.prerequisite_id),
            weekly: row.weekly_for === monday(today),
            ...archive(row),
        })),
        notes,
        habits: s.habits.map((row) => ({
            ...dashboardHabit(
                row,
                s.habit_days.filter((d) => d.habit_id === row.id),
            ),
            goal: row.primary_goal_id || "",
            tags: row.tags || [],
            icon: row.icon || "leaf",
            color: row.accent || "#408e73",
            started: !!row.first_check_in_at,
            created: localDate(
                row.timezone || user.timezone,
                new Date(row.created_at),
            ),
            ...archive(row),
        })),
        reviews: s.reviews.map((row) => ({
            ...archive(row),
            id: row.id,
            kind: row.period as "daily",
            from: row.period_date!,
            to:
                row.period === "weekly"
                    ? addDays(row.period_date!, 6)
                    : row.period === "monthly"
                      ? addDays(
                            addDays(row.period_date!, 32).slice(0, 7) + "-01",
                            -1,
                        )
                      : row.period_date!,
            title: row.title,
            reflection: row.reflection || "",
            wentWell: row.went_well || "",
            improve: row.improve || "",
            nextSteps: row.next_steps || "",
            finalized: !!row.finalized,
            snapshot: row.snapshot
                ? {
                      ...row.snapshot,
                      facts: row.snapshot.facts?.map((fact) => ({
                          ...fact,
                          target:
                              fact.kind === "task" || fact.kind === "checklist"
                                  ? String(ids.number(fact.target))
                                  : fact.target,
                      })),
                  }
                : { done: 0, total: 0, habits: 0 },
            createdAt: row.created_at,
        })),
        events,
        activityCounts: s.activity_counts,
        focus: s.focus || "",
        dashboard: { ...DEFAULT_DASHBOARD, ...prefs.dashboard },
        appearance: {
            theme: user.theme,
            scene: prefs.visual_theme || "mountain",
            showBackground: prefs.show_background ?? true,
            showIllustrations: prefs.show_illustrations ?? true,
            showQuote: prefs.show_quote ?? true,
            quote: prefs.custom_quote || "",
            accent: prefs.accent || "",
            background: prefs.background_id
                ? `/api/v1/account-files/${prefs.background_id}`
                : prefs.background_color || "",
            backgrounds: s.account_files
                .filter((f) => f.purpose === "background")
                .map((f) => f.url),
        },
        appearancePreview: null,
        profile: {
            name: user.name,
            bio: profile.bio || "",
            email: user.email,
            pendingEmail: profile.pending_email || "",
            avatar: profile.avatar_id
                ? `/api/v1/account-files/${profile.avatar_id}`
                : "",
            timezone: user.timezone,
            mfa: user.mfa_method || "none",
            passwordChanged: false,
            accountDeleted: false,
            notifications: {
                inApp: prefs.notifications_enabled ?? true,
                email: prefs.email_notifications ?? true,
                reminders: prefs.show_reminders ?? true,
                shares: prefs.show_shares ?? true,
            },
            completedHours: prefs.history_completed_hours || 24,
            retentionDays: prefs.history_retention_days ?? null,
            overdueDays: prefs.history_overdue_days || 3,
        },
        reports: [],
        members: [],
        admin: user.role === "admin",
        registration: "open",
        invitations: [],
        adminLog: [],
    };
}

function taskFields(row: TaskRecord, data: Data, ids: WorkspaceIds) {
    const milestone = data.milestones.some((m) => m.id === row.parent);
    const originalDay = row.scheduledStart.slice(0, 10);
    const scheduledAt = row.scheduledDay
        ? row.scheduledDay === originalDay && row.scheduledStart
            ? zonedInstant(row.scheduledStart, data.profile.timezone)
            : zonedInstant(`${row.scheduledDay}T12:00`, data.profile.timezone)
        : null;
    const due = row.due
        ? zonedInstant(
              `${row.reminder === "dayBefore" ? addDays(row.due, -1) : row.due}T09:00`,
              data.profile.timezone,
          )
        : null;
    const reminder =
        row.reminder === "none"
            ? null
            : row.reminder === "custom"
              ? zonedInstant(row.reminderAt, data.profile.timezone)
              : ["due", "dayBefore"].includes(row.reminder)
                ? due
                : null;
    return {
        title: row.title[0],
        content: row.description[0],
        completion_criteria: row.criteria[0],
        expected_result: row.outcome[0],
        importance: row.importance,
        status: backendStatus(row.status, "tasks"),
        goal_id: !milestone && row.parent ? row.parent : null,
        milestone_id: milestone ? row.parent : null,
        start_date: row.start || null,
        due_date: row.due || null,
        scheduled_at: scheduledAt,
        scheduled_end: row.scheduledDay === originalDay && row.scheduledEnd
            ? zonedInstant(row.scheduledEnd, data.profile.timezone)
            : null,
        reminder_at: reminder,
        reminder_mode: row.reminder,
        pinned: row.pinned,
        tags: row.tags,
        checklist: row.checklist.map(({ text, checked }) => ({
            text,
            checked,
        })),
        related: row.related,
        resource_note_ids: (row.resourceNoteIds || []).map(id => ids.server(id)),
    };
}
const collections = [
    "areas",
    "goals",
    "milestones",
    "tasks",
    "habits",
    "notes",
    "reviews",
    "series",
] as const;
export function changesBetween(
    old: Data,
    next: Data,
    s: Snapshot,
    ids: WorkspaceIds,
    acks: string[],
): Change[] {
    const changes: Change[] = [];
    function fields(
        key: (typeof collections)[number],
        row: Data[typeof key][number],
    ): Record<string, unknown> {
        if (key === "tasks") return taskFields(row as TaskRecord, next, ids);
        if (key === "series") {
            const value = row as Data["series"][number];
            return {
                title: value.template.title[0],
                content: value.template.description[0],
                importance: value.template.importance,
                tags: value.template.tags,
                state: value.state,
                frequency: value.rule.frequency,
                interval_count: value.rule.interval,
                weekdays:
                    value.rule.frequency === "weekly"
                        ? value.rule.weekdays.map((day) => day + 1)
                        : [],
                start_date: value.rule.start,
                end_date: value.rule.end || null,
                timezone: next.profile.timezone,
                template: taskFields(value.template, next, ids),
            };
        }
        if (key === "notes") {
            const value = row as Note;
            return {
                title: value.title || "Untitled",
                content: value.content,
                document: value.document || null,
                color: value.color,
                pinned: value.pinned,
                tags: value.tags,
                goal_id: value.goal || null,
                task_id: value.task ? ids.id(value.task) : null,
                background_id: value.background.startsWith("/api/v1/files/")
                    ? value.background.split("/").pop()
                    : null,
            };
        }
        if (key === "reviews") {
            const value = row as Data["reviews"][number];
            return {
                title: value.title || "Review",
                content: value.reflection,
                reflection: value.reflection,
                went_well: value.wentWell || "",
                improve: value.improve || "",
                next_steps: value.nextSteps || "",
                finalized: !!value.finalized,
                period: value.kind,
                period_date: value.from,
            };
        }
        if (key === "habits") {
            const value = row as Data["habits"][number];
            return {
                title: value.title[0],
                importance: value.importance,
                icon: value.icon,
                accent: value.color,
                content: value.description || "",
                timezone: value.timezone,
                frequency: value.frequency,
                target: value.target,
                tags: value.tags || [],
                primary_goal_id: value.goal || null,
            };
        }
        if (key === "areas") {
            const value = row as Data["areas"][number];
            return {
                title: value.title[0],
                importance: value.importance,
                icon: value.icon,
                accent: value.color,
            };
        }
        if (key === "goals") {
            const value = row as Data["goals"][number];
            return {
                title: value.title[0],
                importance: value.importance,
                icon: value.icon,
                accent: value.color,
                start_date: value.start || null,
                due_date: value.due || null,
                status: backendStatus(value.status, "goals"),
                completion_criteria: value.criteria[0],
                area_id: value.parent ? null : value.area,
                parent_goal_id: value.parent || null,
                content: value.description[0],
                expected_result: value.outcome[0],
                strategy: value.strategy,
                related: value.related,
            };
        }
        const value = row as Data["milestones"][number];
        return {
            title: value.title[0],
            importance: value.importance,
            icon: value.icon,
            accent: value.color,
            start_date: value.start || null,
            due_date: value.due || null,
            status: backendStatus(value.status, "milestones"),
            completion_criteria: value.criteria,
            goal_id: value.goal,
            related: value.related || [],
            weekly: !!value.weekly,
            weekly_for: value.weekly
                ? monday(localDate(next.profile.timezone))
                : null,
        };
    }
    for (const key of collections) {
        const kind = (key === "series" ? "task-series" : key) as Kind;
        for (const row of next[key]) {
            const before = old[key].find((item) => item.id === row.id);
            const id =
                typeof row.id === "number"
                    ? ids.id(row.id)
                    : ids.server(row.id);
            const values = fields(key, row);
            if (!before) {
                changes.push({
                    action: "create",
                    kind,
                    client_id: id,
                    fields: values,
                    acknowledgements: acks,
                });
                if (
                    key === "milestones" &&
                    (row as Data["milestones"][number]).prerequisites.length
                )
                    changes.push({
                        action: "prerequisites",
                        kind,
                        id,
                        version: 1,
                        fields: {
                            ids: (row as Data["milestones"][number])
                                .prerequisites,
                        },
                    });
                continue;
            }
            const raw = s[kind].find((item) => item.id === id);
            if (!raw)
                throw new Error(
                    "Reload this workspace before saving the item.",
                );
            const prior = fields(key, before);
            const delta = Object.fromEntries(
                Object.entries(values).filter(
                    ([name, value]) =>
                        JSON.stringify(value) !== JSON.stringify(prior[name]),
                ),
            );
            if (key === "notes" && (row as Note).permission !== "owner")
                for (const name of Object.keys(delta))
                    if (!["title", "content"].includes(name))
                        delete delta[name];
            const changed = Object.keys(delta).length > 0;
            if (changed)
                changes.push({
                    action: "update",
                    kind,
                    id,
                    version: raw.version,
                    fields: delta,
                    acknowledgements: acks,
                });
            if (
                "archived" in row &&
                "archived" in before &&
                row.archived !== before.archived
            )
                changes.push({
                    action: row.archived ? "archive" : "restore",
                    kind,
                    id,
                    version: raw.version + (changed ? 1 : 0),
                    fields: { include_contents: true },
                });
            if (key === "milestones") {
                const previous = (before as Data["milestones"][number])
                        .prerequisites,
                    current = (row as Data["milestones"][number]).prerequisites;
                if (JSON.stringify(previous) !== JSON.stringify(current))
                    changes.push({
                        action: "prerequisites",
                        kind,
                        id,
                        version: raw.version + (changed ? 1 : 0),
                        fields: { ids: current },
                    });
            }
        }
        if (key === "notes" || key === "reviews")
            for (const row of old[key])
                if (!next[key].some((item) => item.id === row.id)) {
                    const id = ids.server(row.id),
                        raw = s[kind].find((item) => item.id === id);
                    if (raw)
                        changes.push({
                            action: "delete",
                            kind,
                            id,
                            version: raw.version,
                            fields: {},
                        });
                }
    }
    for (const row of next.tasks) {
        const before = old.tasks.find((r) => r.id === row.id);
        for (const period of ["daily", "weekly"] as const)
            if (
                (before?.[period] || false) !== row[period] &&
                !(period === "weekly" && row.daily && !before?.daily)
            )
                changes.push({
                    action: "selection",
                    kind: "tasks",
                    id: ids.id(row.id),
                    fields: {
                        period,
                        day:
                            period === "daily"
                                ? localDate(next.profile.timezone)
                                : monday(localDate(next.profile.timezone)),
                        selected: row[period],
                    },
                });
    }
    for (const row of next.habits) {
        const before = old.habits.find((r) => r.id === row.id);
        if (!before) continue;
        for (const day of new Set([
            ...before.checkins,
            ...before.rests,
            ...row.checkins,
            ...row.rests,
        ])) {
            const state = row.checkins.includes(day)
                    ? "done"
                    : row.rests.includes(day)
                      ? "rest"
                      : "clear",
                prior = before.checkins.includes(day)
                    ? "done"
                    : before.rests.includes(day)
                      ? "rest"
                      : "clear";
            if (state !== prior)
                changes.push({
                    action: "checkin",
                    kind: "habits",
                    id: ids.server(row.id),
                    fields: { day, state },
                });
        }
    }
    if (old.focus !== next.focus)
        changes.push({
            action: "focus",
            kind: "goals",
            fields: { goal_id: next.focus || null },
        });
    for (const change of changes) {
        const refs = (value: unknown, key = ""): unknown =>
            Array.isArray(value)
                ? value.map((v) => refs(v, key))
                : value && typeof value === "object"
                  ? Object.fromEntries(
                        Object.entries(value).map(([k, v]) => [k, refs(v, k)]),
                    )
                  : typeof value === "string" &&
                      (key.endsWith("_id") || ["related", "ids"].includes(key))
                    ? ids.server(value)
                    : value;
        change.fields = refs(change.fields) as Record<string, unknown>;
    }
    return changes;
}
