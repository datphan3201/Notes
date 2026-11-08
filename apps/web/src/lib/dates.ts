export function localDate(timezone: string, now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}

export function monthDays(month: string) {
    const [year, index] = month.split("-").map(Number);
    const first = new Date(Date.UTC(year, index - 1, 1));
    const offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) => {
        const day = new Date(Date.UTC(year, index - 1, 1 - offset + i));
        return day.toISOString().slice(0, 10);
    });
}

export function taskMatches(
    task: {
        due_date?: string | null;
        start_date?: string | null;
        scheduled_at?: string | null;
    },
    date: string,
    timezone: string,
) {
    return (
        task.due_date === date ||
        task.start_date === date ||
        (!!task.scheduled_at &&
            localDate(timezone, new Date(task.scheduled_at)) === date)
    );
}

export function zonedInput(
    instant: string | null | undefined,
    timezone: string,
) {
    if (!instant) return "";
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (name: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === name)!.value;
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function zonedInstant(value: string, timezone: string) {
    if (!value) return null;
    const target = Date.parse(value + ":00Z");
    let guess = target;
    for (let iteration = 0; iteration < 4; iteration++) {
        const represented = Date.parse(
            zonedInput(new Date(guess).toISOString(), timezone) + ":00Z",
        );
        if (represented === target) return new Date(guess).toISOString();
        guess += target - represented;
    }
    throw new Error(
        "This time is skipped by a daylight saving change. Choose another time.",
    );
}

export function timezones(current: string) {
    return [
        ...new Set(["UTC", current, ...Intl.supportedValuesOf("timeZone")]),
    ];
}
