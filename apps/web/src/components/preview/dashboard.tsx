"use client";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { TASK_RETURN_MIME } from "@/lib/task-picker";
import { PageHeaderFrame } from "../ui/layout";
import HabitCheckinDays from "../habit-checkin-days";
import { DashboardPanel } from "../ui/dashboard-panel";
import FloatingActions from "../floating-actions";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
    ArrowRight,
    Check,
    CircleHelp,
    ClipboardList,
    Flag,
    Flame,
    Plus,
    RefreshCw,
    X,
} from "lucide-react";
import { TaskDropZone, useTaskPicker } from "../task-picker";
import { usePreviewData, day, addDays, dateLabel } from "./workspace-data";
import { blankDraft, isToday } from "./task-data";
import { ActivityPreview } from "./reviews";
import { monday } from "./calendar";
import { habitStreak } from "@/lib/habit-progress";
import {
    statuses,
    weekdays,
    type DashboardTask,
    type Label,
} from "./dashboard-data";
import type { PreviewLocale, PreviewTask, Text, ViewState } from "./shared";

export function DashboardView({
    locale,
    text,
    state,
    onReady,
    onNavigate,
    data: db,
    today = day,
    timezone = DEFAULT_TIMEZONE,
    activity,
    connected = false,
}: {
    locale: PreviewLocale;
    text: Text;
    state: ViewState;
    onReady: () => void;
    onNavigate: (section: string) => void;
    data: Pick<
        ReturnType<typeof usePreviewData>,
        | "focus"
        | "setFocus"
        | "tasks"
        | "goals"
        | "milestones"
        | "habits"
        | "events"
        | "appearance"
        | "dashboard"
        | "setTasks"
        | "setTaskAction"
        | "setPlanningAction"
        | "navigate"
        | "checkHabit"
    >;
    today?: string;
    timezone?: string;
    activity: ReactNode;
    connected?: boolean;
}) {
    const [tab, setTab] = useState("today");
    const [status, setStatus] = useState("all");
    const [showTasks, setShowTasks] = useState(false), [showHabits, setShowHabits] = useState(false);
    const day = today;
    const sampleDay = (offset: number) =>
        new Date(`${addDays(day, offset)}T12:00:00Z`);
    const focusId = db.focus,
        setFocusId = db.setFocus;
    const tasks: DashboardTask[] = db.tasks
        .filter((t) => !t.archived)
        .map((t) => ({
            ...t,
            importance: String(t.importance),
            note: text(...t.description),
            scheduled: t.scheduledStart.slice(11, 16),
            daily: connected ? t.daily : isToday(t),
            automaticToday:
                t.due === day ||
                t.start === day ||
                t.scheduledStart.slice(0, 10) === day,
            weekly: connected
                ? t.weekly
                : t.weekly ||
                  (t.due >= monday(day) && t.due <= addDays(monday(day), 6)),
        }));
    const focusGoals = db.goals
        .filter((g) => !g.archived)
        .map((g) => {
            const ms = db.milestones.filter(
                (m) => m.goal === g.id && !m.archived,
            );
            return {
                ...g,
                steps: ms.map((m) => m.title),
                milestones: ms,
                completed: ms.filter((m) => m.status === "Done").length,
            };
        });
    const sampleHabits = db.habits
        .filter((h) => !h.archived)
        .map((h) => ({
            ...h,
            target: h.frequency === "daily" ? 7 : h.target,
            streak: habitStreak(h, h.today || day),
            weekly: h.checkins.filter((d) => d >= monday(day) && d < day)
                .length,
            history: Array.from({ length: 5 }, (_, i) =>
                h.checkins.includes(addDays(day, i - 5)),
            ),
        }));
    const habitChecks = db.habits
        .filter((h) => h.checkins.includes(h.today || day))
        .map((h) => h.id);
    const habitPercentage = sampleHabits.length
        ? Math.round((habitChecks.length / sampleHabits.length) * 100)
        : null;
    const recentCounts = Array.from(
        { length: 30 },
        (_, i) =>
            db.events.filter(
                (e) => e.date === addDays(day, i - 29) && !e.reversed,
            ).length,
    );
    const weekCounts = Array.from(
        { length: 7 },
        (_, i) =>
            db.events.filter(
                (e) => e.date === addDays(monday(day), i) && !e.reversed,
            ).length,
    );
    const setEditor = (value: PreviewTask | null | undefined) => {
        if (value === undefined) return;
        db.setTaskAction(
            value
                ? { kind: "edit", id: value.id }
                : {
                      kind: "create",
                      draft: { ...blankDraft(), plan: week ? "week" : "today" },
                  },
        );
    };
    const [sort, setSort] = useState("importance");
    const taskPicker = useTaskPicker();
    const dueMilestones = db.milestones.filter(
        (m) =>
            !m.archived &&
            m.status !== "Done" &&
            (m.weekly ||
                (m.due &&
                    m.due >= monday(day) &&
                    m.due <= addDays(monday(day), 6))),
    );
    const [activityDay, setActivityDay] = useState<number | null>(null);
    const [weekDay, setWeekDay] = useState<number | null>(null);
    const [message, setMessage] = useState<Label | null>(null);
    useEffect(() => {
        if (connected) setMessage(null);
    }, [connected, db.tasks, db.focus, db.habits]);
    const empty = state === "empty";
    const week = tab === "week";
    const openPicker = () => { onReady(); taskPicker.open({ kind: "plan", period: week ? "week" : "today" }); };
    useEffect(() => {
        if (taskPicker.target?.kind === "plan") openPicker();
    }, [week]);
    const selected = empty
        ? []
        : tasks.filter((task) => (week ? task.weekly : task.daily));
    const done = selected.filter((task) => task.status === "Done").length;
    const percentage = selected.length
        ? Math.round((done / selected.length) * 100)
        : null;
    const rows = selected
        .filter((task) => status === "all" || task.status === status)
        .sort((a, b) =>
            sort === "importance"
                ? Number(b.importance) - Number(a.importance)
                : (a.scheduled || "99:99").localeCompare(
                      b.scheduled || "99:99",
                  ),
        );
    const focus = empty
        ? undefined
        : focusGoals.find((goal) => goal.id === focusId);
    const dayLabel = (offset: number) =>
        new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
        }).format(sampleDay(offset));
    const statusLabel = (value: string) => {
        const item = statuses.find(([key]) => key === value)!;
        return text(item[1], item[2]);
    };
    const addToPlan = (id: number, daily: boolean) => {
        db.setTasks((items) =>
            items.map((task) =>
                task.id === id
                    ? { ...task, weekly: true, daily: task.daily || daily }
                    : task,
            ),
        );
        onReady();
        setMessage([
            connected
                ? "Updating your plan…"
                : daily
                  ? "Added to today's plan."
                  : "Added to this week's plan.",
            connected
                ? "Đang cập nhật kế hoạch…"
                : daily
                  ? "Đã thêm vào kế hoạch hôm nay."
                  : "Đã thêm vào kế hoạch tuần này.",
        ]);
    };
    const openEditor = (task: DashboardTask) =>
        setEditor({
            ...task,
            title: text(...task.title),
            done: task.status === "Done",
        });
    const tabs: [string, string][] = [
        ["today", text("Daily", "Hàng ngày")],
        ["week", text("Weekly", "Hàng tuần")],
        ["activity", text("Activity", "Hoạt động")],
    ];

    return (
        <div className="preview-dashboard">
            <PageHeaderFrame className="preview-dashboard-header">
                <div>
                    <p className="dashboard-date">
                        {new Intl.DateTimeFormat(locale, {
                            dateStyle: "full",
                            timeZone: "UTC",
                        }).format(sampleDay(0))}{" "}

                    </p>
                    <h1>
                        {text("Hello there!", "Chào bạn!")}{" "}
                        <span aria-hidden="true">✨</span>
                    </h1>
                    <p>
                        {text(
                            "You're making steady progress.",
                            "Bạn đang tiến bộ từng bước.",
                        )}
                    </p>
                </div>
            </PageHeaderFrame>
            <FloatingActions
                label={text("Page actions", "Thao tác trang")}
                closeLabel={text("Close actions", "Đóng thao tác")}
            >
                <button
                    className="button button-primary"
                    onClick={() => setEditor(null)}
                >
                    <Plus size={18} />
                    {text("New task", "Công việc mới")}
                </button>
                <button className="button button-quiet" onClick={openPicker}>{text("Choose tasks", "Chọn công việc")}</button>
            </FloatingActions>
            <DashboardPanel
                className="dashboard-roadmap"
                text={text}
                label={text("Roadmap", "Lộ trình")}
                summary={
                    focus ? (
                        <div className="dashboard-collapsed-progress">
                            <span className="progress-pill">
                                {focus.steps.length ? `${Math.round((focus.completed / focus.steps.length) * 100)}%` : "0%"}
                            </span>
                            <span>
                                {text(
                                    `${focus.completed} of ${focus.steps.length} milestones completed`,
                                    `Đã hoàn thành ${focus.completed}/${focus.steps.length} cột mốc`,
                                )}
                            </span>
                        </div>
                    ) : null
                }
                header={<div className="section-heading">
                    <label className="roadmap-title-picker">
                        <span className="sr-only">
                            {text("Choose a roadmap", "Chọn lộ trình")}
                        </span>
                        <select
                            value={empty ? "" : focusId}
                            onChange={(event) => setFocusId(event.target.value)}
                        >
                            <option value="">
                                {text("Choose a roadmap", "Chọn lộ trình")}
                            </option>
                            {!empty &&
                                focusGoals.map((goal) => (
                                    <option key={goal.id} value={goal.id}>
                                        {text(...goal.title)}
                                    </option>
                                ))}
                        </select>
                    </label>
                    <button
                        className="section-link text-button"
                        onClick={() =>
                            db.navigate("goals", { goal: focusId || undefined })
                        }
                    >
                        {text("View full roadmap", "Xem toàn bộ lộ trình")}
                        <ArrowRight size={14} />
                    </button>
                </div>}>

                {focus ? (
                    <div className="roadmap-preview preview-dashboard-roadmap">
                        {focus.steps.slice(0, 6).map((step, index) => (
                            <button
                                key={index}
                                className={`roadmap-step ${index < focus.completed ? "is-done" : ""}`}
                                title={text(...step)}
                                onClick={() =>
                                    db.setPlanningAction({
                                        kind: "milestone",
                                        id: focus.milestones[index].id,
                                        view: true,
                                    })
                                }
                            >
                                <span className="preview-roadmap-dot">
                                    {index < focus.completed && (
                                        <Check size={12} />
                                    )}
                                </span>
                                <span>{text(...step)}</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="subtle-copy preview-roadmap-empty">
                        {text(
                            empty
                                ? "Your roadmaps will appear here when you create a Goal."
                                : "Choose a roadmap to display here.",
                            empty
                                ? "Lộ trình sẽ xuất hiện ở đây khi bạn tạo Mục tiêu."
                                : "Chọn lộ trình để hiển thị ở đây.",
                        )}
                    </p>
                )}
            </DashboardPanel>
            <nav
                className="workspace-section-menu"
                role="tablist"
                aria-label={text("Dashboard sections", "Các mục tổng quan")}
                onKeyDown={(event) => {
                    const index = tabs.findIndex(([key]) => key === tab);
                    const next =
                        event.key === "ArrowRight"
                            ? (index + 1) % 3
                            : event.key === "ArrowLeft"
                              ? (index + 2) % 3
                              : event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? 2
                                  : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    setTab(tabs[next][0]);
                    event.currentTarget
                        .querySelectorAll<HTMLButtonElement>("button")
                        [next].focus();
                }}
            >
                {tabs.map(([key, label]) => (
                    <button
                        key={key}
                        role="tab"
                        id={`preview-dashboard-tab-${key}`}
                        aria-selected={tab === key}
                        aria-controls="preview-dashboard-panel"
                        tabIndex={tab === key ? 0 : -1}
                        onClick={() => setTab(key)}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            <div role="status" className="preview-feedback">
                {message && (
                    <div className="notice">
                        <Check size={16} />
                        <span>{text(...message)}</span>
                        <button
                            className="icon-button"
                            aria-label={text(
                                "Dismiss message",
                                "Đóng thông báo trạng thái",
                            )}
                            onClick={() => setMessage(null)}
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>
            <section
                id="preview-dashboard-panel"
                role="tabpanel"
                aria-labelledby={`preview-dashboard-tab-${tab}`}
            >
                {tab === "activity" ? (
                    activity
                ) : state === "loading" || state === "error" ? (
                    <div
                        className="planning-panel preview-state"
                        role={state === "error" ? "alert" : "status"}
                    >
                        {state === "loading" ? (
                            <>
                                <RefreshCw className="preview-spin" size={28} />
                                <p>
                                    {text(
                                        "Loading your plan…",
                                        "Đang tải kế hoạch của bạn…",
                                    )}
                                </p>
                            </>
                        ) : (
                            <>
                                <CircleHelp size={28} />
                                <h2>
                                    {text(
                                        "Your plan could not be loaded",
                                        "Chưa tải được kế hoạch",
                                    )}
                                </h2>
                                <p>
                                    {text(
                                        "Try again to see your tasks and supporting cards.",
                                        "Thử tải lại để xem công việc và các thẻ hỗ trợ.",
                                    )}
                                </p>
                                <button
                                    className="button button-primary"
                                    onClick={onReady}
                                >
                                    {text("Try again", "Thử lại")}
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="dashboard-split-layout">
                        <div className="dashboard-split-main">
                            <TaskDropZone as="section" target={{kind: "plan", period: week ? "week" : "today"}} className="dashboard-task-drop"><DashboardPanel
                                className="today-panel"
                                text={text}
                                label={text("Tasks", "Công việc")}
                                summary={
                                    <div className="dashboard-task-summary">
                                        <div
                                            className="progress-ring is-compact"
                                            style={
                                                {
                                                    "--progress": `${percentage || 0}%`,
                                                } as CSSProperties
                                            }
                                            role="img"
                                            aria-label={
                                                text("Completion: ", "Tiến độ: ") +
                                                (percentage === null
                                                    ? text(
                                                          "No tasks selected",
                                                          "Chưa chọn công việc",
                                                      )
                                                    : `${percentage}%`)
                                            }
                                        >
                                            <strong>
                                                {percentage === null
                                                    ? "—"
                                                    : `${percentage}%`}
                                            </strong>
                                        </div>
                                        <div className="dashboard-task-summary-copy">
                                            <strong>
                                                {done} / {selected.length}
                                            </strong>
                                            <small>
                                                {text(
                                                    week
                                                        ? "selected tasks completed"
                                                        : "tasks completed today",
                                                    week
                                                        ? "công việc đã chọn đã hoàn thành"
                                                        : "công việc hôm nay đã hoàn thành",
                                                )}
                                            </small>
                                        </div>
                                    </div>
                                }
                                header={<div className="section-heading preview-dashboard-task-heading">
                                    <h2>
                                        <ClipboardList size={17} />
                                        {text(
                                            week
                                                ? "Weekly tasks"
                                                : "Daily tasks",
                                            week
                                                ? "Công việc trong tuần"
                                                : "Công việc hàng ngày",
                                        )}
                                        <span className="count-badge">
                                            {done}/{selected.length}
                                        </span>
                                    </h2>
                                    <button
                                        className={
                                            week
                                                ? "text-button"
                                                : "button button-quiet"
                                        }
                                        onClick={() => {
                                            openPicker();
                                        }}
                                    >
                                        <Plus size={15} />
                                        {text(
                                            week ? "Select tasks" : "Add task",
                                            week
                                                ? "Chọn công việc"
                                                : "Thêm công việc",
                                        )}
                                    </button>
                                </div>}>
                                <div className="dashboard-task-summary">
                                    <div
                                        className="progress-ring"
                                        style={
                                            {
                                                "--progress": `${percentage || 0}%`,
                                            } as CSSProperties
                                        }
                                        role="img"
                                        aria-label={
                                            text("Completion: ", "Tiến độ: ") +
                                            (percentage === null
                                                ? text(
                                                      "No tasks selected",
                                                      "Chưa chọn công việc",
                                                  )
                                                : `${percentage}%`)
                                        }
                                    >
                                        <strong>
                                            {percentage === null
                                                ? "—"
                                                : `${percentage}%`}
                                        </strong>
                                    </div>
                                    <div className="dashboard-task-summary-copy">
                                        <strong>
                                            {done} / {selected.length}
                                        </strong>
                                        <small>
                                            {text(
                                                week
                                                    ? "selected tasks completed"
                                                    : "tasks completed today",
                                                week
                                                    ? "công việc đã chọn đã hoàn thành"
                                                    : "công việc hôm nay đã hoàn thành",
                                            )}
                                        </small>
                                    </div>
                                </div>

                                <div className="dashboard-week-filters">
                                    <label className="field">
                                        {text("Filter by", "Lọc theo")}
                                        <select
                                            value={status}
                                            onChange={(event) =>
                                                setStatus(event.target.value)
                                            }
                                        >
                                            <option value="all">
                                                {text(
                                                    "All tasks",
                                                    "Tất cả công việc",
                                                )}
                                            </option>
                                            {statuses.map(([key, en, vi]) => (
                                                <option key={key} value={key}>
                                                    {text(en, vi)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="field">
                                        {text("Sort by", "Sắp xếp theo")}
                                        <select
                                            value={sort}
                                            onChange={(event) =>
                                                setSort(event.target.value)
                                            }
                                        >
                                            <option value="importance">
                                                {text(
                                                    "Importance",
                                                    "Mức quan trọng",
                                                )}
                                            </option>
                                            <option value="scheduled">
                                                {text(
                                                    "Scheduled time",
                                                    "Thời gian lên lịch",
                                                )}
                                            </option>
                                        </select>
                                    </label>
                                </div>
                                <div className="preview-dashboard-checklist">
                                    {(showTasks ? rows : rows.slice(0, db.dashboard.tasks)).map(
                                        (task) => (
                                            <article
                                                key={task.id}
                                                draggable={!!taskPicker.target && task.status !== "Done"}
                                                onDragStart={event => event.dataTransfer.setData(TASK_RETURN_MIME, String(task.id))}
                                                className={`dashboard-item dashboard-checklist-row ${task.status === "Done" ? "is-done" : ""}`}
                                            >
                                                <button
                                                    className={`task-completion-button ${task.status === "Done" ? "is-complete" : ""}`}
                                                    aria-label={
                                                        text(
                                                            task.status ===
                                                                "Done"
                                                                ? "Reopen: "
                                                                : "Complete: ",
                                                            task.status ===
                                                                "Done"
                                                                ? "Mở lại: "
                                                                : "Hoàn thành: ",
                                                        ) + text(...task.title)
                                                    }
                                                    aria-pressed={
                                                        task.status === "Done"
                                                    }
                                                    onClick={() =>
                                                        db.setTaskAction({
                                                            kind: "complete",
                                                            id: task.id,
                                                        })
                                                    }
                                                >
                                                    {task.status === "Done" && (
                                                        <Check size={17} />
                                                    )}
                                                </button>
                                                <button
                                                    className="dashboard-item-copy preview-dashboard-task-copy"
                                                    onClick={() =>
                                                        openEditor(task)
                                                    }
                                                >
                                                    <strong>
                                                        {text(...task.title)}
                                                    </strong>
                                                    <small className="dashboard-task-labels">
                                                        <span>
                                                            {statusLabel(
                                                                task.status,
                                                            )}
                                                        </span>
                                                        {task.scheduled && (
                                                            <span>
                                                                {text(
                                                                    "Scheduled",
                                                                    "Lên lịch",
                                                                )}{" "}
                                                                {task.scheduled}
                                                            </span>
                                                        )}
                                                        {task.due && (
                                                            <span>
                                                                {text(
                                                                    "Due",
                                                                    "Hạn",
                                                                )}{" "}
                                                                {new Intl.DateTimeFormat(
                                                                    locale,
                                                                    {
                                                                        day: "numeric",
                                                                        month: "short",
                                                                        timeZone:
                                                                            "UTC",
                                                                    },
                                                                ).format(
                                                                    new Date(
                                                                        `${task.due}T00:00:00Z`,
                                                                    ),
                                                                )}
                                                            </span>
                                                        )}
                                                    </small>
                                                </button>
                                                {week ? (
                                                    <button
                                                        className="icon-button dashboard-plan-button"
                                                        disabled={task.daily}
                                                        title={text(
                                                            task.daily
                                                                ? "Already in today's plan"
                                                                : "Add for today",
                                                            task.daily
                                                                ? "Đã có trong hôm nay"
                                                                : "Thêm cho hôm nay",
                                                        )}
                                                        aria-label={
                                                            text(
                                                                task.daily
                                                                    ? "Already in today's plan: "
                                                                    : "Add for today: ",
                                                                task.daily
                                                                    ? "Đã có trong hôm nay: "
                                                                    : "Thêm cho hôm nay: ",
                                                            ) +
                                                            text(...task.title)
                                                        }
                                                        onClick={() =>
                                                            addToPlan(
                                                                task.id,
                                                                true,
                                                            )
                                                        }
                                                    >
                                                        {task.daily ? (
                                                            <Check size={15} />
                                                        ) : (
                                                            <Plus size={16} />
                                                        )}
                                                    </button>
                                                ) : task.automaticToday ? null : (
                                                    <button
                                                        className="icon-button dashboard-plan-button"
                                                        aria-label={
                                                            text(
                                                                "Remove from today's plan: ",
                                                                "Bỏ khỏi kế hoạch hôm nay: ",
                                                            ) +
                                                            text(...task.title)
                                                        }
                                                        onClick={() => {
                                                            db.setTasks(
                                                                (items) =>
                                                                    items.map(
                                                                        (
                                                                            item,
                                                                        ) =>
                                                                            item.id ===
                                                                            task.id
                                                                                ? {
                                                                                      ...item,
                                                                                      daily: false,
                                                                                  }
                                                                                : item,
                                                                    ),
                                                            );
                                                            setMessage([
                                                                connected
                                                                    ? "Updating your plan…"
                                                                    : "Removed from today's sample selection. Task dates and weekly selection stay the same.",
                                                                connected
                                                                    ? "Đang cập nhật kế hoạch…"
                                                                    : "Đã bỏ khỏi lựa chọn hôm nay trong bản mẫu. Ngày công việc và lựa chọn tuần được giữ nguyên.",
                                                            ]);
                                                        }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </article>
                                        ),
                                    )}
                                    {rows.length > db.dashboard.tasks && <button className="text-button" onClick={() => setShowTasks(!showTasks)}>{text(showTasks ? "Show less" : "Show more", showTasks ? "Thu gọn" : "Xem thêm")}</button>}
                                {!rows.length && (
                                        <div className="preview-dashboard-empty">
                                            <ClipboardList size={25} />
                                            <strong>
                                                {text(
                                                    selected.length
                                                        ? "No tasks with this status"
                                                        : "A little room to focus",
                                                    selected.length
                                                        ? "Không có công việc ở trạng thái này"
                                                        : "Một chút không gian để tập trung",
                                                )}
                                            </strong>
                                            <p>
                                                {text(
                                                    selected.length
                                                        ? "Choose another status to see the rest of your plan."
                                                        : "Choose an existing task or create a small next step.",
                                                    selected.length
                                                        ? "Chọn trạng thái khác để xem phần còn lại của kế hoạch."
                                                        : "Chọn công việc có sẵn hoặc tạo một bước tiếp theo nhỏ.",
                                                )}
                                            </p>
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    openPicker()
                                                }
                                            >
                                                {text(
                                                    selected.length
                                                        ? "Choose tasks"
                                                        : "Select tasks",
                                                    selected.length
                                                        ? "Chọn công việc"
                                                        : "Chọn công việc",
                                                )}
                                            </button>
                                        </div>
                                    )}
                                    {!week && rows.length > 4 && (
                                        <p className="subtle-copy">
                                            {text(
                                                "Showing the first four tasks.",
                                                "Đang hiển thị bốn công việc đầu tiên.",
                                            )}
                                        </p>
                                    )}
                                </div>
                            </DashboardPanel></TaskDropZone>
                        </div>
                        <div className="dashboard-split-side">
                            {week ? (
                                <>
                                    <DashboardPanel
                                        className="dashboard-week-side"
                                        text={text}
                                        label={text("Milestones", "Cột mốc")}
                                        summary={
                                            <div className="dashboard-collapsed-progress">
                                                <span>
                                                    {text(
                                                        `${dueMilestones.filter((m) => m.status === "Done").length} of ${dueMilestones.length} milestones completed`,
                                                        `Đã hoàn thành ${dueMilestones.filter((m) => m.status === "Done").length}/${dueMilestones.length} cột mốc`,
                                                    )}
                                                </span>
                                            </div>
                                        }
                                        header={<div className="section-heading">
                                            <h2>
                                                <Flag size={17} />
                                                {text("Milestones", "Cột mốc")}
                                                <span className="count-badge">
                                                    {empty
                                                        ? 0
                                                        : dueMilestones.length}
                                                </span>
                                            </h2>
                                        </div>}>

                                        {empty || !dueMilestones.length ? (
                                            <p className="subtle-copy">
                                                {text(
                                                    "No milestones due this week.",
                                                    "Tuần này chưa có cột mốc đến hạn.",
                                                )}
                                            </p>
                                        ) : (
                                            dueMilestones.map((milestone) => (
                                                <button
                                                    className="preview-dashboard-milestone"
                                                    key={milestone.id}
                                                    onClick={() =>
                                                        db.setPlanningAction({
                                                            kind: "milestone",
                                                            id: milestone.id,
                                                            view: true,
                                                        })
                                                    }
                                                >
                                                    <Flag size={17} />
                                                    <span>
                                                        <strong>
                                                            {text(
                                                                ...milestone.title,
                                                            )}
                                                        </strong>
                                                        <small>
                                                            {dateLabel(
                                                                milestone.due,
                                                                locale,
                                                            )}
                                                        </small>
                                                    </span>
                                                </button>
                                            ))
                                        )}
                                        <div className="section-heading preview-dashboard-target-heading">
                                            <h3>
                                                {text(
                                                    "Habit targets",
                                                    "Mục tiêu thói quen",
                                                )}
                                            </h3>
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    onNavigate("habits")
                                                }
                                            >
                                                {text("View all", "Xem tất cả")}
                                            </button>
                                        </div>
                                        {empty ? (
                                            <p className="subtle-copy">
                                                {text(
                                                    "Your weekly Habit targets will appear here.",
                                                    "Mục tiêu thói quen trong tuần sẽ xuất hiện ở đây.",
                                                )}
                                            </p>
                                        ) : (
                                            sampleHabits.map((habit) => (
                                                <div
                                                    key={habit.id}
                                                    className="preview-dashboard-target"
                                                >
                                                    <strong>
                                                        {text(...habit.title)}
                                                    </strong>
                                                    <span>
                                                        {habit.weekly +
                                                            Number(
                                                                habitChecks.includes(
                                                                    habit.id,
                                                                ),
                                                            )}
                                                        /{habit.target}{" "}
                                                        {text(
                                                            "this week",
                                                            "tuần này",
                                                        )}
                                                    </span>
                                                    <progress
                                                        max={habit.target}
                                                        value={
                                                            habit.weekly +
                                                            Number(
                                                                habitChecks.includes(
                                                                    habit.id,
                                                                ),
                                                            )
                                                        }
                                                        aria-label={text(
                                                            ...habit.title,
                                                        )}
                                                    />
                                                </div>
                                            ))
                                        )}
                                    </DashboardPanel>
                                    <DashboardPanel className="dashboard-week-panel" text={text} label={text("Weekly progress", "Tiến độ tuần")} header={<div className="section-heading">
                                            <h2>
                                                {text(
                                                    "Weekly activity",
                                                    "Hoạt động tuần",
                                                )}
                                            </h2>
                                            <small>
                                                {dayLabel(-5)} – {dayLabel(1)}
                                            </small>
                                        </div>}>

                                        <p className="dashboard-week-activity-summary">
                                            <strong>
                                                {empty
                                                    ? 0
                                                    : weekCounts.reduce(
                                                          (a, b) => a + b,
                                                          0,
                                                      )}
                                            </strong>
                                            {text("contributions", "đóng góp")}
                                        </p>
                                        <div className="dashboard-week-bars-wrapper">
                                            <div className="day-bars">
                                                {weekCounts.map(
                                                    (value, index) => (
                                                        <button
                                                            key={index}
                                                            className="day-bar"
                                                            aria-current={
                                                                index === 5
                                                                    ? "date"
                                                                    : undefined
                                                            }
                                                            aria-pressed={
                                                                weekDay ===
                                                                index
                                                            }
                                                            aria-label={`${dateLabel(addDays(monday(day), index), locale)}: ${empty ? 0 : value} ${text("contributions", "đóng góp")}`}
                                                            onClick={() =>
                                                                setWeekDay(
                                                                    index,
                                                                )
                                                            }
                                                        >
                                                            <span className="day-bar-count">
                                                                {empty
                                                                    ? 0
                                                                    : value}
                                                            </span>
                                                            <span className="day-bar-track">
                                                                <i
                                                                    style={
                                                                        {
                                                                            "--bar-height": `${empty ? 0 : (value / 4) * 100}%`,
                                                                        } as CSSProperties
                                                                    }
                                                                />
                                                            </span>
                                                            <small>
                                                                {text(
                                                                    ...weekdays[
                                                                        index
                                                                    ],
                                                                )}
                                                            </small>
                                                        </button>
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                        <p
                                            className="preview-dashboard-chart-detail"
                                            role="status"
                                        >
                                            {weekDay === null
                                                ? text(
                                                      "Select a day to see its activity.",
                                                      "Chọn một ngày để xem hoạt động.",
                                                  )
                                                : `${dateLabel(addDays(monday(day), weekDay), locale)}: ${empty ? 0 : weekCounts[weekDay]} ${text(connected ? "contributions" : "sample contributions", connected ? "đóng góp" : "đóng góp minh họa")}`}
                                        </p>
                                    </DashboardPanel>
                                </>
                            ) : (
                                <>
                                    <DashboardPanel
                                        className="dashboard-habits-panel"
                                        text={text}
                                        label={text("Habits", "Thói quen")}
                                        summary={
                                            <div className="dashboard-task-summary">
                                                <div
                                                    className="progress-ring is-compact"
                                                    style={
                                                        {
                                                            "--progress": `${habitPercentage || 0}%`,
                                                        } as CSSProperties
                                                    }
                                                    role="img"
                                                    aria-label={
                                                        text("Habit completion: ", "Tiến độ thói quen: ") +
                                                        (habitPercentage === null
                                                            ? text(
                                                                  "No habits",
                                                                  "Chưa có thói quen",
                                                              )
                                                            : `${habitPercentage}%`)
                                                    }
                                                >
                                                    <strong>
                                                        {habitPercentage === null
                                                            ? "—"
                                                            : `${habitPercentage}%`}
                                                    </strong>
                                                </div>
                                                <div className="dashboard-task-summary-copy">
                                                    <strong>
                                                        {habitChecks.length} / {sampleHabits.length}
                                                    </strong>
                                                    <small>
                                                        {text(
                                                            "habits checked today",
                                                            "thói quen đã điểm danh hôm nay",
                                                        )}
                                                    </small>
                                                </div>
                                            </div>
                                        }
                                        header={<div className="section-heading">
                                            <h2>
                                                {text("Habits", "Thói quen")}
                                                <span className="count-badge">
                                                    {empty
                                                        ? "0/0"
                                                        : `${habitChecks.length}/${sampleHabits.length}`}
                                                </span>
                                            </h2>
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    onNavigate("habits")
                                                }
                                            >
                                                {text(
                                                    "Manage habits",
                                                    "Quản lý thói quen",
                                                )}
                                                <ArrowRight size={13} />
                                            </button>
                                        </div>}>

                                        {empty ? (
                                            <div className="preview-dashboard-empty">
                                                <Flame size={24} />
                                                <p>
                                                    {text(
                                                        "Build your first small daily routine.",
                                                        "Bắt đầu bằng một thói quen nhỏ hàng ngày.",
                                                    )}
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="dashboard-task-summary dashboard-habit-summary">
                                                    <div
                                                        className="progress-ring"
                                                        style={
                                                            {
                                                                "--progress": `${habitPercentage || 0}%`,
                                                            } as CSSProperties
                                                        }
                                                        role="img"
                                                        aria-label={
                                                            text("Habit completion: ", "Tiến độ thói quen: ") +
                                                            (habitPercentage === null
                                                                ? text(
                                                                      "No habits",
                                                                      "Chưa có thói quen",
                                                                  )
                                                                : `${habitPercentage}%`)
                                                        }
                                                    >
                                                        <strong>
                                                            {habitPercentage === null
                                                                ? "—"
                                                                : `${habitPercentage}%`}
                                                        </strong>
                                                    </div>
                                                    <div className="dashboard-task-summary-copy">
                                                        <strong>
                                                            {habitChecks.length} / {sampleHabits.length}
                                                        </strong>
                                                        <small>
                                                            {text(
                                                                "habits checked today",
                                                                "thói quen đã điểm danh hôm nay",
                                                            )}
                                                        </small>
                                                    </div>
                                                </div>
                                                {(showHabits ? sampleHabits : sampleHabits.slice(0, db.dashboard.habits)).map((habit) => {
                                                const checked =
                                                    habitChecks.includes(
                                                        habit.id,
                                                    );
                                                return (
                                                    <div
                                                        className="preview-dashboard-habit"
                                                        key={habit.id}
                                                    >
                                                        <div className="dashboard-item">

                                                            <div className="dashboard-item-copy">
                                                                <strong>
                                                                    {text(
                                                                        ...habit.title,
                                                                    )}
                                                                </strong>
                                                                <small>
                                                                    {habit.weekly +
                                                                        Number(
                                                                            checked,
                                                                        )}
                                                                    /
                                                                    {
                                                                        habit.target
                                                                    }{" "}
                                                                    {text(
                                                                        "this week",
                                                                        "tuần này",
                                                                    )}{" "}
                                                                </small>
                                                            </div>
                                                        </div>
                                                        <HabitCheckinDays habit={habit} dates={Array.from({ length: 7 }, (_, index) => addDays(monday(habit.today || day), index))} today={habit.today || day} locale={locale} text={text} onCheck={db.checkHabit} />
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                    {sampleHabits.length > db.dashboard.habits && <button className="text-button" onClick={() => setShowHabits(!showHabits)}>{text(showHabits ? "Show less" : "Show more", showHabits ? "Thu gọn" : "Xem thêm")}</button>}
                                    </DashboardPanel>

                                    <DashboardPanel
                                        className="dashboard-recent-panel"
                                        text={text}
                                        label={text("Activity", "Hoạt động")}
                                        summary={
                                            <div className="dashboard-collapsed-progress">
                                                <span>{text("30-day activity overview", "Tổng quan hoạt động 30 ngày")}</span>
                                            </div>
                                        }
                                        header={<div className="section-heading">
                                            <h2>
                                                {text("Activity", "Hoạt động")}
                                            </h2>
                                            <small>
                                                {text(
                                                    "Last 30 days",
                                                    "30 ngày gần đây",
                                                )}
                                            </small>
                                        </div>}>

                                        <div className="recent-activity-section">
                                            <div className="recent-activity-overview">
                                                <div className="recent-activity-stats-summary">
                                                    <strong>
                                                        {empty
                                                            ? 0
                                                            : recentCounts.reduce(
                                                                  (a, b) =>
                                                                      a + b,
                                                                  0,
                                                              )}
                                                    </strong>
                                                    <span>
                                                        {text(
                                                            "contributions",
                                                            "đóng góp",
                                                        )}
                                                    </span>
                                                    <small>
                                                        {dayLabel(-29)} –{" "}
                                                        {dayLabel(0)}
                                                    </small>
                                                </div>
                                                <div className="recent-activity-calendar">
                                                    <div
                                                        className="recent-activity-weekdays"
                                                        aria-hidden="true"
                                                    >
                                                        {weekdays.map(
                                                            (label) => (
                                                                <span
                                                                    key={
                                                                        label[0]
                                                                    }
                                                                >
                                                                    {text(
                                                                        ...label,
                                                                    )}
                                                                </span>
                                                            ),
                                                        )}
                                                    </div>
                                                    <div
                                                        data-recent-activity-grid
                                                        role="group"
                                                        aria-label={text(
                                                            "Activity for the last 30 days",
                                                            "Hoạt động 30 ngày gần đây",
                                                        )}
                                                    >
                                                        {Array.from(
                                                            { length: 4 },
                                                            (_, index) => (
                                                                <span
                                                                    key={`blank-${index}`}
                                                                    aria-hidden="true"
                                                                />
                                                            ),
                                                        )}
                                                        {recentCounts.map(
                                                            (count, index) => (
                                                                <button
                                                                    key={index}
                                                                    className="activity-day"
                                                                    data-level={
                                                                        empty
                                                                            ? 0
                                                                            : Math.min(
                                                                                  count,
                                                                                  4,
                                                                              )
                                                                    }
                                                                    aria-pressed={
                                                                        activityDay ===
                                                                        index
                                                                    }
                                                                    aria-label={`${dayLabel(index - 29)}: ${empty ? 0 : count} ${text("contributions", "đóng góp")}`}
                                                                    title={`${dayLabel(index - 29)}: ${empty ? 0 : count}`}
                                                                    onClick={() =>
                                                                        setActivityDay(
                                                                            index,
                                                                        )
                                                                    }
                                                                />
                                                            ),
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="recent-activity-footer">
                                                <div
                                                    className="activity-legend"
                                                    aria-label={text(
                                                        "Less to more activity",
                                                        "Mức hoạt động từ ít đến nhiều",
                                                    )}
                                                >
                                                    <span>
                                                        {text("Less", "Ít")}
                                                    </span>
                                                    {[0, 1, 2, 3, 4].map(
                                                        (level) => (
                                                            <i
                                                                key={level}
                                                                data-level={
                                                                    level
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                    <span>
                                                        {text("More", "Nhiều")}
                                                    </span>
                                                </div>
                                                <button
                                                    className="text-button"
                                                    onClick={() =>
                                                        setTab("activity")
                                                    }
                                                >
                                                    {text(
                                                        "View activity",
                                                        "Xem hoạt động",
                                                    )}
                                                    <ArrowRight size={13} />
                                                </button>
                                            </div>
                                            <p
                                                className="recent-activity-detail"
                                                role="status"
                                            >
                                                {activityDay === null
                                                    ? text(
                                                          "Select a day to see its activity.",
                                                          "Chọn một ngày để xem hoạt động.",
                                                      )
                                                    : `${dayLabel(activityDay - 29)}: ${empty ? 0 : recentCounts[activityDay]} ${text(connected ? "contributions" : "sample contributions", connected ? "đóng góp" : "đóng góp minh họa")}`}
                                            </p>
                                        </div>
                                    </DashboardPanel>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </section>

        </div>
    );
}

export default function PreviewDashboard(props: {
    locale: PreviewLocale;
    text: Text;
    state: ViewState;
    onReady: () => void;
    onNavigate: (section: string) => void;
}) {
    const data = usePreviewData();
    return (
        <DashboardView
            {...props}
            data={data}
            today={data.today}
            timezone={data.profile.timezone}
            connected={!!data.live}
            activity={<ActivityPreview text={props.text} />}
        />
    );
}
