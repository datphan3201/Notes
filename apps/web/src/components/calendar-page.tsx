"use client";
import { type Entity, type Kind } from "@/lib/api";
import { localDate, monthDays } from "@/lib/dates";
import { addDays, monday } from "@/lib/task-views";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
    QueryState,
    Tabs,
    useItems,
    type PageContext,
} from "./workspace-context";
import { update } from "./workspace-controls";

export function CalendarPage({ ctx }: { ctx: PageContext }) {
    const tasks = useItems("tasks", ctx.identity.user.id),
        milestones = useItems("milestones", ctx.identity.user.id),
        goals = useItems("goals", ctx.identity.user.id);
    const today = localDate(ctx.identity.user.timezone);
    const [anchor, setAnchor] = useState(today),
        [view, setView] = useState("month"),
        [filter, setFilter] = useState("all");
    const month = anchor.slice(0, 7);
    const days =
        view === "week"
            ? Array.from({ length: 7 }, (_, index) =>
                  addDays(monday(anchor), index),
              )
            : monthDays(month);
    const records = [
        ...(tasks.data || []).map((row) => ({ ...row, kind: "tasks" as Kind })),
        ...(milestones.data || []).map((row) => ({
            ...row,
            kind: "milestones" as Kind,
        })),
        ...(goals.data || []).map((row) => ({ ...row, kind: "goals" as Kind })),
    ].filter((row) => filter === "all" || filter === row.kind);
    const dateOf = (row: Entity) =>
        row.scheduled_at
            ? localDate(ctx.identity.user.timezone, new Date(row.scheduled_at))
            : row.due_date || row.start_date;
    const move = async (event: React.DragEvent, destination: string) => {
        event.preventDefault();
        let data: { kind: Kind; id: string };
        try {
            data = JSON.parse(
                event.dataTransfer.getData("application/planner"),
            );
        } catch {
            return;
        }
        const row = records.find(
            (row) => row.kind === data.kind && row.id === data.id,
        );
        if (row) await reschedule(row, destination);
    };
    const reschedule = async (
        row: Entity & { kind: Kind },
        destination: string,
    ) => {
        const current = dateOf(row);
        const delta = current
            ? Math.round(
                  (Date.parse(destination + "T12:00Z") -
                      Date.parse(current + "T12:00Z")) /
                      86400000,
              )
            : 0;
        const fields: Record<string, unknown> = {};
        if (row.start_date) fields.start_date = addDays(row.start_date, delta);
        if (row.due_date) fields.due_date = addDays(row.due_date, delta);
        if (row.scheduled_at) {
            const { zonedInput, zonedInstant } = await import("@/lib/dates");
            const local = zonedInput(
                row.scheduled_at,
                ctx.identity.user.timezone,
            );
            fields.scheduled_at = zonedInstant(
                destination + local.slice(10),
                ctx.identity.user.timezone,
            );
        }
        if (row.scheduled_end) {
            const { zonedInput, zonedInstant } = await import("@/lib/dates");
            const local = zonedInput(
                row.scheduled_end,
                ctx.identity.user.timezone,
            );
            fields.scheduled_end = zonedInstant(
                addDays(local.slice(0, 10), delta) + local.slice(10),
                ctx.identity.user.timezone,
            );
        }
        if (!Object.keys(fields).length) fields.due_date = destination;
        await ctx.action(() => update(ctx, row.kind, row, fields));
    };
    const drag = (event: React.DragEvent, row: Entity & { kind: Kind }) => {
        event.dataTransfer.setData(
            "application/planner",
            JSON.stringify({ kind: row.kind, id: row.id }),
        );
        event.dataTransfer.effectAllowed = "move";
    };
    const keyboardMove = (
        event: React.KeyboardEvent,
        row: Entity & { kind: Kind },
    ) => {
        const offsets: Record<string, number> = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
        };
        if (!event.altKey || !(event.key in offsets) || !dateOf(row)) return;
        event.preventDefault();
        void reschedule(row, addDays(dateOf(row)!, offsets[event.key]));
    };
    function navigate(direction: number) {
        if (view === "week") setAnchor(addDays(anchor, 7 * direction));
        else {
            const date = new Date(month + "-15T12:00:00Z");
            date.setUTCMonth(date.getUTCMonth() + direction);
            setAnchor(date.toISOString().slice(0, 10));
        }
    }
    return (
        <>
            <QueryState queries={[tasks, milestones, goals]} />
            <div className="planning-panel">
                <div className="section-heading">
                    <div className="action-row">
                        <button
                            className="icon-button"
                            aria-label={ctx.text("Previous period", "Kỳ trước")}
                            onClick={() => navigate(-1)}
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <h2>
                            {new Intl.DateTimeFormat(ctx.identity.user.locale, {
                                month: "long",
                                year: "numeric",
                                timeZone: "UTC",
                            }).format(new Date(month + "-15T12:00Z"))}
                        </h2>
                        <button
                            className="icon-button"
                            aria-label={ctx.text("Next period", "Kỳ sau")}
                            onClick={() => navigate(1)}
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            className="button button-quiet"
                            onClick={() => setAnchor(today)}
                        >
                            {ctx.t.today}
                        </button>
                    </div>
                    <label>
                        {ctx.text("Show", "Hiển thị")}
                        <select
                            value={filter}
                            onChange={(event) => setFilter(event.target.value)}
                        >
                            <option value="all">{ctx.t.all}</option>
                            <option value="tasks">{ctx.t.tasks}</option>
                            <option value="milestones">
                                {ctx.t.milestones}
                            </option>
                            <option value="goals">{ctx.t.goals}</option>
                        </select>
                    </label>
                </div>
                <Tabs
                    label={ctx.t.calendar}
                    value={view}
                    onChange={setView}
                    items={[
                        ["month", ctx.text("Month", "Tháng")],
                        ["week", ctx.text("Week", "Tuần")],
                        ["gantt", "Gantt"],
                    ]}
                />
                {view === "gantt" ? (
                    <div className="gantt-scroll">
                        <div
                            className="parity-gantt"
                            style={{
                                gridTemplateColumns: `220px repeat(${days.length}, 32px)`,
                            }}
                        >
                            <strong>{ctx.t.title}</strong>
                            {days.map((day) => (
                                <span
                                    key={day}
                                    onDragOver={(event) =>
                                        event.preventDefault()
                                    }
                                    onDrop={(event) => void move(event, day)}
                                >
                                    {day.slice(-2)}
                                </span>
                            ))}
                            {records
                                .filter(
                                    (row) =>
                                        !!dateOf(row) &&
                                        (row.start_date || dateOf(row)!) <=
                                            days[days.length - 1] &&
                                        (row.due_date || dateOf(row)!) >=
                                            days[0],
                                )
                                .map((row) => {
                                    const first = Math.max(
                                        0,
                                        days.indexOf(
                                            row.start_date || dateOf(row)!,
                                        ),
                                    );
                                    const finish = row.due_date || dateOf(row)!;
                                    const last =
                                        finish > days[days.length - 1]
                                            ? days.length - 1
                                            : days.indexOf(finish);
                                    return (
                                        <div
                                            className="gantt-react-row"
                                            key={row.kind + row.id}
                                        >
                                            <button
                                                onClick={() =>
                                                    ctx.open(row.kind, row)
                                                }
                                            >
                                                {row.title}
                                            </button>
                                            <button
                                                className="gantt-react-bar"
                                                onKeyDown={(event) =>
                                                    keyboardMove(event, row)
                                                }
                                                draggable
                                                onDragStart={(event) =>
                                                    drag(event, row)
                                                }
                                                style={{
                                                    gridColumn: `${first + 2} / span ${Math.max(1, last - first + 1)}`,
                                                }}
                                                onClick={() =>
                                                    ctx.open(row.kind, row)
                                                }
                                            >
                                                {row.title}
                                            </button>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                ) : (
                    <div className="calendar-scroll">
                        <table className="calendar-table">
                            <thead>
                                <tr>
                                    {days.slice(0, 7).map((day) => (
                                        <th key={day}>
                                            {new Intl.DateTimeFormat(
                                                ctx.identity.user.locale,
                                                {
                                                    weekday: "short",
                                                    timeZone: "UTC",
                                                },
                                            ).format(new Date(day + "T12:00Z"))}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(
                                    { length: days.length / 7 },
                                    (_, week) => (
                                        <tr key={week}>
                                            {days
                                                .slice(week * 7, week * 7 + 7)
                                                .map((day) => (
                                                    <td
                                                        key={day}
                                                        onDragOver={(event) =>
                                                            event.preventDefault()
                                                        }
                                                        onDrop={(event) =>
                                                            void move(
                                                                event,
                                                                day,
                                                            )
                                                        }
                                                    >
                                                        <button
                                                            className={`calendar-date ${day === today ? "is-today" : ""}`}
                                                            title={
                                                                ctx.text(
                                                                    "Create task on ",
                                                                    "Tạo công việc ngày ",
                                                                ) + day
                                                            }
                                                            onClick={() =>
                                                                ctx.open(
                                                                    "tasks",
                                                                    null,
                                                                    {
                                                                        due_date:
                                                                            day,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            {Number(
                                                                day.slice(-2),
                                                            )}
                                                        </button>
                                                        {records
                                                            .filter(
                                                                (row) =>
                                                                    dateOf(
                                                                        row,
                                                                    ) === day ||
                                                                    row.start_date ===
                                                                        day,
                                                            )
                                                            .map((row) => (
                                                                <button
                                                                    className="calendar-event"
                                                                    onKeyDown={(
                                                                        event,
                                                                    ) =>
                                                                        keyboardMove(
                                                                            event,
                                                                            row,
                                                                        )
                                                                    }
                                                                    data-kind={
                                                                        row.kind
                                                                    }
                                                                    key={
                                                                        row.kind +
                                                                        row.id
                                                                    }
                                                                    draggable
                                                                    onDragStart={(
                                                                        event,
                                                                    ) =>
                                                                        drag(
                                                                            event,
                                                                            row,
                                                                        )
                                                                    }
                                                                    onClick={() =>
                                                                        ctx.open(
                                                                            row.kind,
                                                                            row,
                                                                        )
                                                                    }
                                                                >
                                                                    {row.title}
                                                                </button>
                                                            ))}
                                                    </td>
                                                ))}
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <details className="planning-panel">
                <summary>
                    {ctx.text("Unscheduled", "Chưa lên lịch")} (
                    {records.filter((row) => !dateOf(row)).length})
                </summary>
                <p>
                    {ctx.text(
                        "Drag an item onto a day, or open it to choose dates.",
                        "Kéo một mục vào ngày, hoặc mở để chọn ngày.",
                    )}
                </p>
                {records
                    .filter((row) => !dateOf(row))
                    .map((row) => (
                        <button
                            className="calendar-event"
                            onKeyDown={(event) => keyboardMove(event, row)}
                            key={row.kind + row.id}
                            draggable
                            onDragStart={(event) => drag(event, row)}
                            onClick={() => ctx.open(row.kind, row)}
                        >
                            {row.title}
                        </button>
                    ))}
            </details>
        </>
    );
}
