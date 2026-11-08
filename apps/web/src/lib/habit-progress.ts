import { addDays, monday } from "./task-views.ts";
import type { Habit } from "../components/preview/workspace-data";

export function habitStreak(habit: Habit, today: string): number {
    const done = new Set(habit.checkins),
        rest = new Set(habit.rests);
    const since = habit.created || [...done, ...rest].sort()[0] || today;
    if (habit.frequency === "daily") {
        let count = 0;
        for (let day = today; day >= since; day = addDays(day, -1)) {
            if (done.has(day)) count++;
            else if (day !== today && !rest.has(day)) break;
        }
        return count;
    }
    const current = monday(today);
    let count = 0;
    for (
        let start = current;
        addDays(start, 6) >= since;
        start = addDays(start, -7)
    ) {
        let completed = 0,
            rested = 0,
            available = 0;
        for (let offset = 0; offset < 7; offset++) {
            const day = addDays(start, offset);
            if (day < since) continue;
            available++;
            if (done.has(day)) completed++;
            else if (rest.has(day)) rested++;
        }
        const required = Math.max(
            0,
            Math.min(habit.target, available) - rested,
        );
        if (completed > 0 && completed >= required) count++;
        else if (start !== current && completed < required) break;
    }
    return count;
}
