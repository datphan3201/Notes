"use client";

import { useEffect, useRef, useState } from "react";
import { AlarmClock, CalendarDays, Check, Repeat2 } from "lucide-react";
import Dialog from "../dialog";
import { Stars } from "./ui";
import { weekdays } from "./dashboard-data";
import {
    demoToday as fixtureToday,
    formatTaskDate,
    frequencies,
    nextDates,
    tagOptions as fixtureTags,
    type TaskDraft,
} from "./task-data";
import { addDays, monday } from "@/lib/task-views";
import { usePreviewData } from "./workspace-data";
import type { PreviewLocale, Text } from "./shared";

export default function TaskPreviewEditor({
    initial,
    mode,
    locale,
    text,
    completedParents,
    onClose,
    onSave,
}: {
    initial: TaskDraft;
    mode: "create" | "edit" | "series";
    locale: PreviewLocale;
    text: Text;
    completedParents: string[];
    onClose: () => void;
    onSave: (draft: TaskDraft) => void | boolean | Promise<void | boolean>;
}) {
    const db = usePreviewData();
    const tagOptions = db.live?.tags || fixtureTags;
    const { parents } = db;
    const demoToday = db.today || fixtureToday;
    const [draft, setDraft] = useState(initial);
    const [baseline, setBaseline] = useState(initial);
    const [discard, setDiscard] = useState(false);
    const [conflict, setConflict] = useState(false);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [panel, setPanel] = useState("");
    const titleInput = useRef<HTMLInputElement>(null);
    const conflictNotice = useRef<HTMLElement>(null);
    useEffect(() => {
        if (!discard) titleInput.current?.focus();
    }, [discard]);
    useEffect(() => {
        if (conflict) {
            conflictNotice.current?.scrollIntoView({ block: "start" });
            conflictNotice.current?.focus();
        }
    }, [conflict]);
    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
    const repeating = draft.rule.frequency !== "none";
    const dates = nextDates(draft.rule);
    const change = <K extends keyof TaskDraft>(key: K, value: TaskDraft[K]) => {
        setDraft((current) => ({ ...current, [key]: value }));
        setError("");
    };
    const close = () => (dirty ? setDiscard(true) : onClose());
    const simulateSaved = {
        ...initial,
        description: text(
            "Updated saved example. Your draft is kept until you choose.",
            "Bản lưu mẫu đã cập nhật. Bản nháp được giữ đến khi bạn chọn.",
        ),
    };
    return (
        <Dialog
            title={
                discard
                    ? text("Discard your changes?", "Bỏ thay đổi chưa lưu?")
                    : text(
                          mode === "create"
                              ? "New task"
                              : mode === "series"
                                ? "Edit repeating template"
                                : "Edit task",
                          mode === "create"
                              ? "Công việc mới"
                              : mode === "series"
                                ? "Sửa mẫu công việc lặp lại"
                                : "Chỉnh sửa công việc",
                      )
            }
            closeLabel={text("Close", "Đóng")}
            onClose={discard ? () => setDiscard(false) : close}
            className={`preview-dialog ${discard ? "preview-confirm" : mode === "create" ? "preview-task-capture" : "preview-sheet"} preview-task-editor`}
        >
            {discard ? (
                <>
                    <div className="preview-dialog-body">
                        <p>
                            {text(
                                "Keep editing to preserve this draft, or discard it and return to your task.",
                                "Tiếp tục sửa để giữ bản nháp, hoặc bỏ thay đổi và quay lại công việc.",
                            )}
                        </p>
                    </div>
                    <footer className="preview-dialog-footer">
                        <button
                            autoFocus
                            className="button button-quiet"
                            onClick={() => setDiscard(false)}
                        >
                            {text("Keep editing", "Tiếp tục sửa")}
                        </button>
                        <button
                            className="button button-danger"
                            onClick={onClose}
                        >
                            {text("Discard changes", "Bỏ thay đổi")}
                        </button>
                    </footer>
                </>
            ) : (
                <form
                    className="preview-dialog-form"
                    onSubmit={async (event) => {
                        event.preventDefault();
                        if (!draft.title.trim()) {
                            setError(
                                text(
                                    "Give this task a name.",
                                    "Nhập tên công việc.",
                                ),
                            );
                            titleInput.current?.focus();
                            return;
                        }
                        if (
                            draft.start &&
                            draft.due &&
                            draft.due < draft.start
                        ) {
                            setError(
                                text(
                                    "The due date must be on or after the start date.",
                                    "Hạn hoàn thành phải từ ngày bắt đầu trở đi.",
                                ),
                            );
                            return;
                        }
                        if (
                            repeating &&
                            draft.due &&
                            draft.due < draft.rule.start
                        ) {
                            setError(
                                text(
                                    "The due date cannot be before the repeating start date.",
                                    "Hạn hoàn thành không thể trước ngày bắt đầu lặp.",
                                ),
                            );
                            return;
                        }
                        if (
                            repeating &&
                            (!dates.length ||
                                (draft.rule.end &&
                                    draft.rule.end < draft.rule.start))
                        ) {
                            setError(
                                text(
                                    "Choose a start, valid weekdays and an end after the start.",
                                    "Chọn ngày bắt đầu, các thứ lặp hợp lệ và ngày kết thúc từ ngày bắt đầu trở đi.",
                                ),
                            );
                            return;
                        }
                        if (conflict) return;
                        setSubmitting(true);
                        try {
                            await onSave({
                                ...draft,
                                title: draft.title.trim(),
                                plan: repeating ? "none" : draft.plan,
                            });
                        } catch (err) {
                            setError((err as Error).message);
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                >
                    <div className="preview-dialog-body stack-form">
                        {conflict && (
                            <aside
                                className="notice preview-task-conflict"
                                ref={conflictNotice}
                                tabIndex={-1}
                                role="alert"
                            >
                                <strong>
                                    {text(
                                        "This task changed elsewhere",
                                        "Công việc có thay đổi ở bản lưu khác",
                                    )}
                                </strong>
                                <p>
                                    {text(
                                        "Preview example. Your unsaved edits are preserved while you choose a version.",
                                        "Tình huống xem thử. Thay đổi chưa lưu được giữ trong lúc bạn chọn phiên bản.",
                                    )}
                                </p>
                                <div className="action-row">
                                    <button
                                        type="button"
                                        className="button button-quiet"
                                        onClick={() => {
                                            setDraft(simulateSaved);
                                            setBaseline(simulateSaved);
                                            setConflict(false);
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
                                        onClick={() => {
                                            setBaseline(simulateSaved);
                                            setConflict(false);
                                        }}
                                    >
                                        {text(
                                            "Keep my draft",
                                            "Giữ bản nháp của tôi",
                                        )}
                                    </button>
                                </div>
                            </aside>
                        )}
                        <label className="field">
                            {text("Task name", "Tên công việc")}
                            <input
                                ref={titleInput}
                                value={draft.title}
                                maxLength={200}
                                required
                                onChange={(event) =>
                                    change("title", event.target.value)
                                }
                                placeholder={text(
                                    "What needs to get done?",
                                    "Bạn cần làm gì?",
                                )}
                            />
                        </label>
                        <label className="field">
                            {text("Add to", "Thêm vào")}
                            <select
                                value={draft.parent}
                                onChange={(event) =>
                                    change("parent", event.target.value)
                                }
                            >
                                {parents.map((parent) => (
                                    <option
                                        key={parent.id}
                                        value={parent.id}
                                        disabled={
                                            (parent.archived ||
                                                completedParents.includes(
                                                    parent.goal,
                                                )) &&
                                            parent.id !== initial.parent
                                        }
                                    >
                                        {text(...parent.label)}
                                    </option>
                                ))}
                            </select>
                        </label>
                        {!repeating && (
                            <label className="field">
                                {text("Plan for", "Lên kế hoạch cho")}
                                <select
                                    value={draft.plan}
                                    onChange={(event) =>
                                        change(
                                            "plan",
                                            event.target
                                                .value as TaskDraft["plan"],
                                        )
                                    }
                                >
                                    <option value="none">
                                        {text("Decide later", "Quyết định sau")}
                                    </option>
                                    <option value="today">
                                        {text("Today", "Hôm nay")}
                                    </option>
                                    <option value="week">
                                        {text("This week", "Tuần này")}
                                    </option>
                                </select>
                                <small>
                                    {text(
                                        "Planning does not change task dates or status.",
                                        "Lên kế hoạch không thay đổi trạng thái hoặc ngày công việc.",
                                    )}
                                </small>
                            </label>
                        )}
                        {mode === "edit" && (
                            <div className="field">
                                <span>{text("Status", "Trạng thái")}</span>
                                <strong>{initial.status === "Done"
                                    ? text("Completed", "Đã hoàn thành")
                                    : text("Not completed", "Chưa hoàn thành")}</strong>
                                <small>{text("Use Complete or Reopen on the task to change completion.", "Dùng nút Hoàn thành hoặc Mở lại trên công việc để đổi trạng thái.")}</small>
                            </div>
                        )}
                        <details className="preview-task-disclosure">
                            <summary>
                                {text(
                                    "Description and completion criteria",
                                    "Mô tả và tiêu chí hoàn thành",
                                )}
                            </summary>
                            <div className="stack-form">
                                <label className="field">
                                    {text("Description", "Mô tả")}
                                    <textarea
                                        rows={3}
                                        maxLength={10000}
                                        value={draft.description}
                                        onChange={(event) =>
                                            change(
                                                "description",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                                <label className="field">
                                    {text(
                                        "Completion criteria",
                                        "Tiêu chí hoàn thành",
                                    )}
                                    <textarea
                                        rows={3}
                                        maxLength={10000}
                                        value={draft.criteria}
                                        onChange={(event) =>
                                            change(
                                                "criteria",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                                <label className="field">
                                    {text(
                                        "Expected result",
                                        "Kết quả mong đợi",
                                    )}
                                    <textarea
                                        rows={2}
                                        maxLength={10000}
                                        value={draft.outcome}
                                        onChange={(event) =>
                                            change(
                                                "outcome",
                                                event.target.value,
                                            )
                                        }
                                    />
                                </label>
                            </div>
                        </details>
                        <div>
                            <div
                                className="schedule-toolbar"
                                role="group"
                                aria-label={text(
                                    "Dates, reminder and repeat",
                                    "Ngày, nhắc nhở và lặp lại",
                                )}
                            >
                                {[
                                    [
                                        "dates",
                                        CalendarDays,
                                        "Dates",
                                        "Ngày",
                                    ],
                                    [
                                        "reminder",
                                        AlarmClock,
                                        "Reminder",
                                        "Nhắc nhở",
                                    ],
                                    ["repeat", Repeat2, "Repeat", "Lặp lại"],
                                ]
                                    .filter(
                                        ([key]) =>
                                            mode !== "edit" || key !== "repeat",
                                    )
                                    .map(([key, Icon, en, vi]) => {
                                        const ControlIcon =
                                            Icon as typeof CalendarDays;
                                        return (
                                            <button
                                                key={key as string}
                                                type="button"
                                                className="button button-quiet"
                                                aria-expanded={panel === key}
                                                aria-controls="preview-task-schedule-panel"
                                                aria-label={text(
                                                    en as string,
                                                    vi as string,
                                                )}
                                                title={text(
                                                    en as string,
                                                    vi as string,
                                                )}
                                                onClick={() =>
                                                    setPanel(
                                                        panel === key
                                                            ? ""
                                                            : (key as string),
                                                    )
                                                }
                                            >
                                                <ControlIcon size={18} />
                                                <span>
                                                    {text(
                                                        en as string,
                                                        vi as string,
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                            </div>
                            {panel && (
                                <section
                                    id="preview-task-schedule-panel"
                                    className="preview-task-schedule-panel stack-form"
                                    aria-label={text(
                                        panel === "repeat"
                                            ? "Repeat settings"
                                            : panel === "reminder"
                                              ? "Reminder settings"
                                              : "Dates",
                                        panel === "repeat"
                                            ? "Thiết lập lặp lại"
                                            : panel === "reminder"
                                              ? "Thiết lập nhắc nhở"
                                              : "Ngày và lịch",
                                    )}
                                >
                                    {panel === "dates" ? (
                                        <>
                                            <div className="preview-task-date-presets">
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        change("due", demoToday)
                                                    }
                                                >
                                                    {text("Today", "Hôm nay")}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        change(
                                                            "due",
                                                            addDays(
                                                                demoToday,
                                                                1,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    {text(
                                                        "Tomorrow",
                                                        "Ngày mai",
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        change(
                                                            "due",
                                                            addDays(
                                                                monday(
                                                                    demoToday,
                                                                ),
                                                                7,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    {text(
                                                        "Next Monday",
                                                        "Thứ hai tới",
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-button"
                                                    onClick={() =>
                                                        change("due", "")
                                                    }
                                                >
                                                    {text(
                                                        "Clear due date",
                                                        "Bỏ hạn",
                                                    )}
                                                </button>
                                            </div>
                                            <div className="preview-task-field-pair">
                                                <label className="field">
                                                    {text(
                                                        "Start date",
                                                        "Ngày bắt đầu",
                                                    )}
                                                    <input
                                                        type="date"
                                                        value={draft.start}
                                                        onChange={(event) =>
                                                            change(
                                                                "start",
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </label>
                                                <label className="field">
                                                    {text(
                                                        "Due date",
                                                        "Hạn hoàn thành",
                                                    )}
                                                    <input
                                                        type="date"
                                                        value={draft.due}
                                                        onChange={(event) =>
                                                            change(
                                                                "due",
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </label>
                                            </div>
                                        </>
                                    ) : panel === "reminder" ? (
                                        <>
                                            <label className="field">
                                                {text("Remind me", "Nhắc tôi")}
                                                <select
                                                    value={draft.reminder}
                                                    onChange={(event) =>
                                                        change(
                                                            "reminder",
                                                            event.target.value,
                                                        )
                                                    }
                                                >
                                                    <option value="none">
                                                        {text(
                                                            "No reminder",
                                                            "Không nhắc",
                                                        )}
                                                    </option>
                                                    <option
                                                        value="due"
                                                        disabled={!draft.due}
                                                    >
                                                        {text(
                                                            "09:00 on the due date",
                                                            "09:00 ngày đến hạn",
                                                        )}
                                                    </option>
                                                    <option
                                                        value="dayBefore"
                                                        disabled={!draft.due}
                                                    >
                                                        {text(
                                                            "09:00 the day before the due date",
                                                            "09:00 một ngày trước hạn",
                                                        )}
                                                    </option>
                                                    <option value="custom">
                                                        {text(
                                                            "Choose date and time",
                                                            "Chọn ngày và giờ",
                                                        )}
                                                    </option>
                                                </select>
                                            </label>
                                            {draft.reminder === "custom" && (
                                                <label className="field">
                                                    {text(
                                                        "Reminder date and time",
                                                        "Ngày và giờ nhắc",
                                                    )}
                                                    <input
                                                        type="datetime-local"
                                                        required
                                                        value={draft.reminderAt}
                                                        onChange={(event) =>
                                                            change(
                                                                "reminderAt",
                                                                event.target
                                                                    .value,
                                                            )
                                                        }
                                                    />
                                                </label>
                                            )}
                                            <p className="subtle-copy">
                                                {text(
                                                    "Add a due date to enable due-date reminders.",
                                                    "Đặt hạn hoàn thành để dùng nhắc nhở theo hạn.",
                                                )}
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <label className="field">
                                                {text("Frequency", "Tần suất")}
                                                <select
                                                    value={draft.rule.frequency}
                                                    onChange={(event) =>
                                                        change("rule", {
                                                            ...draft.rule,
                                                            frequency: event
                                                                .target
                                                                .value as TaskDraft["rule"]["frequency"],
                                                        })
                                                    }
                                                >
                                                    {frequencies.map(
                                                        ([key, en, vi]) => (
                                                            <option
                                                                key={key}
                                                                value={key}
                                                                disabled={
                                                                    mode ===
                                                                        "series" &&
                                                                    key ===
                                                                        "none"
                                                                }
                                                            >
                                                                {text(en, vi)}
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </label>
                                            {repeating && (
                                                <>
                                                    <label className="field">
                                                        {text(
                                                            "Repeat every",
                                                            "Lặp lại mỗi",
                                                        )}
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={365}
                                                            required
                                                            value={
                                                                draft.rule
                                                                    .interval
                                                            }
                                                            onChange={(event) =>
                                                                change("rule", {
                                                                    ...draft.rule,
                                                                    interval:
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        ) || 1,
                                                                })
                                                            }
                                                        />
                                                        <small>
                                                            {text(
                                                                ...(frequencies
                                                                    .find(
                                                                        ([
                                                                            key,
                                                                        ]) =>
                                                                            key ===
                                                                            draft
                                                                                .rule
                                                                                .frequency,
                                                                    )!
                                                                    .slice(
                                                                        1,
                                                                    ) as [
                                                                    string,
                                                                    string,
                                                                ]),
                                                            )}
                                                        </small>
                                                    </label>
                                                    {draft.rule.frequency ===
                                                        "weekly" && (
                                                        <div
                                                            className="preview-task-weekdays"
                                                            role="group"
                                                            aria-label={text(
                                                                "Repeat on",
                                                                "Lặp vào các thứ",
                                                            )}
                                                        >
                                                            {weekdays.map(
                                                                (
                                                                    label,
                                                                    index,
                                                                ) => (
                                                                    <button
                                                                        type="button"
                                                                        key={
                                                                            index
                                                                        }
                                                                        className="button button-quiet"
                                                                        aria-pressed={draft.rule.weekdays.includes(
                                                                            index,
                                                                        )}
                                                                        onClick={() =>
                                                                            change(
                                                                                "rule",
                                                                                {
                                                                                    ...draft.rule,
                                                                                    weekdays:
                                                                                        draft.rule.weekdays.includes(
                                                                                            index,
                                                                                        )
                                                                                            ? draft.rule.weekdays.filter(
                                                                                                  (
                                                                                                      day,
                                                                                                  ) =>
                                                                                                      day !==
                                                                                                      index,
                                                                                              )
                                                                                            : [
                                                                                                  ...draft
                                                                                                      .rule
                                                                                                      .weekdays,
                                                                                                  index,
                                                                                              ],
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        {text(
                                                                            ...label,
                                                                        )}
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="preview-task-field-pair">
                                                        <label className="field">
                                                            {text(
                                                                "Repeating starts",
                                                                "Bắt đầu lặp",
                                                            )}
                                                            <input
                                                                type="date"
                                                                required
                                                                value={
                                                                    draft.rule
                                                                        .start
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    change(
                                                                        "rule",
                                                                        {
                                                                            ...draft.rule,
                                                                            start: event
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </label>
                                                        <label className="field">
                                                            {text(
                                                                "Repeat until (optional)",
                                                                "Lặp đến ngày (tùy chọn)",
                                                            )}
                                                            <input
                                                                type="date"
                                                                min={
                                                                    draft.rule
                                                                        .start
                                                                }
                                                                value={
                                                                    draft.rule
                                                                        .end
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    change(
                                                                        "rule",
                                                                        {
                                                                            ...draft.rule,
                                                                            end: event
                                                                                .target
                                                                                .value,
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                        </label>
                                                    </div>
                                                    <div className="preview-task-date-preview">
                                                        <strong>
                                                            {text(
                                                                "Rule date preview",
                                                                "Xem trước ngày lặp",
                                                            )}
                                                        </strong>
                                                        <div>
                                                            {dates.length ? (
                                                                dates.map(
                                                                    (date) => (
                                                                        <span
                                                                            className="context-chip"
                                                                            key={
                                                                                date
                                                                            }
                                                                        >
                                                                            {formatTaskDate(
                                                                                date,
                                                                                locale,
                                                                            )}
                                                                        </span>
                                                                    ),
                                                                )
                                                            ) : (
                                                                <p>
                                                                    {text(
                                                                        "Choose valid dates and at least one weekday for weekly repetition.",
                                                                        "Chọn ngày hợp lệ và ít nhất một thứ khi lặp hàng tuần.",
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <small>
                                                            {text(
                                                                "Plan individual occurrences from the task list.",
                                                                "Chọn kế hoạch cho từng lần lặp trong danh sách công việc.",
                                                            )}
                                                        </small>
                                                    </div>
                                                    <label className="field">
                                                        {text(
                                                            "One checklist item per line",
                                                            "Mỗi dòng một mục kiểm tra",
                                                        )}
                                                        <textarea
                                                            rows={3}
                                                            value={
                                                                draft.checklistTemplate
                                                            }
                                                            onChange={(event) =>
                                                                change(
                                                                    "checklistTemplate",
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </label>
                                                </>
                                            )}
                                        </>
                                    )}
                                </section>
                            )}
                            <p className="preview-task-schedule-summary">
                                {draft.due && (
                                    <span>
                                        {text("Due", "Hạn")}{" "}
                                        {formatTaskDate(draft.due, locale)}
                                    </span>
                                )}
                                {draft.reminder !== "none" && (
                                    <span>
                                        <AlarmClock size={13} />
                                        {text(
                                            "Reminder set",
                                            "Đã đặt nhắc nhở",
                                        )}
                                    </span>
                                )}
                                {repeating && (
                                    <span>
                                        <Repeat2 size={13} />
                                        {text(
                                            ...(frequencies
                                                .find(
                                                    ([key]) =>
                                                        key ===
                                                        draft.rule.frequency,
                                                )!
                                                .slice(1) as [string, string]),
                                        )}
                                    </span>
                                )}
                            </p>
                        </div>
                        <details className="preview-task-disclosure">
                            <summary>
                                {text("More options", "Tùy chọn khác")}
                            </summary>
                            <div className="stack-form">
                                <fieldset className="preview-task-stars-field">
                                    <legend>
                                        {text("Importance", "Mức quan trọng")}
                                    </legend>
                                    <Stars value={draft.importance} text={text}
                                        onChange={value => change("importance", value)} />
                                </fieldset>
                                <fieldset className="preview-task-tags">
                                    <legend>{text("Tags", "Nhãn")}</legend>
                                    {tagOptions.map((tag) => (
                                        <label key={tag.id}>
                                            <input
                                                type="checkbox"
                                                checked={draft.tags.includes(
                                                    tag.id,
                                                )}
                                                onChange={() =>
                                                    change(
                                                        "tags",
                                                        draft.tags.includes(
                                                            tag.id,
                                                        )
                                                            ? draft.tags.filter(
                                                                  (id) =>
                                                                      id !==
                                                                      tag.id,
                                                              )
                                                            : [
                                                                  ...draft.tags,
                                                                  tag.id,
                                                              ],
                                                    )
                                                }
                                            />
                                            {text(...tag.label)}
                                        </label>
                                    ))}
                                </fieldset>
                            </div>
                        </details>
                        {mode !== "create" && !db.live && (
                            <details className="preview-editor-tools">
                                <summary>
                                    {text(
                                        "Preview a draft conflict",
                                        "Xem thử xung đột bản nháp",
                                    )}
                                </summary>
                                <p>
                                    {text(
                                        "This example keeps your edits while you choose the saved version or your draft.",
                                        "Tình huống này giữ thay đổi trong lúc bạn chọn bản đã lưu hoặc bản nháp.",
                                    )}
                                </p>
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    onClick={() => setConflict(true)}
                                >
                                    {text(
                                        "Show version conflict",
                                        "Hiện xung đột phiên bản",
                                    )}
                                </button>
                            </details>
                        )}
                        {error && (
                            <p className="field-error" role="alert">
                                {error}
                            </p>
                        )}
                    </div>
                    <footer className="preview-dialog-footer">
                        <span className="preview-draft-status">
                            {text(
                                dirty ? "Unsaved changes" : "No changes yet",
                                dirty
                                    ? "Có thay đổi chưa lưu"
                                    : "Chưa có thay đổi",
                            )}
                        </span>
                        <button
                            type="button"
                            className="button button-quiet"
                            onClick={close}
                        >
                            {text("Cancel", "Hủy")}
                        </button>
                        <button
                            type="submit"
                            className="button button-primary"
                            disabled={conflict || submitting}
                        >
                            <Check size={16} />
                            {text(
                                mode === "create"
                                    ? repeating
                                        ? "Create series"
                                        : "Create task"
                                    : "Save changes",
                                mode === "create"
                                    ? repeating
                                        ? "Tạo chuỗi lặp"
                                        : "Tạo công việc"
                                    : "Lưu thay đổi",
                            )}
                        </button>
                    </footer>
                </form>
            )}
        </Dialog>
    );
}
