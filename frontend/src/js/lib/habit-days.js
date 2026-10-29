// Display state of one Habit day. Dates are YYYY-MM-DD strings in the
// Habit's (or account's) timezone, so plain string comparison orders them.
// A Rest Day never counts as done; it only marks the day as protected.
export function habitDayState(date, checked, today, trackingSince, rested = false) {
    if (checked) return 'checked';
    if (rested) return 'rest';
    if (date > today) return 'upcoming';
    if (date === today) return 'open';
    if (!trackingSince || date < trackingSince) return 'untracked';
    return 'missed';
}

export const habitDayDescriptions = {
    checked: 'checked in',
    missed: 'missed',
    open: 'not checked in yet',
    rest: 'rest day',
    upcoming: 'upcoming',
    untracked: 'before tracking began',
};

// Rest Days can be planned for exactly the next `size` days after today.
export function restWindow(today, size = 3) {
    const dates = [];
    for (let offset = 1; offset <= size; offset++) dates.push(shiftDate(today, offset));
    return dates;
}

export function shiftDate(date, days) {
    const cursor = new Date(`${date}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + days);
    return cursor.toISOString().slice(0, 10);
}

export function streakLabel(streak, t = (text) => text) {
    const count = streak?.count ?? 0;
    const unit =
        streak?.unit === 'weeks'
            ? count === 1
                ? t('week')
                : t('weeks')
            : count === 1
              ? t('day')
              : t('days');
    return `${count} ${unit}`;
}
