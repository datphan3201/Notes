"use client";

import { useState } from "react";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Check,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";
import NotePreview from "../note-preview";
import { statuses } from "./dashboard-data";
import {
    formatTaskDate,
    isToday,
    tagOptions as fixtureTags,
    type TaskRecord,
} from "./task-data";
import { usePreviewData } from "./workspace-data";
import type { PreviewLocale, Text } from "./shared";

export function TaskPreviewTabs({
    items,
    value,
    onChange,
    label,
    prefix,
}: {
    items: [string, string][];
    value: string;
    onChange: (value: string) => void;
    label: string;
    prefix: string;
}) {
    return (
        <nav
            className="workspace-section-menu"
            role="tablist"
            aria-label={label}
            onKeyDown={(event) => {
                const index = items.findIndex(([key]) => key === value);
                const next =
                    event.key === "ArrowRight"
                        ? (index + 1) % items.length
                        : event.key === "ArrowLeft"
                          ? (index + items.length - 1) % items.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? items.length - 1
                              : -1;
                if (next < 0) return;
                event.preventDefault();
                onChange(items[next][0]);
                event.currentTarget
                    .querySelectorAll<HTMLButtonElement>("button")
                    [next].focus();
            }}
        >
            {items.map(([key, text]) => (
                <button
                    key={key}
                    id={`${prefix}-tab-${key}`}
                    type="button"
                    role="tab"
                    aria-selected={value === key}
                    aria-controls={`${prefix}-panel-${key}`}
                    tabIndex={value === key ? 0 : -1}
                    onClick={() => onChange(key)}
                >
                    {text}
                </button>
            ))}
        </nav>
    );
}

export default function TaskPreviewDetail({
    task,
    locale,
    text,
    onUpdate,
    onBack,
    onEdit,
    onTransition,
    onPlan,
}: {
    task: TaskRecord;
    locale: PreviewLocale;
    text: Text;
    onUpdate: (patch: Partial<TaskRecord>) => void;
    onBack: () => void;
    onEdit: () => void;
    onTransition: () => void;
    onPlan: (period: "today" | "week") => void;
}) {
    const db = usePreviewData();
    const tagOptions = db.live?.tags || fixtureTags;
    const { parents } = db;
    const linkedNotes = db.notes.filter(
        (note) => !note.archived && (note.task === task.id || task.noteIds?.includes(note.id)),
    );
    const [tab, setTab] = useState(db.nav.note ? "notes" : "overview");
    const [itemText, setItemText] = useState("");
    const [renaming, setRenaming] = useState<number | null>(null);
    const [rename, setRename] = useState("");
    const [related, setRelated] = useState(
        db.live ? db.goals.find((g) => !g.archived)?.id || "" : "reading",
    );
    const parent = parents.find((parent) => parent.id === task.parent)!;
    const status = statuses.find(([key]) => key === task.status)!;
    const moveItem = (index: number, delta: number) => {
        const items = [...task.checklist];
        const target = index + delta;
        [items[index], items[target]] = [items[target], items[index]];
        onUpdate({ checklist: items });
    };
    const renameItem = (id: number) => {
        if (!rename.trim()) return;
        onUpdate({
            checklist: task.checklist.map((item) =>
                item.id === id ? { ...item, text: rename.trim() } : item,
            ),
        });
        setRenaming(null);
    };
    return (
        <div className="preview-task-detail" data-task-detail>
            <header className="workspace-header preview-task-detail-header">
                <div>
                    <button className="text-button" onClick={onBack}>
                        <ArrowLeft size={15} />
                        {text("Tasks", "Công việc")} /{" "}
                        {text("Details", "Chi tiết")}
                    </button>
                    <h1>{text(...task.title)}</h1>
                    <p>
                        {text(status[1], status[2])}
                        {task.due &&
                            ` · ${text("Due", "Hạn")} ${formatTaskDate(task.due, locale)}`}{" "}
                        ·{" "}
                        <span
                            className="preview-task-stars"
                            aria-label={`${text("Importance", "Mức quan trọng")} ${task.importance}/5`}
                        >
                            {"★".repeat(task.importance)}
                            {"☆".repeat(5 - task.importance)}
                        </span>
                    </p>
                </div>
                <div className="action-row">
                    <button className="button button-quiet" onClick={onEdit}>
                        <Pencil size={15} />
                        {text("Edit task", "Chỉnh sửa công việc")}
                    </button>
                    <button
                        className="button button-quiet"
                        aria-pressed={task.weekly}
                        onClick={() => onPlan("week")}
                    >
                        {task.weekly ? <Check size={16} /> : <Plus size={16} />}
                        {text(
                            task.weekly
                                ? "Selected for this week"
                                : "Select for this week",
                            task.weekly
                                ? "Đã chọn cho tuần này"
                                : "Chọn cho tuần này",
                        )}
                    </button>
                    <button
                        className="icon-button"
                        disabled={
                            task.status === "Done" ||
                            (isToday(task, db.today) && !task.daily)
                        }
                        aria-pressed={isToday(task, db.today)}
                        aria-label={text(
                            isToday(task, db.today)
                                ? "In today's plan"
                                : "Add for today",
                            isToday(task, db.today)
                                ? "Đã có trong hôm nay"
                                : "Thêm cho hôm nay",
                        )}
                        title={text(
                            isToday(task, db.today)
                                ? "In today's plan"
                                : "Add for today",
                            isToday(task, db.today)
                                ? "Đã có trong hôm nay"
                                : "Thêm cho hôm nay",
                        )}
                        onClick={() => onPlan("today")}
                    >
                        {isToday(task, db.today) ? (
                            <Check size={17} />
                        ) : (
                            <Plus size={18} />
                        )}
                    </button>
                    <button
                        className="button button-primary"
                        onClick={onTransition}
                    >
                        {text(
                            task.status === "Done" ? "Reopen" : "Complete",
                            task.status === "Done" ? "Mở lại" : "Hoàn thành",
                        )}
                    </button>
                </div>
            </header>
            <TaskPreviewTabs
                prefix="preview-task-detail"
                label={text("Task sections", "Các mục công việc")}
                value={tab}
                onChange={setTab}
                items={[
                    ["overview", text("Overview", "Tổng quan")],
                    ["notes", text("Notes", "Ghi chú")],
                    ["related", text("Related work", "Công việc liên quan")],
                ]}
            />
            <section
                id="preview-task-detail-panel-overview"
                role="tabpanel"
                aria-labelledby="preview-task-detail-tab-overview"
                hidden={tab !== "overview"}
            >
                <div className="planning-grid task-detail-grid">
                    <article className="planning-panel">
                        <h2>
                            {text("Task information", "Thông tin công việc")}
                        </h2>
                        <p className="preview-task-description">
                            {text(...task.description) ||
                                text("No description yet.", "Chưa có mô tả.")}
                        </p>
                        <dl className="detail-list">
                            <div>
                                <dt>{text("Belongs to", "Thuộc về")}</dt>
                                <dd>
                                    <button
                                        className="text-button"
                                        onClick={() =>
                                            parent.id
                                                ? db.navigate("goals", {
                                                      goal: parent.goal,
                                                  })
                                                : onBack()
                                        }
                                    >
                                        {text(...parent.label)}
                                    </button>
                                </dd>
                            </div>
                            <div>
                                <dt>
                                    {text(
                                        "Estimated time",
                                        "Thời gian dự kiến",
                                    )}
                                </dt>
                                <dd>
                                    {task.estimate
                                        ? `${task.estimate} ${text("minutes", "phút")}`
                                        : text(
                                              "Not estimated",
                                              "Chưa ước tính",
                                          )}
                                </dd>
                            </div>
                            <div>
                                <dt>{text("Tags", "Nhãn")}</dt>
                                <dd>
                                    {task.tags.length
                                        ? task.tags
                                              .map((id) =>
                                                  text(
                                                      ...tagOptions.find(
                                                          (tag) =>
                                                              tag.id === id,
                                                      )!.label,
                                                  ),
                                              )
                                              .join(" · ")
                                        : "—"}
                                </dd>
                            </div>
                            {task.scheduledStart && (
                                <div>
                                    <dt>{text("Scheduled", "Theo lịch")}</dt>
                                    <dd>
                                        {formatTaskDate(
                                            task.scheduledStart.slice(0, 10),
                                            locale,
                                        )}{" "}
                                        {task.scheduledStart.slice(11)}
                                        {task.scheduledEnd &&
                                            ` – ${task.scheduledEnd.slice(11)}`}{" "}
                                        · Asia/Ho_Chi_Minh
                                    </dd>
                                </div>
                            )}
                        </dl>
                        <details className="preview-task-disclosure">
                            <summary>
                                {text(
                                    "Outcome and criteria",
                                    "Kết quả và tiêu chí",
                                )}
                            </summary>
                            <dl className="detail-list">
                                <div>
                                    <dt>
                                        {text(
                                            "Expected result",
                                            "Kết quả mong đợi",
                                        )}
                                    </dt>
                                    <dd>{text(...task.outcome) || "—"}</dd>
                                </div>
                                <div>
                                    <dt>
                                        {text(
                                            "Completion criteria",
                                            "Tiêu chí hoàn thành",
                                        )}
                                    </dt>
                                    <dd>{text(...task.criteria) || "—"}</dd>
                                </div>
                            </dl>
                        </details>
                    </article>
                    <article className="planning-panel">
                        <div className="section-heading">
                            <h2>
                                {text(
                                    "Task completion checklist",
                                    "Danh sách kiểm tra hoàn thành",
                                )}
                            </h2>
                            <small>
                                {
                                    task.checklist.filter(
                                        (item) => item.checked,
                                    ).length
                                }{" "}
                                / {task.checklist.length}
                            </small>
                        </div>
                        <p className="subtle-copy">
                            {text(
                                "Used when completing this task. Check boxes in Notes are for your own tracking.",
                                "Dùng khi hoàn thành công việc. Các ô đánh dấu trong Ghi chú dành cho việc theo dõi riêng.",
                            )}
                        </p>
                        <div className="preview-task-checklist">
                            {task.checklist.map((item, index) => (
                                <div
                                    className="preview-task-checklist-row"
                                    key={item.id}
                                >
                                    <input
                                        type="checkbox"
                                        aria-label={
                                            text(
                                                "Check item: ",
                                                "Đánh dấu mục: ",
                                            ) + item.text
                                        }
                                        checked={item.checked}
                                        onChange={() =>
                                            onUpdate({
                                                checklist: task.checklist.map(
                                                    (row) =>
                                                        row.id === item.id
                                                            ? {
                                                                  ...row,
                                                                  checked:
                                                                      !row.checked,
                                                              }
                                                            : row,
                                                ),
                                            })
                                        }
                                    />
                                    {renaming === item.id ? (
                                        <form
                                            onSubmit={(event) => {
                                                event.preventDefault();
                                                renameItem(item.id);
                                            }}
                                        >
                                            <input
                                                autoFocus
                                                value={rename}
                                                maxLength={200}
                                                aria-label={text(
                                                    "Checklist item name",
                                                    "Tên mục kiểm tra",
                                                )}
                                                onChange={(event) =>
                                                    setRename(
                                                        event.target.value,
                                                    )
                                                }
                                            />
                                            <button
                                                className="icon-button"
                                                aria-label={text(
                                                    "Save item name",
                                                    "Lưu tên mục",
                                                )}
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                className="icon-button"
                                                aria-label={text(
                                                    "Cancel rename",
                                                    "Hủy đổi tên",
                                                )}
                                                onClick={() =>
                                                    setRenaming(null)
                                                }
                                            >
                                                ×
                                            </button>
                                        </form>
                                    ) : (
                                        <>
                                            <span
                                                className={
                                                    item.checked
                                                        ? "is-complete"
                                                        : ""
                                                }
                                            >
                                                {item.text}
                                            </span>
                                            <div className="preview-checklist-actions">
                                                <button
                                                    className="text-button"
                                                    onClick={() => {
                                                        setRename(item.text);
                                                        setRenaming(item.id);
                                                    }}
                                                >
                                                    {text("Rename", "Đổi tên")}
                                                </button>
                                                <button
                                                    className="icon-button"
                                                    disabled={index === 0}
                                                    aria-label={
                                                        text(
                                                            "Move up: ",
                                                            "Chuyển lên: ",
                                                        ) + item.text
                                                    }
                                                    onClick={() =>
                                                        moveItem(index, -1)
                                                    }
                                                >
                                                    <ArrowUp size={13} />
                                                </button>
                                                <button
                                                    className="icon-button"
                                                    disabled={
                                                        index ===
                                                        task.checklist.length -
                                                            1
                                                    }
                                                    aria-label={
                                                        text(
                                                            "Move down: ",
                                                            "Chuyển xuống: ",
                                                        ) + item.text
                                                    }
                                                    onClick={() =>
                                                        moveItem(index, 1)
                                                    }
                                                >
                                                    <ArrowDown size={13} />
                                                </button>
                                                <button
                                                    className="icon-button"
                                                    aria-label={
                                                        text(
                                                            "Remove item: ",
                                                            "Bỏ mục: ",
                                                        ) + item.text
                                                    }
                                                    onClick={() =>
                                                        onUpdate({
                                                            checklist:
                                                                task.checklist.filter(
                                                                    (row) =>
                                                                        row.id !==
                                                                        item.id,
                                                                ),
                                                        })
                                                    }
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                        <details className="preview-task-disclosure">
                            <summary>
                                {text(
                                    "Add checklist item",
                                    "Thêm mục kiểm tra",
                                )}
                            </summary>
                            <form
                                className="preview-task-inline-form"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    if (!itemText.trim()) return;
                                    onUpdate({
                                        checklist: [
                                            ...task.checklist,
                                            {
                                                id: Date.now(),
                                                text: itemText.trim(),
                                                checked: false,
                                            },
                                        ],
                                    });
                                    setItemText("");
                                }}
                            >
                                <input
                                    value={itemText}
                                    maxLength={200}
                                    aria-label={text(
                                        "New checklist item",
                                        "Mục kiểm tra mới",
                                    )}
                                    onChange={(event) =>
                                        setItemText(event.target.value)
                                    }
                                    placeholder={text(
                                        "What needs checking?",
                                        "Cần kiểm tra điều gì?",
                                    )}
                                />
                                <button className="button button-quiet">
                                    <Plus size={15} />
                                    {text("Add", "Thêm")}
                                </button>
                            </form>
                        </details>
                    </article>
                </div>
            </section>
            <section
                id="preview-task-detail-panel-notes"
                role="tabpanel"
                aria-labelledby="preview-task-detail-tab-notes"
                hidden={tab !== "notes"}
            >
                <article className="planning-panel preview-task-linked-notes">
                    <div className="section-heading">
                        <div>
                            <h2>
                                {text("Notes", "Ghi chú")}
                            </h2>
                            <p className="subtle-copy">
                                {text(
                                    "These are the same Notes shown in your Notes workspace. Open one to edit and save.",
                                    "Đây là các ghi chú trong mục Notes. Mở ghi chú để chỉnh sửa và lưu.",
                                )}
                            </p>
                        </div>
                        <button
                            className="button button-quiet"
                            onClick={() => db.navigate("notes", { note: "new", task: task.id })}
                        >
                            <Plus size={15} />
                            {text("New linked note", "Ghi chú liên kết mới")}
                        </button>
                    </div>
                    {linkedNotes.length ? (
                        linkedNotes.map((note) => (
                            <button
                                key={note.id}
                                className="preview-linked-note-card"
                                onClick={() =>
                                    db.navigate("notes", { note: note.id, task: task.id })
                                }
                            >
                                <strong>{note.locked && !note.unlocked ? text("Locked note", "Ghi chú đã khóa") : note.title}</strong>
                                {note.locked && !note.unlocked ? <p>{text("Unlock to read this note.", "Mở khóa để đọc ghi chú.")}</p> :
                                    <NotePreview content={note.content} document={note.document}
                                        checkedLabel={text("Checked", "Đã đánh dấu")}
                                        uncheckedLabel={text("Unchecked", "Chưa đánh dấu")} />}

                            </button>
                        ))
                    ) : (
                        <p className="subtle-copy">
                            {text(
                                "No linked notes yet.",
                                "Chưa có ghi chú liên kết.",
                            )}
                        </p>
                    )}
                </article>
            </section>
            <section
                id="preview-task-detail-panel-related"
                role="tabpanel"
                aria-labelledby="preview-task-detail-tab-related"
                hidden={tab !== "related"}
            >
                <article className="planning-panel">
                    <h2>
                        {text(
                            "Context and contributions",
                            "Ngữ cảnh và đóng góp",
                        )}
                    </h2>
                    <p className="subtle-copy">
                        {text(
                            "Related Goals do not move the task or change progress. Its primary location stays in Overview.",
                            "Mục tiêu liên quan không di chuyển công việc hay thay đổi tiến độ. Vị trí chính vẫn ở Tổng quan.",
                        )}
                    </p>
                    {task.related.map((id) => (
                        <div className="preview-task-related-row" key={id}>
                            <button
                                className="text-button"
                                onClick={() =>
                                    db.navigate("goals", { goal: id })
                                }
                            >
                                {text(
                                    ...parents.find(
                                        (parent) => parent.id === id,
                                    )!.label,
                                )}
                            </button>
                            <button
                                className="icon-button"
                                aria-label={text(
                                    "Remove related Goal",
                                    "Bỏ mục tiêu liên quan",
                                )}
                                onClick={() =>
                                    onUpdate({
                                        related: task.related.filter(
                                            (value) => value !== id,
                                        ),
                                    })
                                }
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                    <form
                        className="preview-task-inline-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (
                                related &&
                                related !== task.parent &&
                                !task.related.includes(related)
                            )
                                onUpdate({
                                    related: [...task.related, related],
                                });
                        }}
                    >
                        <label className="field">
                            {text("Link a Goal", "Liên kết mục tiêu")}
                            <select
                                value={related}
                                onChange={(event) =>
                                    setRelated(event.target.value)
                                }
                            >
                                <option value="">
                                    {text("Choose a Goal", "Chọn mục tiêu")}
                                </option>
                                {parents
                                    .filter(
                                        (parent) =>
                                            parent.id &&
                                            parent.id !== "listening" &&
                                            parent.id !== "finished" &&
                                            parent.goal !==
                                                parents.find(
                                                    (row) =>
                                                        row.id === task.parent,
                                                )?.goal &&
                                            !task.related.includes(parent.id),
                                    )
                                    .map((parent) => (
                                        <option
                                            key={parent.id}
                                            value={parent.id}
                                        >
                                            {text(...parent.label)}
                                        </option>
                                    ))}
                            </select>
                        </label>
                        <button
                            className="button button-quiet"
                            disabled={
                                !related ||
                                related === task.parent ||
                                task.related.includes(related)
                            }
                        >
                            <Plus size={15} />
                            {text("Link Goal", "Liên kết mục tiêu")}
                        </button>
                    </form>
                </article>
            </section>
        </div>
    );
}
