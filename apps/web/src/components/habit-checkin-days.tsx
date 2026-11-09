"use client";

import { Check, X } from "lucide-react";
import { dateLabel, type Habit } from "./preview/workspace-data";
import type { Text } from "./preview/shared";

export default function HabitCheckinDays({ habit, dates, today, locale, text, onCheck, onRest }: {
    habit: Habit; dates: string[]; today: string; locale: "en" | "vi"; text: Text;
    onCheck: (id: string, date: string) => void; onRest?: (habit: Habit, date: string) => void;
}) {
    return <div className="habit-checkin-days">
        {dates.map(date => {
            const checked = habit.checkins.includes(date), rested = habit.rests.includes(date), future = date > today;
            const state = checked ? "checked" : rested ? "rest" : date < today ? "missed" : "pending";
            const action = future ? text("Plan rest day", "Đặt ngày nghỉ") : checked ? text("Undo check-in", "Bỏ điểm danh") : text("Check in", "Điểm danh");
            return <button type="button" key={date}
                className={`habit-checkin-day is-${state} ${future ? "is-future" : ""} ${date === today ? "is-today" : ""}`}
                title={dateLabel(date, locale, true)} aria-label={`${text(...habit.title)}. ${dateLabel(date, locale, true)}. ${action}`}
                aria-pressed={checked || rested} disabled={future ? !onRest || date > shiftDate(today, 3) : rested}
                onClick={() => future ? onRest?.(habit, date) : onCheck(habit.id, date)}>
                <span className="habit-checkin-dot">{checked ? <Check size={12} aria-hidden="true" /> : rested ? "R" : date < today ? <X size={12} aria-hidden="true" /> : ""}</span>
                <small>{new Intl.DateTimeFormat(locale, { weekday: locale === "vi" ? "narrow" : "short", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"))}</small>
            </button>;
        })}
    </div>;
}

function shiftDate(date: string, days: number) {
    const value = new Date(date + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}
