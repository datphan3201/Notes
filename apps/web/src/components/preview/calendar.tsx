"use client";
import FloatingActions from "../floating-actions";
import { useState, type CSSProperties } from "react";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    CalendarDays,
    Flag,
    Target,
} from "lucide-react";
import {
    usePreviewData,
    addDays,
    dateLabel,
    day as fixtureToday,
    goalProgress,
} from "./workspace-data";
import { blankDraft } from "./task-data";
import { Header } from "./ui";
import type { Text } from "./shared";
export const monday = (date: string) =>
    addDays(date, -((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7));
type Item = {
    key: string;
    id: string;
    kind: "tasks" | "goals" | "milestones";
    title: string;
    start: string;
    end: string;
    done: boolean;
    series: boolean;
    color: string;
    parent: string;
    slot: string;
    depth?: number;
    expandable?: boolean;
};
export default function CalendarPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const day = db.today || fixtureToday;
    const [view, setView] = useState("month"),
        [cursor, setCursor] = useState(day),
        [selected, setSelected] = useState(day),
        [query, setQuery] = useState(""),
        [goalFilter, setGoalFilter] = useState(""),
        [zoom, setZoom] = useState("day"),
        [group, setGroup] = useState("goal");
    const [collapsed, setCollapsed] = useState<string[]>([]);
    const [drag, setDrag] = useState<{
        key: string;
        date: string;
        edge?: "start" | "end";
    } | null>(null);
    const items: Item[] = [
        ...db.tasks
            .filter((t) => !t.archived)
            .map((t) => ({
                key: `tasks:${t.id}`,
                id: String(t.id),
                kind: "tasks" as const,
                title: text(...t.title),
                start: t.start || t.scheduledStart.slice(0, 10) || t.due,
                end: t.due || t.scheduledEnd.slice(0, 10) || t.start,
                done: t.status === "Done",
                series: !!t.seriesId,
                color: "#067287",
                parent:
                    db.parents.find((p) => p.id === t.parent)?.goal || "inbox",
                slot: t.scheduledStart.slice(11, 16),
            })),
        ...db.goals
            .filter((g) => !g.archived)
            .map((g) => ({
                key: `goals:${g.id}`,
                id: g.id,
                kind: "goals" as const,
                title: text(...g.title),
                start: g.start || g.due,
                end: g.due || g.start,
                done: g.status === "Done",
                series: false,
                color: g.color,
                parent: g.id,
                slot: "",
            })),
        ...db.milestones
            .filter((g) => !g.archived)
            .map((g) => ({
                key: `milestones:${g.id}`,
                id: g.id,
                kind: "milestones" as const,
                title: text(...g.title),
                start: g.start || g.due,
                end: g.due || g.start,
                done: g.status === "Done",
                series: false,
                color: g.color,
                parent: g.goal,
                slot: "",
            })),
    ].filter(
        (item) =>
            (!goalFilter || item.parent === goalFilter) &&
            (view !== "gantt" ||
                item.title.toLowerCase().includes(query.toLowerCase())),
    );
    const monthStart = cursor.slice(0, 7) + "-01",
        gridStart = view === "week" ? monday(cursor) : monday(monthStart),
        days = Array.from({ length: view === "week" ? 7 : 42 }, (_, i) =>
            addDays(gridStart, i),
        );
    const visible = (date: string) =>
        items.filter(
            (item) =>
                !!item.start &&
                (view === "week"
                    ? item.start <= date && item.end >= date
                    : item.start === date || item.end === date),
        );
    const create = (date: string) =>
        db.setTaskAction({
            kind: "create",
            draft: { ...blankDraft(), due: date },
        });
    const open = (item: Item) =>
        item.kind === "tasks"
            ? db.setTaskAction({ kind: "edit", id: Number(item.id) })
            : db.setPlanningAction({
                  kind: item.kind === "goals" ? "goal" : "milestone",
                  id: item.id,
              });
    function shift(
        item: Item,
        target: string,
        origin: string,
        edge?: "start" | "end",
    ) {
        if (item.done || item.series) return;
        const delta = Math.round(
            (Date.parse(target) - Date.parse(origin)) / 86400000,
        );
        if (item.kind === "tasks")
            db.setTasks((rows) =>
                rows.map((row) => {
                    if (String(row.id) !== item.id) return row;
                    let start = row.start,
                        due = row.due,
                        scheduledStart = row.scheduledStart,
                        scheduledEnd = row.scheduledEnd;
                    const move = (s: string) =>
                        s ? addDays(s.slice(0, 10), delta) + s.slice(10) : s;
                    if (edge === "start") start = target;
                    else if (edge === "end") due = target;
                    else if (!item.start) due = target;
                    else {
                        start =
                            start && (view === "gantt" || start === origin)
                                ? move(start)
                                : start;
                        due =
                            due && (view === "gantt" || due === origin)
                                ? move(due)
                                : due;
                        if (
                            scheduledStart &&
                            (view === "gantt" ||
                                scheduledStart.slice(0, 10) === origin)
                        ) {
                            scheduledStart = move(scheduledStart);
                            scheduledEnd = move(scheduledEnd);
                        }
                    }
                    if (start && due && start > due) {
                        return row;
                    }
                    return { ...row, start, due, scheduledStart, scheduledEnd };
                }),
            );
        else {
            const update = (row: {
                id: string;
                start: string;
                due: string;
            }) => {
                if (row.id !== item.id) return row;
                const start =
                        edge === "end"
                            ? row.start
                            : edge === "start"
                              ? target
                              : row.start
                                ? addDays(row.start, delta)
                                : "",
                    due =
                        edge === "start"
                            ? row.due
                            : edge === "end"
                              ? target
                              : row.due
                                ? addDays(row.due, delta)
                                : "";
                if (start && due && start > due) return row;
                return { ...row, start, due };
            };
            if (item.kind === "goals")
                db.setGoals((rows) =>
                    rows.map((row) => ({ ...row, ...update(row) })),
                );
            else
                db.setMilestones((rows) =>
                    rows.map((row) => ({ ...row, ...update(row) })),
                );
        }
    }
    const drop = (date: string) => {
        const item = items.find((item) => item.key === drag?.key);
        if (item && drag) shift(item, date, drag.date, drag.edge);
        setDrag(null);
    };
    const movePeriod = (direction: number) => {
        if (view === "week") setCursor(addDays(cursor, 7 * direction));
        else {
            const d = new Date(monthStart + "T00:00:00Z");
            d.setUTCMonth(d.getUTCMonth() + direction);
            setCursor(d.toISOString().slice(0, 10));
        }
    };
    const icon = (item: Item) =>
        item.kind === "goals" ? (
            <Target size={12} />
        ) : item.kind === "milestones" ? (
            <Flag size={12} />
        ) : (
            <CalendarDays size={12} />
        );
    const chip = (item: Item, date: string) => (
        <button
            key={item.key}
            draggable={!item.done && !item.series}
            className={`review-calendar-item ${item.done ? "is-done" : ""} ${item.end && item.end < day && !item.done ? "is-overdue" : ""}`}
            title={`${item.title} · ${dateLabel(item.start, db.locale)} – ${dateLabel(item.end, db.locale)}`}
            onDragStart={() => setDrag({ key: item.key, date })}
            onDragEnd={() => setDrag(null)}
            onKeyDown={(event) => {
                const steps: Record<string, number> = {
                    ArrowLeft: -1,
                    ArrowRight: 1,
                    ArrowUp: -7,
                    ArrowDown: 7,
                };
                const step = steps[event.key];
                if (!event.altKey || !step || item.done || item.series) return;
                event.preventDefault();
                shift(item, addDays(date, step), date);
            }}
            onClick={(e) => {
                e.stopPropagation();
                open(item);
            }}
        >
            {icon(item)}
            {item.slot && <small>{item.slot}</small>}
            <span>{item.title}</span>
        </button>
    );
    const ganttStart = monday(addDays(cursor, -7)),
        count = zoom === "month" ? 126 : zoom === "week" ? 84 : 42,
        cell = zoom === "day" ? 38 : zoom === "week" ? 16 : 7,
        ganttDays = Array.from({ length: count }, (_, i) =>
            addDays(ganttStart, i),
        );
    const ordered: Item[] = [];
    const added = new Set<string>();
    const append = (item: Item, depth: number, children: Item[] = []) => {
        ordered.push({ ...item, depth, expandable: children.length > 0 });
        added.add(item.key);
        return !collapsed.includes(item.key);
    };
    function appendGoal(id: string, depth: number) {
        const item = items.find((row) => row.key === `goals:${id}`);
        if (!item || added.has(item.key)) return;
        const childGoals = db.goals.filter(
                (g) => g.parent === id && !g.archived,
            ),
            milestones = items.filter(
                (i) => i.kind === "milestones" && i.parent === id,
            ),
            direct = items.filter(
                (i) =>
                    i.kind === "tasks" &&
                    db.tasks.find((t) => String(t.id) === i.id)?.parent === id,
            );
        if (
            !append(item, depth, [
                ...milestones,
                ...direct,
                ...items.filter((i) =>
                    childGoals.some((g) => `goals:${g.id}` === i.key),
                ),
            ])
        )
            return;
        childGoals.forEach((g) => appendGoal(g.id, depth + 1));
        milestones.forEach((ms) => {
            const children = items.filter(
                (i) =>
                    i.kind === "tasks" &&
                    db.tasks.find((t) => String(t.id) === i.id)?.parent ===
                        ms.id,
            );
            if (append(ms, depth + 1, children))
                children.forEach((t) => append(t, depth + 2));
        });
        direct.forEach((t) => append(t, depth + 1));
    }
    if (group === "goal" && !query) {
        db.goals
            .filter((g) => !g.parent && !g.archived)
            .forEach((g) => appendGoal(g.id, 0));
        items
            .filter(
                (i) =>
                    i.kind === "tasks" &&
                    !db.tasks.find((t) => String(t.id) === i.id)?.parent,
            )
            .forEach((t) => append(t, 0));
    } else
        ordered.push(
            ...[...items].sort((a, b) =>
                group === "goal"
                    ? a.parent.localeCompare(b.parent) ||
                      a.kind.localeCompare(b.kind)
                    : a.kind.localeCompare(b.kind),
            ),
        );
    const progress = (item: Item) =>
        item.kind === "goals"
            ? goalProgress(item.id, db.goals, db.milestones, db.tasks)
            : item.kind === "milestones"
              ? (() => {
                    const rows = db.tasks.filter(
                        (t) =>
                            !t.archived && !t.seriesId && t.parent === item.id,
                    );
                    return rows.length
                        ? (rows.filter((t) => t.status === "Done").length /
                              rows.length) *
                              100
                        : item.done
                          ? 100
                          : 0;
                })()
              : null;
    const toolbar = (
        <div className="calendar-toolbar">
            <div className="calendar-nav">
                <button
                    className="icon-button"
                    aria-label={text("Previous period", "Kỳ trước")}
                    onClick={() => movePeriod(-1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    className="icon-button"
                    aria-label={text("Next period", "Kỳ tiếp")}
                    onClick={() => movePeriod(1)}
                >
                    <ChevronRight size={18} />
                </button>
                <h2>
                    {new Intl.DateTimeFormat(db.locale, {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                    }).format(new Date(cursor + "T00:00:00Z"))}
                </h2>
                <button
                    className="button button-quiet"
                    onClick={() => {
                        setCursor(day);
                        setSelected(day);
                    }}
                >
                    {text("Today", "Hôm nay")}
                </button>
            </div>
            <div className="calendar-controls">
                <select
                    aria-label={text("Goal", "Mục tiêu")}
                    value={goalFilter}
                    onChange={(event) => setGoalFilter(event.target.value)}
                >
                    <option value="">
                        {text("All goals", "Tất cả mục tiêu")}
                    </option>
                    {db.goals
                        .filter((goal) => !goal.archived)
                        .map((goal) => (
                            <option key={goal.id} value={goal.id}>
                                {text(...goal.title)}
                            </option>
                        ))}
                </select>
                <div
                    className="calendar-switch"
                    role="group"
                    aria-label={text("Calendar view", "Chế độ lịch")}
                >
                    {[
                        ["month", text("Month", "Tháng")],
                        ["week", text("Week", "Tuần")],
                        ["gantt", "Gantt"],
                    ].map(([key, title]) => (
                        <button
                            key={key}
                            aria-pressed={view === key}
                            onClick={() => setView(key)}
                        >
                            {title}
                        </button>
                    ))}
                </div>
            </div>
            {view === "gantt" && (
                <div className="review-gantt-controls">
                    <input
                        type="search"
                        aria-label={text(
                            "Find calendar items",
                            "Tìm mục trong lịch",
                        )}
                        placeholder={text(
                            "Find a task, Goal or Milestone…",
                            "Tìm công việc, mục tiêu hoặc cột mốc…",
                        )}
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <label>
                        {text("Show by", "Hiển thị theo")}
                        <select
                            aria-label={text("Group Gantt", "Nhóm Gantt")}
                            value={group}
                            onChange={(event) => setGroup(event.target.value)}
                        >
                            <option value="goal">
                                {text("Goal", "Mục tiêu")}
                            </option>
                            <option value="type">{text("Type", "Loại")}</option>
                        </select>
                    </label>
                    <label>
                        {text("Zoom", "Thu phóng")}
                        <select
                            value={zoom}
                            onChange={(event) => setZoom(event.target.value)}
                        >
                            <option value="day">{text("Days", "Ngày")}</option>
                            <option value="week">
                                {text("Weeks", "Tuần")}
                            </option>
                            <option value="month">
                                {text("Months", "Tháng")}
                            </option>
                        </select>
                    </label>
                </div>
            )}
        </div>
    );
    return (
        <div className="review-calendar planning-page calendar-page">
            <Header
                title={text("Calendar", "Lịch")}
                description={text(
                    "Every date in your plan, and room to move work where it fits.",
                    "Mọi mốc thời gian trong kế hoạch, và chỗ để dời công việc sang ngày phù hợp.",
                )}
            />
            <FloatingActions
                label={text("Page actions", "Thao tác trang")}
                closeLabel={text("Close actions", "Đóng thao tác")}
            >
                <button
                    className="button button-primary"
                    onClick={() => create(selected)}
                >
                    <Plus size={17} />
                    {text("New task", "Công việc mới")}
                </button>
            </FloatingActions>
            {view !== "gantt" ? (
                <div
                    className="review-calendar-layout"
                    role="region"
                    aria-label={text("Calendar", "Lịch")}
                >
                    <div className="planning-panel review-calendar-scroll">
                        {toolbar}
                        <div
                            className={`review-calendar-grid ${view === "week" ? "is-week" : ""}`}
                            data-view={view}
                        >
                            <div className="review-weekdays">
                                {Array.from({ length: 7 }, (_, i) => (
                                    <span key={i}>
                                        {new Intl.DateTimeFormat(db.locale, {
                                            weekday: "short",
                                            timeZone: "UTC",
                                        }).format(
                                            new Date(
                                                addDays("2026-11-02", i) +
                                                    "T00:00:00Z",
                                            ),
                                        )}
                                    </span>
                                ))}
                            </div>
                            <div className="review-calendar-days">
                                {days.map((date) => (
                                    <div
                                        key={date}
                                        className={`review-calendar-day ${date === day ? "is-today" : ""} ${date === selected ? "is-selected" : ""} ${date.slice(0, 7) !== cursor.slice(0, 7) ? "is-outside" : ""}`}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            drop(date);
                                        }}
                                    >
                                        <button
                                            className="review-date-number"
                                            aria-label={dateLabel(
                                                date,
                                                db.locale,
                                                true,
                                            )}
                                            onClick={() => setSelected(date)}
                                            onDoubleClick={() => create(date)}
                                        >
                                            {Number(date.slice(8))}
                                            <span
                                                className="calendar-dots"
                                                aria-hidden="true"
                                            >
                                                {visible(date)
                                                    .slice(0, 3)
                                                    .map((item) => (
                                                        <i
                                                            key={item.key}
                                                            className={
                                                                item.kind !==
                                                                "tasks"
                                                                    ? "is-goal"
                                                                    : item.done
                                                                      ? "is-done"
                                                                      : ""
                                                            }
                                                        />
                                                    ))}
                                            </span>
                                        </button>
                                        {visible(date)
                                            .slice(0, view === "month" ? 3 : 20)
                                            .map((item) => chip(item, date))}
                                        {view === "month" &&
                                            visible(date).length > 3 && (
                                                <button
                                                    className="review-calendar-more"
                                                    onClick={() =>
                                                        setSelected(date)
                                                    }
                                                >
                                                    +{visible(date).length - 3}{" "}
                                                    {text("more", "mục nữa")}
                                                </button>
                                            )}
                                        <button
                                            className="review-day-add"
                                            aria-label={
                                                text("Add on ", "Thêm vào ") +
                                                dateLabel(date, db.locale)
                                            }
                                            onClick={() => {
                                                setSelected(date);
                                                create(date);
                                            }}
                                        >
                                            ＋
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <aside className="review-agenda-stack">
                        <section className="planning-panel review-date-agenda">
                            <div className="section-heading">
                                <h2>{dateLabel(selected, db.locale, true)}</h2>
                                <button
                                    className="button button-quiet"
                                    onClick={() => create(selected)}
                                >
                                    <Plus size={15} />
                                    {text("Add task", "Thêm công việc")}
                                </button>
                            </div>
                            {visible(selected).map((item) =>
                                chip(item, selected),
                            )}
                            {!visible(selected).length && (
                                <p className="review-inline-empty">
                                    {text(
                                        "A little room to plan.",
                                        "Còn chỗ cho kế hoạch mới.",
                                    )}
                                </p>
                            )}
                        </section>
                        <section className="planning-panel review-date-agenda">
                            <h3>{text("Unscheduled", "Chưa lên lịch")}</h3>
                            <p className="review-caption">
                                {text(
                                    "Drag onto a day, or open to set dates.",
                                    "Kéo vào một ngày, hoặc mở để đặt ngày.",
                                )}
                            </p>
                            {items
                                .filter(
                                    (item) =>
                                        item.kind === "tasks" &&
                                        !item.start &&
                                        !item.done,
                                )
                                .map((item) => chip(item, selected))}
                        </section>
                    </aside>
                </div>
            ) : (
                <div
                    className="planning-panel review-gantt-scroll"
                    role="region"
                    aria-label={text("Gantt timeline", "Dòng thời gian Gantt")}
                >
                    {toolbar}
                    <div
                        className="review-gantt"
                        style={
                            {
                                "--day-width": `${cell}px`,
                                width: 240 + cell * count,
                            } as CSSProperties
                        }
                    >
                        <div className="review-gantt-axis">
                            <strong>
                                {text(
                                    "Goal / Milestone / Task",
                                    "Mục tiêu / Cột mốc / Công việc",
                                )}
                            </strong>
                            <div>
                                {ganttDays.map((date) => (
                                    <span key={date}>
                                        {Number(date.slice(8))}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <svg
                            className="review-gantt-dependencies"
                            aria-hidden="true"
                            style={{
                                left: 240,
                                top: 54,
                                width: cell * count,
                                height: ordered.length * 44,
                            }}
                        >
                            {db.milestones
                                .filter((m) => !m.archived)
                                .flatMap((m) =>
                                    m.prerequisites.map((id) => {
                                        const from = ordered.findIndex(
                                                (i) =>
                                                    i.key ===
                                                    `milestones:${id}`,
                                            ),
                                            to = ordered.findIndex(
                                                (i) =>
                                                    i.key ===
                                                    `milestones:${m.id}`,
                                            );
                                        if (
                                            from < 0 ||
                                            to < 0 ||
                                            !ordered[from].end ||
                                            !ordered[to].start
                                        )
                                            return null;
                                        const x1 =
                                                ((Date.parse(
                                                    ordered[from].end,
                                                ) -
                                                    Date.parse(ganttStart)) /
                                                    86400000) *
                                                    cell +
                                                cell,
                                            x2 =
                                                ((Date.parse(
                                                    ordered[to].start,
                                                ) -
                                                    Date.parse(ganttStart)) /
                                                    86400000) *
                                                cell;
                                        return (
                                            <path
                                                key={`${id}-${m.id}`}
                                                d={`M ${x1} ${from * 44 + 22} H ${x2 - 8} V ${to * 44 + 22} H ${x2}`}
                                            />
                                        );
                                    }),
                                )}
                        </svg>
                        {ordered.map((item, index) => {
                            const left = Math.max(
                                    0,
                                    (Date.parse(item.start) -
                                        Date.parse(ganttStart)) /
                                        86400000,
                                ),
                                right = Math.min(
                                    count - 1,
                                    (Date.parse(item.end) -
                                        Date.parse(ganttStart)) /
                                        86400000,
                                );
                            return (
                                <div
                                    className="review-gantt-row"
                                    key={item.key}
                                >
                                    <div
                                        className="review-gantt-name"
                                        style={{
                                            paddingLeft:
                                                12 + (item.depth || 0) * 14,
                                        }}
                                    >
                                        {item.expandable && (
                                            <button
                                                className="icon-button"
                                                aria-expanded={
                                                    !collapsed.includes(
                                                        item.key,
                                                    )
                                                }
                                                aria-label={
                                                    text(
                                                        "Expand or collapse: ",
                                                        "Mở hoặc thu gọn: ",
                                                    ) + item.title
                                                }
                                                onClick={() =>
                                                    setCollapsed((values) =>
                                                        values.includes(
                                                            item.key,
                                                        )
                                                            ? values.filter(
                                                                  (v) =>
                                                                      v !==
                                                                      item.key,
                                                              )
                                                            : [
                                                                  ...values,
                                                                  item.key,
                                                              ],
                                                    )
                                                }
                                            >
                                                <ChevronRight
                                                    size={13}
                                                    style={{
                                                        transform:
                                                            collapsed.includes(
                                                                item.key,
                                                            )
                                                                ? "none"
                                                                : "rotate(90deg)",
                                                    }}
                                                />
                                            </button>
                                        )}
                                        <button
                                            className="review-gantt-open"
                                            onClick={() => open(item)}
                                        >
                                            {icon(item)}
                                            {item.title}
                                        </button>
                                    </div>
                                    <div className="review-gantt-track">
                                        {ganttDays.map((date) => (
                                            <span
                                                key={date}
                                                onDragOver={(e) =>
                                                    e.preventDefault()
                                                }
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    drop(date);
                                                }}
                                            />
                                        ))}
                                        {item.start &&
                                        right >= 0 &&
                                        left <= count - 1 ? (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-label={
                                                    item.title +
                                                    text(
                                                        ". Alt+arrows to move; Shift to resize.",
                                                        ". Alt+mũi tên để di chuyển; thêm Shift để đổi hạn.",
                                                    )
                                                }
                                                className={`review-gantt-bar ${item.done ? "is-done" : ""}`}
                                                style={{
                                                    left: left * cell,
                                                    width:
                                                        Math.max(
                                                            1,
                                                            right - left + 1,
                                                        ) *
                                                            cell -
                                                        3,
                                                    background: item.color,
                                                }}
                                                draggable={
                                                    !item.done && !item.series
                                                }
                                                onDragStart={() =>
                                                    setDrag({
                                                        key: item.key,
                                                        date: item.start,
                                                    })
                                                }
                                                onDragEnd={() => setDrag(null)}
                                                onClick={() => open(item)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") {
                                                        open(item);
                                                        return;
                                                    }
                                                    if (
                                                        !e.altKey ||
                                                        ![
                                                            "ArrowLeft",
                                                            "ArrowRight",
                                                        ].includes(e.key)
                                                    )
                                                        return;
                                                    e.preventDefault();
                                                    const origin = e.shiftKey
                                                        ? item.end
                                                        : item.start;
                                                    shift(
                                                        item,
                                                        addDays(
                                                            origin,
                                                            e.key ===
                                                                "ArrowLeft"
                                                                ? -1
                                                                : 1,
                                                        ),
                                                        origin,
                                                        e.shiftKey
                                                            ? "end"
                                                            : undefined,
                                                    );
                                                }}
                                            >
                                                <span
                                                    className="review-gantt-handle"
                                                    draggable={
                                                        !item.done &&
                                                        !item.series
                                                    }
                                                    aria-label={text(
                                                        "Resize start",
                                                        "Đổi ngày bắt đầu",
                                                    )}
                                                    onDragStart={(e) => {
                                                        e.stopPropagation();
                                                        setDrag({
                                                            key: item.key,
                                                            date: item.start,
                                                            edge: "start",
                                                        });
                                                    }}
                                                />
                                                <span>{item.title}</span>
                                                {progress(item) !== null && (
                                                    <i
                                                        className="review-gantt-progress"
                                                        style={{
                                                            width: `${progress(item)}%`,
                                                        }}
                                                    />
                                                )}
                                                <span
                                                    className="review-gantt-handle"
                                                    draggable={
                                                        !item.done &&
                                                        !item.series
                                                    }
                                                    aria-label={text(
                                                        "Resize deadline",
                                                        "Đổi hạn",
                                                    )}
                                                    onDragStart={(e) => {
                                                        e.stopPropagation();
                                                        setDrag({
                                                            key: item.key,
                                                            date: item.end,
                                                            edge: "end",
                                                        });
                                                    }}
                                                />
                                            </div>
                                        ) : (
                                            !item.start && (
                                                <button
                                                    className="text-button review-gantt-unscheduled"
                                                    onClick={() => open(item)}
                                                >
                                                    {text(
                                                        "Set dates",
                                                        "Đặt ngày",
                                                    )}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            <p className="review-caption">
                {text(
                    db.live
                        ? "Drag to reschedule. Completed tasks and recurring occurrences stay fixed. Dates follow your account timezone."
                        : "Drag to reschedule. Completed tasks and recurring occurrences stay fixed. All dates in this preview use the sample day 7 November 2026.",
                    db.live
                        ? "Kéo để đổi lịch. Công việc hoàn thành và lần lặp được giữ cố định. Ngày theo múi giờ tài khoản của bạn."
                        : "Kéo để đổi lịch. Công việc hoàn thành và lần lặp được giữ cố định. Ngày mẫu của bản xem thử: 07/11/2026.",
                )}
            </p>
        </div>
    );
}
