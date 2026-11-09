import type { Identity, WorkspacePreferences } from "@/lib/api";
import type { PreviewNotice } from "./preview/notifications";
export type LiveRuntime = {
    historyLimit: number;
    keepNoteDraft: (
        id: string,
        draft: { title: string; content: string; document?: import("@/lib/note-document").RichNoteDocument | null },
    ) => Promise<void>;
    discardNoteDraft: (id: string) => Promise<void>;
    resolveNoteConflict: (
        id: string,
        draft?: { title: string; content: string; document?: import("@/lib/note-document").RichNoteDocument | null },
    ) => Promise<boolean>;
    tags: { id: string; label: [string, string] }[];
    invitations: {
        note_id: string;
        title: string;
        owner: string;
        can_edit: boolean;
    }[];
    saveTags: (values: string[]) => Promise<void>;
    preferences: (values: Partial<WorkspacePreferences>) => Promise<void>;
    href: (section: string) => string;
    identity: Identity;
    busy: boolean;
    offline: boolean;
    notices: PreviewNotice[];
    request: <T = unknown>(path: string, options?: RequestInit) => Promise<T>;
    refresh: () => Promise<void>;
    flush: () => Promise<boolean>;
    acknowledge: (values: string[]) => void;
    serverId: (id: string | number) => string;
    upload: (path: string, file: File, purpose?: string) => Promise<unknown>;
    logout: () => Promise<void>;
};
