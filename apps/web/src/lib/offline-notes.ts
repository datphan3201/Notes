import type { Snapshot, Change } from "@/components/live-model";

const database = "planner-private-notes-v1",
    lastAccount = "planner-offline-account";
type Cached = {
    snapshot: Snapshot;
    changes: Change[];
    drafts?: Record<string, NoteDraft>;
};
function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(database, 1);
        request.onupgradeneeded = () =>
            request.result.createObjectStore("accounts");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}
async function stored<T>(
    userId: string,
    write?: (value: Cached | undefined) => Cached | undefined,
): Promise<T> {
    const db = await open();
    try {
        return await new Promise<T>((resolve, reject) => {
            const transaction = db.transaction(
                    "accounts",
                    write ? "readwrite" : "readonly",
                ),
                store = transaction.objectStore("accounts"),
                request = store.get(userId);
            let result: unknown;
            request.onsuccess = () => {
                try {
                    result = write ? write(request.result) : request.result;
                    if (write) {
                        if (result) store.put(result, userId);
                        else store.delete(userId);
                    }
                } catch (error) {
                    transaction.abort();
                    reject(error);
                }
            };
            transaction.oncomplete = () => resolve(result as T);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
    } finally {
        db.close();
    }
}
export async function cachedNotes(
    userId = localStorage.getItem(lastAccount) || "",
) {
    return userId ? stored<Cached | undefined>(userId) : undefined;
}
export async function cacheNotes(snapshot: Snapshot) {
    const identity = {
        ...snapshot.identity,
        csrf: "",
        user: { ...snapshot.identity.user, profile: {}, role: "user" as const },
    };
    const copy: Snapshot = {
        ...snapshot,
        identity,
        areas: [],
        goals: [],
        milestones: [],
        tasks: [],
        habits: [],
        reviews: [],
        "task-series": [],
        selections: [],
        habit_days: [],
        dependencies: [],
        activity: [],
        focus: null,
        account_files: [],
        invitations: [],
        notes: snapshot.notes
            .filter((note) => !note.shared && !note.shares?.length && !note.locked && !note.archived_at)
            .map((note) => ({
                ...note,
                files: [],
                shares: [],
                background_id: null,
                summary: "",
            })),
    };
    localStorage.setItem(lastAccount, identity.user.id);
    await stored(identity.user.id, (prior) => ({
        snapshot: { ...copy, notes: copy.notes.flatMap(note => {
            if (note.body_loaded !== false) return [note];
            const cached = prior?.snapshot.notes.find(row => row.id === note.id && row.version === note.version);
            return cached ? [cached] : [];
        }) },
        changes: prior?.changes || [],
        drafts: Object.fromEntries(
            Object.entries(prior?.drafts || {}).filter(
                ([id]) =>
                    !snapshot.notes.some(
                        (note) =>
                            (note.id === id || note.client_key === id) &&
                            (note.locked || note.shared || !!note.shares?.length),
                    ),
            ),
        ),
    }));
}
export async function queueNoteChanges(userId: string, changes: Change[]) {
    if (
        changes.some(
            (change) =>
                change.kind !== "notes" ||
                !["create", "update", "delete"].includes(change.action),
        )
    )
        throw new Error("Only personal Note drafts can be edited offline.");
    await stored(userId, (prior) => {
        if (!prior)
            throw new Error("Open Notes online before using offline mode.");
        return { ...prior, changes };
    });
}
export async function clearNoteChanges(userId: string) {
    await stored(userId, (prior) =>
        prior ? { ...prior, changes: [] } : undefined,
    );
}
export async function forgetOfflineNotes(userId?: string) {
    const id = userId || localStorage.getItem(lastAccount);
    if (id) await stored(id, () => undefined);
    localStorage.removeItem(lastAccount);
}
export function restoreOfflineDrafts(
    snapshot: Snapshot,
    changes: Change[],
): Snapshot {
    const notes = [...snapshot.notes];
    for (const change of changes) {
        if (change.action === "create")
            notes.unshift({
                id: change.client_id!,
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                title: "Untitled",
                content: "",
                importance: 3,
                archived_at: null,
                ...change.fields,
            } as Snapshot["notes"][number]);
        else {
            const index = notes.findIndex((note) => note.id === change.id);
            if (index >= 0) {
                if (change.action === "delete") notes.splice(index, 1);
                else notes[index] = { ...notes[index], ...change.fields };
            }
        }
    }
    return { ...snapshot, notes };
}

export type NoteDraft = { version?: number; title: string; content: string; document?: import("./note-document").RichNoteDocument | null };
export async function keepNoteDraft(
    userId: string,
    id: string,
    draft: NoteDraft,
) {
    await stored(userId, (prior) =>
        prior
            ? { ...prior, drafts: { ...prior.drafts, [id]: draft } }
            : undefined,
    );
}
export async function discardNoteDraft(userId: string, id?: string) {
    await stored(userId, (prior) => {
        if (!prior) return undefined;
        const drafts = { ...prior.drafts };
        if (id) delete drafts[id];
        return { ...prior, drafts: id ? drafts : {} };
    });
}
