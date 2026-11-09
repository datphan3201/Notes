import type { TaskRecord } from "../components/preview/task-data";

export const TASK_PICKER_MIME = "application/x-planner-task";
// Keep ordinary Calendar date-move handlers separate from tray returns.
export const TASK_RETURN_MIME = "application/x-planner-task-return";
export type TaskPickerTarget =
    | { kind: "plan"; period: "today" | "week" }
    | { kind: "calendar"; date: string }
    | { kind: "parent"; id: string };

export function readPickedTask(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const id = Number(value);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function taskDate(task: Pick<TaskRecord, "scheduledStart" | "start" | "due">) {
    return task.scheduledStart.slice(0, 10) || task.start || task.due;
}

export function taskIsPicked(task: TaskRecord, target: TaskPickerTarget) {
    if (target.kind === "plan") return target.period === "today" ? task.daily : task.weekly;
    if (target.kind === "parent") return task.parent === target.id;
    return taskDate(task) === target.date;
}

// These are account-local date strings, not UTC instants. Preserve the local
// clock time and the complete date interval; the ordinary API adapter converts instants.
export function pickedTaskPatch(task: TaskRecord, target: TaskPickerTarget): Partial<TaskRecord> {
    if (target.kind === "plan")
        return { weekly: true, daily: task.daily || target.period === "today" };
    if (target.kind === "parent") return { parent: target.id };
    const origin = taskDate(task);
    if (!origin) return { due: target.date };
    const delta = Math.round((Date.parse(target.date) - Date.parse(origin)) / 86_400_000);
    const shift = (value: string) => {
        if (!value) return value;
        const date = new Date(value.slice(0, 10) + "T00:00:00Z");
        date.setUTCDate(date.getUTCDate() + delta);
        return date.toISOString().slice(0, 10) + value.slice(10);
    };
    return {
        start: shift(task.start), due: shift(task.due),
        scheduledStart: shift(task.scheduledStart), scheduledEnd: shift(task.scheduledEnd),
    };
}

export function taskCanReturn(task: TaskRecord, target: TaskPickerTarget) {
    return target.kind === "calendar" ? !!taskDate(task) : taskIsPicked(task, target);
}

export function returnedTaskPatch(target: TaskPickerTarget): Partial<TaskRecord> {
    if (target.kind === "plan") return target.period === "today"
        ? { daily: false } : { daily: false, weekly: false };
    if (target.kind === "parent") return { parent: "" };
    return { start: "", due: "", scheduledStart: "", scheduledEnd: "" };
}
