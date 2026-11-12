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

export function taskDate(task: Pick<TaskRecord, "scheduledDay">) {
    return task.scheduledDay;
}

export function taskIsPicked(task: TaskRecord, target: TaskPickerTarget) {
    if (target.kind === "plan") return target.period === "today" ? task.daily : task.weekly;
    if (target.kind === "parent") return task.parent === target.id;
    return taskDate(task) === target.date;
}

// Calendar placement is an account-local day, independent of Task start and due dates.
export function pickedTaskPatch(task: TaskRecord, target: TaskPickerTarget): Partial<TaskRecord> {
    if (target.kind === "plan")
        return { weekly: true, daily: task.daily || target.period === "today" };
    if (target.kind === "parent") return { parent: target.id };
    return { scheduledDay: target.date };
}

export function taskCanReturn(task: TaskRecord, target: TaskPickerTarget) {
    return target.kind === "calendar" ? !!taskDate(task) : taskIsPicked(task, target);
}

export function returnedTaskPatch(target: TaskPickerTarget): Partial<TaskRecord> {
    if (target.kind === "plan") return target.period === "today"
        ? { daily: false } : { daily: false, weekly: false };
    if (target.kind === "parent") return { parent: "" };
    return { scheduledDay: "" };
}
