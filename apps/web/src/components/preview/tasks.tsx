"use client";
import { PageHeaderFrame } from "../ui/layout";
import { CollectionToolbar } from "../ui/collection-toolbar";
import FloatingActions from "../floating-actions";
import { pickedTaskPatch, returnedTaskPatch, taskIsPicked } from "@/lib/task-picker";

import { useEffect, useRef, useState } from "react";
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleHelp,
    ClipboardList,
    MoreHorizontal,
    Pencil,
    CalendarDays,
    Plus,
    RefreshCw,
    Repeat2,
    Sun,
    X,
} from "lucide-react";
import Dialog from "../dialog";
import { Confirm, Stars } from "./ui";
import { statuses, type Label } from "./dashboard-data";
import TaskPreviewEditor from "./task-editor";
import TaskPreviewDetail from "./task-detail";
import {
    blankDraft,
    demoToday as fixtureToday,
    draftFromRecord,
    formatTaskDate,
    frequencies,
    matchesTaskView,
    nextDates,
    recordFromDraft,
    seriesStates,
    tagOptions as fixtureTags,
    updateFromDraft,
    views,
    type TaskDraft,
    type TaskRecord,
} from "./task-data";
import { usePreviewData } from "./workspace-data";
import type { PreviewLocale, Text, ViewState } from "./shared";

type Editor = {
    kind: "create" | "edit" | "series";
    id?: number;
    draft: TaskDraft;
};
type Prompt =
    | { kind: "complete" | "reopen" | "archive"; id: number }
    | { kind: "end"; id: number }
    | { kind: "info"; title: string; body: string };

export default function TasksPreview({
    locale,
    text,
    state,
    onReady,
    onNavigate,
}: {
    locale: PreviewLocale;
    text: Text;
    state: ViewState;
    onReady: () => void;
    onNavigate: (section: string) => void;
}) {
    const shared = usePreviewData();
    const tagOptions = shared.live?.tags || fixtureTags;
    const demoToday = shared.today || fixtureToday;
    const { tasks, setTasks, series, setSeries, parents } = shared;

    const [view, setView] = useState("all");
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("NotStarted");
    const [sort, setSort] = useState("importance");
    const [group, setGroup] = useState("goal");
    const [tag, setTag] = useState("");
    const [seriesState, setSeriesState] = useState("all");
    const [pageIndex, setPageIndex] = useState(0);
    const [collapsed, setCollapsed] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const completedParents = shared.goals
        .filter((goal) => goal.status === "Done")
        .map((goal) => goal.id);
    const setCompletedParents = (change: (ids: string[]) => string[]) => {
        const next = change(completedParents);
        shared.setGoals((goals) =>
            goals.map((goal) =>
                goal.status === "Done" && !next.includes(goal.id)
                    ? { ...goal, status: "NotStarted" }
                    : goal,
            ),
        );
    };
    const [editor, setEditor] = useState<Editor | null>(null);
    const [prompt, setPrompt] = useState<Prompt | null>(null);
    const [archiveSeries, setArchiveSeries] = useState<number | null>(null);
    const [acknowledged, setAcknowledged] = useState(false);
    const [archiveFuture, setArchiveFuture] = useState(false);
    const [reopenMode, setReopenMode] = useState("clear");
    const [reopenDue, setReopenDue] = useState(demoToday);
    const [message, setMessage] = useState<Label | null>(null);
    const [messageTaskId, setMessageTaskId] = useState<number | null>(null);
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (shared.nav.section === "tasks" && shared.nav.task !== undefined) {
            setSelectedId(shared.nav.task);
            onReady();
        }
    }, [shared.nav.stamp]);

    const empty = state === "empty";
    const repeating = view === "repeating";
    const selected = tasks.find(
        (task) => task.id === selectedId && !task.archived,
    );
    const selectedPrompt =
        prompt && "id" in prompt && prompt.kind !== "end"
            ? tasks.find((task) => task.id === prompt.id)
            : undefined;
    const selectedSeries =
        prompt?.kind === "end"
            ? series.find((row) => row.id === prompt.id)
            : undefined;
    const common = (empty ? [] : tasks).filter(
        (task) =>
            !task.archived &&
            (!shared.live || !task.history) &&
            text(...task.title)
                .toLocaleLowerCase(locale)
                .includes(query.toLocaleLowerCase(locale)) &&
            (!tag || task.tags.includes(tag)) &&
            (status === "all" ||
                task.status === status),
    );
    const filtered = common
        .filter((task) =>
            matchesTaskView(task, view, shared.today, !!shared.live),
        )
        .sort(
            (a, b) =>
                Number(b.pinned) - Number(a.pinned) ||
                (sort === "importance"
                    ? b.importance - a.importance
                    : (
                          a.scheduledStart ||
                          (a.start ? `${a.start}T00:00` : "9999")
                      ).localeCompare(
                          b.scheduledStart ||
                              (b.start ? `${b.start}T00:00` : "9999"),
                      )),
        );
    const filteredSeries = (empty ? [] : series).filter(
        (row) =>
            !row.template.archived &&
            text(...row.template.title)
                .toLocaleLowerCase(locale)
                .includes(query.toLocaleLowerCase(locale)) &&
            (seriesState === "all" || row.state === seriesState),
    );
    const total = repeating ? filteredSeries.length : filtered.length;
    const pages = Math.max(1, Math.ceil(total / 5));
    const page = Math.min(pageIndex, pages - 1);
    const pageTasks = filtered.slice(page * 5, page * 5 + 5);
    const doneRows = pageTasks.filter((task) => task.status === "Done");
    const grouped = new Map<string, TaskRecord[]>();
    for (const task of pageTasks.filter((task) => task.status !== "Done")) {
        const key =
            group === "goal"
                ? parents.find((parent) => parent.id === task.parent)!.goal
                : group === "status"
                  ? task.status
                  : "none";
        grouped.set(key, [...(grouped.get(key) || []), task]);
    }
    useEffect(() => {
        const closeOutside = (event: PointerEvent) =>
            root.current
                ?.querySelectorAll<HTMLDetailsElement>(
                    ".preview-task-row-menu[open]",
                )
                .forEach((menu) => {
                    if (!menu.contains(event.target as Node)) menu.open = false;
                });
        const closeEscape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            root.current
                ?.querySelectorAll<HTMLDetailsElement>(
                    ".preview-task-row-menu[open]",
                )
                .forEach((menu) => {
                    menu.open = false;
                    menu.querySelector<HTMLElement>("summary")?.focus();
                });
        };
        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", closeEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            document.removeEventListener("keydown", closeEscape);
        };
    }, []);
    const update = (id: number, patch: Partial<TaskRecord>) =>
        setTasks((items) =>
            items.map((task) =>
                task.id === id ? { ...task, ...patch } : task,
            ),
        );
    const notify = (en: string, vi: string) => {
        if (shared.live) return;
        setMessage([en, vi]);
        setMessageTaskId(null);
    };
    const statusLabel = (value: string) => {
        const row = statuses.find(([key]) => key === value)!;
        return text(row[1], row[2]);
    };
    const openPrompt = (value: Prompt) => {
        setAcknowledged(false);
        setArchiveFuture(false);
        setReopenMode("clear");
        setReopenDue(demoToday);
        setPrompt(value);
    };
    const openEditor = (task?: TaskRecord) =>
        setEditor(
            task
                ? {
                      kind: "edit",
                      id: task.id,
                      draft: draftFromRecord(task, text),
                  }
                : {
                      kind: "create",
                      draft: {
                          ...blankDraft(),
                          rule: { ...blankDraft().rule, start: demoToday },
                      },
                  },
        );
    const openDetail = (id: number) => {
        setSelectedId(id);
        onReady();
    };
    const plan = (task: TaskRecord, period: "today" | "week") => {
        if (task.status === "Done") return;
        const target = { kind: "plan", period } as const;
        update(task.id, taskIsPicked(task, target) ? returnedTaskPatch(target) : pickedTaskPatch(task, target));
        notify(
            "Plan updated. Task dates and status stay the same.",
            "Đã cập nhật kế hoạch. Ngày và trạng thái công việc được giữ nguyên.",
        );
    };
    const transition = (task: TaskRecord) => {
        if (task.status === "Done") {
            if (
                (task.due && task.due < demoToday) ||
                completedParents.includes(
                    parents.find((parent) => parent.id === task.parent)!.goal,
                )
            )
                openPrompt({ kind: "reopen", id: task.id });
            else {
                update(task.id, { status: "NotStarted" });
                notify(
                    "Task reopened in this preview.",
                    "Đã mở lại công việc trong bản xem thử.",
                );
            }
        } else if (task.checklist.some((item) => !item.checked))
            openPrompt({ kind: "complete", id: task.id });
        else {
            update(task.id, { status: "Done" });
            notify(
                "Task completed. Checklist items were kept as they were.",
                "Đã hoàn thành công việc. Các mục kiểm tra được giữ nguyên.",
            );
        }
    };
    const info = (title: string, body: string) =>
        openPrompt({ kind: "info", title, body });
    const saveEditor = async (draft: TaskDraft) => {
        if (!editor) return;
        if (editor.kind === "series") {
            setSeries((items) =>
                items.map((row) =>
                    row.id === editor.id
                        ? {
                              ...row,
                              template: {
                                  ...updateFromDraft(row.template, draft),
                                  checklist: recordFromDraft(
                                      draft,
                                      row.template.id,
                                  ).checklist,
                              },
                              rule: draft.rule,
                          }
                        : row,
                ),
            );
            notify(
                "Repeating template saved in this preview. Existing Task examples are unchanged.",
                "Đã lưu mẫu lặp trong bản xem thử. Các công việc mẫu hiện có được giữ nguyên.",
            );
        } else if (editor.kind === "edit") {
            setTasks((items) =>
                items.map((task) =>
                    task.id === editor.id ? updateFromDraft(task, draft) : task,
                ),
            );
            notify(
                "Task changes saved in this preview.",
                "Đã lưu thay đổi công việc trong bản xem thử.",
            );
        } else if (draft.rule.frequency !== "none") {
            const id = Date.now();
            setSeries((items) => [
                ...items,
                {
                    id,
                    template: recordFromDraft(draft, id),
                    rule: draft.rule,
                    state: "active",
                },
            ]);
            setView("repeating");
            setSeriesState("all");
            setQuery("");
            setPageIndex(0);
            notify(
                "Repeating template created in this preview.",
                "Đã tạo mẫu công việc lặp lại trong bản xem thử.",
            );
        } else {
            const id = Date.now();
            setTasks((items) => [...items, recordFromDraft(draft, id)]);
            setView("all");
            setStatus("all");
            setQuery("");
            setTag("");
            setPageIndex(0);
            notify(
                "Task created in this preview.",
                "Đã tạo công việc trong bản xem thử.",
            );
            setMessageTaskId(id);
        }
        if (shared.live && !(await shared.live.flush())) return false;
        setEditor(null);
        if (!shared.live) onReady();
    };
    const row = (task: TaskRecord) => (
        <article
            className={`preview-full-task-row ${task.status === "Done" ? "is-complete" : ""} ${task.due && task.due < demoToday && task.status !== "Done" ? "is-overdue" : ""}`}
            key={task.id}
        >
            <button
                className="preview-task-tick"
                aria-label={
                    text(
                        task.status === "Done" ? "Reopen: " : "Complete: ",
                        task.status === "Done" ? "Mở lại: " : "Hoàn thành: ",
                    ) + text(...task.title)
                }
                aria-pressed={task.status === "Done"}
                onClick={() => transition(task)}
            >
                {task.status === "Done" && <Check size={18} />}
            </button>
            <div className="preview-full-task-copy">
                <button
                    className="preview-task-open"
                    onClick={() => openDetail(task.id)}
                >
                    {text(...task.title)}
                </button>
                <p>
                    {task.status === "Done" ? statusLabel(task.status)
                        : task.due ? `${text(task.due < demoToday ? "Overdue" : "Due", task.due < demoToday ? "Quá hạn" : "Hạn")} ${formatTaskDate(task.due, locale)}`
                        : task.scheduledStart ? `${text("Scheduled", "Theo lịch")} ${formatTaskDate(task.scheduledStart.slice(0, 10), locale)}`
                        : statusLabel(task.status)}
                </p>
                {task.parent && (
                    <small className="preview-task-parent">
                        {text(
                            ...parents.find(
                                (parent) => parent.id === task.parent,
                            )!.label,
                        )}
                    </small>
                )}
                {task.tags.length > 0 && (
                    <div className="preview-task-tag-list">
                        {task.tags.map((id) => (
                            <span key={id}>
                                #
                                {text(
                                    ...tagOptions.find((tag) => tag.id === id)!
                                        .label,
                                )}
                            </span>
                        ))}
                    </div>
                )}
            </div>
            <div className="preview-full-task-actions">
                <button
                    type="button"
                    className="button button-quiet preview-task-plan-action"
                    aria-pressed={task.weekly}
                    disabled={task.status === "Done"}
                    aria-label={text(task.weekly ? "Selected for this week: " : "Select for this week: ", task.weekly ? "Đã chọn cho tuần này: " : "Chọn cho tuần này: ") + text(...task.title)}
                    title={text(task.weekly ? "Remove from this week, including today's selection" : "Add to this week's plan", task.weekly ? "Bỏ khỏi tuần này, bao gồm lựa chọn hôm nay" : "Thêm vào kế hoạch tuần này")}
                    onClick={() => plan(task, "week")}
                >
                    <CalendarDays size={16} aria-hidden="true" />
                    {text("This week", "Tuần này")}
                    {task.weekly && <Check size={14} aria-hidden="true" />}
                </button>
                <button
                    type="button"
                    className="button button-quiet preview-task-plan-action"
                    aria-pressed={task.daily}
                    disabled={task.status === "Done"}
                    aria-label={text(task.daily ? "In today's plan: " : "Add for today: ", task.daily ? "Đã có trong hôm nay: " : "Thêm cho hôm nay: ") + text(...task.title)}
                    title={text(task.daily ? "Remove from today; keep the weekly selection" : "Add to today's plan", task.daily ? "Bỏ khỏi hôm nay, giữ lựa chọn trong tuần" : "Thêm vào kế hoạch hôm nay")}
                    onClick={() => plan(task, "today")}
                >
                    <Sun size={16} aria-hidden="true" />
                    {text("Today", "Hôm nay")}
                    {task.daily && <Check size={14} aria-hidden="true" />}
                </button>
                <div className="preview-task-row-importance">
                    <span>{text("Importance", "Mức quan trọng")} {task.importance}/5</span>
                    <Stars value={task.importance} text={text} labelSuffix={text(...task.title)}
                        onChange={importance => update(task.id, { importance })} />
                </div>
                <details
                    className="preview-task-row-menu"
                    onClick={(event) => {
                        if ((event.target as Element).closest("button"))
                            event.currentTarget.open = false;
                    }}
                >
                    <summary
                        className="button button-quiet preview-task-menu-trigger"
                        aria-label={text("More actions: ", "Thao tác khác: ") + text(...task.title)}
                    >
                        <MoreHorizontal size={16} aria-hidden="true" />
                        {text("Actions", "Thao tác")}
                    </summary>
                    <div className="preview-task-row-menu-panel">
                        <button onClick={() => openDetail(task.id)}>
                            {text("Open full page", "Mở trang đầy đủ")}
                        </button>
                        <button onClick={() => openEditor(task)}>
                            {text("Edit task", "Chỉnh sửa công việc")}
                        </button>
                        <button onClick={() => openEditor(task)}>
                            {text(
                                "Move to Goal or Milestone",
                                "Chuyển Mục tiêu hoặc Cột mốc",
                            )}
                        </button>
                        <button
                            onClick={() =>
                                update(task.id, { pinned: !task.pinned })
                            }
                        >
                            {text(
                                task.pinned ? "Unpin" : "Pin to top",
                                task.pinned ? "Bỏ ghim" : "Ghim lên đầu",
                            )}
                        </button>
                        {task.seriesId && (
                            <button
                                onClick={() => {
                                    const item = series.find(
                                        (row) => row.id === task.seriesId,
                                    )!;
                                    if (item.state === "ended") {
                                        setSelectedId(null);
                                        setView("repeating");
                                        setSeriesState("ended");
                                        setQuery("");
                                        return;
                                    }
                                    setEditor({
                                        kind: "series",
                                        id: item.id,
                                        draft: draftFromRecord(
                                            item.template,
                                            text,
                                            item.rule,
                                        ),
                                    });
                                }}
                            >
                                {text(
                                    series.some(
                                        (row) =>
                                            row.id === task.seriesId &&
                                            row.state === "ended",
                                    )
                                        ? "View ended series"
                                        : "Edit repeating template",
                                    series.some(
                                        (row) =>
                                            row.id === task.seriesId &&
                                            row.state === "ended",
                                    )
                                        ? "Xem chuỗi đã kết thúc"
                                        : "Sửa mẫu công việc lặp lại",
                                )}
                            </button>
                        )}
                        <button
                            className="is-danger"
                            onClick={() =>
                                openPrompt({ kind: "archive", id: task.id })
                            }
                        >
                            {text("Archive task", "Lưu trữ công việc")}
                        </button>
                    </div>
                </details>
            </div>
        </article>
    );
    return (
        <div className="preview-tasks" ref={root}>
            {selected ? (
                <TaskPreviewDetail
                    key={selected.id}
                    task={selected}
                    locale={locale}
                    text={text}
                    onUpdate={(patch) => update(selected.id, patch)}
                    onBack={() => {
                        setSelectedId(null);
                        setMessage(null);
                    }}
                    onEdit={() => openEditor(selected)}
                    onTransition={() => transition(selected)}
                    onPlan={(period) => plan(selected, period)}
                />
            ) : (
                <>
                    <PageHeaderFrame className="preview-tasks-header">
                        <div>
                            <h1>{text("Tasks", "Công việc")}</h1>
                            <p>
                                {text(
                                    "A place for the next step, and the steps after that.",
                                    "Nơi dành cho bước tiếp theo và những bước sau đó.",
                                )}
                            </p>
                        </div>
                    </PageHeaderFrame>
                    <FloatingActions
                        label={text("Page actions", "Thao tác trang")}
                        closeLabel={text("Close actions", "Đóng thao tác")}
                    >
                        <button
                            className="button button-quiet"
                            onClick={() => onNavigate("history")}
                        >
                            {text("Task history", "Lịch sử công việc")}
                        </button>

                        <button
                            className="button button-primary"
                            onClick={() => openEditor()}
                        >
                            <Plus size={18} />
                            {text("New task", "Công việc mới")}
                        </button>
                    </FloatingActions>
                    <section className="planning-panel preview-task-collection">
                        <div
                            className="task-view-menu preview-task-views"
                            role="group"
                            aria-label={text(
                                "Task time filters",
                                "Lọc thời gian công việc",
                            )}
                        >
                            {views.map(([key, en, vi]) => (
                                <button
                                    key={key}
                                    aria-pressed={view === key}
                                    onClick={() => {
                                        setView(key);
                                        setMessage(null);
                                        setPageIndex(0);
                                    }}
                                >
                                    {text(en, vi)}
                                    <span className="count-badge">
                                        {key === "repeating"
                                            ? filteredSeries.length
                                            : common.filter((task) =>
                                                  matchesTaskView(
                                                      task,
                                                      key,
                                                      shared.today,
                                                      !!shared.live,
                                                  ),
                                              ).length}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <button className="button button-quiet task-series-navigation"
                            aria-pressed={repeating}
                            onClick={() => { setView(repeating ? "all" : "repeating"); setPageIndex(0); setMessage(null); }}>
                            <Repeat2 size={16} aria-hidden="true" />
                            {text(repeating ? "Back to tasks" : "Repeating series", repeating ? "Về công việc" : "Chuỗi lặp")}
                        </button>
                        <CollectionToolbar className={`preview-task-filters ${repeating ? "is-repeating" : ""}`}
                            label={text("Find tasks", "Tìm công việc")} filtersLabel={text("Filters and sorting", "Lọc và sắp xếp")}
                            search={<label className="field">
                                {text("Find a task", "Tìm công việc")}
                                <input
                                    type="search"
                                    value={query}
                                    onChange={(event) => {
                                        setQuery(event.target.value);
                                        setPageIndex(0);
                                    }}
                                    placeholder={text(
                                        "Search by task name",
                                        "Tìm theo tên công việc",
                                    )}
                                />
                            </label>}>

                            {repeating ? (
                                <label className="field">
                                    {text("Series state", "Trạng thái chuỗi")}
                                    <select
                                        value={seriesState}
                                        onChange={(event) => {
                                            setSeriesState(event.target.value);
                                            setPageIndex(0);
                                        }}
                                    >
                                        <option value="all">
                                            {text(
                                                "All states",
                                                "Tất cả trạng thái",
                                            )}
                                        </option>
                                        {seriesStates.map(([key, en, vi]) => (
                                            <option value={key} key={key}>
                                                {text(en, vi)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <>
                                    <label className="field">
                                        {text("Status", "Trạng thái")}
                                        <select
                                            value={status}
                                            onChange={(event) => {
                                                setStatus(event.target.value);
                                                setPageIndex(0);
                                            }}
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
                                        {text("Sort", "Sắp xếp")}
                                        <select
                                            value={sort}
                                            onChange={(event) => {
                                                setSort(event.target.value);
                                                setPageIndex(0);
                                            }}
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
                                    <label className="field">
                                        {text("Group by", "Nhóm theo")}
                                        <select
                                            value={group}
                                            onChange={(event) =>
                                                setGroup(event.target.value)
                                            }
                                        >
                                            <option value="goal">
                                                {text("Goal", "Mục tiêu")}
                                            </option>
                                            <option value="status">
                                                {text("Status", "Trạng thái")}
                                            </option>
                                            <option value="none">
                                                {text("None", "Không nhóm")}
                                            </option>
                                        </select>
                                    </label>
                                </>
                            )}
                                                </CollectionToolbar>
                        {!repeating && (
                            <details className="preview-task-extra-filters">
                                <summary>
                                    {text("More filters", "Bộ lọc khác")}
                                </summary>
                                <label className="field">
                                    {text("Tag", "Nhãn")}
                                    <select
                                        value={tag}
                                        onChange={(event) => {
                                            setTag(event.target.value);
                                            setPageIndex(0);
                                        }}
                                    >
                                        <option value="">
                                            {text("All tags", "Tất cả nhãn")}
                                        </option>
                                        {tagOptions.map((item) => (
                                            <option
                                                value={item.id}
                                                key={item.id}
                                            >
                                                {text(...item.label)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </details>
                        )}
                        {state === "loading" ? (
                            <div className="preview-state" role="status">
                                <RefreshCw size={26} className="preview-spin" />
                                <p>
                                    {text(
                                        "Loading tasks…",
                                        "Đang tải công việc…",
                                    )}
                                </p>
                            </div>
                        ) : state === "error" ? (
                            <div className="preview-state" role="alert">
                                <CircleHelp size={28} />
                                <h2>
                                    {text(
                                        "Tasks could not be loaded",
                                        "Chưa tải được công việc",
                                    )}
                                </h2>
                                <p>
                                    {text(
                                        "Try again to see your task list.",
                                        "Thử tải lại để xem danh sách công việc.",
                                    )}
                                </p>
                                <button
                                    className="button button-primary"
                                    onClick={onReady}
                                >
                                    {text("Try again", "Thử lại")}
                                </button>
                            </div>
                        ) : total === 0 ? (
                            <div className="preview-state">
                                <ClipboardList size={30} />
                                <h2>
                                    {text(
                                        repeating
                                            ? "No repeating tasks here yet"
                                            : "A little room to focus",
                                        repeating
                                            ? "Chưa có công việc lặp lại phù hợp"
                                            : "Một chút không gian để tập trung",
                                    )}
                                </h2>
                                <p>
                                    {text(
                                        "Try another filter or create a small next step.",
                                        "Thử bộ lọc khác hoặc tạo một bước tiếp theo nhỏ.",
                                    )}
                                </p>
                                <div className="action-row">
                                    <button
                                        className="button button-quiet"
                                        onClick={() => {
                                            setQuery("");
                                            setStatus("all");
                                            setTag("");
                                            setSeriesState("all");
                                            setView(
                                                repeating ? "repeating" : "all",
                                            );
                                        }}
                                    >
                                        {text("Clear filters", "Bỏ bộ lọc")}
                                    </button>
                                    <button
                                        className="button button-primary"
                                        onClick={() => {
                                            const draft = blankDraft();
                                            if (repeating)
                                                draft.rule.frequency = "weekly";
                                            setEditor({
                                                kind: "create",
                                                draft,
                                            });
                                        }}
                                    >
                                        <Plus size={16} />
                                        {text(
                                            repeating
                                                ? "New series"
                                                : "New task",
                                            repeating
                                                ? "Chuỗi lặp mới"
                                                : "Công việc mới",
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : repeating ? (
                            <div className="preview-series-list">
                                {filteredSeries
                                    .slice(page * 5, page * 5 + 5)
                                    .map((item) => {
                                        const stateLabel = seriesStates.find(
                                            ([key]) => key === item.state,
                                        )!;
                                        const frequency = frequencies.find(
                                            ([key]) =>
                                                key === item.rule.frequency,
                                        )!;
                                        return (
                                            <article
                                                key={item.id}
                                                className="preview-series-card"
                                            >
                                                <div>
                                                    <h2>
                                                        <Repeat2 size={18} />
                                                        {text(
                                                            ...item.template
                                                                .title,
                                                        )}
                                                    </h2>
                                                    <span
                                                        className={`preview-series-state is-${item.state}`}
                                                    >
                                                        {text(
                                                            stateLabel[1],
                                                            stateLabel[2],
                                                        )}
                                                    </span>
                                                    <p>
                                                        {text(
                                                            frequency[1],
                                                            frequency[2],
                                                        )}
                                                    </p>
                                                    <p className="subtle-copy">
                                                        {text(
                                                            ...parents.find(
                                                                (parent) =>
                                                                    parent.id ===
                                                                    item
                                                                        .template
                                                                        .parent,
                                                            )!.label,
                                                        )}
                                                    </p>
                                                    <div
                                                        className="preview-series-dates"
                                                        aria-label={text(
                                                            "Rule date preview",
                                                            "Xem trước ngày theo quy tắc",
                                                        )}
                                                    >
                                                        {nextDates(item.rule)
                                                            .slice(0, 4)
                                                            .map((date) => (
                                                                <span
                                                                    className="context-chip"
                                                                    key={date}
                                                                >
                                                                    {formatTaskDate(
                                                                        date,
                                                                        locale,
                                                                    )}
                                                                </span>
                                                            ))}
                                                    </div>
                                                </div>
                                                <div className="action-row">
                                                    <button className="button button-quiet"
                                                        onClick={() => setArchiveSeries(item.id)}>
                                                        {text("Archive series", "Lưu trữ chuỗi")}
                                                    </button>
                                                    {item.state !== "ended" ? (
                                                        <>
                                                            <button
                                                                className="button button-quiet"
                                                                onClick={() =>
                                                                    setEditor({
                                                                        kind: "series",
                                                                        id: item.id,
                                                                        draft: draftFromRecord(
                                                                            item.template,
                                                                            text,
                                                                            item.rule,
                                                                        ),
                                                                    })
                                                                }
                                                            >
                                                                <Pencil
                                                                    size={15}
                                                                />
                                                                {text(
                                                                    "Edit",
                                                                    "Sửa",
                                                                )}
                                                            </button>
                                                            <button
                                                                className="button button-quiet"
                                                                onClick={() => {
                                                                    setSeries(
                                                                        (
                                                                            items,
                                                                        ) =>
                                                                            items.map(
                                                                                (
                                                                                    row,
                                                                                ) =>
                                                                                    row.id ===
                                                                                    item.id
                                                                                        ? {
                                                                                              ...row,
                                                                                              state:
                                                                                                  row.state ===
                                                                                                  "active"
                                                                                                      ? "paused"
                                                                                                      : "active",
                                                                                          }
                                                                                        : row,
                                                                            ),
                                                                    );
                                                                    notify(
                                                                        "Series state updated. Existing Task examples are preserved.",
                                                                        "Đã đổi trạng thái chuỗi. Các công việc mẫu hiện có được giữ nguyên.",
                                                                    );
                                                                }}
                                                            >
                                                                {text(
                                                                    item.state ===
                                                                        "active"
                                                                        ? "Pause"
                                                                        : "Resume",
                                                                    item.state ===
                                                                        "active"
                                                                        ? "Tạm dừng"
                                                                        : "Tiếp tục",
                                                                )}
                                                            </button>
                                                            <button
                                                                className="button button-danger-quiet"
                                                                onClick={() =>
                                                                    openPrompt({
                                                                        kind: "end",
                                                                        id: item.id,
                                                                    })
                                                                }
                                                            >
                                                                {text(
                                                                    "End series",
                                                                    "Kết thúc chuỗi",
                                                                )}
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            className="button button-quiet"
                                                            onClick={() => {
                                                                const draft =
                                                                    draftFromRecord(
                                                                        item.template,
                                                                        text,
                                                                        {
                                                                            ...item.rule,
                                                                            start: demoToday,
                                                                            end: "",
                                                                        },
                                                                    );
                                                                setEditor({
                                                                    kind: "create",
                                                                    draft,
                                                                });
                                                            }}
                                                        >
                                                            <Plus size={15} />
                                                            {text(
                                                                "Start a new series",
                                                                "Tạo chuỗi mới",
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </article>
                                        );
                                    })}
                            </div>
                        ) : (
                            <div className="preview-task-groups">
                                {[...grouped].map(([key, items]) => (
                                    <section
                                        key={key}
                                        className="preview-task-group"
                                    >
                                        {key !== "none" && (
                                            <div className="section-heading">
                                                <button
                                                    className="preview-task-group-heading"
                                                    aria-expanded={
                                                        !collapsed.includes(key)
                                                    }
                                                    onClick={() =>
                                                        setCollapsed(
                                                            (values) =>
                                                                values.includes(
                                                                    key,
                                                                )
                                                                    ? values.filter(
                                                                          (
                                                                              value,
                                                                          ) =>
                                                                              value !==
                                                                              key,
                                                                      )
                                                                    : [
                                                                          ...values,
                                                                          key,
                                                                      ],
                                                        )
                                                    }
                                                >
                                                    <ChevronDown
                                                        size={17}
                                                        className={
                                                            collapsed.includes(
                                                                key,
                                                            )
                                                                ? "is-collapsed"
                                                                : ""
                                                        }
                                                    />
                                                    {group === "goal"
                                                        ? text(
                                                              ...parents.find(
                                                                  (parent) =>
                                                                      parent.id ===
                                                                          key ||
                                                                      (key ===
                                                                          "inbox" &&
                                                                          !parent.id),
                                                              )!.label,
                                                          )
                                                        : statusLabel(key)}
                                                    <span className="count-badge">
                                                        {items.length}
                                                    </span>
                                                </button>
                                                {group === "goal" &&
                                                    key !== "inbox" && (
                                                        <button
                                                            className="text-button"
                                                            onClick={() =>
                                                                onNavigate(
                                                                    "goals",
                                                                )
                                                            }
                                                        >
                                                            {text(
                                                                "Open roadmap",
                                                                "Mở lộ trình",
                                                            )}{" "}
                                                            →
                                                        </button>
                                                    )}
                                            </div>
                                        )}
                                        {!collapsed.includes(key) &&
                                            items.map(row)}
                                    </section>
                                ))}
                                {doneRows.length > 0 && (
                                    <details
                                        className="preview-task-completed"
                                        open={status === "Done" || undefined}
                                    >
                                        <summary>
                                            {text("Completed", "Đã hoàn thành")}{" "}
                                            ({doneRows.length})
                                        </summary>
                                        {doneRows.map(row)}
                                    </details>
                                )}
                            </div>
                        )}
                        {state !== "loading" &&
                            state !== "error" &&
                            total > 0 && (
                                <nav
                                    className="preview-task-pagination"
                                    aria-label={text(
                                        "Task pages",
                                        "Trang công việc",
                                    )}
                                >
                                    <span>
                                        {page * 5 + 1}–
                                        {Math.min((page + 1) * 5, total)} /{" "}
                                        {total}
                                    </span>
                                    <button
                                        className="icon-button"
                                        disabled={page === 0}
                                        aria-label={text(
                                            "Previous page",
                                            "Trang trước",
                                        )}
                                        onClick={() => setPageIndex(page - 1)}
                                    >
                                        <ChevronLeft size={18} />
                                    </button>
                                    <span>
                                        {page + 1} / {pages}
                                    </span>
                                    <button
                                        className="icon-button"
                                        disabled={page + 1 >= pages}
                                        aria-label={text(
                                            "Next page",
                                            "Trang sau",
                                        )}
                                        onClick={() => setPageIndex(page + 1)}
                                    >
                                        <ChevronRight size={18} />
                                    </button>
                                </nav>
                            )}
                    </section>
                </>
            )}
            <div className="preview-task-feedback" role="status">
                {message && (
                    <div className="notice">
                        <Check size={17} />
                        <span>{text(...message)}</span>
                        {messageTaskId && (
                            <button
                                className="text-button"
                                onClick={() => openDetail(messageTaskId)}
                            >
                                {text("Open task", "Mở công việc")}
                            </button>
                        )}
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
            {editor && (
                <TaskPreviewEditor
                    initial={editor.draft}
                    mode={editor.kind}
                    locale={locale}
                    text={text}
                    completedParents={completedParents}
                    onClose={() => setEditor(null)}
                    onSave={saveEditor}
                />
            )}
            {archiveSeries !== null && (
                <Confirm text={text} title={text("Archive this repeating series?", "Lưu trữ chuỗi lặp này?")}
                    onClose={() => setArchiveSeries(null)}
                    onConfirm={async () => {
                        const saved = await shared.archiveEntity("task-series", String(archiveSeries), false);
                        if (saved === false) throw new Error(text("Could not archive. Try again.", "Chưa lưu trữ được. Hãy thử lại."));
                        setArchiveSeries(null);
                    }}>
                    <p>{text("Existing Tasks stay available. Restore the series from Archive.", "Các công việc hiện có vẫn được giữ. Khôi phục chuỗi từ Lưu trữ.")}</p>
                </Confirm>
            )}
            {prompt && (
                <Dialog
                    title={
                        prompt.kind === "info"
                            ? prompt.title
                            : text(
                                  prompt.kind === "complete"
                                      ? "Complete with unchecked items?"
                                      : prompt.kind === "reopen"
                                        ? "Reopen this task?"
                                        : prompt.kind === "end"
                                          ? "End this repeating series?"
                                          : "Archive this task?",
                                  prompt.kind === "complete"
                                      ? "Hoàn thành khi còn mục chưa đánh dấu?"
                                      : prompt.kind === "reopen"
                                        ? "Mở lại công việc này?"
                                        : prompt.kind === "end"
                                          ? "Kết thúc chuỗi lặp này?"
                                          : "Lưu trữ công việc này?",
                              )
                    }
                    closeLabel={text("Close", "Đóng")}
                    className="preview-dialog preview-confirm"
                    onClose={() => setPrompt(null)}
                >
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (shared.live && acknowledged)
                                shared.live.acknowledge([
                                    prompt.kind === "reopen"
                                        ? "reopen_parents"
                                        : "unchecked",
                                ]);
                            if (
                                prompt.kind === "complete" &&
                                selectedPrompt &&
                                acknowledged
                            ) {
                                update(selectedPrompt.id, { status: "Done" });
                                notify(
                                    "Task completed. Unchecked items remain unchecked.",
                                    "Đã hoàn thành công việc. Các mục chưa đánh dấu vẫn được giữ nguyên.",
                                );
                            } else if (
                                prompt.kind === "reopen" &&
                                selectedPrompt
                            ) {
                                const parent = parents.find(
                                    (row) => row.id === selectedPrompt.parent,
                                )!;
                                if (
                                    completedParents.includes(parent.goal) &&
                                    !acknowledged
                                )
                                    return;
                                update(selectedPrompt.id, {
                                    status: "NotStarted",
                                    due:
                                        selectedPrompt.due &&
                                        selectedPrompt.due < demoToday
                                            ? reopenMode === "clear"
                                                ? ""
                                                : reopenDue
                                            : selectedPrompt.due,
                                });
                                setCompletedParents((items) =>
                                    items.filter((id) => id !== parent.goal),
                                );
                                notify(
                                    "Task reopened in this preview.",
                                    "Đã mở lại công việc trong bản xem thử.",
                                );
                            } else if (
                                prompt.kind === "archive" &&
                                selectedPrompt
                            ) {
                                update(selectedPrompt.id, { archived: true });
                                if (selectedId === selectedPrompt.id)
                                    setSelectedId(null);
                                notify(
                                    "Task archived in this preview. Reload restores the samples.",
                                    "Đã lưu trữ công việc trong bản xem thử. Tải lại trang để khôi phục mẫu.",
                                );
                            } else if (
                                prompt.kind === "end" &&
                                selectedSeries
                            ) {
                                setSeries((items) =>
                                    items.map((item) =>
                                        item.id === selectedSeries.id
                                            ? { ...item, state: "ended" }
                                            : item,
                                    ),
                                );
                                if (archiveFuture)
                                    setTasks((items) =>
                                        items.map((task) =>
                                            task.seriesId ===
                                                selectedSeries.id &&
                                            task.status === "NotStarted" &&
                                            (task.start || task.due) > demoToday
                                                ? { ...task, archived: true }
                                                : task,
                                        ),
                                    );
                                notify(
                                    "Series ended. Started and completed Tasks are preserved.",
                                    "Đã kết thúc chuỗi. Công việc đang làm và đã hoàn thành được giữ nguyên.",
                                );
                            }
                            setPrompt(null);
                        }}
                    >
                        <div className="preview-dialog-body stack-form">
                            {prompt.kind === "info" ? (
                                <p>{prompt.body}</p>
                            ) : (
                                <>
                                    <p>
                                        <strong>
                                            {selectedPrompt
                                                ? text(...selectedPrompt.title)
                                                : selectedSeries
                                                  ? text(
                                                        ...selectedSeries
                                                            .template.title,
                                                    )
                                                  : ""}
                                        </strong>
                                    </p>
                                    {prompt.kind === "complete" &&
                                        selectedPrompt && (
                                            <>
                                                <p>
                                                    {
                                                        selectedPrompt.checklist.filter(
                                                            (item) =>
                                                                !item.checked,
                                                        ).length
                                                    }{" "}
                                                    {text(
                                                        "checklist items are still unchecked. Completing the task will not check them automatically.",
                                                        "mục kiểm tra chưa được đánh dấu. Hoàn thành công việc không tự đánh dấu các mục này.",
                                                    )}
                                                </p>
                                                <label className="preview-task-ack">
                                                    <input
                                                        type="checkbox"
                                                        checked={acknowledged}
                                                        onChange={(event) =>
                                                            setAcknowledged(
                                                                event.target
                                                                    .checked,
                                                            )
                                                        }
                                                    />
                                                    {text(
                                                        "I want to complete the task with these items unchecked.",
                                                        "Tôi muốn hoàn thành công việc dù còn các mục chưa đánh dấu.",
                                                    )}
                                                </label>
                                            </>
                                        )}
                                    {prompt.kind === "reopen" &&
                                        selectedPrompt && (
                                            <>
                                                {selectedPrompt.due &&
                                                    selectedPrompt.due <
                                                        demoToday && (
                                                        <>
                                                            <p>
                                                                {text(
                                                                    "The old due date is in the past. Clear it or choose a new date before reopening.",
                                                                    "Hạn cũ đã qua. Bỏ hạn hoặc chọn ngày mới trước khi mở lại.",
                                                                )}
                                                            </p>
                                                            <label className="preview-task-ack">
                                                                <input
                                                                    type="radio"
                                                                    name="reopen-date"
                                                                    checked={
                                                                        reopenMode ===
                                                                        "clear"
                                                                    }
                                                                    onChange={() =>
                                                                        setReopenMode(
                                                                            "clear",
                                                                        )
                                                                    }
                                                                />
                                                                {text(
                                                                    "Clear the old due date",
                                                                    "Bỏ hạn cũ",
                                                                )}
                                                            </label>
                                                            <label className="preview-task-ack">
                                                                <input
                                                                    type="radio"
                                                                    name="reopen-date"
                                                                    checked={
                                                                        reopenMode ===
                                                                        "date"
                                                                    }
                                                                    onChange={() =>
                                                                        setReopenMode(
                                                                            "date",
                                                                        )
                                                                    }
                                                                />
                                                                {text(
                                                                    "Choose a new due date",
                                                                    "Chọn hạn mới",
                                                                )}
                                                            </label>
                                                            {reopenMode ===
                                                                "date" && (
                                                                <label className="field">
                                                                    {text(
                                                                        "New due date",
                                                                        "Hạn mới",
                                                                    )}
                                                                    <input
                                                                        type="date"
                                                                        min={
                                                                            demoToday
                                                                        }
                                                                        required
                                                                        value={
                                                                            reopenDue
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setReopenDue(
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                    />
                                                                </label>
                                                            )}
                                                        </>
                                                    )}
                                                {completedParents.includes(
                                                    parents.find(
                                                        (row) =>
                                                            row.id ===
                                                            selectedPrompt.parent,
                                                    )!.goal,
                                                ) && (
                                                    <label className="preview-task-ack">
                                                        <input
                                                            type="checkbox"
                                                            required
                                                            checked={
                                                                acknowledged
                                                            }
                                                            onChange={(event) =>
                                                                setAcknowledged(
                                                                    event.target
                                                                        .checked,
                                                                )
                                                            }
                                                        />
                                                        {text(
                                                            "Reopen the completed parent Goal together with this task.",
                                                            "Cùng mở lại mục tiêu cha đã hoàn thành với công việc này.",
                                                        )}
                                                    </label>
                                                )}
                                            </>
                                        )}
                                    {prompt.kind === "end" && (
                                        <>
                                            <p>
                                                {text(
                                                    "Ending is permanent for this series. To repeat again later, create a new series. Started and completed Tasks stay available.",
                                                    "Kết thúc là trạng thái cuối của chuỗi này. Muốn lặp lại về sau, hãy tạo chuỗi mới. Công việc đang làm và đã hoàn thành được giữ lại.",
                                                )}
                                            </p>
                                            <label className="preview-task-ack">
                                                <input
                                                    type="checkbox"
                                                    checked={archiveFuture}
                                                    onChange={(event) =>
                                                        setArchiveFuture(
                                                            event.target
                                                                .checked,
                                                        )
                                                    }
                                                />
                                                {text(
                                                    "Also archive future occurrences that have not started.",
                                                    "Đồng thời lưu trữ các lần lặp trong tương lai chưa bắt đầu.",
                                                )}
                                            </label>
                                        </>
                                    )}
                                    {prompt.kind === "archive" && (
                                        <p>
                                            {text(
                                                shared.live
                                                    ? "The Task moves to Archive. Restore it from Settings when needed."
                                                    : "The task will leave this sample list. Reload the page to restore the fixture.",
                                                shared.live
                                                    ? "Công việc được chuyển vào Lưu trữ. Bạn có thể khôi phục trong Cài đặt."
                                                    : "Công việc sẽ được bỏ khỏi danh sách mẫu. Tải lại trang để khôi phục dữ liệu minh họa.",
                                            )}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <footer className="preview-dialog-footer">
                            {prompt.kind !== "info" && (
                                <button
                                    type="button"
                                    className="button button-quiet"
                                    onClick={() => setPrompt(null)}
                                >
                                    {text("Cancel", "Hủy")}
                                </button>
                            )}
                            <button
                                className={`button ${prompt.kind === "end" ? "button-danger" : "button-primary"}`}
                                disabled={
                                    prompt.kind === "complete" && !acknowledged
                                }
                            >
                                {text(
                                    prompt.kind === "info"
                                        ? "Close"
                                        : prompt.kind === "complete"
                                          ? "Complete task"
                                          : prompt.kind === "reopen"
                                            ? "Reopen task"
                                            : prompt.kind === "end"
                                              ? "End series"
                                              : "Archive task",
                                    prompt.kind === "info"
                                        ? "Đóng"
                                        : prompt.kind === "complete"
                                          ? "Hoàn thành công việc"
                                          : prompt.kind === "reopen"
                                            ? "Mở lại công việc"
                                            : prompt.kind === "end"
                                              ? "Kết thúc chuỗi"
                                              : "Lưu trữ công việc",
                                )}
                            </button>
                        </footer>
                    </form>
                </Dialog>
            )}
        </div>
    );
}
