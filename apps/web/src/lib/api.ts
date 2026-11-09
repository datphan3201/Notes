export type User = {
    role?: "user" | "admin";
    mfa_method?: "none" | "email" | "app";
    profile?: { bio?: string; avatar_id?: string; pending_email?: string };
    id: string;
    email: string;
    name: string;
    timezone: string;
    locale: "vi" | "en";
    theme: "light" | "dark";
    email_verified: boolean;
    two_factor_enabled: boolean;
    preferences: WorkspacePreferences;
};
export type WorkspacePreferences = {
    history_retention_days?: number | null;
    tags?: string[];
    accent?: string;
    background_id?: string | null;
    show_reminders?: boolean;
    show_shares?: boolean;
    visual_theme?: "mountain" | "forest" | "ocean" | "pisces" | "stars";
    show_background?: boolean;
    show_illustrations?: boolean;
    show_quote?: boolean;
    custom_quote?: string;
    background_color?: string | null;
    notes_view?: "grid" | "list";
    notifications_enabled?: boolean;
    email_notifications?: boolean;
    history_completed_hours?: number;
    history_overdue_days?: number;
};
export type Identity = { user: User; csrf: string };
export type Kind =
    | "notes"
    | "areas"
    | "goals"
    | "milestones"
    | "tasks"
    | "habits"
    | "reviews"
    | "task-series";
export type Entity = {
    document?: import("./note-document").RichNoteDocument | null;
    series_id?: string | null;
    first_check_in_at?: string | null;
    id: string;
    title: string;
    content: string;
    importance: number;
    version: number;
    updated_at: string;
    archived_at: string | null;
    created_at: string;
    status?: "todo" | "doing" | "blocked" | "done" | "active" | "completed";
    due_date?: string | null;
    start_date?: string | null;
    expected_result?: string;
    completion_criteria?: string;
    scheduled_at?: string | null;
    scheduled_end?: string | null;
    occurrence_date?: string | null;
    completed_at?: string | null;
    reminder_at?: string | null;
    estimated_minutes?: number | null;
    area_id?: string | null;
    parent_goal_id?: string | null;
    goal_id?: string | null;
    milestone_id?: string | null;
    task_id?: string | null;
    pinned?: boolean;
    shared?: boolean;
    can_edit?: boolean;
    color?: string;
    progress?: number;
    locked?: boolean;
    tags?: string[];
    checklist?: { text: string; checked: boolean }[];
    note_ids?: string[];
    resource_note_ids?: string[];
    timezone?: string;
    frequency?: string;
    target?: number;
    period?: string;
    period_date?: string;
    state?: string;
    interval_count?: number;
    weekdays?: number[];
    end_date?: string | null;
};
export type Collection = { items: Entity[]; page: number; has_more: boolean };
export type Dashboard = {
    date: string;
    counts: {
        open_tasks: number;
        completed_tasks: number;
        goals: number;
        notes: number;
    };
    today: Entity[];
    week: Entity[];
    habits: Entity[];
};
export type Run = {
    preview?: (Record<string, unknown> | null)[];
    id: string;
    status: string;
    answer: string;
    proposal: {
        operations: {
            kind: Kind;
            action: string;
            ref?: string;
            acknowledgements?: string[];
            id?: string;
            fields: Record<string, unknown>;
        }[];
    } | null;
    proposal_hash: string | null;
    sources: { kind: Kind; id: string; version: number }[];
    applied_at: string | null;
    error_code: string | null;
};

export class ApiError extends Error {
    constructor(
        public status: number,
        message: string,
        public fields: Record<string, string> = {},
    ) {
        super(message);
    }
}

export async function api<T>(
    path: string,
    options: RequestInit = {},
    csrf?: string,
): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
        headers.set("Content-Type", "application/json");
    if (csrf) headers.set("x-csrf-token", csrf);
    const response = await fetch(`/api/v1${path}`, {
        ...options,
        headers,
        credentials: "same-origin",
        cache: "no-store",
    });
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const fields: Record<string, string> = {};
        if (Array.isArray(body.detail)) {
            for (const issue of body.detail) {
                const key = issue.loc?.[issue.loc.length - 1];
                if (typeof key === "string" && typeof issue.msg === "string")
                    fields[key] = issue.msg;
            }
        }
        throw new ApiError(
            response.status,
            typeof body.detail === "string"
                ? body.detail
                : "Check the fields and try again.",
            fields,
        );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}
