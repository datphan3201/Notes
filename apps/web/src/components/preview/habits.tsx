"use client";
import FloatingActions from "../floating-actions";
import { timezones } from "@/lib/dates";
import { useState } from "react";
import { Check, MoreHorizontal, Plus, Flame, X } from "lucide-react";
import {
    usePreviewData,
    addDays,
    dateLabel,
    day as fixtureToday,
    label,
    palette,
    type Habit,
} from "./workspace-data";
import { monday } from "./calendar";
import {
    Confirm,
    EntityIcon,
    Field,
    FormDialog,
    Header,
    IconPicker,
    Stars,
} from "./ui";
import type { Text } from "./shared";
import { tagOptions as fixtureTags } from "./task-data";
import { habitStreak } from "@/lib/habit-progress";
export default function HabitsPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const tagOptions = db.live?.tags || fixtureTags;
    const day = db.today || fixtureToday;
    const [editing, setEditing] = useState<Habit | null | undefined>(undefined),
        [icon, setIcon] = useState("leaf"),
        [color, setColor] = useState(palette[1]),
        [importance, setImportance] = useState(3),
        [frequency, setFrequency] = useState("daily"),
        [archive, setArchive] = useState<Habit | null>(null);
    const frozen =
        !!editing && (!!editing.started || editing.checkins.length > 0);
    const dates = Array.from({ length: 10 }, (_, i) => addDays(day, i - 6));
    const daily = db.habits.filter(
        (habit) => !habit.archived && habit.frequency === "daily",
    );
    const atHabitDate = (habit: Habit, date: string) =>
        addDays(
            habit.today || day,
            Math.round((Date.parse(date) - Date.parse(day)) / 86400000),
        );
    const tracked = (habit: Habit, date: string) =>
        atHabitDate(habit, date) >=
        (habit.created || [...habit.checkins, ...habit.rests].sort()[0] || day);
    const dayComplete = (date: string) => {
        const active = daily.filter((habit) => tracked(habit, date));
        return (
            active.length > 0 &&
            active.every(
                (habit) =>
                    habit.checkins.includes(atHabitDate(habit, date)) ||
                    habit.rests.includes(atHabitDate(habit, date)),
            )
        );
    };
    let streak = 0,
        cursor = dayComplete(day) ? day : addDays(day, -1);
    for (; dayComplete(cursor); cursor = addDays(cursor, -1))
        if (
            daily.some(
                (habit) =>
                    tracked(habit, cursor) &&
                    habit.checkins.includes(atHabitDate(habit, cursor)),
            )
        )
            streak++;
    const weekday = (date: string) =>
        new Intl.DateTimeFormat(db.locale, {
            weekday: db.locale === "vi" ? "narrow" : "short",
            timeZone: "UTC",
        }).format(new Date(date + "T00:00:00Z"));
    const open = (habit: Habit | null) => {
        setEditing(habit);
        setIcon(habit?.icon || "leaf");
        setColor(habit?.color || palette[1]);
        setImportance(habit?.importance || 3);
        setFrequency(habit?.frequency || "daily");
    };
    const rest = (habit: Habit, date: string) => {
        const day = habit.today || db.today || fixtureToday;
        if (
            date <= day ||
            date > addDays(day, 3) ||
            habit.checkins.includes(date)
        )
            return;
        db.setHabits((rows) =>
            rows.map((row) =>
                row.id === habit.id
                    ? {
                          ...row,
                          rests: row.rests.includes(date)
                              ? row.rests.filter((value) => value !== date)
                              : [...row.rests, date],
                      }
                    : row,
            ),
        );
    };
    return (
        <div className="review-habits planning-page" data-habits-page>
            <Header
                title={text("Habits", "Thói quen")}
                description={text(
                    "Small steps, big consistency.",
                    "Bước nhỏ, duy trì đều đặn.",
                )}
            />
            <FloatingActions
                label={text("Page actions", "Thao tác trang")}
                closeLabel={text("Close actions", "Đóng thao tác")}
            >
                <button
                    className="button button-primary"
                    onClick={() => open(null)}
                >
                    <Plus size={17} />
                    {text("New Habit", "Thói quen mới")}
                </button>
            </FloatingActions>
            <div className="habit-summary">
                <article className="planning-panel">
                    <h2>{text("Your streak", "Chuỗi ngày của bạn")}</h2>
                    <div className="review-habit-streak">
                        <strong>
                            <Flame size={23} />
                            {streak}{" "}
                            {text(streak === 1 ? "day" : "days", "ngày")}
                        </strong>
                        <div className="habit-checkin-days">
                            {dates.slice(0, 7).map((date) => (
                                <div
                                    className={`habit-checkin-day ${dayComplete(date) ? "is-checked" : date < day ? "is-missed" : "is-pending"}`}
                                    key={date}
                                >
                                    <span className="habit-checkin-dot"
                                        aria-label={dayComplete(date) ? text("Completed", "Đã hoàn thành") : date < day ? text("Missed", "Chưa hoàn thành") : text("Not checked in", "Chưa điểm danh")}>
                                        {dayComplete(date)
                                            ? <Check size={12} aria-hidden="true" />
                                            : date < day
                                              ? <X size={12} aria-hidden="true" />
                                              : ""}
                                    </span>
                                    <small>{weekday(date)}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="subtle-copy">
                        {text(
                            "Complete all daily habits to keep your streak going.",
                            "Hoàn thành mọi thói quen hàng ngày để giữ chuỗi của bạn.",
                        )}
                    </p>
                </article>
                {db.appearance.showQuote && (
                    <article className="planning-panel scene-card quote-scene-card">
                        <blockquote className="theme-quote">
                            {db.appearance.quote ||
                                text(
                                    "Small steps add up to great results.",
                                    "Những bước nhỏ cộng dồn thành kết quả lớn.",
                                )}
                        </blockquote>
                    </article>
                )}
            </div>
            <section className="planning-panel habit-today-panel">
                <div className="section-heading">
                    <h2>{text("List of habits", "Danh sách thói quen")}</h2>

                </div>
                <div data-habit-list>
                    {db.habits
                        .filter((habit) => !habit.archived)
                        .map((habit) => {
                            const day = habit.today || db.today || fixtureToday;
                            const dates = Array.from({ length: 10 }, (_, i) =>
                                addDays(day, i - 6),
                            );
                            const count = habit.checkins.filter(
                                (date) =>
                                    date >=
                                        (habit.frequency === "daily"
                                            ? day
                                            : monday(day)) && date <= day,
                            ).length;
                            return (
                                <article
                                    className="planning-list-item planning-list-item-wrap habit-row"
                                    key={habit.id}
                                >
                                    <button
                                        className={`habit-tick ${habit.checkins.includes(day) ? "is-checked" : ""} ${habit.rests.includes(day) ? "is-rest" : ""}`}
                                        role="checkbox"
                                        aria-checked={habit.checkins.includes(
                                            day,
                                        )}
                                        aria-label={
                                            text(
                                                "Check in or undo: ",
                                                "Điểm danh hoặc bỏ: ",
                                            ) + text(...habit.title)
                                        }
                                        onClick={() =>
                                            db.checkHabit(habit.id, day)
                                        }
                                    >
                                        <span className="habit-tick-circle">
                                            <Check size={17} />
                                        </span>
                                    </button>
                                    <div className="habit-row-copy">
                                        <strong className="habit-row-name">
                                            <EntityIcon
                                                name={habit.icon}
                                                color={habit.color}
                                                onChange={(icon, color) =>
                                                    db.setHabits((rows) =>
                                                        rows.map((row) =>
                                                            row.id === habit.id
                                                                ? {
                                                                      ...row,
                                                                      icon,
                                                                      color,
                                                                  }
                                                                : row,
                                                        ),
                                                    )
                                                }
                                                text={text}
                                                defaultIcon="activity"
                                                label={text(
                                                    "Edit Habit icon",
                                                    "Sửa biểu tượng thói quen",
                                                )}
                                            />
                                            <span>
                                                {text(...habit.title)}{" "}
                                                <Stars
                                                    value={habit.importance}
                                                    text={text}
                                                />
                                            </span>
                                        </strong>
                                        {habit.description && (
                                            <p className="subtle-copy">
                                                {habit.description}
                                            </p>
                                        )}
                                        <small>
                                            {count}/
                                            {habit.frequency === "daily"
                                                ? 1
                                                : habit.target}{" "}
                                            {habit.frequency === "daily"
                                                ? text("today", "hôm nay")
                                                : text(
                                                      "this week",
                                                      "tuần này",
                                                  )}{" "}
                                            · {text("Streak", "Chuỗi")}:{" "}
                                            {habitStreak(habit, day)}{" "}
                                            {habit.frequency === "daily"
                                                ? text("days", "ngày")
                                                : text("weeks", "tuần")}
                                        </small>
                                        {habit.goal && (
                                            <button
                                                className="context-chip text-button"
                                                onClick={() =>
                                                    db.navigate("goals", {
                                                        goal: habit.goal,
                                                    })
                                                }
                                            >
                                                {text(
                                                    ...db.goals.find(
                                                        (goal) =>
                                                            goal.id ===
                                                            habit.goal,
                                                    )!.title,
                                                )}
                                            </button>
                                        )}
                                        {!!habit.tags?.length && (
                                            <div className="tag-chips">
                                                {habit.tags.map((id) => (
                                                    <span
                                                        className="context-chip"
                                                        key={id}
                                                    >
                                                        {text(
                                                            ...(tagOptions.find(
                                                                (tag) =>
                                                                    tag.id ===
                                                                    id,
                                                            )?.label || [
                                                                id,
                                                                id,
                                                            ]),
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {habit.rests.includes(day) && (
                                            <small className="habit-rest-note">
                                                {text(
                                                    "Rest day today · your streak is protected",
                                                    "Hôm nay là ngày nghỉ · chuỗi của bạn được giữ",
                                                )}
                                            </small>
                                        )}
                                    </div>
                                    <div className="habit-checkin-days">
                                        {dates.map((date) => {
                                            const checked =
                                                    habit.checkins.includes(
                                                        date,
                                                    ),
                                                rested =
                                                    habit.rests.includes(date),
                                                future = date > day;
                                            const state = checked
                                                ? "checked"
                                                : rested
                                                  ? "rest"
                                                  : date < day
                                                    ? "missed"
                                                    : "pending";
                                            return (
                                                <button
                                                    className={`habit-checkin-day is-${state} ${future ? "is-future" : ""} ${date === day ? "is-today" : ""}`}
                                                    key={date}
                                                    title={dateLabel(
                                                        date,
                                                        db.locale,
                                                        true,
                                                    )}
                                                    aria-label={`${text(...habit.title)} · ${dateLabel(date, db.locale, true)} · ${future ? text("Rest day", "Ngày nghỉ") : checked ? text("Undo check-in", "Bỏ điểm danh") : text("Check in", "Điểm danh")}`}
                                                    aria-pressed={
                                                        checked || rested
                                                    }
                                                    disabled={
                                                        (!future && rested) ||
                                                        (!!habit.created &&
                                                            date <
                                                                habit.created)
                                                    }
                                                    onClick={() =>
                                                        future
                                                            ? rest(habit, date)
                                                            : db.checkHabit(
                                                                  habit.id,
                                                                  date,
                                                              )
                                                    }
                                                >
                                                    <span className="habit-checkin-dot">
                                                        {checked ? (
                                                            <Check size={12} />
                                                        ) : rested ? (
                                                            "R"
                                                        ) : date < day ? (
                                                            <X size={12} aria-hidden="true" />
                                                        ) : (
                                                            ""
                                                        )}
                                                    </span>
                                                    <small>
                                                        {weekday(date)}
                                                    </small>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="habit-row-actions">
                                        <button
                                            className="button button-quiet"
                                            onClick={() => open(habit)}
                                        >
                                            {text("Edit", "Chỉnh sửa")}
                                        </button>
                                        <details className="review-row-menu">
                                            <summary
                                                className="icon-button"
                                                aria-label={text(
                                                    "More Habit options",
                                                    "Tùy chọn thói quen",
                                                )}
                                            >
                                                <MoreHorizontal size={19} />
                                            </summary>
                                            <div className="review-popover">
                                                <strong>
                                                    {text(
                                                        "Rest day",
                                                        "Ngày nghỉ",
                                                    )}
                                                </strong>
                                                <p className="subtle-copy">
                                                    {text(
                                                        "Plan rest in the next 3 days. Rest protects your streak without adding a completion.",
                                                        "Lên lịch nghỉ trong 3 ngày tới. Ngày nghỉ giữ chuỗi nhưng không tính là hoàn thành.",
                                                    )}
                                                </p>
                                                {[1, 2, 3].map((n) => (
                                                    <button
                                                        key={n}
                                                        onClick={() =>
                                                            rest(
                                                                habit,
                                                                addDays(day, n),
                                                            )
                                                        }
                                                        aria-pressed={habit.rests.includes(
                                                            addDays(day, n),
                                                        )}
                                                    >
                                                        {habit.rests.includes(
                                                            addDays(day, n),
                                                        )
                                                            ? "✓ "
                                                            : ""}
                                                        {dateLabel(
                                                            addDays(day, n),
                                                            db.locale,
                                                        )}
                                                    </button>
                                                ))}
                                                <button
                                                    className="danger-text"
                                                    onClick={() =>
                                                        setArchive(habit)
                                                    }
                                                >
                                                    {text(
                                                        "Archive Habit",
                                                        "Lưu trữ thói quen",
                                                    )}
                                                </button>
                                            </div>
                                        </details>
                                    </div>
                                </article>
                            );
                        })}
                    {!db.habits.some((habit) => !habit.archived) && (
                        <div className="review-state">
                            <h2>
                                {text(
                                    "A fresh start, every day.",
                                    "Mỗi ngày là một khởi đầu mới.",
                                )}
                            </h2>
                            <button
                                className="button button-primary"
                                onClick={() => open(null)}
                            >
                                {text(
                                    "Create your first habit",
                                    "Tạo thói quen đầu tiên",
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </section>
            {editing !== undefined && (
                <FormDialog
                    dirty={
                        icon !== (editing?.icon || "leaf") ||
                        color !== (editing?.color || palette[1]) ||
                        importance !== (editing?.importance || 3)
                    }
                    key={editing?.id || "new"}
                    text={text}
                    title={text(
                        editing ? "Edit Habit" : "New Habit",
                        editing ? "Sửa thói quen" : "Thói quen mới",
                    )}
                    onClose={() => setEditing(undefined)}
                    onSubmit={async (form) => {
                        const values = new FormData(form),
                            value = (key: string) =>
                                String(values.get(key) || "").trim();
                        const habit: Habit = {
                            id: editing?.id || `habit-${Date.now()}`,
                            title: label(value("title")),
                            goal: value("goal"),
                            frequency: frozen
                                ? editing.frequency
                                : (frequency as Habit["frequency"]),
                            target:
                                frequency === "daily"
                                    ? 1
                                    : Number(
                                          value("target") ||
                                              editing?.target ||
                                              3,
                                      ),
                            timezone: frozen
                                ? editing.timezone
                                : value("timezone"),
                            importance,
                            icon,
                            color,
                            description: value("description"),
                            tags: values.getAll("tag").map(String),
                            started: frozen,
                            checkins: editing?.checkins || [],
                            rests: editing?.rests || [],
                            archived: false,
                        };
                        db.setHabits((rows) =>
                            editing
                                ? rows.map((row) =>
                                      row.id === editing.id ? habit : row,
                                  )
                                : [...rows, habit],
                        );
                        if (db.live && !(await db.live.flush())) return false;
                        setEditing(undefined);
                        db.setMessage(
                            text("Habit saved.", "Đã lưu thói quen."),
                        );
                    }}
                >
                    <Field label={text("Name", "Tên")}>
                        <input
                            name="title"
                            required
                            defaultValue={editing ? text(...editing.title) : ""}
                            maxLength={160}
                        />
                    </Field>
                    <Field label={text("Description", "Mô tả")}>
                        <textarea
                            name="description"
                            rows={3}
                            defaultValue={editing?.description || ""}
                        />
                    </Field>
                    <fieldset className="review-checkbox-list">
                        <legend>{text("Tags", "Nhãn")}</legend>
                        {tagOptions.map((tag) => (
                            <label key={tag.id}>
                                <input
                                    type="checkbox"
                                    name="tag"
                                    value={tag.id}
                                    defaultChecked={editing?.tags?.includes(
                                        tag.id,
                                    )}
                                />
                                {text(...tag.label)}
                            </label>
                        ))}
                    </fieldset>
                    <IconPicker
                        icon={icon}
                        color={color}
                        text={text}
                        onChange={(i, c) => {
                            setIcon(i);
                            setColor(c);
                        }}
                    />
                    <Stars
                        text={text}
                        value={importance}
                        onChange={setImportance}
                    />
                    <Field
                        label={text("Goal (optional)", "Mục tiêu (tùy chọn)")}
                    >
                        <select name="goal" defaultValue={editing?.goal || ""}>
                            <option value="">
                                {text(
                                    "No linked Goal",
                                    "Không liên kết mục tiêu",
                                )}
                            </option>
                            {db.goals
                                .filter((g) => !g.archived)
                                .map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {text(...g.title)}
                                    </option>
                                ))}
                        </select>
                    </Field>
                    <Field
                        label={text("Period", "Chu kỳ")}
                        hint={
                            frozen
                                ? text(
                                      "Period and timezone are fixed after the first check-in.",
                                      "Chu kỳ và múi giờ cố định sau lần điểm danh đầu tiên.",
                                  )
                                : undefined
                        }
                    >
                        <select
                            disabled={!!frozen}
                            value={frequency}
                            onChange={(e) => setFrequency(e.target.value)}
                        >
                            <option value="daily">
                                {text("Daily", "Hàng ngày")}
                            </option>
                            <option value="weekly">
                                {text("Weekly", "Hàng tuần")}
                            </option>
                        </select>
                    </Field>
                    {frequency === "weekly" && (
                        <Field
                            label={text("Days per week", "Số ngày mỗi tuần")}
                        >
                            <input
                                name="target"
                                type="number"
                                min={1}
                                max={7}
                                required
                                defaultValue={editing?.target || 3}
                            />
                        </Field>
                    )}
                    <Field label={text("Timezone", "Múi giờ")}>
                        <select
                            name="timezone"
                            disabled={!!frozen}
                            defaultValue={
                                editing?.timezone || db.profile.timezone
                            }
                        >
                            {[
                                ...new Set([
                                    editing?.timezone || db.profile.timezone,
                                    "Asia/Ho_Chi_Minh",
                                    "UTC",
                                    "America/New_York",
                                ]),
                            ].map((zone) => (
                                <option key={zone}>{zone}</option>
                            ))}
                        </select>
                    </Field>
                </FormDialog>
            )}
            {archive && (
                <Confirm
                    text={text}
                    title={text(
                        "Archive this Habit?",
                        "Lưu trữ thói quen này?",
                    )}
                    onClose={() => setArchive(null)}
                    onConfirm={async () => {
                        if (await db.archiveEntity("habits", archive.id, false) === false)
                            throw new Error(text("Could not archive. Try again.", "Chưa lưu trữ được. Hãy thử lại."));
                        setArchive(null);
                    }}
                >
                    <p>{text(...archive.title)}</p>
                    <p>
                        {text(
                            "Check-ins and rest history are kept in Archive.",
                            "Lịch sử điểm danh và ngày nghỉ được giữ trong Lưu trữ.",
                        )}
                    </p>
                </Confirm>
            )}
        </div>
    );
}
