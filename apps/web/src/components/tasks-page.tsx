"use client";
import { type Entity } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { matchesView } from "@/lib/task-views";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
    Empty,
    QueryState,
    useItems,
    type PageContext,
} from "./workspace-context";
import { statusName, TaskRow, update, usePlan } from "./workspace-controls";

export function TasksPage({
    ctx,
    history = false,
}: {
    ctx: PageContext;
    history?: boolean;
}) {
    const tasks = useItems("tasks", ctx.identity.user.id);
    const series = useItems("task-series", ctx.identity.user.id);
    const goals = useItems("goals", ctx.identity.user.id);
    const milestones = useItems("milestones", ctx.identity.user.id);
    const plan = usePlan(ctx);
    const [view, setView] = useState(history ? "history" : "all");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState(history ? "all" : "open");
    const [sort, setSort] = useState("importance");
    const [group, setGroup] = useState("goal");
    const [page, setPage] = useState(0);
    const [seriesState, setSeriesState] = useState("all");
    useEffect(() => {
        if (history) return;
        const requested = new URLSearchParams(window.location.search).get(
            "view",
        );
        if (requested)
            setView(
                [
                    "today",
                    "next",
                    "week",
                    "backlog",
                    "overdue",
                    "all",
                    "repeating",
                ].includes(requested)
                    ? requested
                    : "today",
            );
    }, [history]);
    const today = localDate(ctx.identity.user.timezone);
    const week = new Set(plan.data?.weekly),
        daily = new Set(plan.data?.daily);
    const matches = (task: Entity, key: string) =>
        matchesView(
            task,
            key,
            today,
            ctx.identity.user.timezone,
            week,
            daily,
            ctx.identity.user.preferences,
        );
    const statusMatches = (task: Entity) =>
        status === "all" ||
        (status === "open" ? task.status !== "done" : task.status === status);
    const filtered = (tasks.data || [])
        .filter(
            (task) =>
                matches(task, view) &&
                statusMatches(task) &&
                `${task.title}\n${task.content}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
        )
        .sort((a, b) =>
            sort === "scheduled"
                ? (a.scheduled_at || a.start_date || "9999").localeCompare(
                      b.scheduled_at || b.start_date || "9999",
                  )
                : b.importance - a.importance || a.id.localeCompare(b.id),
        );
    const shown = filtered.slice(page * 20, page * 20 + 20);
    const groups = new Map<string, Entity[]>();
    for (const task of shown) {
        const parent =
            task.goal_id ||
            milestones.data?.find((row) => row.id === task.milestone_id)
                ?.goal_id ||
            "inbox";
        const key = group === "none" ? "all" : parent;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(task);
    }
    const views: [string, string][] = [
        ["today", ctx.t.today],
        ["next", ctx.text("Next", "Sắp tới")],
        ["week", ctx.t.week],
        ["backlog", ctx.text("Backlog", "Để sau")],
        ["overdue", ctx.text("Overdue", "Quá hạn")],
        ["all", ctx.t.all],
        ["repeating", ctx.text("Repeating", "Lặp lại")],
    ];
    const chooseView = (key: string) => {
        setView(key);
        setPage(0);
        if (!history)
            window.history.replaceState(null, "", `/tasks?view=${key}`);
    };
    return (
        <section className="planning-panel collection-main">
            <QueryState locale={ctx.identity.user.locale} queries={[tasks, plan, goals, milestones, series]} />
            {!history && (
                <div
                    className="task-view-menu"
                    role="group"
                    aria-label={ctx.text(
                        "Task time filters",
                        "Lọc thời gian công việc",
                    )}
                >
                    {views.map(([key, label]) => (
                        <button
                            key={key}
                            aria-pressed={view === key}
                            onClick={() => chooseView(key)}
                        >
                            {label}{" "}
                            <span className="count-badge">
                                {key === "repeating"
                                    ? series.data?.length || 0
                                    : (tasks.data || []).filter(
                                          (task) =>
                                              matches(task, key) &&
                                              statusMatches(task),
                                      ).length}
                            </span>
                        </button>
                    ))}
                </div>
            )}
            <div className="collection-controls">
                <label className="field">
                    {ctx.text("Find a task", "Tìm công việc")}
                    <input
                        type="search"
                        placeholder={ctx.text(
                            "Search task names",
                            "Tìm theo tên",
                        )}
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setPage(0);
                        }}
                    />
                </label>
                <label className="field">
                    {ctx.t.status}
                    <select
                        value={status}
                        onChange={(event) => {
                            setStatus(event.target.value);
                            setPage(0);
                        }}
                    >
                        <option value="open">{ctx.t.openTasks}</option>
                        <option value="all">
                            {ctx.text("All tasks", "Tất cả công việc")}
                        </option>
                        {["todo", "doing", "blocked", "done"].map((value) => (
                            <option key={value} value={value}>
                                {statusName(ctx, value)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="field">
                    {ctx.text("Sort", "Sắp xếp")}
                    <select
                        value={sort}
                        onChange={(event) => setSort(event.target.value)}
                    >
                        <option value="importance">{ctx.t.importance}</option>
                        <option value="scheduled">
                            {ctx.text(
                                "Scheduled time",
                                "Thời gian đã lên lịch",
                            )}
                        </option>
                    </select>
                </label>
                <label className="field">
                    {ctx.text("Group by", "Nhóm theo")}
                    <select
                        value={group}
                        onChange={(event) => setGroup(event.target.value)}
                    >
                        <option value="goal">{ctx.t.goals}</option>
                        <option value="none">
                            {ctx.text("No grouping", "Không nhóm")}
                        </option>
                    </select>
                </label>
            </div>
            {view === "repeating" ? (
                <>
                    <label>
                        {ctx.text("Series state", "Trạng thái lặp")}
                        <select
                            value={seriesState}
                            onChange={(event) =>
                                setSeriesState(event.target.value)
                            }
                        >
                            {["all", "active", "paused", "ended"].map(
                                (value) => (
                                    <option key={value}>{value}</option>
                                ),
                            )}
                        </select>
                    </label>
                    <button
                        className="button button-quiet"
                        onClick={() => ctx.open("task-series")}
                    >
                        <span aria-hidden="true">＋</span> {ctx.t.repeat}
                    </button>
                    {series.data
                        ?.filter(
                            (row) =>
                                (seriesState === "all" ||
                                    row.state === seriesState) &&
                                row.title
                                    .toLowerCase()
                                    .includes(query.toLowerCase()),
                        )
                        .map((row) => (
                            <article className="task-row" key={row.id}>
                                <button
                                    className="task-row-main"
                                    onClick={() => ctx.open("task-series", row)}
                                >
                                    <strong>{row.title}</strong>
                                    <small>
                                        {row.frequency} · {row.state}
                                    </small>
                                </button>
                                {row.state !== "ended" && (
                                    <>
                                        <button
                                            className="button button-quiet"
                                            onClick={() =>
                                                void ctx.action(() =>
                                                    update(
                                                        ctx,
                                                        "task-series",
                                                        row,
                                                        {
                                                            state:
                                                                row.state ===
                                                                "active"
                                                                    ? "paused"
                                                                    : "active",
                                                        },
                                                    ),
                                                )
                                            }
                                        >
                                            {row.state === "active"
                                                ? ctx.text("Pause", "Tạm dừng")
                                                : ctx.text(
                                                      "Resume",
                                                      "Tiếp tục",
                                                  )}
                                        </button>
                                        <button
                                            className="button button-quiet"
                                            onClick={() =>
                                                ctx.open("task-series", row)
                                            }
                                        >
                                            {ctx.text(
                                                "Edit / End",
                                                "Sửa / Kết thúc",
                                            )}
                                        </button>
                                    </>
                                )}
                            </article>
                        ))}
                </>
            ) : (
                <>
                    {[...groups].map(([key, rows]) => (
                        <section key={key}>
                            {key !== "all" && (
                                <header className="section-heading">
                                    <h2>
                                        {goals.data?.find(
                                            (goal) => goal.id === key,
                                        )?.title ||
                                            ctx.text("Inbox", "Hộp việc")}
                                    </h2>
                                    {key !== "inbox" && (
                                        <Link
                                            className="section-link"
                                            href={`/goals/${key}`}
                                        >
                                            {ctx.text(
                                                "Open roadmap →",
                                                "Mở lộ trình →",
                                            )}
                                        </Link>
                                    )}
                                </header>
                            )}
                            {rows.map((task) => (
                                <TaskRow
                                    key={task.id}
                                    ctx={ctx}
                                    task={task}
                                    plan={plan.data}
                                />
                            ))}
                        </section>
                    ))}
                    {!tasks.isPending && !filtered.length && (
                        <Empty>{ctx.t.noTasks}</Empty>
                    )}
                    <div className="collection-pagination">
                        <button
                            className="button button-quiet"
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                        >
                            {ctx.text("Previous", "Trước")}
                        </button>
                        <span>
                            {page + 1} /{" "}
                            {Math.max(1, Math.ceil(filtered.length / 20))}
                        </span>
                        <button
                            className="button button-quiet"
                            disabled={(page + 1) * 20 >= filtered.length}
                            onClick={() => setPage(page + 1)}
                        >
                            {ctx.text("Next", "Sau")}
                        </button>
                    </div>
                    {status === "open" &&
                        (tasks.data || []).some(
                            (task) =>
                                task.status === "done" && matches(task, view),
                        ) && (
                            <section className="task-completed-section">
                                <h3>{ctx.t.doneTasks}</h3>
                                {tasks
                                    .data!.filter(
                                        (task) =>
                                            task.status === "done" &&
                                            matches(task, view),
                                    )
                                    .map((task) => (
                                        <TaskRow
                                            key={task.id}
                                            ctx={ctx}
                                            task={task}
                                            plan={plan.data}
                                        />
                                    ))}
                            </section>
                        )}
                </>
            )}
        </section>
    );
}
