"use client";

import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { usePreviewData, dateLabel } from "./preview/workspace-data";
import { blankDraft } from "./preview/task-data";
import { statuses } from "./preview/dashboard-data";
import { Confirm } from "./ui/patterns";
import { FloatingTaskPicker } from "./ui/floating-task-picker";
import { TASK_PICKER_MIME, pickedTaskPatch, returnedTaskPatch, readPickedTask, taskCanReturn, taskDate, taskIsPicked, type TaskPickerTarget } from "@/lib/task-picker";

type PickerActions = {
    target: TaskPickerTarget | null;
    open: (target: TaskPickerTarget) => void;
    close: () => void;
    add: (id: number, target: TaskPickerTarget) => void;
    remove: (id: number, target: TaskPickerTarget) => void;
};
const Context = createContext<PickerActions | null>(null);
export function useTaskPicker() {
    const value = useContext(Context);
    if (!value) throw new Error("Task picker requires its workspace provider");
    return value;
}

export function TaskPickerProvider({ children }: { children: ReactNode }) {
    const db = usePreviewData();
    const latest = useRef(db);
    latest.current = db;
    const [target, setTarget] = useState<TaskPickerTarget | null>(null);
    const [error, setError] = useState("");
    const [busyIds, setBusyIds] = useState<number[]>([]);
    const processing = useRef(new Set<number>());
    const [transfer, setTransfer] = useState<{ id: number; target: TaskPickerTarget } | null>(null);
    const text = (en: string, vi: string) => db.locale === "vi" ? vi : en;
    useEffect(() => { setTarget(null); setTransfer(null); setError(""); }, [db.nav.section, db.nav.goal, db.nav.milestone]);
    useEffect(() => setError(""), [db.locale]);
    const parentLabel = (id: string) => {
        const row = db.goals.find(row => row.id === id) || db.milestones.find(row => row.id === id);
        return row ? text(...row.title) : text("Inbox", "Hộp thư đến");
    };
    const targetLabel = (value: TaskPickerTarget) => value.kind === "plan"
        ? text(value.period === "today" ? "Today's plan" : "This week's plan", value.period === "today" ? "Kế hoạch hôm nay" : "Kế hoạch tuần")
        : value.kind === "calendar" ? dateLabel(value.date, db.locale, true) : parentLabel(value.id);
    async function commit(id: number, destination: TaskPickerTarget, confirmed = false, returning = false): Promise<boolean> {
        if (processing.current.has(id)) return false;
        setError("");
        processing.current.add(id);
        setBusyIds([...processing.current]);
        try {
            const runtime = latest.current.live;
            if (runtime && !(await runtime.flush())) throw new Error(text("Resolve the pending save before adding tasks.", "Hãy xử lý thông báo lưu đang chờ trước khi thêm công việc."));
            const data = latest.current;
            const task = data.tasks.find(row => row.id === id && !row.archived && row.status !== "Done");
            if (!task) throw new Error(text("This task is no longer available.", "Công việc này không còn khả dụng."));
            if (returning ? !taskCanReturn(task, destination) : taskIsPicked(task, destination)) return true;
            if (destination.kind !== "plan" && task.seriesId)
                throw new Error(text("Edit dates and parents in the repeating series.", "Hãy chỉnh ngày và mục cha trong chuỗi lặp."));
            if (!returning && destination.kind === "calendar" && !/^\d{4}-\d{2}-\d{2}$/.test(destination.date))
                throw new Error(text("Choose a valid date.", "Hãy chọn ngày hợp lệ."));
            if (!returning && destination.kind === "parent") {
                const parent = data.goals.find(row => row.id === destination.id) || data.milestones.find(row => row.id === destination.id);
                const goal = data.milestones.find(row => row.id === destination.id)?.goal;
                if (!parent || parent.archived || parent.status === "Done" || (goal && data.goals.some(row => row.id === goal && (row.archived || row.status === "Done"))))
                    throw new Error(text("Reopen or restore the parent before adding tasks.", "Hãy mở lại hoặc khôi phục mục cha trước khi thêm công việc."));
                if (!confirmed && task.parent && task.parent !== "inbox") {
                    setTransfer({ id, target: destination });
                    return false;
                }
            }
            data.setTasks(rows => rows.map(row => row.id === id ? { ...row, ...(returning ? returnedTaskPatch(destination) : pickedTaskPatch(row, destination)) } : row));
            if (runtime && !(await runtime.flush()))
                throw new Error(text("The change has not been saved. Use the save error's Retry action.", "Thay đổi chưa được lưu. Hãy dùng nút Thử lại trong thông báo lỗi lưu."));
            return true;
        } catch (err) {
            setError((err as Error).message);
            return false;
        } finally {
            processing.current.delete(id);
            setBusyIds([...processing.current]);
        }
    }
    const open = (value: TaskPickerTarget) => { setError(""); setTarget(value); };
    const add = (id: number, destination: TaskPickerTarget) => { void commit(id, destination); };
    const remove = (id: number, destination: TaskPickerTarget) => { void commit(id, destination, false, true); };
    const moveTask = transfer ? db.tasks.find(row => row.id === transfer.id) : null;
    return <Context.Provider value={{ target, open, close: () => setTarget(null), add, remove }}>
        {children}
        {target && <FloatingTaskPicker className={target.kind === "calendar" ? "calendar-task-picker" : undefined} text={text} destination={targetLabel(target)} error={error} busyIds={busyIds}
            goals={db.goals.filter(row => !row.archived).map(row => ({ id: row.id, title: text(...row.title) }))}
            tasks={db.tasks.filter(row => !row.archived && row.status !== "Done").map(row => {
                const milestone = db.milestones.find(item => item.id === row.parent);
                const goalId = milestone?.goal || (db.goals.some(item => item.id === row.parent) ? row.parent : "inbox");
                const status = statuses.find(([key]) => key === row.status)!;
                const metadata = taskDate(row) ? dateLabel(taskDate(row), db.locale) : text(status[1], status[2]);
                return { id: row.id, title: text(...row.title), goalId, goalLabel: parentLabel(row.parent), metadata,
                    scheduled: !!taskDate(row), selected: taskIsPicked(row, target), returnable: taskCanReturn(row, target),
                    disabledReason: target.kind !== "plan" && row.seriesId ? text("Edit in the repeating series", "Chỉnh trong chuỗi lặp") : undefined };
            })}
            hint={target.kind === "plan" ? text("Adds to the plan without changing dates or status. Drag a task to a highlighted destination, or press Add.", "Thêm vào kế hoạch, giữ nguyên ngày và trạng thái. Kéo công việc vào vùng nhận hoặc bấm Thêm.")
                : target.kind === "calendar" ? text("Moves the task's date interval together, keeping its local clock times. Drag to a day or press Add.", "Dời khoảng ngày của công việc, giữ nguyên giờ. Kéo vào một ngày hoặc bấm Thêm.")
                : text("Sets the task's primary parent. Moving from another parent requires confirmation.", "Gắn công việc vào mục cha này. Chuyển từ mục cha khác cần xác nhận.")}
            returnTarget={JSON.stringify({ kind: "tray", target })}
            returnLabel={target.kind === "calendar" ? text("Clear dates", "Gỡ ngày") : target.kind === "parent" ? text("Move to Inbox", "Đưa về Inbox") : text("Remove from plan", "Bỏ khỏi kế hoạch")}
            returnHint={target.kind === "calendar" ? text("Drop a scheduled task here to clear its dates.", "Kéo công việc từ lịch về đây để gỡ ngày.") : target.kind === "parent" ? text("Drop a task here to move it to Inbox.", "Kéo công việc về đây để đưa về Inbox.") : text("Drop a task here to remove it from this plan.", "Kéo công việc về đây để bỏ khỏi kế hoạch này.")}
            onReturn={id => remove(id, target)}
            onAdd={id => add(id, target)} onClose={() => setTarget(null)}
            onCreate={() => {
                const draft = { ...blankDraft(), ...(target.kind === "parent" ? { parent: target.id }
                    : target.kind === "calendar" ? { scheduledDay: target.date }
                    : { plan: target.period === "today" ? "today" as const : "week" as const }) };
                setTarget(null);
                db.setTaskAction({ kind: "create", draft });
            }}
            onPointerDrop={(id, value) => {
                try {
                    const destination = JSON.parse(value) as TaskPickerTarget | { kind: "tray"; target: TaskPickerTarget };
                    if (destination.kind === "tray") {
                        if (["plan", "calendar", "parent"].includes(destination.target?.kind)) remove(id, destination.target);
                    } else if (["plan", "calendar", "parent"].includes(destination.kind)) add(id, destination);
                } catch { /* Ignore drops outside a workspace destination. */ }
            }} />}
        {transfer && moveTask && <Confirm text={text} title={text("Move task to this parent?", "Chuyển công việc sang mục cha này?")}
            onClose={() => setTransfer(null)} onConfirm={async () => {
                if (!(await commit(transfer.id, transfer.target, true))) throw new Error(text("The task could not be moved. Check the save error and retry.", "Chưa chuyển được công việc. Kiểm tra lỗi lưu rồi thử lại."));
                setTransfer(null);
            }}><p>{text(...moveTask.title)}</p><p>{parentLabel(moveTask.parent)} → {targetLabel(transfer.target)}</p></Confirm>}
    </Context.Provider>;
}

export function TaskDropZone({ target, as: Element = "div", onDrop, onDragOver, onDragLeave, className = "", children, ...props }:
    HTMLAttributes<HTMLElement> & { target?: TaskPickerTarget; as?: "div" | "section" | "span"; children?: ReactNode }) {
    const picker = useTaskPicker();
    const [over, setOver] = useState(false);
    const enabled = !!target;
    return <Element {...props} className={`task-drop-zone ${className}`}
        data-task-drop-target={enabled ? JSON.stringify(target) : undefined}
        data-task-drop-active={over || undefined}
        data-task-picker-open={enabled && !!picker.target || undefined}
        onDragOver={event => {
            if (enabled && event.dataTransfer.types.includes(TASK_PICKER_MIME)) {
                event.preventDefault(); event.stopPropagation(); setOver(true);
            } else onDragOver?.(event);
        }} onDragLeave={event => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false);
            onDragLeave?.(event);
        }} onDrop={event => {
            setOver(false);
            if (target && event.dataTransfer.types.includes(TASK_PICKER_MIME)) {
                event.preventDefault(); event.stopPropagation();
                const id = readPickedTask(event.dataTransfer.getData(TASK_PICKER_MIME));
                if (id !== null) picker.add(id, target);
            } else onDrop?.(event);
        }}>{children}</Element>;
}
