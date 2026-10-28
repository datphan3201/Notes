// User-facing dates stay DATE strings. Scheduled timestamps are projected into
// the account timezone before comparing them with the dashboard's local today.
export function localDate(timestamp, timezone) {
    if (!timestamp) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(new Date(timestamp));
    const value = (type) => parts.find((part) => part.type === type).value;
    return `${value('year')}-${value('month')}-${value('day')}`;
}
export function taskMatchesView(task, view, today, timezone, selectedIds) {
    if (view === 'completed') return task.status === 'Done' && !taskInHistory(task, today);
    if (view === 'history') return taskInHistory(task, today);
    if (taskInHistory(task, today)) return false;
    const scheduled = localDate(task.scheduled_start, timezone);
    const scheduledEnd = localDate(task.scheduled_end, timezone) || scheduled;
    const dates = [task.deadline, task.start_date, task.occurrence_date, scheduled];
    if (view === 'today')
        return (
            dates.includes(today) ||
            (scheduled != null && scheduled <= today && scheduledEnd >= today) ||
            taskIsOverdue(task, today)
        );
    if (view === 'next')
        return [...dates, scheduledEnd].some((date) => date != null && date > today);
    if (view === 'week') return selectedIds.has(task.id);
    if (view === 'backlog')
        return dates.every((date) => !date) && !task.scheduled_end && !selectedIds.has(task.id);
    return true;
}
// The default "open" status filter would hide every Done task, so completed and
// history views widen it. Each view (and its count badge) applies its own rule.
export function taskViewStatus(view, status) {
    return ['history', 'completed'].includes(view) && status === 'open' ? 'all' : status;
}
export function resourceLinks(body) {
    const links = [];
    for (const match of body.matchAll(/https?:\/\/[^\s<>"']+/g)) {
        const value = match[0].replace(/[.,;!?\])}]+$/, '');
        try {
            const url = new URL(value);
            if (!links.includes(url.href)) links.push(url.href);
        } catch {
            /* Incomplete links stay editable text. */
        }
    }
    return links;
}

// Matches the Dashboard overdue rule: unfinished with a deadline before today.
export function taskIsOverdue(task, today) {
    return task.status !== 'Done' && !!task.deadline && task.deadline < today;
}

// Thresholds come from the account's Task history settings (defaults 24h / 3 days).
export function historyThresholds(preferences = globalThis.window?.notesBootstrap?.preferences) {
    return {
        completedHours: preferences?.history_completed_hours || 24,
        overdueDays: preferences?.history_overdue_days || 3,
    };
}

export function taskInHistory(task, today, now = Date.now(), thresholds = historyThresholds()) {
    if (task.status === 'Done') {
        return (
            !!task.completed_at &&
            now - new Date(task.completed_at).getTime() >= thresholds.completedHours * 3600000
        );
    }
    if (!task.deadline) return false;
    const cutoff = new Date(`${today}T00:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - thresholds.overdueDays);
    return task.deadline <= cutoff.toISOString().slice(0, 10);
}
