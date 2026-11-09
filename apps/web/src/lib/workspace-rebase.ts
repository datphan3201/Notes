// Reapply an already evaluated local edit over an acknowledged server snapshot.
// Never rerun state updaters: creators may allocate IDs, and toggles express an
// intent based on the state the user actually saw.
export function rebaseEdit<T>(before: T, after: T, server: T, field = ""): T {
    if (Object.is(before, after) || JSON.stringify(before) === JSON.stringify(after)) return server;
    if (Array.isArray(before) && Array.isArray(after) && Array.isArray(server)) {
        const rows = [...before, ...after, ...server];
        if (rows.every((row: unknown) => row !== null && typeof row === "object" && Object.hasOwn(row, "id"))) {
            const old = new Map(before.map((row) => [row.id, row]));
            const next = new Map(after.map((row) => [row.id, row]));
            const existing = new Set(server.map((row) => row.id));
            return [
                ...server.filter((row) => !old.has(row.id) || next.has(row.id))
                    .map((row) => old.has(row.id) && next.has(row.id)
                        ? rebaseEdit(old.get(row.id), next.get(row.id), row)
                        : row),
                ...after.filter((row) => !old.has(row.id) && !existing.has(row.id)),
            ] as T;
        }
        if (["checkins", "rests", "tags"].includes(field)) {
            const removed = new Set(before.filter((value) => !after.includes(value)));
            return [...new Set([
                ...server.filter((value) => !removed.has(value)),
                ...after.filter((value) => !before.includes(value)),
            ])] as T;
        }
        return after;
    }
    if (before && after && server && typeof before === "object" && typeof after === "object" && typeof server === "object") {
        const old = before as Record<string, unknown>;
        const next = after as Record<string, unknown>;
        const result = { ...server } as Record<string, unknown>;
        for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
            if (!(key in next)) delete result[key];
            else result[key] = rebaseEdit(old[key], next[key], result[key], key);
        }
        return result as T;
    }
    return after;
}
