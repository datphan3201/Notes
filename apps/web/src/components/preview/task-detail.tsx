"use client";

import { useState } from "react";
import {
    ArrowDown,
    ArrowLeft,
    ArrowUp,
    Check,
    Pencil,
    Link as LinkIcon,
    Plus,
    Trash2,
} from "lucide-react";
import NotesPreview from "./notes";
import { FormDialog, Stars } from "./ui";
import { PageActionBar } from "../ui/layout";
import { Button } from "../ui/button";
import { statuses } from "./dashboard-data";
import {
    formatTaskDate,
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
    const [tab, setTab] = useState(db.nav.note ? "notes" : "overview");
    const [notesVisited, setNotesVisited] = useState(!!db.nav.note);
    const [linkResource, setLinkResource] = useState(false);
    const [resourceNoteId, setResourceNoteId] = useState<string | null>(null);
    const [resourceError, setResourceError] = useState("");
    const resourceIds = task.resourceNoteIds || [];
    const primaryIds = task.noteIds || db.notes.filter(note => note.task === task.id).map(note => note.id);
    const resources = db.notes.filter(note => !note.archived && resourceIds.includes(note.id));
    const availableResources = db.notes.filter(note => !note.archived && note.permission === "owner" &&
        !resourceIds.includes(note.id) && !primaryIds.includes(note.id) && note.task !== task.id);
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
                        {text(status[1], status[2])}{" "}
                        <Stars value={task.importance} text={text} />
                    </p>
                </div>
            </header>
            <PageActionBar label={text("Task actions", "Thao tác công việc")}>
                <button className="button button-quiet" onClick={onEdit}>
                    <Pencil size={15} />
                    {text("Edit task", "Chỉnh sửa công việc")}
                </button>
                <Button className="task-plan-toggle" aria-pressed={task.daily}
                    disabled={task.status === "Done"} onClick={() => onPlan("today")}
                    title={text(task.daily ? "Remove from today's plan; keep the weekly selection." : "Add to today's plan without changing dates or status.", task.daily ? "Bỏ khỏi hôm nay, vẫn giữ lựa chọn trong tuần." : "Thêm vào kế hoạch hôm nay, giữ nguyên ngày và trạng thái.")}>
                    {task.daily ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    {text(task.daily ? "Remove from today" : "Add to today", task.daily ? "Bỏ khỏi hôm nay" : "Thêm vào hôm nay")}
                </Button>
                <Button className="task-plan-toggle" aria-pressed={task.weekly}
                    disabled={task.status === "Done"} onClick={() => onPlan("week")}
                    title={text(task.weekly ? "Remove from this week's plan, including today's selection." : "Add to this week's plan without changing dates or status.", task.weekly ? "Bỏ khỏi kế hoạch tuần, bao gồm lựa chọn hôm nay." : "Thêm vào kế hoạch tuần, giữ nguyên ngày và trạng thái.")}>
                    {task.weekly ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    {text(task.weekly ? "Remove from this week" : "Add to this week", task.weekly ? "Bỏ khỏi tuần này" : "Thêm vào tuần này")}
                </Button>
                <button
                    className="button button-primary"
                    onClick={onTransition}
                >
                    {text(
                        task.status === "Done" ? "Reopen" : "Complete",
                        task.status === "Done" ? "Mở lại" : "Hoàn thành",
                    )}
                </button>
            </PageActionBar>
            <TaskPreviewTabs
                prefix="preview-task-detail"
                label={text("Task sections", "Các mục công việc")}
                value={tab}
                onChange={value => { setTab(value); if (value === "notes") setNotesVisited(true); }}
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
                                              .join(", ")
                                        : "—"}
                                </dd>
                            </div>
                            {task.scheduledDay && (
                                <div>
                                    <dt>{text("Scheduled", "Theo lịch")}</dt>
                                    <dd>
                                        {formatTaskDate(
                                            task.scheduledDay,
                                            locale,
                                        )}{" "}

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
                {(notesVisited || tab === "notes") && <NotesPreview text={text} taskId={task.id} />}
                <article className="planning-panel task-note-resources">
                    <div className="section-heading">
                        <h2>{text("Resources", "Tài nguyên")}</h2>
                        <button type="button" className="button button-quiet" onClick={() => setLinkResource(true)}>
                            <LinkIcon size={16} />{text("Link note", "Liên kết ghi chú")}
                        </button>
                    </div>
                    {resourceError && <p className="field-error" role="alert">{resourceError}</p>}
                    {resources.length ? <ul className="task-note-resource-list">
                        {resources.map(note => <li key={note.id}>
                            <button type="button" className="text-button" onClick={() => setResourceNoteId(note.id)}>
                                <LinkIcon size={15} />{note.locked && !note.unlocked ? text("Locked note", "Ghi chú đã khóa") : note.title}
                            </button>
                            <button type="button" className="icon-button" aria-label={text("Unlink note: ", "Bỏ liên kết ghi chú: ") + (note.locked && !note.unlocked ? text("Locked note", "Ghi chú đã khóa") : note.title)}
                                onClick={async () => {
                                    setResourceError("");
                                    onUpdate({ resourceNoteIds: resourceIds.filter(id => id !== note.id) });
                                    if (db.live && !(await db.live.flush())) setResourceError(text("Could not save resource links.", "Chưa lưu được liên kết tài nguyên."));
                                }}><Trash2 size={15} /></button>
                        </li>)}
                    </ul> : <p className="subtle-copy">{text("Link existing Notes as resources for this task.", "Liên kết các ghi chú có sẵn làm tài nguyên cho công việc.")}</p>}
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
            {resourceNoteId && <NotesPreview text={text} resourceNoteId={resourceNoteId} onResourceClose={() => setResourceNoteId(null)} />}
            {linkResource && <FormDialog text={text} title={text("Link note", "Liên kết ghi chú")}
                submitLabel={text("Link", "Liên kết")} onClose={() => setLinkResource(false)}
                onSubmit={async form => {
                    const noteId = String(new FormData(form).get("note") || "");
                    if (!availableResources.some(note => note.id === noteId)) return false;
                    onUpdate({ resourceNoteIds: [...resourceIds, noteId] });
                    if (db.live && !(await db.live.flush())) throw new Error(text("Could not save resource links.", "Chưa lưu được liên kết tài nguyên."));
                    setLinkResource(false);
                }}>
                <label className="field">{text("Note resource", "Ghi chú tài nguyên")}
                    <select name="note" aria-label={text("Note resource", "Ghi chú tài nguyên")} required defaultValue="">
                        <option value="" disabled>{text("Select a note", "Chọn ghi chú")}</option>
                        {availableResources.map(note => <option key={note.id} value={note.id}>
                            {note.locked && !note.unlocked ? text("Locked note", "Ghi chú đã khóa") : note.title}
                        </option>)}
                    </select>
                </label>
                {!availableResources.length && <p className="subtle-copy">{text("No available Notes. Create one in Notes first.", "Chưa có ghi chú khả dụng. Hãy tạo ghi chú trong Notes trước.")}</p>}
            </FormDialog>}
        </div>
    );
}
