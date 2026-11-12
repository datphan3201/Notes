export const workspaceKinds = ['areas', 'goals', 'milestones', 'tasks', 'habits', 'notes', 'reviews', 'task-series'] as const;
type Kind = typeof workspaceKinds[number];
type Versioned = { id: string; version: number; note_ids?: string[] };
export function versionInventory(snapshot: Record<Kind, Versioned[]>) {
    return Object.fromEntries(workspaceKinds.map((kind) => [kind,
        Object.fromEntries(snapshot[kind].map((row) => [row.id, row.version]))]));
}
export function mergeWorkspace<T extends Record<Kind, Versioned[]>>(
    previous: T,
    update: T & { manifest: Record<Kind, string[]>; task_notes: Record<string, string[]>;
        note_state?: Record<string, Partial<Versioned>> },
): T {
    const next = { ...previous, ...update };
    for (const kind of workspaceKinds) {
        if (!Array.isArray(update.manifest[kind])) throw new Error('Incomplete workspace manifest');
        const rows = new Map(previous[kind].map((row) => [row.id, row]));
        for (const row of update[kind]) rows.set(row.id, row);
        next[kind] = update.manifest[kind].map((id) => {
            const row = rows.get(id);
            if (!row) throw new Error('Missing workspace record');
            return kind === 'tasks' ? { ...row, note_ids: update.task_notes[id] || [] }
                : kind === 'notes' ? { ...row, ...update.note_state?.[id] } : row;
        }) as T[typeof kind];
    }
    return next;
}
