import type { PreviewTask } from "./shared";

export type Label = [string, string];
export type PlanningStatus = "NotStarted" | "InProgress" | "Blocked" | "Done";
export type TaskStatus = "NotStarted" | "Done";
export type DashboardTask = Omit<PreviewTask, "title" | "done"> & {
    title: Label;
    status: TaskStatus;
    daily: boolean;
    weekly: boolean;
    scheduled: string;
    automaticToday?: boolean;
    automaticWeek?: boolean;
};
export const planningStatuses: [PlanningStatus, string, string][] = [
    ["NotStarted", "Not started", "Chưa bắt đầu"],
    ["InProgress", "In progress", "Đang thực hiện"],
    ["Blocked", "Blocked", "Đang bị chặn"],
    ["Done", "Completed", "Đã hoàn thành"],
];
export const statuses: [TaskStatus, string, string][] = [
    ["NotStarted", "Not completed", "Chưa hoàn thành"],
    ["Done", "Completed", "Đã hoàn thành"],
];
export const weekdays: Label[] = [
    ["Mon", "T2"],
    ["Tue", "T3"],
    ["Wed", "T4"],
    ["Thu", "T5"],
    ["Fri", "T6"],
    ["Sat", "T7"],
    ["Sun", "CN"],
];
export const sampleDay = (offset: number) =>
    new Date(Date.UTC(2026, 10, 7 + offset));
