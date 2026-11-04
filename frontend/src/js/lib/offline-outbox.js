/**
 * Pure rules for the offline outbox: one pending entry per Note, so a burst
 * of offline edits becomes a single request when the connection returns.
 *
 * Entry shapes:
 *   { noteId, kind: 'create', snapshot }                 not yet on the server
 *   { noteId, kind: 'update', snapshot, baseVersion }   edit of a server version
 *   { noteId, kind: 'delete', baseVersion }             delete of a server version
 */

/** Returns the entry that replaces `previous` (may be undefined) after `next`, or null to drop both. */
export function coalesce(previous, next) {
    if (!previous) return next;
    if (previous.kind === 'create') {
        // Deleting a note the server never saw needs no request at all.
        if (next.kind === 'delete') return null;
        return { ...previous, snapshot: next.snapshot };
    }
    if (next.kind === 'delete')
        return { noteId: next.noteId, kind: 'delete', baseVersion: previous.baseVersion };
    if (previous.kind === 'delete') return previous;
    // Keep the version the first offline edit was based on: that is what the server knows.
    return { ...previous, snapshot: next.snapshot };
}

/**
 * Applies a queued snapshot over a stored Note for display while it waits to sync.
 * @returns {object}
 */
export function withPendingSnapshot(note, entry) {
    if (!entry || entry.kind === 'delete') return note;
    const snapshot = entry.snapshot;
    return {
        ...note,
        id: entry.noteId,
        title: snapshot.title,
        content: snapshot.content,
        content_preview: snapshot.content.slice(0, 240),
        color: snapshot.color,
        is_pinned: snapshot.is_pinned,
        labels: note?.labels || [],
        pending_sync: true,
    };
}

/**
 * Client-side list for offline mode: search title/content (case and accent
 * insensitive, like the server), filter by any selected tag, pinned first by
 * pin time, then the chosen order.
 */
export function filterAndSort(
    notes,
    { q = '', labelIds = [], sort = 'updated', direction = 'desc' },
) {
    const fold = (text) =>
        String(text || '')
            .toLocaleLowerCase()
            .normalize('NFD')
            .replace(/\p{Mn}/gu, '')
            .replace(/đ/g, 'd');
    const needle = fold(q.trim());
    const selected = labelIds.map(String);
    const field = { title: 'title', created: 'created_at' }[sort] || 'updated_at';
    const factor = direction === 'asc' ? 1 : -1;
    return notes
        .filter((note) => {
            if (needle) {
                const haystack =
                    fold(note.title) + '\n' + (note.is_locked ? '' : fold(note.content));
                if (!haystack.includes(needle)) return false;
            }
            if (selected.length) {
                const ids = (note.labels || []).map((label) => String(label.id));
                if (!selected.some((id) => ids.includes(id))) return false;
            }
            return true;
        })
        .sort((a, b) => {
            const pinned = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
            if (pinned) return pinned;
            if (a.is_pinned && b.is_pinned)
                return String(b.pinned_at || '').localeCompare(String(a.pinned_at || ''));
            const left = String(a[field] || '');
            const right = String(b[field] || '');
            const order =
                field === 'title'
                    ? left.localeCompare(right, undefined, { sensitivity: 'base' })
                    : left.localeCompare(right);
            return order * factor || String(b.id).localeCompare(String(a.id));
        });
}
