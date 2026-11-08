export type PreviewLocale = "vi" | "en";
export type Text = (en: string, vi: string) => string;
export type ViewState = "ready" | "empty" | "loading" | "error";
export type PreviewTask = {
    id: number;
    title: string;
    note: string;
    due: string;
    importance: string;
    done: boolean;
};

export const previewSections = [
    "dashboard",
    "goals",
    "tasks",
    "calendar",
    "habits",
    "notes",
    "reviews",
    "profile",
    "appearance",
    "security",
    "notifications",
    "history",
    "archive",
    "help",
    "reports",
    "admin",
];
