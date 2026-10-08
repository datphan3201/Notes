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
    const scheduled = localDate(task.scheduled_start, timezone);
    const scheduledEnd = localDate(task.scheduled_end, timezone) || scheduled;
    const dates = [task.deadline, task.start_date, task.occurrence_date, scheduled];
    if (view === 'today')
        return (
            dates.includes(today) ||
            (scheduled != null && scheduled <= today && scheduledEnd >= today)
        );
    if (view === 'next')
        return [...dates, scheduledEnd].some((date) => date != null && date > today);
    if (view === 'week') return selectedIds.has(task.id);
    if (view === 'backlog')
        return dates.every((date) => !date) && !task.scheduled_end && !selectedIds.has(task.id);
    return true;
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
