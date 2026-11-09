"use client";
import { TASK_RETURN_MIME } from "@/lib/task-picker";
import { PageHeaderFrame, PageActionBar } from "../ui/layout";
import FloatingActions from "../floating-actions";
import { TaskDropZone, useTaskPicker } from "../task-picker";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Check,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Pencil,
    Pin,
    Plus,
    Settings2,
} from "lucide-react";
import Dialog from "../dialog";
import { createPortal } from "react-dom";
import { statuses, planningStatuses } from "./dashboard-data";
import {
    usePreviewData,
    dateLabel,
    goalProgress,
    label,
    palette,
    type Area,
    type Goal,
    type Milestone,
} from "./workspace-data";
import {
    BaselineIcon,
    Confirm,
    EntityIcon,
    Field,
    FormDialog,
    Header,
    IconPicker,
    Panel,
    Stars,
    Tabs,
} from "./ui";
import type { Text } from "./shared";

// The editor reads optional fields from one of the three planning records.
type EditablePlanning = Area & {
    related?: string[];
    parent?: string;
    prerequisites?: string[];
    area?: string;
    goal?: string;
    description?: Goal["description"];
    outcome?: Goal["outcome"];
    start?: string;
    due?: string;
    criteria?: string | Goal["criteria"];
};

type Editing = {
    kind: "area" | "goal" | "milestone";
    id?: string;
    area?: string;
    parent?: string;
    goal?: string;
};
export default function PlanningPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const taskPicker = useTaskPicker();
    const { goals, milestones, tasks, areas } = db;
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (db.planningAction) {
            if (
                db.planningAction.view &&
                db.planningAction.kind === "milestone" &&
                db.planningAction.id
            ) {
                setSelectedMilestone(db.planningAction.id);
                setMilestoneTab("tasks");
            } else open(db.planningAction);
            db.setPlanningAction(null);
        }
    }, [db.planningAction]);
    const [view, setView] = useState("tree");
    const [expanded, setExpanded] = useState<string[]>([]);
    const [expandedAreas, setExpandedAreas] = useState<string[]>([]);
    const [relatedKind, setRelatedKind] = useState("child_goals");
    const [manage, setManage] = useState(false);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [icon, setIcon] = useState("target");
    const [color, setColor] = useState(palette[0]);
    const [importance, setImportance] = useState(3);
    const [parent, setParent] = useState("");
    const [prerequisites, setPrerequisites] = useState<string[]>([]);
    const [relatedGoals, setRelatedGoals] = useState<string[]>([]);
    const [error, setError] = useState("");
    const [infoTab, setInfoTab] = useState("");
    const [strategyDrafts, setStrategyDrafts] = useState<
        Record<string, string>
    >({});
    const [conflict, setConflict] = useState(false);
    const selectedMilestone = db.nav.milestone || "";
    function setSelectedMilestone(id: string) {
        const milestone = milestones.find((row) => row.id === id);
        if (milestone)
            db.navigate("goals", { goal: milestone.goal, milestone: id });
        else if (db.nav.milestone) db.navigate("goals", { goal: db.nav.goal });
    }
    const [milestoneTab, setMilestoneTab] = useState("tasks");
    const [page, setPage] = useState(0);
    const [confirmation, setConfirmation] = useState<{
        kind: "archive" | "complete" | "leave";
        type: "goal" | "milestone";
        id: string;
        target?: string;
    } | null>(null);
    const [ack, setAck] = useState(false);
    const selected = goals.find(
        (goal) => goal.id === db.nav.goal && !goal.archived,
    );
    const focus = goals.find((goal) => goal.id === db.focus && !goal.archived);
    const ms = milestones.find(
        (row) => row.id === selectedMilestone && !row.archived,
    );
    const activeAreas = areas.filter((area) => !area.archived);
    const current: EditablePlanning | undefined =
        editing?.kind === "goal"
            ? goals.find((row) => row.id === editing.id)
            : editing?.kind === "milestone"
              ? milestones.find((row) => row.id === editing.id)
              : areas.find((row) => row.id === editing?.id);
    useEffect(() => {
        setPage(0);
        setInfoTab("");
        setConflict(false);
    }, [db.nav.goal]);
    const progress = (goal: Goal) =>
        goalProgress(goal.id, goals, milestones, tasks);
    const status = (value: string) => {
        const row = planningStatuses.find(([key]) => key === value)!;
        return text(row[1], row[2]);
    };
    function open(edit: Editing) {
        const value: EditablePlanning | undefined =
            edit.kind === "goal"
                ? goals.find((row) => row.id === edit.id)
                : edit.kind === "milestone"
                  ? milestones.find((row) => row.id === edit.id)
                  : areas.find((row) => row.id === edit.id);
        setEditing(edit);
        setIcon(
            value?.icon ||
                (edit.kind === "milestone"
                    ? "flag"
                    : edit.kind === "area"
                      ? "leaf"
                      : "target"),
        );
        setColor(value?.color || palette[0]);
        setImportance(value?.importance || 3);
        setParent(
            edit.parent ||
                (value && "parent" in value ? value.parent : "") ||
                "",
        );
        setPrerequisites(value?.prerequisites || []);
        setRelatedGoals(value?.related || []);
        setError("");
        setManage(false);
    }
    function cycle(candidate: string, id: string) {
        const visited = new Set<string>([id]);
        let cursor = goals.find((row) => row.id === candidate);
        while (cursor) {
            if (visited.has(cursor.id)) return true;
            visited.add(cursor.id);
            cursor = goals.find((row) => row.id === cursor!.parent);
        }
        return false;
    }
    function prerequisiteCycle(
        candidate: string,
        id: string,
        visited = new Set<string>(),
    ): boolean {
        if (candidate === id) return true;
        if (visited.has(candidate)) return false;
        visited.add(candidate);
        return (
            milestones
                .find((row) => row.id === candidate)
                ?.prerequisites.some((parent) =>
                    prerequisiteCycle(parent, id, visited),
                ) || false
        );
    }
    async function save(form: HTMLFormElement) {
        if (!editing) return;
        const fields = new FormData(form),
            title = String(fields.get("title") || "").trim();
        if (!title) return false;
        const id = editing.id || `${editing.kind}-${Date.now()}`;
        if (editing.kind === "area") {
            if (
                areas.some(
                    (area) =>
                        area.id !== id &&
                        text(...area.title).trim().replace(/\s+/g, " ").toLowerCase() ===
                            title.trim().replace(/\s+/g, " ").toLowerCase(),
                )
            ) {
                setError(
                    text(
                        "Area names must be unique, including archived Areas.",
                        "Tên lĩnh vực phải duy nhất, kể cả lĩnh vực đã lưu trữ.",
                    ),
                );
                return false;
            }
            if (!editing.id && activeAreas.length >= 4) return false;
            const record: Area = {
                id,
                title: label(title),
                importance,
                icon,
                color,
                archived: false,
            };
            db.setAreas((rows) =>
                editing.id
                    ? rows.map((row) => (row.id === id ? record : row))
                    : [...rows, record],
            );
        } else if (editing.kind === "goal") {
            if (parent && cycle(parent, id)) {
                setError(
                    text(
                        "A Goal cannot be moved under itself or its descendants.",
                        "Không thể chuyển mục tiêu vào chính nó hoặc mục tiêu con.",
                    ),
                );
                return false;
            }
            const start = String(fields.get("start") || ""),
                due = String(fields.get("due") || "");
            if (start && due && due < start) {
                setError(
                    text(
                        "The due date must follow the start.",
                        "Hạn hoàn thành phải từ ngày bắt đầu trở đi.",
                    ),
                );
                return false;
            }
            const old = goals.find((row) => row.id === id);
            const record: Goal = {
                id,
                title: label(title),
                area: parent
                    ? goals.find((row) => row.id === parent)!.area
                    : String(
                          fields.get("area") ||
                              editing.area ||
                              activeAreas[0]?.id ||
                              "",
                      ),
                parent,
                status: old?.status || "NotStarted",
                importance,
                icon,
                color,
                start,
                due,
                description: label(String(fields.get("description") || "")),
                outcome: label(String(fields.get("outcome") || "")),
                criteria: label(String(fields.get("criteria") || "")),
                strategy: old?.strategy || "",
                related: relatedGoals,
                archived: false,
            };
            db.setGoals((rows) => {
                const descendants = new Set([id]);
                for (let changed = true; changed; ) {
                    changed = false;
                    for (const row of rows)
                        if (
                            descendants.has(row.parent) &&
                            !descendants.has(row.id)
                        ) {
                            descendants.add(row.id);
                            changed = true;
                        }
                }
                return editing.id
                    ? rows.map((row) =>
                          row.id === id
                              ? record
                              : descendants.has(row.id)
                                ? { ...row, area: record.area }
                                : row,
                      )
                    : [...rows, record];
            });
        } else {
            if (
                prerequisites.some((candidate) =>
                    prerequisiteCycle(candidate, id),
                )
            ) {
                setError(
                    text(
                        "Prerequisites cannot form a cycle.",
                        "Điều kiện tiên quyết không được tạo vòng lặp.",
                    ),
                );
                return false;
            }
            const old = milestones.find((row) => row.id === id);
            const record: Milestone = {
                id,
                title: label(title),
                goal: String(
                    fields.get("goal") ||
                        editing.goal ||
                        selected?.id ||
                        (db.live
                            ? goals.find((g) => !g.archived)?.id || ""
                            : "learning"),
                ),
                status: old?.status || "NotStarted",
                importance,
                icon,
                color,
                start: String(fields.get("start") || ""),
                due: String(fields.get("due") || ""),
                criteria: String(fields.get("criteria") || ""),
                prerequisites,
                related: relatedGoals,
                archived: false,
            };
            if (record.start && record.due && record.due < record.start) {
                setError(
                    text(
                        "Check the start and due dates.",
                        "Kiểm tra ngày bắt đầu và hạn hoàn thành.",
                    ),
                );
                return false;
            }
            db.setMilestones((rows) =>
                editing.id
                    ? rows.map((row) => (row.id === id ? record : row))
                    : [...rows, record],
            );
        }
        db.setMessage(
            db.live
                ? text("Saving…", "Đang lưu…")
                : text("Saved in this preview.", "Đã lưu trong bản xem thử."),
        );
        if (db.live && !(await db.live.flush())) return false;
        setEditing(null);
        return true;
    }
    function request(
        kind: "archive" | "complete",
        type: "goal" | "milestone",
        id: string,
    ) {
        setAck(false);
        setConfirmation({ kind, type, id });
    }
    function complete() {
        db.live?.acknowledge(ack ? ["unfinished"] : []);
        if (!confirmation) return;
        if (confirmation.type === "goal") {
            const target = goals.find((row) => row.id === confirmation.id)!;
            db.setGoals((rows) =>
                rows.map((row) =>
                    row.id === target.id
                        ? {
                              ...row,
                              status:
                                  target.status === "Done"
                                      ? "NotStarted"
                                      : "Done",
                          }
                        : row,
                ),
            );
        } else {
            const target = milestones.find(
                (row) => row.id === confirmation.id,
            )!;
            if (
                target.status !== "Done" &&
                target.prerequisites.some(
                    (id) =>
                        milestones.find((row) => row.id === id)?.status !==
                        "Done",
                )
            )
                return;
            if (
                target.status === "Done" &&
                milestones.some(
                    (row) =>
                        row.status === "Done" &&
                        row.prerequisites.includes(target.id),
                )
            ) {
                db.setMessage(
                    text(
                        "Reopen completed dependent Milestones first.",
                        "Hãy mở lại các cột mốc phụ thuộc đã hoàn thành trước.",
                    ),
                );
                setConfirmation(null);
                return;
            }
            db.setMilestones((rows) =>
                rows.map((row) =>
                    row.id === target.id
                        ? {
                              ...row,
                              status:
                                  target.status === "Done"
                                      ? "NotStarted"
                                      : "Done",
                          }
                        : row,
                ),
            );
        }
        setConfirmation(null);
        db.setMessage(
            text(
                "Status updated. Task checklist records remain separate.",
                "Đã đổi trạng thái. Danh sách kiểm tra công việc được giữ riêng.",
            ),
        );
    }
    const entity = confirmation
        ? confirmation.type === "goal"
            ? goals.find((row) => row.id === confirmation.id)
            : milestones.find((row) => row.id === confirmation.id)
        : undefined;
    const contents = confirmation
        ? tasks.filter(
              (task) =>
                  !task.archived &&
                  task.status !== "Done" &&
                  !task.seriesId &&
                  (task.parent === confirmation.id ||
                      (confirmation.type === "goal" &&
                          milestones.some(
                              (row) =>
                                  row.goal === confirmation.id &&
                                  row.id === task.parent,
                          ))),
          ).length +
          (confirmation.type === "goal"
              ? goals.filter(
                    (row) =>
                        row.parent === confirmation.id &&
                        !row.archived &&
                        row.status !== "Done",
                ).length
              : 0)
        : 0;
    function goalRow(goal: Goal) {
        const value = progress(goal);
        return (
            <span className="goal-tree-row">
                <button
                    className="planning-item-link goal-tree-link"
                    onClick={() => db.navigate("goals", { goal: goal.id })}
                >
                    <strong className="goal-tree-name">
                        <EntityIcon name={goal.icon} color={goal.color} />
                        {text(...goal.title)}
                    </strong>
                    <span className="goal-tree-meta">
                        <Stars value={goal.importance} text={text} />
                        {goal.due && (
                            <small className="goal-tree-deadline">
                                {dateLabel(goal.due, db.locale)}
                            </small>
                        )}
                        <span className="goal-mini-track" aria-hidden="true">
                            <i
                                style={
                                    {
                                        "--progress": `${value || 0}%`,
                                    } as CSSProperties
                                }
                            />
                        </span>
                        <span className="goal-tree-progress">
                            {value === null ? "—" : `${value}%`}
                        </span>
                    </span>
                </button>
                <button
                    className="icon-button"
                    aria-label={
                        text("Edit Goal: ", "Chỉnh sửa mục tiêu: ") +
                        text(...goal.title)
                    }
                    onClick={() => open({ kind: "goal", id: goal.id })}
                >
                    <Pencil size={17} />
                </button>
            </span>
        );
    }
    function tree(parentId: string, area: string): React.ReactNode {
        return goals
            .filter(
                (goal) =>
                    goal.parent === parentId &&
                    !goal.archived &&
                    (parentId || goal.area === area),
            )
            .map((goal) => {
                const children = goals.some(
                    (row) => row.parent === goal.id && !row.archived,
                );
                const row = goalRow(goal);
                return (
                    <li key={goal.id}>
                        {children ? (
                            <details
                                open={expanded.includes(goal.id)}
                                onToggle={(event) => {
                                    if (event.target !== event.currentTarget)
                                        return;
                                    const isOpen = event.currentTarget.open;
                                    setExpanded((ids) =>
                                        isOpen
                                            ? ids.includes(goal.id)
                                                ? ids
                                                : [...ids, goal.id]
                                            : ids.filter(
                                                  (id) => id !== goal.id,
                                              ),
                                    );
                                }}
                            >
                                <summary>{row}</summary>
                                <ul>{tree(goal.id, area)}</ul>
                            </details>
                        ) : (
                            row
                        )}
                    </li>
                );
            });
    }
    const strategy = selected
        ? (strategyDrafts[selected.id] ?? selected.strategy)
        : "";
    const strategyDirty = !!selected && strategy !== selected.strategy;
    const milestonePanel = ms && (
        <TaskDropZone as="section" target={ms.status !== "Done" ? {kind:"parent", id:ms.id} : undefined} className="planning-panel review-milestone-focus">
            <button
                className="button button-quiet"
                onClick={() => setSelectedMilestone("")}
            >
                <ArrowLeft size={17} />
                {text("Back to roadmap", "Quay lại lộ trình")}
            </button>
            <PageHeaderFrame illustrated={false} className="workspace-header milestone-focus-header">
                <div>
                    <div className="entity-title-row">
                        <EntityIcon
                            name={ms.icon}
                            color={ms.color}
                            onChange={(icon, color) =>
                                db.setMilestones((rows) =>
                                    rows.map((row) =>
                                        row.id === ms.id
                                            ? { ...row, icon, color }
                                            : row,
                                    ),
                                )
                            }
                            text={text}
                            defaultIcon="flag"
                            label={text(
                                "Change milestone icon",
                                "Đổi biểu tượng cột mốc",
                            )}
                        />
                        <h2 tabIndex={-1}>{text(...ms.title)}</h2>
                        <Stars
                            value={ms.importance}
                            text={text}
                            onChange={(importance) =>
                                db.setMilestones((rows) =>
                                    rows.map((row) =>
                                        row.id === ms.id
                                            ? { ...row, importance }
                                            : row,
                                    ),
                                )
                            }
                        />
                    </div>
                    <p>
                        {
                            tasks.filter(
                                (task) =>
                                    !task.archived &&
                                    !task.seriesId &&
                                    task.parent === ms.id &&
                                    task.status === "Done",
                            ).length
                        }
                        /
                        {
                            tasks.filter(
                                (task) =>
                                    !task.archived &&
                                    !task.seriesId &&
                                    task.parent === ms.id,
                            ).length
                        }{" "}
                        {text(
                            "finite tasks completed",
                            "công việc hữu hạn đã xong",
                        )}

                    </p>
                </div>
            </PageHeaderFrame>
            <PageActionBar label={text("Milestone actions", "Thao tác cột mốc")} className="milestone-page-actions">
                <button
                    className={`button button-quiet ${ms.weekly ? "is-selected" : ""}`}
                    aria-pressed={!!ms.weekly}
                    aria-label={text(
                        "Plan for this week",
                        "Chọn cho tuần này",
                    )}
                    onClick={() =>
                        db.setMilestones((rows) =>
                            rows.map((row) =>
                                row.id === ms.id
                                    ? { ...row, weekly: !row.weekly }
                                    : row,
                            ),
                        )
                    }
                >
                    <Pin
                        size={17}
                        fill={ms.weekly ? "currentColor" : "none"}
                    />
                    {text("This week", "Tuần này")}
                </button>
                <details className="review-row-menu">
                    <summary
                        className="button button-quiet"
                        aria-label={text(
                            "Milestone actions",
                            "Thao tác cột mốc",
                        )}
                    >
                        <MoreHorizontal size={18} />
                        {text("Actions", "Thao tác")}
                    </summary>
                    <div>
                        <button
                            onClick={() =>
                                open({ kind: "milestone", id: ms.id })
                            }
                        >
                            {text("Edit milestone", "Chỉnh sửa cột mốc")}
                        </button>
                        <button
                            onClick={() =>
                                request("archive", "milestone", ms.id)
                            }
                        >
                            {text("Archive milestone", "Lưu trữ cột mốc")}
                        </button>
                    </div>
                </details>
                <button
                    className="button button-primary"
                    disabled={
                        ms.status !== "Done" &&
                        ms.prerequisites.some(
                            (id) =>
                                milestones.find((row) => row.id === id)
                                    ?.status !== "Done",
                        )
                    }
                    onClick={() => request("complete", "milestone", ms.id)}
                >
                    <Check size={17} />
                    {ms.status === "Done"
                        ? text("Reopen milestone", "Mở lại cột mốc")
                        : text("Complete milestone", "Hoàn thành cột mốc")}
                </button>
                <button className="button button-quiet" disabled={selected?.status === "Done" || ms.status === "Done"}
                    onClick={() => taskPicker.open({ kind: "parent", id: ms.id })}>
                    <Plus size={17} />{text("Choose tasks", "Chọn công việc")}
                </button>
            </PageActionBar>
            <p className="roadmap-criteria">
                {ms.criteria ||
                    text(
                        "Complete the finite tasks or explicitly acknowledge unfinished work.",
                        "Hoàn thành các công việc hữu hạn hoặc xác nhận rõ phần chưa xong.",
                    )}
            </p>
            {ms.prerequisites.some(
                (id) =>
                    milestones.find((row) => row.id === id)?.status !== "Done",
            ) && (
                <p className="notice">
                    {text(
                        "Finish the prerequisites before completing this milestone. You can still work on its tasks.",
                        "Hoàn thành điều kiện tiên quyết trước khi hoàn thành cột mốc. Bạn vẫn có thể làm các công việc bên trong.",
                    )}
                </p>
            )}
            <details className="milestone-links">
                <summary>
                    {text(
                        "Prerequisites and related goals",
                        "Điều kiện và mục tiêu liên quan",
                    )}
                </summary>
                <h3>
                    {text(
                        "Finish these milestones first",
                        "Hoàn thành các cột mốc này trước",
                    )}
                </h3>
                {ms.prerequisites.length ? (
                    ms.prerequisites.map((id) => {
                        const row = milestones.find((item) => item.id === id);
                        return (
                            row && (
                                <p key={id}>
                                    <button
                                        className="text-button"
                                        onClick={() => setSelectedMilestone(id)}
                                    >
                                        {text(...row.title)}
                                    </button>{" "}

                                </p>
                            )
                        );
                    })
                ) : (
                    <p className="subtle-copy">
                        {text(
                            "No prerequisites.",
                            "Không có điều kiện tiên quyết.",
                        )}
                    </p>
                )}
                <button
                    className="text-button"
                    onClick={() => open({ kind: "milestone", id: ms.id })}
                >
                    {text("Edit prerequisites", "Chỉnh sửa điều kiện")}
                </button>
            </details>
            <Tabs
                id="review-milestone"
                value={milestoneTab}
                onChange={setMilestoneTab}
                label={text("Milestone task types", "Loại công việc cột mốc")}
                items={[
                    ["tasks", text("Tasks", "Công việc")],
                    ["recurring", text("Recurring work", "Công việc lặp lại")],
                ]}
            />
            {[false, true].map((recurring) => (
                <Panel
                    key={String(recurring)}
                    id="review-milestone"
                    tab={recurring ? "recurring" : "tasks"}
                    value={milestoneTab}
                >
                    {recurring && (
                        <p className="subtle-copy">
                            {text(
                                "Recurring work does not count toward finite task progress.",
                                "Công việc lặp lại không tính vào tiến độ công việc hữu hạn.",
                            )}
                        </p>
                    )}
                    {tasks
                        .filter(
                            (task) =>
                                !task.archived &&
                                task.parent === ms.id &&
                                !!task.seriesId === recurring,
                        )
                        .map((task) => (
                            <TaskLine key={task.id} id={task.id} text={text} />
                        ))}
                    {!tasks.some(
                        (task) =>
                            !task.archived &&
                            task.parent === ms.id &&
                            !!task.seriesId === recurring,
                    ) && (
                        <p className="review-inline-empty">
                            {text(
                                "No tasks in this group.",
                                "Chưa có công việc trong nhóm này.",
                            )}
                        </p>
                    )}
                    {!recurring && (
                        <button
                            className="button button-quiet milestone-add-task"
                            disabled={selected?.status === "Done"}
                            onClick={() => taskPicker.open({ kind: "parent", id: ms.id })}
                        >
                            <Plus size={17} />
                            {text("Add task", "Thêm công việc")}
                        </button>
                    )}
                </Panel>
            ))}
        </TaskDropZone>
    );
    return (
        <TaskDropZone target={selected && selected.status !== "Done" ? {kind:"parent", id:selected.id} : undefined}
            className="review-planning planning-page"
            data-goals-page={!selected || undefined}
            data-goal-detail={!!selected || undefined}
        >
            {selected ? (
                <>
                    <PageHeaderFrame>
                        <div>
                            <p className="eyebrow">
                                <button
                                    className="text-button"
                                    onClick={() => db.navigate("goals")}
                                >
                                    {text("Goals", "Mục tiêu")}
                                </button>{" "}
                                / {text("Roadmap", "Lộ trình")}
                            </p>
                            <div className="entity-title-row">
                                <EntityIcon
                                    name={selected.icon}
                                    color={selected.color}
                                    onChange={(icon, color) =>
                                        db.setGoals((rows) =>
                                            rows.map((row) =>
                                                row.id === selected.id
                                                    ? { ...row, icon, color }
                                                    : row,
                                            ),
                                        )
                                    }
                                    text={text}
                                    defaultIcon="target"
                                    label={text(
                                        "Change Goal icon",
                                        "Đổi biểu tượng mục tiêu",
                                    )}
                                />
                                <h1>{text(...selected.title)}</h1>
                            </div>
                            <p className="entity-meta-row">
                                <span>
                                    {progress(selected) === null
                                        ? "—"
                                        : `${progress(selected)}%`}{" "}
                                    {text("progress", "tiến độ")}
                                </span>
                                <Stars
                                    value={selected.importance}
                                    text={text}
                                    onChange={(importance) =>
                                        db.setGoals((rows) =>
                                            rows.map((row) =>
                                                row.id === selected.id
                                                    ? { ...row, importance }
                                                    : row,
                                            ),
                                        )
                                    }
                                />
                            </p>
                        </div>
                    </PageHeaderFrame>
                    {!ms && (
                        <PageActionBar label={text("Goal actions", "Thao tác mục tiêu")}>
                            <button
                                className="button button-quiet"
                                onClick={() => setInfoTab("information")}
                            >
                                <BaselineIcon name="goals" />
                                {text("Goal information", "Thông tin mục tiêu")}
                            </button>

                            <button
                                className="button button-quiet"
                                onClick={() =>
                                    request("complete", "goal", selected.id)
                                }
                            >
                                <Check size={17} />
                                {selected.status === "Done"
                                    ? text("Reopen Goal", "Mở lại mục tiêu")
                                    : text(
                                          "Complete Goal",
                                          "Hoàn thành mục tiêu",
                                      )}
                            </button>
                            <button
                                className="button button-primary"
                                disabled={selected.status === "Done"}
                                onClick={() =>
                                    open({
                                        kind: "milestone",
                                        goal: selected.id,
                                    })
                                }
                            >
                                <Plus size={17} />
                                {text("Add milestone", "Thêm cột mốc")}
                            </button>
                            <button className="button button-quiet" disabled={selected.status === "Done"}
                                onClick={() => taskPicker.open({ kind: "parent", id: selected.id })}>
                                <Plus size={17} />{text("Choose tasks", "Chọn công việc")}
                            </button>
                        </PageActionBar>
                    )}
                    {!ms && (
                        <section
                            aria-label={text(
                                "Goal roadmap",
                                "Lộ trình mục tiêu",
                            )}
                        >
                            <div className="section-heading">
                                <div>
                                    <h2 className="roadmap-heading">
                                        {text("Roadmap", "Lộ trình")}
                                    </h2>
                                    <p className="subtle-copy">
                                        {text(
                                            "Select the Goal name for its information, or a milestone for its tasks.",
                                            "Chọn tên mục tiêu để xem thông tin hoặc chọn cột mốc để xem công việc.",
                                        )}
                                    </p>
                                </div>
                            </div>
                            <Fishbone
                                goal={selected}
                                milestones={milestones.filter(
                                    (row) =>
                                        row.goal === selected.id &&
                                        !row.archived,
                                )}
                                page={page}
                                onPage={setPage}
                                text={text}
                                onHead={() => setInfoTab("information")}
                                onMilestone={(id) => {
                                    setSelectedMilestone(id);
                                    setMilestoneTab("tasks");
                                }}
                            />
                        </section>
                    )}
                    {ms && milestonePanel}
                </>
            ) : (
                <>
                    <Header
                        title={text("Goals", "Mục tiêu")}
                        description={text(
                            "Give your ambitions a direction.",
                            "Định hướng cho những điều bạn muốn thực hiện.",
                        )}
                    />
                    <FloatingActions
                        label={text("Page actions", "Thao tác trang")}
                        closeLabel={text("Close actions", "Đóng thao tác")}
                    >
                        <button
                            className="button button-quiet"
                            onClick={() => setManage(true)}
                        >
                            <Settings2 size={17} />
                            {text("Manage areas", "Quản lý lĩnh vực")}
                        </button>
                        <button
                            className="button button-primary"
                            onClick={() => open({ kind: "goal" })}
                        >
                            <Plus size={17} />
                            {text("New goal", "Mục tiêu mới")}
                        </button>
                    </FloatingActions>
                    <article className="main-goal-card scene-card">
                        <span className="context-chip">
                            ★ {text("Main goal", "Mục tiêu chính")}
                        </span>
                        <div className="main-goal-title">
                            {focus && (
                                <EntityIcon
                                    name={focus.icon}
                                    color={focus.color}
                                />
                            )}
                            <h2>{focus ? text(...focus.title) : text("Choose your main goal", "Chọn mục tiêu chính")}</h2>
                        </div>
                        {focus && <div className="main-goal-importance"><Stars value={focus.importance} text={text} /></div>}
                        <details className="main-goal-selection">
                            <summary>{text("Change main goal", "Đổi mục tiêu chính")}</summary>
                            <span className="roadmap-title-picker main-goal-picker">
                                <select
                                    aria-label={text(
                                        "Choose your main goal",
                                        "Chọn mục tiêu chính",
                                    )}
                                    value={focus?.id || ""}
                                    onChange={(event) =>
                                        db.setFocus(event.target.value)
                                    }
                                >
                                    <option value="">
                                        {text(
                                            "Choose your main goal",
                                            "Chọn mục tiêu chính",
                                        )}
                                    </option>
                                    {goals
                                        .filter(
                                            (goal) =>
                                                !goal.archived &&
                                                (goal.status !== "Done" ||
                                                    goal.id === db.focus),
                                        )
                                        .map((goal) => (
                                            <option
                                                key={goal.id}
                                                value={goal.id}
                                            >
                                                {goal.parent
                                                    ? text(
                                                          ...goals.find(
                                                              (row) =>
                                                                  row.id ===
                                                                  goal.parent,
                                                          )!.title,
                                                      ) + " › "
                                                    : ""}
                                                {text(...goal.title)}
                                            </option>
                                        ))}
                                </select>
                            </span>
                        </details>
                        <p>
                            {focus
                                ? text(...focus.outcome) ||
                                  text(...focus.description) ||
                                  text(
                                      "Open this goal to describe the outcome you want.",
                                      "Mở mục tiêu để mô tả kết quả bạn mong muốn.",
                                  )
                                : text(
                                      "Pick the goal you are focusing on. It also becomes the roadmap on your Dashboard.",
                                      "Chọn mục tiêu bạn đang tập trung. Mục tiêu này cũng trở thành lộ trình ở Tổng quan.",
                                  )}
                        </p>
                        {focus && (
                            <div className="main-goal-footer">
                                <strong>
                                    {progress(focus) === null
                                        ? "—"
                                        : `${progress(focus)}%`}
                                </strong>
                                <span
                                    className="progress-track"
                                    aria-hidden="true"
                                >
                                    <i
                                        style={
                                            {
                                                "--progress": `${progress(focus) || 0}%`,
                                            } as CSSProperties
                                        }
                                    />
                                </span>
                                <button
                                    className="button button-quiet"
                                    onClick={() =>
                                        open({ kind: "goal", id: focus.id })
                                    }
                                >
                                    <Pencil size={17} />
                                    {text("Edit goal", "Chỉnh sửa mục tiêu")}
                                </button>
                                <button
                                    className="section-link text-button"
                                    onClick={() =>
                                        db.navigate("goals", { goal: focus.id })
                                    }
                                >
                                    {text("Open roadmap", "Mở lộ trình")} →
                                </button>
                            </div>
                        )}
                    </article>
                    <div
                        className="task-view-menu review-goal-view-menu"
                        role="group"
                        aria-label={text("Goal views", "Chế độ mục tiêu")}
                    >
                        <button
                            aria-pressed={view === "tree"}
                            onClick={() => setView("tree")}
                        >
                            {text("Areas", "Lĩnh vực")}
                        </button>
                        <button
                            id="review-goals-tab-timeline"
                            aria-pressed={view === "timeline"}
                            onClick={() => setView("timeline")}
                        >
                            {text("Timeline", "Dòng thời gian")}
                        </button>
                        <button
                            className="review-expand-goals"
                            hidden={view !== "tree"}
                            onClick={() => {
                                const allOpen =
                                    activeAreas.every((area) =>
                                        expandedAreas.includes(area.id),
                                    ) &&
                                    goals
                                        .filter((goal) => !goal.archived)
                                        .every((goal) =>
                                            expanded.includes(goal.id),
                                        );
                                setExpandedAreas(
                                    allOpen
                                        ? []
                                        : activeAreas.map((area) => area.id),
                                );
                                setExpanded(
                                    allOpen
                                        ? []
                                        : goals
                                              .filter((goal) => !goal.archived)
                                              .map((goal) => goal.id),
                                );
                            }}
                        >
                            {text("Expand all", "Mở rộng tất cả")}
                        </button>
                    </div>
                    <section
                        hidden={view !== "tree"}
                        aria-label={text("Areas", "Lĩnh vực")}
                    >
                        {activeAreas.map((area) => {
                            const roots = goals.filter(
                                (goal) =>
                                    !goal.archived &&
                                    goal.area === area.id &&
                                    !goal.parent,
                            );
                            const average = roots.length
                                ? Math.round(
                                      roots.reduce(
                                          (sum, goal) =>
                                              sum + (progress(goal) || 0),
                                          0,
                                      ) / roots.length,
                                  )
                                : 0;
                            return (
                                <details
                                    key={area.id}
                                    className="goal-area-group"
                                    open={expandedAreas.includes(area.id)}
                                    onToggle={(event) => {
                                        if (
                                            event.target !== event.currentTarget
                                        )
                                            return;
                                        const isOpen = event.currentTarget.open;
                                        setExpandedAreas((ids) =>
                                            isOpen
                                                ? ids.includes(area.id)
                                                    ? ids
                                                    : [...ids, area.id]
                                                : ids.filter(
                                                      (id) => id !== area.id,
                                                  ),
                                        );
                                    }}
                                >
                                    <summary>
                                        <span className="entity-icon-button">
                                            <EntityIcon
                                                name={area.icon}
                                                color={area.color}
                                                onChange={(icon, color) =>
                                                    db.setAreas((rows) =>
                                                        rows.map((row) =>
                                                            row.id === area.id
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
                                                defaultIcon="leaf"
                                                label={
                                                    text(
                                                        "Edit Area icon: ",
                                                        "Sửa biểu tượng lĩnh vực: ",
                                                    ) + text(...area.title)
                                                }
                                            />
                                        </span>
                                        <span className="area-title-row">
                                            <strong className="area-title">
                                                {text(...area.title)}
                                            </strong>
                                            <Stars
                                                value={area.importance}
                                                text={text}
                                                onChange={(importance) =>
                                                    db.setAreas((rows) =>
                                                        rows.map((row) =>
                                                            row.id === area.id
                                                                ? {
                                                                      ...row,
                                                                      importance,
                                                                  }
                                                                : row,
                                                        ),
                                                    )
                                                }
                                            />
                                        </span>
                                        <span className="subtle-copy">
                                            {average}%{" "}
                                            {text(
                                                "average goal progress",
                                                "tiến độ trung bình",
                                            )}
                                        </span>
                                        <span
                                            className="progress-track"
                                            aria-hidden="true"
                                        >
                                            <i
                                                style={
                                                    {
                                                        "--progress": `${average}%`,
                                                    } as CSSProperties
                                                }
                                            />
                                        </span>
                                    </summary>
                                    <ul className="goal-tree">
                                        {tree("", area.id)}
                                        {!roots.length && (
                                            <li className="goal-area-empty">
                                                {text(
                                                    "Room for a new goal.",
                                                    "Sẵn sàng cho mục tiêu mới.",
                                                )}
                                            </li>
                                        )}
                                    </ul>
                                    <button
                                        className="text-button"
                                        onClick={() =>
                                            open({
                                                kind: "goal",
                                                area: area.id,
                                            })
                                        }
                                    >
                                        <Plus size={15} />
                                        {text("New goal", "Mục tiêu mới")}
                                    </button>
                                </details>
                            );
                        })}
                        <button
                            className="button add-area-reference"
                            onClick={() => setManage(true)}
                        >
                            <Plus size={17} />
                            {text(
                                "Add another life area",
                                "Thêm lĩnh vực cuộc sống",
                            )}
                        </button>
                    </section>
                    <section
                        className="planning-panel"
                        data-goal-timeline
                        hidden={view !== "timeline"}
                        aria-label={text("Timeline", "Dòng thời gian")}
                    >
                        {goals
                            .filter((goal) => !goal.archived)
                            .sort((a, b) =>
                                (a.due || "9999").localeCompare(
                                    b.due || "9999",
                                ),
                            )
                            .map((goal) => (
                                <div
                                    className={`goal-timeline-item ${goal.status === "Done" ? "is-completed" : ""} ${goal.due ? "has-deadline" : ""}`}
                                    key={goal.id}
                                >
                                    <span
                                        className="goal-timeline-dot"
                                        aria-hidden="true"
                                    />
                                    <time dateTime={goal.due || undefined}>
                                        {goal.due
                                            ? dateLabel(goal.due, db.locale)
                                            : text(
                                                  "No deadline",
                                                  "Không có hạn",
                                              )}
                                    </time>
                                    {goalRow(goal)}
                                </div>
                            ))}
                    </section>
                </>
            )}
            {mounted &&
                createPortal(
                    <>
                        {selected && infoTab && (
                            <Dialog
                                title={text(
                                    "Goal information",
                                    "Thông tin mục tiêu",
                                )}
                                heading={
                                    <>
                                        <p className="eyebrow">
                                            {text(
                                                "Goal information",
                                                "Thông tin mục tiêu",
                                            )}
                                        </p>
                                        <div className="entity-title-row">
                                            <EntityIcon
                                                name={selected.icon}
                                                color={selected.color}
                                            />
                                            <h2>{text(...selected.title)}</h2>
                                        </div>
                                        <p className="subtle-copy">
                                            {progress(selected) === null
                                                ? "—"
                                                : `${progress(selected)}%`}{" "}
                                            {text("progress", "tiến độ")}
                                        </p>
                                    </>
                                }
                                closeLabel={text("Close", "Đóng")}
                                className="preview-dialog review-dialog review-goal-information-dialog"
                                onClose={() => {
                                    if (strategyDirty) {
                                        setConfirmation({
                                            kind: "leave",
                                            type: "goal",
                                            id: selected.id,
                                            target: "",
                                        });
                                    } else setInfoTab("");
                                }}
                            >
                                <div className="preview-dialog-body">
                                    <div className="goal-information-content">
                                        <p className="review-prose">
                                            {text(...selected.description)}
                                        </p>
                                        <dl className="detail-list">
                                            <div>
                                                <dt>
                                                    {text(
                                                        "Desired outcome",
                                                        "Kết quả mong muốn",
                                                    )}
                                                </dt>
                                                <dd>
                                                    {text(
                                                        ...selected.outcome,
                                                    ) || "—"}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt>
                                                    {text(
                                                        "Completion criteria",
                                                        "Tiêu chí hoàn thành",
                                                    )}
                                                </dt>
                                                <dd>
                                                    {text(
                                                        ...selected.criteria,
                                                    ) || "—"}
                                                </dd>
                                            </div>
                                        </dl>
                                    </div>
                                    <button
                                        className="button button-quiet"
                                        onClick={() => {
                                            setInfoTab("");
                                            open({
                                                kind: "goal",
                                                id: selected.id,
                                            });
                                        }}
                                    >
                                        <Settings2 size={17} />
                                        {text(
                                            "Edit goal",
                                            "Chỉnh sửa mục tiêu",
                                        )}
                                    </button>
                                    <details
                                        name="preview-goal-information"
                                        className="goal-information-section"
                                    >
                                        <summary>
                                            {text("Strategy", "Chiến lược")}{" "}
                                            <span className="subtle-copy">
                                                {strategyDirty
                                                    ? text(
                                                          "Unsaved draft",
                                                          "Bản nháp chưa lưu",
                                                      )
                                                    : text("Saved", "Đã lưu")}
                                            </span>
                                        </summary>
                                        <form
                                            className="stack-form"
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                if (conflict) return;
                                                db.setGoals((rows) =>
                                                    rows.map((goal) =>
                                                        goal.id === selected.id
                                                            ? {
                                                                  ...goal,
                                                                  strategy,
                                                              }
                                                            : goal,
                                                    ),
                                                );
                                                db.setMessage(
                                                    text(
                                                        "Strategy saved. Progress is unchanged.",
                                                        "Đã lưu chiến lược. Tiến độ được giữ nguyên.",
                                                    ),
                                                );
                                            }}
                                        >
                                            {conflict && (
                                                <aside className="notice">
                                                    <p>
                                                        {text(
                                                            "Saved-version example changed. Your draft is preserved.",
                                                            "Bản lưu minh họa đã thay đổi. Bản nháp được giữ nguyên.",
                                                        )}
                                                    </p>
                                                    <div className="action-row">
                                                        <button
                                                            type="button"
                                                            className="button button-quiet"
                                                            onClick={() => {
                                                                setStrategyDrafts(
                                                                    (
                                                                        values,
                                                                    ) => ({
                                                                        ...values,
                                                                        [selected.id]:
                                                                            selected.strategy,
                                                                    }),
                                                                );
                                                                setConflict(
                                                                    false,
                                                                );
                                                            }}
                                                        >
                                                            {text(
                                                                "Use saved version",
                                                                "Dùng bản đã lưu",
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button button-primary"
                                                            onClick={() =>
                                                                setConflict(
                                                                    false,
                                                                )
                                                            }
                                                        >
                                                            {text(
                                                                "Keep my draft",
                                                                "Giữ bản nháp của tôi",
                                                            )}
                                                        </button>
                                                    </div>
                                                </aside>
                                            )}
                                            <Field
                                                label={text(
                                                    "Strategy",
                                                    "Chiến lược",
                                                )}
                                                hint={text(
                                                    "A separate planning draft. It does not change progress or Activity.",
                                                    "Bản nháp kế hoạch riêng. Không thay đổi tiến độ hay Hoạt động.",
                                                )}
                                            >
                                                <textarea
                                                    rows={9}
                                                    maxLength={20000}
                                                    value={strategy}
                                                    onChange={(event) =>
                                                        setStrategyDrafts(
                                                            (values) => ({
                                                                ...values,
                                                                [selected.id]:
                                                                    event.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                />
                                            </Field>
                                            <div className="review-form-footer">
                                                <span role="status">
                                                    {text(
                                                        strategyDirty
                                                            ? "Unsaved draft"
                                                            : "Saved",
                                                        strategyDirty
                                                            ? "Bản nháp chưa lưu"
                                                            : "Đã lưu",
                                                    )}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="button button-quiet"
                                                    onClick={() =>
                                                        setStrategyDrafts(
                                                            (values) => ({
                                                                ...values,
                                                                [selected.id]:
                                                                    selected.strategy,
                                                            }),
                                                        )
                                                    }
                                                >
                                                    {text("Cancel", "Hủy")}
                                                </button>
                                                <button
                                                    className="button button-primary"
                                                    disabled={
                                                        conflict ||
                                                        !strategyDirty
                                                    }
                                                >
                                                    {text(
                                                        "Save strategy",
                                                        "Lưu chiến lược",
                                                    )}
                                                </button>
                                            </div>
                                            {!db.live && (
                                                <details className="review-simulation">
                                                    <summary>
                                                        {text(
                                                            "Preview version conflict",
                                                            "Xem thử xung đột phiên bản",
                                                        )}
                                                    </summary>
                                                    <button
                                                        type="button"
                                                        className="button button-quiet"
                                                        onClick={() =>
                                                            setConflict(true)
                                                        }
                                                    >
                                                        {text(
                                                            "Show conflict",
                                                            "Hiện xung đột",
                                                        )}
                                                    </button>
                                                </details>
                                            )}
                                        </form>
                                    </details>
                                    <details
                                        name="preview-goal-information"
                                        className="goal-information-section"
                                    >
                                        <summary>
                                            {text(
                                                "Related work",
                                                "Công việc liên quan",
                                            )}
                                        </summary>
                                        <div className="section-heading">
                                            <h2>
                                                {text(
                                                    "Related work",
                                                    "Công việc liên quan",
                                                )}
                                            </h2>
                                            <Field
                                                label={text("Show", "Hiển thị")}
                                            >
                                                <select
                                                    value={relatedKind}
                                                    onChange={(event) =>
                                                        setRelatedKind(
                                                            event.target.value,
                                                        )
                                                    }
                                                >
                                                    {[
                                                        [
                                                            "child_goals",
                                                            text(
                                                                "Child goals",
                                                                "Mục tiêu con",
                                                            ),
                                                        ],
                                                        [
                                                            "direct_tasks",
                                                            text(
                                                                "Direct tasks",
                                                                "Công việc trực tiếp",
                                                            ),
                                                        ],
                                                        [
                                                            "recurring_tasks",
                                                            text(
                                                                "Recurring work",
                                                                "Công việc lặp lại",
                                                            ),
                                                        ],
                                                        [
                                                            "habits",
                                                            text(
                                                                "Habits",
                                                                "Thói quen",
                                                            ),
                                                        ],
                                                        [
                                                            "contributions",
                                                            text(
                                                                "Contributions",
                                                                "Đóng góp",
                                                            ),
                                                        ],
                                                    ].map(([value, title]) => (
                                                        <option
                                                            key={value}
                                                            value={value}
                                                        >
                                                            {title}
                                                        </option>
                                                    ))}
                                                </select>
                                            </Field>
                                        </div>
                                        {relatedKind === "child_goals" && (
                                            <>
                                                {goals
                                                    .filter(
                                                        (goal) =>
                                                            !goal.archived &&
                                                            goal.parent ===
                                                                selected.id,
                                                    )
                                                    .map((goal) => (
                                                        <button
                                                            key={goal.id}
                                                            className="review-note-link"
                                                            onClick={() =>
                                                                db.navigate(
                                                                    "goals",
                                                                    {
                                                                        goal: goal.id,
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            {text(
                                                                ...goal.title,
                                                            )}
                                                        </button>
                                                    ))}
                                                <button
                                                    className="button button-quiet"
                                                    disabled={
                                                        selected.status ===
                                                        "Done"
                                                    }
                                                    onClick={() => {
                                                        setInfoTab("");
                                                        open({
                                                            kind: "goal",
                                                            area: selected.area,
                                                            parent: selected.id,
                                                        });
                                                    }}
                                                >
                                                    <Plus size={16} />
                                                    {text(
                                                        "Add sub-goal",
                                                        "Thêm mục tiêu con",
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        {[
                                            "direct_tasks",
                                            "recurring_tasks",
                                        ].includes(relatedKind) && (
                                            <>
                                                {tasks
                                                    .filter(
                                                        (task) =>
                                                            !task.archived &&
                                                            task.parent ===
                                                                selected.id &&
                                                            !!task.seriesId ===
                                                                (relatedKind ===
                                                                    "recurring_tasks"),
                                                    )
                                                    .map((task) => (
                                                        <TaskLine
                                                            key={task.id}
                                                            id={task.id}
                                                            text={text}
                                                        />
                                                    ))}
                                                {relatedKind ===
                                                    "direct_tasks" && (
                                                    <button
                                                        className="button button-quiet"
                                                        disabled={
                                                            selected.status ===
                                                            "Done"
                                                        }
                                                        onClick={() => {
                                                            setInfoTab("");
                                                            taskPicker.open({ kind: "parent", id: selected.id });
                                                        }}
                                                    >
                                                        <Plus size={16} />
                                                        {text(
                                                            "Add task",
                                                            "Thêm công việc",
                                                        )}
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {relatedKind === "habits" &&
                                            db.habits
                                                .filter(
                                                    (habit) =>
                                                        !habit.archived &&
                                                        habit.goal ===
                                                            selected.id,
                                                )
                                                .map((habit) => (
                                                    <button
                                                        key={habit.id}
                                                        className="review-note-link"
                                                        onClick={() => {
                                                            setInfoTab("");
                                                            db.navigate(
                                                                "habits",
                                                            );
                                                        }}
                                                    >
                                                        {text(...habit.title)}
                                                    </button>
                                                ))}
                                        {relatedKind === "contributions" && (
                                            <>
                                                <p className="subtle-copy">
                                                    {text(
                                                        "Related work does not change parent relationships or progress.",
                                                        "Công việc liên quan không thay đổi quan hệ cha con hoặc tiến độ.",
                                                    )}
                                                </p>
                                                {selected.related.map((id) => {
                                                    const goal = goals.find(
                                                        (row) =>
                                                            row.id === id &&
                                                            !row.archived,
                                                    );
                                                    return (
                                                        goal && (
                                                            <button
                                                                className="review-note-link"
                                                                key={id}
                                                                onClick={() =>
                                                                    db.navigate(
                                                                        "goals",
                                                                        {
                                                                            goal: id,
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                {text(
                                                                    ...goal.title,
                                                                )}
                                                            </button>
                                                        )
                                                    );
                                                })}
                                            </>
                                        )}
                                    </details>
                                    <details
                                        name="preview-goal-information"
                                        className="goal-information-section"
                                    >
                                        <summary>
                                            {text(
                                                "Related notes",
                                                "Ghi chú liên quan",
                                            )}
                                        </summary>
                                        <div className="section-heading">
                                            <h2>
                                                {text(
                                                    "Related notes",
                                                    "Ghi chú liên quan",
                                                )}
                                            </h2>
                                            <button
                                                className="button button-quiet"
                                                onClick={() => {
                                                    setInfoTab("");
                                                    db.navigate("notes", {
                                                        note: "new",
                                                        goal: selected.id,
                                                    });
                                                }}
                                            >
                                                <Plus size={16} />
                                                {text(
                                                    "New linked note",
                                                    "Ghi chú liên kết mới",
                                                )}
                                            </button>
                                        </div>
                                        {db.notes
                                            .filter(
                                                (note) =>
                                                    note.goal === selected.id,
                                            )
                                            .map((note) => (
                                                <button
                                                    className="review-note-link"
                                                    key={note.id}
                                                    onClick={() => {
                                                        setInfoTab("");
                                                        db.navigate("notes", {
                                                            note: note.id,
                                                        });
                                                    }}
                                                >
                                                    {note.locked &&
                                                    !note.unlocked
                                                        ? text(
                                                              "Locked note",
                                                              "Ghi chú đã khóa",
                                                          )
                                                        : note.title}
                                                </button>
                                            ))}
                                    </details>
                                    <section className="danger-zone">
                                        <p className="subtle-copy">
                                            {text(
                                                "Archiving a goal also archives its sub-goals, milestones and tasks. Their data is retained.",
                                                "Lưu trữ mục tiêu cũng lưu trữ các mục tiêu con, cột mốc và công việc bên trong. Dữ liệu vẫn được giữ lại.",
                                            )}
                                        </p>
                                        <button
                                            className="button button-danger-quiet"
                                            onClick={() =>
                                                request(
                                                    "archive",
                                                    "goal",
                                                    selected.id,
                                                )
                                            }
                                        >
                                            {text(
                                                "Archive goal",
                                                "Lưu trữ mục tiêu",
                                            )}
                                        </button>
                                    </section>
                                </div>
                            </Dialog>
                        )}
                        {manage && (
                            <Dialog
                                title={text("Manage Areas", "Quản lý lĩnh vực")}
                                closeLabel={text("Close", "Đóng")}
                                className="preview-dialog review-dialog review-compact"
                                onClose={() => setManage(false)}
                            >
                                <div className="preview-dialog-body stack-form">
                                    <p>
                                        {text(
                                            "Up to four active Areas. Keep at least one; move its active Goals before archiving it.",
                                            "Tối đa bốn lĩnh vực đang dùng. Giữ ít nhất một lĩnh vực; chuyển các mục tiêu đang dùng trước khi lưu trữ lĩnh vực.",
                                        )}
                                    </p>
                                    {activeAreas.map((area, index) => (
                                        <div
                                            className="review-manage-area"
                                            key={area.id}
                                        >
                                            <EntityIcon
                                                name={area.icon}
                                                color={area.color}
                                            />
                                            <span>{text(...area.title)}</span>
                                            <button
                                                className="icon-button"
                                                disabled={!index}
                                                aria-label={text(
                                                    "Move Area up",
                                                    "Chuyển lĩnh vực lên",
                                                )}
                                                onClick={() =>
                                                    db.setAreas((rows) => {
                                                        const next = [...rows];
                                                        const i =
                                                                next.findIndex(
                                                                    (row) =>
                                                                        row.id ===
                                                                        area.id,
                                                                ),
                                                            j = next.findIndex(
                                                                (row) =>
                                                                    row.id ===
                                                                    activeAreas[
                                                                        index -
                                                                            1
                                                                    ].id,
                                                            );
                                                        [next[i], next[j]] = [
                                                            next[j],
                                                            next[i],
                                                        ];
                                                        return next;
                                                    })
                                                }
                                            >
                                                <ArrowUp size={15} />
                                            </button>
                                            <button
                                                className="icon-button"
                                                disabled={
                                                    index ===
                                                    activeAreas.length - 1
                                                }
                                                aria-label={text(
                                                    "Move Area down",
                                                    "Chuyển lĩnh vực xuống",
                                                )}
                                                onClick={() =>
                                                    db.setAreas((rows) => {
                                                        const next = [...rows];
                                                        const i =
                                                                next.findIndex(
                                                                    (row) =>
                                                                        row.id ===
                                                                        area.id,
                                                                ),
                                                            j = next.findIndex(
                                                                (row) =>
                                                                    row.id ===
                                                                    activeAreas[
                                                                        index +
                                                                            1
                                                                    ].id,
                                                            );
                                                        [next[i], next[j]] = [
                                                            next[j],
                                                            next[i],
                                                        ];
                                                        return next;
                                                    })
                                                }
                                            >
                                                <ArrowDown size={15} />
                                            </button>
                                            <button
                                                className="text-button"
                                                onClick={() =>
                                                    open({
                                                        kind: "area",
                                                        id: area.id,
                                                    })
                                                }
                                            >
                                                {text(
                                                    "Rename / Edit",
                                                    "Đổi tên / Sửa",
                                                )}
                                            </button>
                                            <button
                                                className="text-button"
                                                disabled={
                                                    activeAreas.length <= 1 ||
                                                    goals.some(
                                                        (goal) =>
                                                            goal.area ===
                                                                area.id &&
                                                            !goal.archived &&
                                                            !goal.parent,
                                                    )
                                                }
                                                onClick={() =>
                                                    db.archiveEntity(
                                                        "areas",
                                                        area.id,
                                                        false,
                                                    )
                                                }
                                            >
                                                {text("Archive", "Lưu trữ")}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <footer className="preview-dialog-footer">
                                    <button
                                        className="button button-quiet"
                                        onClick={() => setManage(false)}
                                    >
                                        {text("Close", "Đóng")}
                                    </button>
                                    <button
                                        className="button button-primary"
                                        disabled={activeAreas.length >= 4}
                                        onClick={() => open({ kind: "area" })}
                                    >
                                        <Plus size={16} />
                                        {text("Add Area", "Thêm lĩnh vực")}
                                    </button>
                                </footer>
                            </Dialog>
                        )}
                        {editing && (
                            <FormDialog
                                key={`${editing.kind}-${editing.id || "new"}`}
                                text={text}
                                title={text(
                                    editing.id
                                        ? `Edit ${editing.kind}`
                                        : `New ${editing.kind}`,
                                    editing.kind === "area"
                                        ? editing.id
                                            ? "Sửa lĩnh vực"
                                            : "Lĩnh vực mới"
                                        : editing.kind === "goal"
                                          ? editing.id
                                              ? "Sửa mục tiêu"
                                              : "Mục tiêu mới"
                                          : editing.id
                                            ? "Sửa cột mốc"
                                            : "Cột mốc mới",
                                )}
                                dirty={
                                    icon !==
                                        (current?.icon ||
                                            (editing.kind === "milestone"
                                                ? "flag"
                                                : editing.kind === "area"
                                                  ? "leaf"
                                                  : "target")) ||
                                    color !== (current?.color || palette[0]) ||
                                    importance !== (current?.importance || 3)
                                }
                                onClose={() => setEditing(null)}
                                onSubmit={save}
                                wide
                            >
                                <Field label={text("Name", "Tên")}>
                                    <input
                                        name="title"
                                        required
                                        maxLength={200}
                                        defaultValue={
                                            current
                                                ? text(...current.title)
                                                : ""
                                        }
                                    />
                                </Field>
                                <IconPicker
                                    icon={icon}
                                    color={color}
                                    text={text}
                                    onChange={(name, value) => {
                                        setIcon(name);
                                        setColor(value);
                                    }}
                                />
                                <Stars
                                    value={importance}
                                    text={text}
                                    onChange={setImportance}
                                />
                                {editing.kind === "goal" && (
                                    <>
                                        <Field
                                            label={text(
                                                "Parent Goal (optional)",
                                                "Mục tiêu cha (tùy chọn)",
                                            )}
                                        >
                                            <select
                                                value={parent}
                                                onChange={(event) =>
                                                    setParent(
                                                        event.target.value,
                                                    )
                                                }
                                            >
                                                <option value="">
                                                    {text(
                                                        "Root Goal in an Area",
                                                        "Mục tiêu gốc trong lĩnh vực",
                                                    )}
                                                </option>
                                                {goals
                                                    .filter(
                                                        (goal) =>
                                                            !goal.archived &&
                                                            goal.status !==
                                                                "Done" &&
                                                            (!editing.id ||
                                                                !cycle(
                                                                    goal.id,
                                                                    editing.id,
                                                                )),
                                                    )
                                                    .map((goal) => (
                                                        <option
                                                            key={goal.id}
                                                            value={goal.id}
                                                        >
                                                            {text(
                                                                ...goal.title,
                                                            )}
                                                        </option>
                                                    ))}
                                            </select>
                                        </Field>
                                        <Field label={text("Area", "Lĩnh vực")}>
                                            <select
                                                name="area"
                                                defaultValue={
                                                    editing.area ||
                                                    (current &&
                                                    "area" in current
                                                        ? current.area
                                                        : activeAreas[0]?.id)
                                                }
                                                disabled={!!parent}
                                            >
                                                {activeAreas.map((area) => (
                                                    <option
                                                        key={area.id}
                                                        value={area.id}
                                                    >
                                                        {text(...area.title)}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field
                                            label={text("Description", "Mô tả")}
                                        >
                                            <textarea
                                                name="description"
                                                rows={3}
                                                defaultValue={
                                                    current &&
                                                    current.description
                                                        ? text(
                                                              ...current.description,
                                                          )
                                                        : ""
                                                }
                                            />
                                        </Field>
                                        <Field
                                            label={text(
                                                "Expected result",
                                                "Kết quả mong đợi",
                                            )}
                                        >
                                            <textarea
                                                name="outcome"
                                                rows={2}
                                                defaultValue={
                                                    current && current.outcome
                                                        ? text(
                                                              ...current.outcome,
                                                          )
                                                        : ""
                                                }
                                            />
                                        </Field>
                                    </>
                                )}
                                {editing.kind === "milestone" && (
                                    <Field label={text("Goal", "Mục tiêu")}>
                                        <select
                                            name="goal"
                                            defaultValue={
                                                editing.goal ||
                                                (current && "goal" in current
                                                    ? current.goal
                                                    : selected?.id)
                                            }
                                        >
                                            {goals
                                                .filter(
                                                    (goal) =>
                                                        !goal.archived &&
                                                        goal.status !== "Done",
                                                )
                                                .map((goal) => (
                                                    <option
                                                        key={goal.id}
                                                        value={goal.id}
                                                    >
                                                        {text(...goal.title)}
                                                    </option>
                                                ))}
                                        </select>
                                    </Field>
                                )}
                                {editing.kind !== "area" && (
                                    <>
                                        <div className="review-field-pair">
                                            <Field
                                                label={text(
                                                    "Start date",
                                                    "Ngày bắt đầu",
                                                )}
                                            >
                                                <input
                                                    name="start"
                                                    type="date"
                                                    defaultValue={
                                                        current &&
                                                        "start" in current
                                                            ? current.start
                                                            : ""
                                                    }
                                                />
                                            </Field>
                                            <Field
                                                label={text(
                                                    "Due date",
                                                    "Hạn hoàn thành",
                                                )}
                                            >
                                                <input
                                                    name="due"
                                                    type="date"
                                                    defaultValue={
                                                        current &&
                                                        "due" in current
                                                            ? current.due
                                                            : ""
                                                    }
                                                />
                                            </Field>
                                        </div>
                                        <Field
                                            label={text(
                                                "Completion criteria",
                                                "Tiêu chí hoàn thành",
                                            )}
                                        >
                                            <textarea
                                                name="criteria"
                                                rows={3}
                                                defaultValue={
                                                    current && current.criteria
                                                        ? typeof current.criteria ===
                                                          "string"
                                                            ? current.criteria
                                                            : text(
                                                                  ...current.criteria,
                                                              )
                                                        : ""
                                                }
                                            />
                                        </Field>
                                    </>
                                )}
                                {editing.kind !== "area" && (
                                    <fieldset className="review-checkbox-list">
                                        <legend>
                                            {text(
                                                "Contributes to Goals",
                                                "Đóng góp cho mục tiêu",
                                            )}
                                        </legend>
                                        <p className="subtle-copy">
                                            {text(
                                                "Links do not change parents or progress.",
                                                "Liên kết không thay đổi mục cha hoặc tiến độ.",
                                            )}
                                        </p>
                                        {goals
                                            .filter(
                                                (goal) =>
                                                    !goal.archived &&
                                                    goal.id !== editing.id,
                                            )
                                            .map((goal) => (
                                                <label key={goal.id}>
                                                    <input
                                                        type="checkbox"
                                                        checked={relatedGoals.includes(
                                                            goal.id,
                                                        )}
                                                        onChange={() =>
                                                            setRelatedGoals(
                                                                (ids) =>
                                                                    ids.includes(
                                                                        goal.id,
                                                                    )
                                                                        ? ids.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  goal.id,
                                                                          )
                                                                        : [
                                                                              ...ids,
                                                                              goal.id,
                                                                          ],
                                                            )
                                                        }
                                                    />
                                                    {text(...goal.title)}
                                                </label>
                                            ))}
                                    </fieldset>
                                )}
                                {editing.kind === "milestone" && (
                                    <fieldset className="review-checkbox-list">
                                        <legend>
                                            {text(
                                                "Prerequisite goals",
                                                "Mục tiêu tiên quyết",
                                            )}
                                        </legend>
                                        {milestones
                                            .filter(
                                                (row) =>
                                                    !row.archived &&
                                                    row.id !== editing.id,
                                            )
                                            .map((row) => (
                                                <label key={row.id}>
                                                    <input
                                                        type="checkbox"
                                                        checked={prerequisites.includes(
                                                            row.id,
                                                        )}
                                                        onChange={() =>
                                                            setPrerequisites(
                                                                (ids) =>
                                                                    ids.includes(
                                                                        row.id,
                                                                    )
                                                                        ? ids.filter(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  id !==
                                                                                  row.id,
                                                                          )
                                                                        : [
                                                                              ...ids,
                                                                              row.id,
                                                                          ],
                                                            )
                                                        }
                                                    />
                                                    <span>
                                                        {text(...row.title)}
                                                        <small>
                                                            {text(
                                                                ...goals.find(
                                                                    (goal) =>
                                                                        goal.id ===
                                                                        row.goal,
                                                                )!.title,
                                                            )}
                                                        </small>
                                                    </span>
                                                </label>
                                            ))}
                                    </fieldset>
                                )}
                                {error && (
                                    <p className="field-error" role="alert">
                                        {error}
                                    </p>
                                )}
                            </FormDialog>
                        )}
                        {confirmation && (
                            <Confirm
                                title={text(
                                    confirmation.kind === "leave"
                                        ? "Keep this draft while switching?"
                                        : confirmation.kind === "archive"
                                          ? "Archive with its contents?"
                                          : entity?.status === "Done"
                                            ? "Reopen this item?"
                                            : "Complete this item?",
                                    confirmation.kind === "leave"
                                        ? "Giữ bản nháp khi chuyển tab?"
                                        : confirmation.kind === "archive"
                                          ? "Lưu trữ cùng nội dung?"
                                          : entity?.status === "Done"
                                            ? "Mở lại mục này?"
                                            : "Hoàn thành mục này?",
                                )}
                                text={text}
                                onClose={() => setConfirmation(null)}
                                disabled={
                                    confirmation.kind !== "leave" &&
                                    contents > 0 &&
                                    !ack
                                }
                                danger={confirmation.kind === "archive"}
                                onConfirm={async () => {
                                    if (confirmation.kind === "leave") {
                                        setInfoTab(confirmation.target!);
                                        setConfirmation(null);
                                    } else if (
                                        confirmation.kind === "archive"
                                    ) {
                                        const saved = await db.archiveEntity(
                                            confirmation.type === "goal"
                                                ? "goals"
                                                : "milestones",
                                            confirmation.id,
                                            true,
                                        );
                                        if (saved === false) throw new Error(text("Could not archive. Try again.", "Chưa lưu trữ được. Hãy thử lại."));
                                        if (selected?.id === confirmation.id)
                                            db.navigate("goals");
                                        else if (
                                            confirmation.type === "milestone"
                                        )
                                            setSelectedMilestone("");
                                        setConfirmation(null);
                                    } else complete();
                                }}
                                label={
                                    confirmation.kind === "leave"
                                        ? text(
                                              "Keep draft and switch",
                                              "Giữ bản nháp và chuyển",
                                          )
                                        : undefined
                                }
                            >
                                <p>
                                    {confirmation.kind === "leave"
                                        ? text(
                                              "The draft stays in this preview until you save, discard or reload.",
                                              "Bản nháp được giữ trong bản xem thử đến khi lưu, bỏ thay đổi hoặc tải lại.",
                                          )
                                        : entity
                                          ? text(...entity.title)
                                          : ""}
                                </p>
                                {contents > 0 &&
                                    confirmation.kind !== "leave" && (
                                        <label className="review-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={ack}
                                                onChange={(event) =>
                                                    setAck(event.target.checked)
                                                }
                                            />
                                            {text(
                                                confirmation.kind === "archive"
                                                    ? "Include child Goals, Milestones and Tasks."
                                                    : "Continue even though some finite child work is unfinished.",
                                                confirmation.kind === "archive"
                                                    ? "Bao gồm mục tiêu con, cột mốc và công việc."
                                                    : "Tiếp tục dù còn công việc hữu hạn bên trong chưa hoàn thành.",
                                            )}
                                        </label>
                                    )}
                            </Confirm>
                        )}
                    </>,
                    document.body,
                )}
        </TaskDropZone>
    );
}
function TaskLine({ id, text }: { id: number; text: Text }) {
    const db = usePreviewData(),
        task = db.tasks.find((row) => row.id === id)!;
    const picker = useTaskPicker();
    return (
        <div className="review-task-line" draggable={!!picker.target && task.status !== "Done" && !task.seriesId}
            onDragStart={event => event.dataTransfer.setData(TASK_RETURN_MIME, String(id))}>
            <button
                className="review-round-check"
                aria-pressed={task.status === "Done"}
                aria-label={
                    text("Complete or reopen: ", "Hoàn thành hoặc mở lại: ") +
                    text(...task.title)
                }
                onClick={() => db.setTaskAction({ kind: "complete", id })}
            >
                {task.status === "Done" && <Check size={15} />}
            </button>
            <button
                className="review-task-line-name"
                onClick={() => db.setTaskAction({ kind: "edit", id })}
            >
                {text(...task.title)}
                <small>
                    {task.due
                        ? `${text("Due", "Hạn")} ${dateLabel(task.due, db.locale)}`
                        : text("No due date", "Chưa đặt hạn")}
                </small>
            </button>
            <Stars value={task.importance} text={text} />
            <button
                className="icon-button"
                aria-label={text("Open full task", "Mở trang công việc")}
                onClick={() => db.navigate("tasks", { task: id })}
            >
                <ChevronRight size={17} />
            </button>
        </div>
    );
}
function Fishbone({
    goal,
    milestones,
    page,
    onPage,
    text,
    onHead,
    onMilestone,
}: {
    goal: Goal;
    milestones: Milestone[];
    page: number;
    onPage: (page: number) => void;
    text: Text;
    onHead: () => void;
    onMilestone: (id: string) => void;
}) {
    const db = usePreviewData();
    const root = useRef<HTMLDivElement>(null),
        head = useRef<HTMLButtonElement>(null);
    const branches = useRef<(HTMLButtonElement | null)[]>([]);
    const visible = milestones.slice(page * 6, page * 6 + 6);
    const headProgress = goalProgress(
        goal.id,
        db.goals,
        db.milestones,
        db.tasks,
    );
    const [lines, setLines] = useState({
        width: 1,
        height: 1,
        spine: "",
        ribs: [] as string[],
    });
    useEffect(() => {
        const element = root.current!;
        let frame = 0;
        const draw = () => {
            const box = element.getBoundingClientRect(),
                origin = head.current!.getBoundingClientRect(),
                bounds = branches.current
                    .slice(0, visible.length)
                    .filter(Boolean)
                    .map((branch) => branch!.getBoundingClientRect());
            if (!bounds.length) return;
            const vertical = window.matchMedia("(max-width: 1000px)").matches;
            element.dataset.roadmapOrientation = vertical
                ? "vertical"
                : "horizontal";
            const x = origin.left + origin.width / 2 - box.left,
                y = origin.top + origin.height / 2 - box.top;
            setLines({
                width: box.width,
                height: box.height,
                spine: vertical
                    ? `M ${x} ${Math.min(...bounds.map((rect) => rect.top)) - box.top - 12} V ${origin.top - box.top}`
                    : `M ${Math.min(...bounds.map((rect) => rect.left)) - box.left - 12} ${y} H ${origin.left - box.left}`,
                ribs: bounds.map((rect) =>
                    vertical
                        ? `M ${(rect.left + rect.width / 2 < origin.left + origin.width / 2 ? rect.right : rect.left) - box.left} ${rect.top + rect.height / 2 - box.top} L ${x} ${rect.top + rect.height / 2 - box.top + 28}`
                        : `M ${rect.left + rect.width / 2 - box.left} ${(rect.top + rect.height / 2 < origin.top + origin.height / 2 ? rect.bottom : rect.top) - box.top} L ${rect.left + rect.width / 2 - box.left + 40} ${y}`,
                ),
            });
        };
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        });
        observer.observe(element);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [goal.id, page, visible.map((row) => row.title.join()).join()]);
    return (
        <div
            ref={root}
            className="goal-roadmap review-fishbone"
            data-roadmap-layout="fishbone"
            data-roadmap-empty={!visible.length}
            style={
                {
                    "--fishbone-pairs": Math.ceil(visible.length / 2),
                    "--fishbone-head-row": Math.ceil(visible.length / 2) + 1,
                    "--fishbone-page-row": Math.ceil(visible.length / 2) + 2,
                } as CSSProperties
            }
        >
            <svg
                className="roadmap-connections"
                viewBox={`0 0 ${lines.width || 1} ${lines.height || 1}`}
                aria-hidden="true"
            >
                <path d={lines.spine} />
                {lines.ribs.map((path, index) => (
                    <path key={index} d={path} />
                ))}
            </svg>
            {visible.map((row, index) => {
                const children = db.tasks.filter(
                    (task) =>
                        !task.archived &&
                        !task.seriesId &&
                        task.parent === row.id,
                );
                const completed = children.filter(
                    (task) => task.status === "Done",
                ).length;
                const waiting = row.prerequisites
                    .map((id) => db.milestones.find((item) => item.id === id))
                    .filter((item) => item && item.status !== "Done");
                return (
                    <button
                        ref={(element) => {
                            branches.current[index] = element;
                        }}
                        key={row.id}
                        className={`roadmap-branch ${row.status === "Done" ? "is-done" : ""}`}
                        style={
                            {
                                "--branch-column": Math.floor(index / 2) + 1,
                                "--branch-row": index % 2 === 0 ? 1 : 3,
                                "--mobile-column": (index % 2) + 1,
                                "--mobile-row": Math.floor(index / 2) + 1,
                            } as CSSProperties
                        }
                        onClick={() => onMilestone(row.id)}
                    >
                        <span className="milestone-icon">
                            <EntityIcon name={row.icon} color={row.color} />
                        </span>
                        <strong>{text(...row.title)}</strong>
                        <small>
                            {completed}/{children.length}{" "}
                            {text("tasks", "công việc")}

                        </small>
                        <Stars value={row.importance} text={text} />
                        {!!waiting.length && (
                            <small className="roadmap-locked">
                                {text("After", "Sau")}{" "}
                                {waiting
                                    .map((item) => text(...item!.title))
                                    .join(", ")}
                            </small>
                        )}
                        <span className="progress-track" aria-hidden="true">
                            <i
                                style={
                                    {
                                        "--progress": `${children.length ? Math.round((completed / children.length) * 100) : row.status === "Done" ? 100 : 0}%`,
                                    } as CSSProperties
                                }
                            />
                        </span>
                        <ul className="roadmap-task-preview">
                            {children.length ? (
                                (children.some((task) => task.status !== "Done")
                                    ? children.filter(
                                          (task) => task.status !== "Done",
                                      )
                                    : children
                                )
                                    .slice(0, 2)
                                    .map((task) => (
                                        <li key={task.id}>
                                            {task.status === "Done" && "✓ "}
                                            {text(...task.title)}
                                        </li>
                                    ))
                            ) : (
                                <li>
                                    {text(
                                        "Add your first task",
                                        "Thêm công việc đầu tiên",
                                    )}
                                </li>
                            )}
                        </ul>
                    </button>
                );
            })}
            <button
                ref={head}
                className="roadmap-center"
                data-open-goal-information
                aria-haspopup="dialog"
                onClick={onHead}
            >
                <EntityIcon name={goal.icon} color={goal.color} />
                <span className="roadmap-goal-name">{text(...goal.title)}</span>
                <span className="roadmap-goal-state" data-roadmap-goal-state>
                    {headProgress === null ? "—" : `${headProgress}%`}
                </span>
                <span className="roadmap-goal-cta">
                    {text("Goal information", "Thông tin mục tiêu")} →
                </span>
            </button>
            {!visible.length && (
                <p className="review-inline-empty">
                    {text(
                        "Add the first Milestone to shape this roadmap.",
                        "Thêm cột mốc đầu tiên để hình thành lộ trình.",
                    )}
                </p>
            )}
            {milestones.length > 6 && (
                <div className="roadmap-pagination">
                    <button
                        className="icon-button"
                        disabled={page === 0}
                        aria-label={text(
                            "Previous Milestones",
                            "Các cột mốc trước",
                        )}
                        onClick={() => onPage(page - 1)}
                    >
                        <ChevronLeft size={17} />
                    </button>
                    <span>
                        {page + 1}/{Math.ceil(milestones.length / 6)}
                    </span>
                    <button
                        className="icon-button"
                        disabled={(page + 1) * 6 >= milestones.length}
                        aria-label={text("Next Milestones", "Các cột mốc tiếp")}
                        onClick={() => onPage(page + 1)}
                    >
                        <ChevronRight size={17} />
                    </button>
                </div>
            )}
        </div>
    );
}
