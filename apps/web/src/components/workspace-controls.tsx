"use client";
import { api, type Entity, type Kind } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { addDays, monday } from "@/lib/task-views";
import { useQuery } from "@tanstack/react-query";
import {
    Check,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Pin,
    Sun,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Empty, QueryState, type PageContext } from "./workspace-context";
export type Plan = { daily: string[]; weekly: string[] };
export function usePlan(ctx: PageContext) {
    const today = localDate(ctx.identity.user.timezone);
    return useQuery({
        queryKey: ["plan", ctx.identity.user.id, today],
        queryFn: () => api<Plan>(`/plan/tasks?day=${today}`),
    });
}

export function update(
    ctx: PageContext,
    kind: Kind,
    row: Entity,
    fields: Record<string, unknown>,
) {
    return api(
        `/${kind}/${row.id}`,
        {
            method: "PATCH",
            body: JSON.stringify({ version: row.version, fields }),
        },
        ctx.identity.csrf,
    );
}

export function statusName(ctx: PageContext, value: string | undefined) {
    const names: Record<string, [string, string]> = {
        todo: ["Not started", "Chưa bắt đầu"],
        doing: ["In progress", "Đang làm"],
        blocked: ["Blocked", "Bị chặn"],
        done: ["Completed", "Hoàn thành"],
        active: ["Active", "Đang thực hiện"],
        completed: ["Completed", "Hoàn thành"],
    };
    return ctx.text(...(names[value || "todo"] || [value || "", value || ""]));
}

export function TaskRow({
    ctx,
    task,
    plan,
    compact = false,
}: {
    ctx: PageContext;
    task: Entity;
    plan?: Plan;
    compact?: boolean;
}) {
    const [busy, setBusy] = useState(false);
    const today = localDate(ctx.identity.user.timezone);
    async function run(work: () => Promise<unknown>) {
        setBusy(true);
        try {
            await ctx.action(work);
        } finally {
            setBusy(false);
        }
    }
    const select = (period: "daily" | "weekly") =>
        run(() =>
            api(
                `/plan/tasks/${task.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        period,
                        day: period === "daily" ? today : monday(today),
                        selected: !(
                            period === "daily" ? plan?.daily : plan?.weekly
                        )?.includes(task.id),
                    }),
                },
                ctx.identity.csrf,
            ),
        );
    return (
        <article
            className={`task-row ${task.status === "done" ? "is-done" : ""}`}
        >
            <button
                className="task-check"
                type="button"
                disabled={busy}
                aria-label={`${task.status === "done" ? ctx.text("Reopen", "Mở lại") : ctx.text("Complete", "Hoàn thành")}: ${task.title}`}
                onClick={() =>
                    void run(() =>
                        update(ctx, "tasks", task, {
                            status: task.status === "done" ? "todo" : "done",
                        }),
                    )
                }
            >
                {task.status === "done" && <Check size={18} />}
            </button>
            <button
                className="task-row-main"
                onClick={() => ctx.open("tasks", task)}
            >
                <strong>{task.title}</strong>
                <small>
                    {task.due_date ? `${ctx.text("Due", "Hạn")} ${task.due_date}` : statusName(ctx, task.status)}
                </small>
            </button>
            {!compact && (
                <div className="task-actions">
                    <button
                        disabled={busy}
                        type="button"
                        className={`icon-button ${plan?.weekly.includes(task.id) ? "is-selected" : ""}`}
                        aria-label={
                            ctx.text(
                                "Plan for this week",
                                "Chọn cho tuần này",
                            ) +
                            ": " +
                            task.title
                        }
                        title={ctx.text(
                            "Plan for this week",
                            "Chọn cho tuần này",
                        )}
                        onClick={() => void select("weekly")}
                    >
                        <Pin size={16} />
                    </button>
                    <button
                        disabled={busy}
                        type="button"
                        className={`icon-button ${plan?.daily.includes(task.id) ? "is-selected" : ""}`}
                        aria-label={
                            ctx.text("Plan for today", "Chọn cho hôm nay") +
                            ": " +
                            task.title
                        }
                        title={ctx.text("Plan for today", "Chọn cho hôm nay")}
                        onClick={() => void select("daily")}
                    >
                        <Sun size={17} />
                    </button>
                    <span
                        className="task-importance"
                        aria-label={`${ctx.t.importance}: ${task.importance}`}
                    >
                        {"★".repeat(task.importance)}
                        {"☆".repeat(5 - task.importance)}
                    </span>
                    <details className="row-menu">
                        <summary
                            className="icon-button"
                            aria-label={ctx.text(
                                "Task actions",
                                "Thao tác công việc",
                            )}
                        >
                            <MoreHorizontal size={18} />
                        </summary>
                        <div>
                            <button onClick={() => ctx.open("tasks", task)}>
                                {ctx.text("Edit", "Chỉnh sửa")}
                            </button>
                            <Link className="button" href={`/tasks/${task.id}`}>
                                {ctx.text("Open details", "Mở chi tiết")}
                            </Link>
                            <button
                                onClick={() =>
                                    void run(() =>
                                        api(
                                            `/tasks/${task.id}/archive`,
                                            {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    version: task.version,
                                                    archived: true,
                                                }),
                                            },
                                            ctx.identity.csrf,
                                        ),
                                    )
                                }
                            >
                                {ctx.t.archive}
                            </button>
                        </div>
                    </details>
                </div>
            )}
        </article>
    );
}

export function FocusPicker({
    ctx,
    goals,
    value,
}: {
    ctx: PageContext;
    goals: Entity[];
    value?: string | null;
}) {
    return (
        <label className="roadmap-title-picker">
            <span className="sr-only">
                {ctx.text("Choose a roadmap", "Chọn lộ trình")}
            </span>
            <select
                aria-label={ctx.text("Choose a roadmap", "Chọn lộ trình")}
                value={value || ""}
                onChange={(event) =>
                    void ctx.action(() =>
                        api(
                            "/focus",
                            {
                                method: "PUT",
                                body: JSON.stringify({
                                    goal_id: event.target.value || null,
                                }),
                            },
                            ctx.identity.csrf,
                        ),
                    )
                }
            >
                <option value="">
                    {ctx.text("Choose a roadmap", "Chọn lộ trình")}
                </option>
                {goals.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                        {goal.title}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function HabitCard({
    ctx,
    habit,
    compact = false,
}: {
    ctx: PageContext;
    habit: Entity;
    compact?: boolean;
}) {
    const today = localDate(habit.timezone || ctx.identity.user.timezone);
    const [offset, setOffset] = useState(0);
    const end = addDays(today, offset * 7),
        start = addDays(end, compact ? -6 : -13);
    const history = useQuery({
        queryKey: ["habit-days", habit.id, start, end],
        queryFn: () =>
            api<{
                days: { day: string; state: string }[];
                window_streak: number;
            }>(`/habits/${habit.id}/days?start=${start}&end=${end}`),
    });
    const [busy, setBusy] = useState(false);
    const state = (day: string) =>
        history.data?.days.find((row) => row.day === day)?.state;
    async function checkin(day: string, value: string) {
        setBusy(true);
        try {
            await ctx.action(() =>
                api(
                    `/habits/${habit.id}/checkin`,
                    {
                        method: "PUT",
                        body: JSON.stringify({ day, state: value }),
                    },
                    ctx.identity.csrf,
                ),
            );
        } finally {
            setBusy(false);
        }
    }
    return (
        <article className="habit-item">
            <div className="section-heading">
                <button
                    className="text-button"
                    onClick={() => ctx.open("habits", habit)}
                >
                    <strong>{habit.title}</strong>
                </button>
                <small>
                    {habit.frequency === "weekly"
                        ? ctx.text("Weekly", "Hàng tuần")
                        : ctx.text("Daily", "Hàng ngày")}
                </small>
            </div>
            <QueryState locale={ctx.identity.user.locale} queries={[history]} />
            <p className="subtle-copy">
                {ctx.text("Streak in this window", "Chuỗi trong khoảng này")}:{" "}
                {history.data?.window_streak || 0} {ctx.text("days", "ngày")}
            </p>
            <div className="habit-history-strip">
                {Array.from({ length: compact ? 7 : 14 }, (_, index) =>
                    addDays(start, index),
                ).map((day) => (
                    <div key={day} className="habit-day">
                        <button
                            data-state={state(day)}
                            disabled={
                                busy ||
                                day > today ||
                                day < habit.created_at.slice(0, 10)
                            }
                            aria-label={`${habit.title}: ${day}`}
                            title={`${day}: ${state(day) || ctx.text("Not checked", "Chưa đánh dấu")}`}
                            onClick={() =>
                                void checkin(
                                    day,
                                    state(day) === "done" ? "clear" : "done",
                                )
                            }
                        >
                            {state(day) === "done"
                                ? "✓"
                                : state(day) === "rest"
                                  ? "−"
                                  : Number(day.slice(-2))}
                        </button>
                        <small>
                            {new Intl.DateTimeFormat(ctx.identity.user.locale, {
                                weekday: "narrow",
                                timeZone: "UTC",
                            }).format(new Date(day + "T12:00Z"))}
                        </small>
                    </div>
                ))}
            </div>
            <div className="action-row">
                <button
                    className="button button-quiet"
                    disabled={busy}
                    onClick={() =>
                        void checkin(
                            today,
                            state(today) === "done" ? "clear" : "done",
                        )
                    }
                >
                    {state(today) === "done" ? ctx.t.clear : ctx.t.checkin}
                </button>
                <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                        void checkin(
                            today,
                            state(today) === "rest" ? "clear" : "rest",
                        )
                    }
                >
                    {ctx.t.rest}
                </button>
                {!compact && (
                    <>
                        <button
                            className="icon-button"
                            aria-label={ctx.text(
                                "Earlier days",
                                "Các ngày trước",
                            )}
                            onClick={() => setOffset(offset - 1)}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            className="icon-button"
                            disabled={offset >= 0}
                            aria-label={ctx.text("Later days", "Các ngày sau")}
                            onClick={() => setOffset(offset + 1)}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </>
                )}
            </div>
        </article>
    );
}

export function ActivityPanel({ ctx }: { ctx: PageContext }) {
    const today = localDate(ctx.identity.user.timezone);
    const activities = useQuery({
        queryKey: ["activity", ctx.identity.user.id, today],
        queryFn: () =>
            api<
                {
                    id: string;
                    kind: string;
                    entity_id: string;
                    created_at: string;
                }[]
            >(`/activity?start=${addDays(today, -30)}&end=${today}`),
    });
    return (
        <section className="planning-panel">
            <h2>{ctx.text("Activity", "Hoạt động")}</h2>
            <QueryState locale={ctx.identity.user.locale} queries={[activities]} />
            {activities.data?.map((item) => (
                <p key={item.id}>
                    <time>
                        {new Intl.DateTimeFormat(ctx.identity.user.locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                            timeZone: ctx.identity.user.timezone,
                        }).format(new Date(item.created_at))}
                    </time>
                </p>
            ))}
            {!activities.isPending && !activities.data?.length && (
                <Empty>
                    {ctx.text(
                        "No activity in the last 30 days.",
                        "Chưa có hoạt động trong 30 ngày qua.",
                    )}
                </Empty>
            )}
        </section>
    );
}
