"use client";
import { useEffect, useRef, useState } from "react";
import {
    Download,
    FileText,
    Grid2X2,
    List,
    LockKeyhole,
    MoreHorizontal,
    Paperclip,
    Pin,
    Plus,
    Search,
    Share2,
    Sparkles,
    Trash2,
    WifiOff,
    X,
} from "lucide-react";
import Dialog from "../dialog";
import NoteDocument from "../note-document";
import { noteLines } from "@/vendor/note-text/js/lib/note-checkbox-text.js";
import { tagOptions } from "./task-data";
import { usePreviewData, type Note, type NoteFile } from "./workspace-data";
import { BaselineIcon, Confirm, Field, FormDialog, Header } from "./ui";
import type { Text } from "./shared";

export default function NotesPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const [selectedId, setSelectedId] = useState("");
    const [query, setQuery] = useState("");
    const [layout, setLayout] = useState(
        db.live?.identity.user.preferences.notes_view || "grid",
    );
    const [filter, setFilter] = useState("all");
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const [sort, setSort] = useState("updated-desc");
    const [noteSize, setNoteSize] = useState("16px");
    const [tagsOpen, setTagsOpen] = useState(false);
    const [tags, setTags] = useState(db.live?.tags || tagOptions);
    useEffect(() => {
        if (db.live) setTags(db.live.tags);
    }, [db.live?.tags.map((t) => t.id).join("|")]);
    const [manageTags, setManageTags] = useState(false);
    const [drafts, setDrafts] = useState<
        Record<string, { title: string; content: string }>
    >({});
    const [sampleOffline, setOffline] = useState(false);
    const offline = db.live ? db.live.offline : sampleOffline;
    const [conflict, setConflict] = useState("");
    const [saving, setSaving] = useState(false);
    const [dialog, setDialog] = useState<{
        kind: "share" | "lock" | "unlock" | "delete" | "file";
        id: string;
        file?: NoteFile;
    } | null>(null);
    const [error, setError] = useState("");
    const [recipients, setRecipients] = useState("");
    const [permission, setPermission] = useState<"read" | "edit">("read");
    const [ask, setAsk] = useState("");
    const [answer, setAnswer] = useState("");
    const urls = useRef<string[]>([]);
    const [openingNote, setOpeningNote] = useState(false);
    const note = db.notes.find((note) => note.id === selectedId);
    const modalNote = db.notes.find((note) => note.id === dialog?.id);
    const draft = note
        ? drafts[note.id] || { title: note.title, content: note.content }
        : null;
    const locked = !!note?.locked && !note.unlocked;
    const editable = !!note && note.permission !== "read" && !locked;
    useEffect(
        () => () => urls.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );
    useEffect(() => {
        if (offline && !db.live) {
            setSaving(false);
            return;
        }
        const snapshots = Object.entries(drafts).filter(
            ([id]) => id !== conflict,
        );
        if (!snapshots.length) {
            setSaving(false);
            return;
        }
        setSaving(true);
        const timer = setTimeout(async () => {
            db.setNotes((notes) =>
                notes.map((note) => {
                    const saved = snapshots.find(([id]) => id === note.id)?.[1];
                    return saved
                        ? {
                              ...note,
                              ...saved,
                              updatedAt: new Date().toISOString(),
                              summaryOutdated:
                                  !!note.summary &&
                                  saved.content !== note.content,
                          }
                        : note;
                }),
            );
            if (db.live && !(await db.live.flush())) {
                setSaving(false);
                setConflict(snapshots[0][0]);
                return;
            }
            if (db.live)
                for (const [id] of snapshots)
                    await db.live.discardNoteDraft(id);
            setDrafts((current) => {
                const next = { ...current };
                for (const [id, snapshot] of snapshots)
                    if (next[id] === snapshot) delete next[id];
                return next;
            });
            setSaving(false);
        }, 650);
        return () => clearTimeout(timer);
    }, [drafts, offline, conflict]);
    useEffect(() => {
        if (db.nav.section !== "notes") {
            setSelectedId("");
            return;
        }
        if (db.nav.note === "new") {
            create(db.nav.goal || "");
        } else if (db.nav.note) {
            const target = db.notes.find((note) => note.id === db.nav.note);
            if (target) open(target);
        }
    }, [db.nav.stamp]);
    function create(goal = "") {
        const id = `note-${Date.now()}`;
        const row: Note = {
            id,
            title: text("Untitled note", "Ghi chú chưa đặt tên"),
            updatedAt: new Date().toISOString(),
            content: "",
            color: "#ffffff",
            pinned: false,
            tags: [],
            goal,
            task: null,
            locked: false,
            lockPassword: "",
            unlocked: true,
            permission: "owner",
            shared: false,
            shares: [],
            files: [],
            background: "",
            summary: "",
            summaryOutdated: false,
        };
        db.setNotes((notes) => [row, ...notes]);
        setSelectedId(id);
    }
    function open(target: Note) {
        setError("");
        if (target.locked && !target.unlocked) {
            setOpeningNote(true);
            setDialog({ kind: "unlock", id: target.id });
        } else {
            setSelectedId(target.id);
            setAsk("");
            setAnswer("");
        }
    }
    const patch = (id: string, changes: Partial<Note>) =>
        db.setNotes((notes) =>
            notes.map((note) =>
                note.id === id
                    ? {
                          ...note,
                          ...changes,
                          updatedAt: new Date().toISOString(),
                      }
                    : note,
            ),
        );
    const edit = (changes: Partial<{ title: string; content: string }>) => {
        if (!note || !editable) return;
        if (db.live)
            void db.live
                .keepNoteDraft(note.id, {
                    ...(drafts[note.id] || {
                        title: note.title,
                        content: note.content,
                    }),
                    ...changes,
                })
                .catch((err) => setError((err as Error).message));
        setDrafts((values) => ({
            ...values,
            [note.id]: {
                ...(values[note.id] || {
                    title: note.title,
                    content: note.content,
                }),
                ...changes,
            },
        }));
    };
    const filtered = db.notes
        .filter((note) => {
            const privateText =
                note.locked && !note.unlocked
                    ? ""
                    : note.title + " " + note.content;
            return (
                (!query ||
                    privateText
                        .toLocaleLowerCase(db.locale)
                        .includes(query.toLocaleLowerCase(db.locale))) &&
                activeTags.every((tag) => note.tags.includes(tag)) &&
                (filter === "all" ||
                    (filter === "pinned" && note.pinned) ||
                    (filter === "shared" && note.permission !== "owner") ||
                    (filter === "owned" && note.permission === "owner"))
            );
        })
        .sort((a, b) =>
            sort.startsWith("title")
                ? (sort.endsWith("asc") ? 1 : -1) *
                  a.title.localeCompare(b.title, db.locale)
                : (sort.endsWith("asc") ? 1 : -1) *
                  (a.updatedAt || "").localeCompare(b.updatedAt || ""),
        );
    async function attach(files: FileList | null) {
        if (!note || !editable || !files) return;
        if (db.live) {
            try {
                for (const file of Array.from(files))
                    await db.live.upload(`/notes/${note.id}/attachments`, file);
                await db.live.refresh();
                setError("");
            } catch (err) {
                setError((err as Error).message);
            }
            return;
        }
        const added: NoteFile[] = [];
        for (const file of Array.from(files)) {
            if (file.size > 10 * 1024 * 1024) {
                setError(
                    text(
                        "Choose files smaller than 10 MB for this preview.",
                        "Chọn tệp dưới 10 MB cho bản xem thử.",
                    ),
                );
                continue;
            }
            const url = URL.createObjectURL(file);
            urls.current.push(url);
            added.push({
                id: `file-${Date.now()}-${added.length}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url,
                ...(file.type.startsWith("text/")
                    ? { content: (await file.text()).slice(0, 100000) }
                    : {}),
            });
        }
        db.setNotes((notes) =>
            notes.map((row) =>
                row.id === note.id
                    ? { ...row, files: [...row.files, ...added] }
                    : row,
            ),
        );
    }
    const act = async (action: () => Promise<unknown>) => {
        try {
            setError("");
            await action();
            await db.live!.refresh();
        } catch (err) {
            setError((err as Error).message);
        }
    };
    async function shareNote(id: string, email: string, canEdit: boolean) {
        await db.live!.request(`/notes/${id}/invitations`, {
            method: "POST",
            body: JSON.stringify({ email, can_edit: canEdit }),
        });
    }
    async function askNote(summary: boolean) {
        if (!db.live || !note) return;
        setAnswer(text("Working…", "Đang xử lý…"));
        try {
            const run = await db.live.request<{ id: string }>(
                `/notes/${note.id}/${summary ? "summary" : "questions"}`,
                {
                    method: "POST",
                    ...(summary
                        ? {}
                        : { body: JSON.stringify({ prompt: ask }) }),
                },
            );
            const { waitForRun } = await import("../live-assistant");
            const answer = await waitForRun(run.id);
            if (summary) {
                await db.live.refresh();
                setAnswer("");
            } else setAnswer(answer.answer);
        } catch (err) {
            setAnswer("");
            setError((err as Error).message);
        }
    }
    const resources = Array.from(
        new Set((draft?.content || "").match(/https?:\/\/[^\s<>]+/g) || []),
    );
    return (
        <div
            className="review-notes workspace"
            style={{ "--font-size-note": noteSize } as React.CSSProperties}
        >
            <Header
                title={text("Notes", "Ghi chú")}
                description={text(
                    "A home for your ideas, research, and things worth keeping.",
                    "Nơi lưu ý tưởng, nghiên cứu và những điều bạn muốn giữ lại.",
                )}
            >
                <details className="note-preferences review-row-menu">
                    <summary className="button button-quiet">
                        <BaselineIcon name="settings" />
                        {text("Preferences", "Tùy chỉnh")}
                    </summary>
                    <div className="review-note-preferences">
                        <Field label={text("Note text size", "Cỡ chữ ghi chú")}>
                            <select
                                value={noteSize}
                                onChange={(event) =>
                                    setNoteSize(event.target.value)
                                }
                            >
                                <option value="14px">
                                    {text("Small", "Nhỏ")}
                                </option>
                                <option value="16px">
                                    {text("Normal", "Vừa")}
                                </option>
                                <option value="18px">
                                    {text("Large", "Lớn")}
                                </option>
                            </select>
                        </Field>
                        <label className="review-checkbox">
                            <input
                                type="checkbox"
                                checked={offline}
                                disabled={!!db.live}
                                onChange={(event) =>
                                    setOffline(event.target.checked)
                                }
                            />
                            <WifiOff size={15} />
                            {text(
                                db.live
                                    ? "Offline status"
                                    : "Preview offline mode",
                                db.live
                                    ? "Trạng thái ngoại tuyến"
                                    : "Xem thử ngoại tuyến",
                            )}
                        </label>
                        <p className="subtle-copy">
                            {text(
                                db.live
                                    ? "Your changes are saved to your account."
                                    : "Sample data resets when you reload.",
                                db.live
                                    ? "Thay đổi được lưu vào tài khoản của bạn."
                                    : "Dữ liệu mẫu được đặt lại khi tải lại trang.",
                            )}
                        </p>
                    </div>
                </details>
                <button
                    className="button button-quiet"
                    onClick={() => db.setAssistantOpen(true)}
                >
                    <Sparkles size={17} />
                    {text("Ask AI", "Hỏi AI")}
                </button>
                <button
                    className="button button-primary"
                    onClick={() => create()}
                >
                    <Plus size={17} />
                    {text("New note", "Ghi chú mới")}
                </button>
            </Header>
            {offline && (
                <aside className="notice review-offline-status" role="status">
                    <WifiOff size={17} />
                    <span>
                        {text(
                            "Offline · pending changes:",
                            "Ngoại tuyến · thay đổi chờ lưu:",
                        )}{" "}
                        {Object.keys(drafts).length}
                    </span>
                    <button
                        className="text-button"
                        onClick={() => setOffline(false)}
                    >
                        {text("Reconnect", "Kết nối lại")}
                    </button>
                </aside>
            )}
            {db.live?.invitations.map((invite) => (
                <aside className="notice review-share-row" key={invite.note_id}>
                    <span>
                        {invite.owner}: {invite.title}
                    </span>
                    <button
                        className="button button-quiet"
                        onClick={() =>
                            void act(() =>
                                db.live!.request(
                                    `/notes/${invite.note_id}/invitations/accept`,
                                    { method: "POST" },
                                ),
                            )
                        }
                    >
                        {text("Accept", "Chấp nhận")}
                    </button>
                    <button
                        className="text-button"
                        onClick={() =>
                            void act(() =>
                                db.live!.request(
                                    `/notes/${invite.note_id}/invitations/decline`,
                                    { method: "POST" },
                                ),
                            )
                        }
                    >
                        {text("Decline", "Từ chối")}
                    </button>
                </aside>
            ))}
            {error && (
                <p role="alert" className="field-error">
                    {error}
                </p>
            )}
            <div className="workspace-layout review-notes-collection">
                <aside
                    className={`notes-filter-panel ${tagsOpen ? "is-open" : ""}`}
                    aria-label={text("Note filters", "Bộ lọc ghi chú")}
                >
                    <button
                        className={`filter-all ${filter === "all" ? "is-active" : ""}`}
                        onClick={() => setFilter("all")}
                    >
                        <BaselineIcon name="notes" />
                        {text("All notes", "Tất cả ghi chú")}
                        <span className="filter-count">{db.notes.length}</span>
                    </button>
                    <button
                        className={`filter-all ${filter === "shared" ? "is-active" : ""}`}
                        onClick={() => setFilter("shared")}
                    >
                        <Share2 size={18} />
                        {text("Shared with me", "Được chia sẻ với tôi")}
                        <span className="filter-count">
                            {
                                db.notes.filter(
                                    (note) => note.permission !== "owner",
                                ).length
                            }
                        </span>
                    </button>
                    <div className="filter-divider" />
                    <div className="filter-heading">
                        <span>{text("Tags", "Nhãn")}</span>
                        <button
                            className="text-button"
                            onClick={() => setManageTags(true)}
                        >
                            {text("Manage", "Quản lý")}
                        </button>
                    </div>
                    <div className="label-filter-list">
                        {tags.map((tag) => (
                            <label className="label-filter-option" key={tag.id}>
                                <input
                                    type="checkbox"
                                    checked={activeTags.includes(tag.id)}
                                    onChange={() =>
                                        setActiveTags((ids) =>
                                            ids.includes(tag.id)
                                                ? ids.filter(
                                                      (id) => id !== tag.id,
                                                  )
                                                : [...ids, tag.id],
                                        )
                                    }
                                />
                                <span>{text(...tag.label)}</span>
                            </label>
                        ))}
                    </div>
                </aside>
                <section className="review-notes-results">
                    <div className="notes-toolbar">
                        <button
                            className="icon-button review-mobile-note-filters"
                            aria-label={text(
                                "Show note filters",
                                "Hiện bộ lọc ghi chú",
                            )}
                            aria-expanded={tagsOpen}
                            onClick={() => setTagsOpen(!tagsOpen)}
                        >
                            <BaselineIcon name="settings" />
                        </button>
                        <div className="search-field">
                            <Search size={18} />
                            <input
                                type="search"
                                aria-label={text("Search notes", "Tìm ghi chú")}
                                placeholder={text(
                                    "Search titles and content",
                                    "Tìm theo tiêu đề và nội dung",
                                )}
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                        </div>
                        <button
                            className="icon-button"
                            aria-label={
                                layout === "grid"
                                    ? text("List", "Danh sách")
                                    : text("Grid", "Lưới")
                            }
                            onClick={() => {
                                const next =
                                    layout === "grid" ? "list" : "grid";
                                setLayout(next);
                                if (db.live)
                                    void db.live.preferences({
                                        notes_view: next,
                                    });
                            }}
                        >
                            {layout === "grid" ? (
                                <List size={18} />
                            ) : (
                                <Grid2X2 size={18} />
                            )}
                        </button>
                        <select
                            aria-label={text("Sort notes", "Sắp xếp ghi chú")}
                            value={sort}
                            onChange={(event) => setSort(event.target.value)}
                        >
                            <option value="updated-desc">
                                {text(
                                    "Last edited · newest",
                                    "Ngày sửa · mới nhất",
                                )}
                            </option>
                            <option value="updated-asc">
                                {text(
                                    "Last edited · oldest",
                                    "Ngày sửa · cũ nhất",
                                )}
                            </option>
                            <option value="title-asc">
                                {text("Title · A–Z", "Tiêu đề · A–Z")}
                            </option>
                            <option value="title-desc">
                                {text("Title · Z–A", "Tiêu đề · Z–A")}
                            </option>
                        </select>
                    </div>
                    {!!activeTags.length && (
                        <div className="active-filter-row">
                            <span>
                                {activeTags
                                    .map((id) =>
                                        text(
                                            ...tags.find(
                                                (tag) => tag.id === id,
                                            )!.label,
                                        ),
                                    )
                                    .join(", ")}
                            </span>
                            <button
                                className="text-button"
                                onClick={() => setActiveTags([])}
                            >
                                {text("Clear filters", "Xóa bộ lọc")}
                            </button>
                        </div>
                    )}
                    {[true, false].map(
                        (pinned) =>
                            filtered.some((note) => note.pinned === pinned) && (
                                <section
                                    className="review-note-group"
                                    key={String(pinned)}
                                >
                                    <h2 className="notes-group-heading">
                                        {pinned
                                            ? text("Pinned", "Đã ghim")
                                            : text(
                                                  "Other notes",
                                                  "Ghi chú khác",
                                              )}
                                    </h2>
                                    <div
                                        className={`review-note-grid is-${layout}`}
                                    >
                                        {filtered
                                            .filter(
                                                (note) =>
                                                    note.pinned === pinned,
                                            )
                                            .map((note) => {
                                                const locked =
                                                    note.locked &&
                                                    !note.unlocked;
                                                return (
                                                    <article
                                                        key={note.id}
                                                        className="review-note-card"
                                                        style={{
                                                            background:
                                                                note.color,
                                                        }}
                                                    >
                                                        <button
                                                            className="review-note-card-open"
                                                            onClick={() =>
                                                                open(note)
                                                            }
                                                        >
                                                            <div className="review-note-badges">
                                                                {note.pinned && (
                                                                    <Pin
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                )}{" "}
                                                                {note.locked && (
                                                                    <LockKeyhole
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                )}{" "}
                                                                {note.shared && (
                                                                    <Share2
                                                                        size={
                                                                            14
                                                                        }
                                                                    />
                                                                )}
                                                            </div>
                                                            <h2>
                                                                {locked
                                                                    ? text(
                                                                          "Locked note",
                                                                          "Ghi chú đã khóa",
                                                                      )
                                                                    : note.title}
                                                            </h2>
                                                            {locked ? (
                                                                <p>
                                                                    {text(
                                                                        "Unlock to read this note.",
                                                                        "Mở khóa để đọc ghi chú này.",
                                                                    )}
                                                                </p>
                                                            ) : (
                                                                <p>
                                                                    {noteLines(
                                                                        (
                                                                            drafts[
                                                                                note
                                                                                    .id
                                                                            ]
                                                                                ?.content ||
                                                                            note.content
                                                                        ).slice(
                                                                            0,
                                                                            200,
                                                                        ),
                                                                    ).map(
                                                                        (
                                                                            line,
                                                                            index,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    index
                                                                                }
                                                                            >
                                                                                {index >
                                                                                    0 &&
                                                                                    "\n"}
                                                                                {line.checked !==
                                                                                    null && (
                                                                                    <span
                                                                                        className={`note-preview-box ${line.checked ? "is-checked" : ""}`}
                                                                                        role="img"
                                                                                        aria-label={
                                                                                            line.checked
                                                                                                ? text(
                                                                                                      "Checked",
                                                                                                      "Đã đánh dấu",
                                                                                                  )
                                                                                                : text(
                                                                                                      "Unchecked",
                                                                                                      "Chưa đánh dấu",
                                                                                                  )
                                                                                        }
                                                                                    >
                                                                                        {line.checked &&
                                                                                            "✓"}
                                                                                    </span>
                                                                                )}
                                                                                {
                                                                                    line.text
                                                                                }
                                                                            </span>
                                                                        ),
                                                                    )}
                                                                </p>
                                                            )}
                                                            <small>
                                                                {note.permission ===
                                                                "read"
                                                                    ? text(
                                                                          "Shared · Read-only",
                                                                          "Được chia sẻ · Chỉ đọc",
                                                                      )
                                                                    : note.tags
                                                                          .map(
                                                                              (
                                                                                  id,
                                                                              ) =>
                                                                                  text(
                                                                                      ...tags.find(
                                                                                          (
                                                                                              tag,
                                                                                          ) =>
                                                                                              tag.id ===
                                                                                              id,
                                                                                      )!
                                                                                          .label,
                                                                                  ),
                                                                          )
                                                                          .join(
                                                                              " · ",
                                                                          )}
                                                            </small>
                                                        </button>
                                                        <details className="review-row-menu">
                                                            <summary
                                                                className="icon-button"
                                                                aria-label={text(
                                                                    "Note actions",
                                                                    "Thao tác ghi chú",
                                                                )}
                                                            >
                                                                <MoreHorizontal
                                                                    size={18}
                                                                />
                                                            </summary>
                                                            <div>
                                                                <button
                                                                    onClick={() =>
                                                                        open(
                                                                            note,
                                                                        )
                                                                    }
                                                                >
                                                                    {text(
                                                                        "Open",
                                                                        "Mở",
                                                                    )}
                                                                </button>
                                                                {note.permission ===
                                                                "owner" ? (
                                                                    <>
                                                                        <button
                                                                            disabled={
                                                                                locked
                                                                            }
                                                                            onClick={() =>
                                                                                patch(
                                                                                    note.id,
                                                                                    {
                                                                                        pinned: !note.pinned,
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            {text(
                                                                                note.pinned
                                                                                    ? "Unpin"
                                                                                    : "Pin",
                                                                                note.pinned
                                                                                    ? "Bỏ ghim"
                                                                                    : "Ghim",
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            disabled={
                                                                                locked
                                                                            }
                                                                            onClick={() => {
                                                                                setError(
                                                                                    "",
                                                                                );
                                                                                setDialog(
                                                                                    {
                                                                                        kind: "share",
                                                                                        id: note.id,
                                                                                    },
                                                                                );
                                                                            }}
                                                                        >
                                                                            {text(
                                                                                "Share",
                                                                                "Chia sẻ",
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                setError(
                                                                                    "",
                                                                                );
                                                                                setDialog(
                                                                                    {
                                                                                        kind: locked
                                                                                            ? "unlock"
                                                                                            : "lock",
                                                                                        id: note.id,
                                                                                    },
                                                                                );
                                                                            }}
                                                                        >
                                                                            {text(
                                                                                locked
                                                                                    ? "Unlock"
                                                                                    : "Password",
                                                                                locked
                                                                                    ? "Mở khóa"
                                                                                    : "Mật khẩu",
                                                                            )}
                                                                        </button>
                                                                        <button
                                                                            disabled={
                                                                                locked
                                                                            }
                                                                            onClick={() =>
                                                                                setDialog(
                                                                                    {
                                                                                        kind: "delete",
                                                                                        id: note.id,
                                                                                    },
                                                                                )
                                                                            }
                                                                        >
                                                                            {text(
                                                                                "Delete note",
                                                                                "Xóa ghi chú",
                                                                            )}
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={() =>
                                                                            db.navigate(
                                                                                "reports",
                                                                                {
                                                                                    note: note.id,
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        {text(
                                                                            "Report this note",
                                                                            "Báo cáo ghi chú",
                                                                        )}
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </details>
                                                    </article>
                                                );
                                            })}
                                    </div>
                                </section>
                            ),
                    )}
                    {!filtered.length && (
                        <div className="review-state">
                            <FileText size={28} />
                            <h2>
                                {text(
                                    "No notes match these filters",
                                    "Không có ghi chú phù hợp",
                                )}
                            </h2>
                            <button
                                className="button button-quiet"
                                onClick={() => {
                                    setQuery("");
                                    setActiveTags([]);
                                    setFilter("all");
                                }}
                            >
                                {text("Clear filters", "Xóa bộ lọc")}
                            </button>
                        </div>
                    )}
                </section>
            </div>
            {note && (
                <Dialog
                    title={
                        locked
                            ? text("Locked note", "Ghi chú đã khóa")
                            : draft?.title || note.title
                    }
                    heading={
                        <>
                            <p className="eyebrow">
                                {text("Editing", "Chỉnh sửa")}
                            </p>
                            <h2>
                                {locked
                                    ? text("Locked note", "Ghi chú đã khóa")
                                    : draft?.title || note.title}
                            </h2>
                            <span className="save-status" role="status">
                                {offline
                                    ? text(
                                          "Offline · queued",
                                          "Ngoại tuyến · chờ lưu",
                                      )
                                    : saving
                                      ? text("Saving…", "Đang lưu…")
                                      : text("Saved", "Đã lưu")}
                            </span>
                        </>
                    }
                    className="preview-dialog review-dialog review-note-modal"
                    closeLabel={text("Close editor", "Đóng trình soạn thảo")}
                    onClose={() => setSelectedId("")}
                >
                    <div className="preview-dialog-body">
                        <>
                            {locked ? (
                                <section className="planning-panel review-state">
                                    <LockKeyhole size={32} />
                                    <h2>
                                        {text(
                                            "This note is locked",
                                            "Ghi chú này đã khóa",
                                        )}
                                    </h2>
                                    <button
                                        className="button button-primary"
                                        onClick={() =>
                                            setDialog({
                                                kind: "unlock",
                                                id: note.id,
                                            })
                                        }
                                    >
                                        {text("Unlock", "Mở khóa")}
                                    </button>
                                </section>
                            ) : (
                                <>
                                    {note.permission === "read" && (
                                        <p className="notice">
                                            {text(
                                                "Shared with you · Read-only. Changes are disabled.",
                                                "Được chia sẻ với bạn · Chỉ đọc. Các thao tác chỉnh sửa bị tắt.",
                                            )}
                                        </p>
                                    )}
                                    {conflict === note.id && (
                                        <aside
                                            className="notice review-conflict"
                                            role="alert"
                                        >
                                            <strong>
                                                {text(
                                                    "This note changed in another saved version",
                                                    "Ghi chú có thay đổi ở bản lưu khác",
                                                )}
                                            </strong>
                                            <p>
                                                {text(
                                                    "Your draft is preserved. Choose a version to continue.",
                                                    "Bản nháp được giữ nguyên. Chọn phiên bản để tiếp tục.",
                                                )}
                                            </p>
                                            <div className="action-row">
                                                {db.live && (
                                                    <button
                                                        className="button button-quiet"
                                                        onClick={() => {
                                                            const value =
                                                                drafts[
                                                                    note.id
                                                                ] || note;
                                                            const url =
                                                                URL.createObjectURL(
                                                                    new Blob(
                                                                        [
                                                                            value.title +
                                                                                "\n\n" +
                                                                                value.content,
                                                                        ],
                                                                        {
                                                                            type: "text/plain",
                                                                        },
                                                                    ),
                                                                );
                                                            urls.current.push(
                                                                url,
                                                            );
                                                            const anchor =
                                                                document.createElement(
                                                                    "a",
                                                                );
                                                            anchor.href = url;
                                                            anchor.download =
                                                                "note-draft.txt";
                                                            anchor.click();
                                                        }}
                                                    >
                                                        {text(
                                                            "Download draft",
                                                            "Tải bản nháp",
                                                        )}
                                                    </button>
                                                )}
                                                <button
                                                    className="button button-quiet"
                                                    onClick={() => {
                                                        setDrafts((current) => {
                                                            const next = {
                                                                ...current,
                                                            };
                                                            if (db.live)
                                                                void db.live.discardNoteDraft(
                                                                    note.id,
                                                                );
                                                            delete next[
                                                                note.id
                                                            ];
                                                            return next;
                                                        });
                                                        setConflict("");
                                                    }}
                                                >
                                                    {text(
                                                        "Use saved version",
                                                        "Dùng bản đã lưu",
                                                    )}
                                                </button>
                                                <button
                                                    className="button button-primary"
                                                    onClick={() =>
                                                        setConflict("")
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
                                    <div className="review-notes-layout">
                                        <article className="planning-panel review-note-editor">
                                            <div className="review-note-title-row">
                                                <label className="review-note-title-label">
                                                    <span>
                                                        {text(
                                                            "Title",
                                                            "Tiêu đề",
                                                        )}
                                                    </span>
                                                    <input
                                                        aria-label={text(
                                                            "Note title",
                                                            "Tên ghi chú",
                                                        )}
                                                        value={draft!.title}
                                                        maxLength={200}
                                                        readOnly={!editable}
                                                        onChange={(event) =>
                                                            edit({
                                                                title: event
                                                                    .target
                                                                    .value,
                                                            })
                                                        }
                                                    />
                                                </label>
                                                <button
                                                    className="icon-button"
                                                    disabled={!editable}
                                                    aria-pressed={note.pinned}
                                                    aria-label={text(
                                                        "Pin note",
                                                        "Ghim ghi chú",
                                                    )}
                                                    onClick={() =>
                                                        patch(note.id, {
                                                            pinned: !note.pinned,
                                                        })
                                                    }
                                                >
                                                    <Pin
                                                        size={17}
                                                        fill={
                                                            note.pinned
                                                                ? "currentColor"
                                                                : "none"
                                                        }
                                                    />
                                                </button>
                                            </div>
                                            <section className="review-note-body">
                                                <label className="control-label">
                                                    {text(
                                                        "Content",
                                                        "Nội dung",
                                                    )}
                                                </label>
                                                <div
                                                    className="review-note-paper"
                                                    style={
                                                        {
                                                            background:
                                                                note.background
                                                                    ? `linear-gradient(#ffffffdf,#ffffffdf),url('${note.background}') center/cover`
                                                                    : "var(--surface)",
                                                            "--font-size-note":
                                                                noteSize,
                                                        } as React.CSSProperties
                                                    }
                                                >
                                                    <NoteDocument
                                                        key={`${note.id}-${db.locale}`}
                                                        label={text(
                                                            "Note content",
                                                            "Nội dung ghi chú",
                                                        )}
                                                        value={draft!.content}
                                                        onChange={(content) =>
                                                            edit({ content })
                                                        }
                                                        readOnly={!editable}
                                                    />
                                                </div>
                                                <div
                                                    className="review-note-save-status"
                                                    role="status"
                                                >
                                                    {text(
                                                        note.permission ===
                                                            "read"
                                                            ? "Read-only"
                                                            : conflict ===
                                                                note.id
                                                              ? "Choose a saved/draft version"
                                                              : offline &&
                                                                  drafts[
                                                                      note.id
                                                                  ]
                                                                ? "Offline · changes queued"
                                                                : saving
                                                                  ? "Saving…"
                                                                  : db.live
                                                                    ? "Saved"
                                                                    : "Saved in this preview",
                                                        note.permission ===
                                                            "read"
                                                            ? "Chỉ đọc"
                                                            : conflict ===
                                                                note.id
                                                              ? "Chọn bản đã lưu hoặc bản nháp"
                                                              : offline &&
                                                                  drafts[
                                                                      note.id
                                                                  ]
                                                                ? "Ngoại tuyến · thay đổi chờ lưu"
                                                                : saving
                                                                  ? "Đang lưu…"
                                                                  : db.live
                                                                    ? "Đã lưu"
                                                                    : "Đã lưu trong bản xem thử",
                                                    )}
                                                </div>
                                            </section>
                                            <details className="goal-information-section">
                                                <summary>
                                                    {text(
                                                        "Attachments",
                                                        "Tệp đính kèm",
                                                    )}
                                                </summary>
                                                <label className="button button-quiet review-file-input">
                                                    <Paperclip size={16} />
                                                    {text(
                                                        "Add files",
                                                        "Thêm tệp",
                                                    )}
                                                    <input
                                                        type="file"
                                                        multiple
                                                        disabled={!editable}
                                                        onChange={(event) => {
                                                            void attach(
                                                                event.target
                                                                    .files,
                                                            );
                                                            event.target.value =
                                                                "";
                                                        }}
                                                    />
                                                </label>
                                                <p className="subtle-copy">
                                                    {text(
                                                        "Selected files stay in browser memory for this preview.",
                                                        "Tệp được chọn chỉ nằm trong bộ nhớ trình duyệt cho lượt xem này.",
                                                    )}
                                                </p>
                                                {note.files.map((file) => (
                                                    <div
                                                        key={file.id}
                                                        className="review-file-row"
                                                    >
                                                        <button
                                                            className="review-file-preview"
                                                            onClick={() =>
                                                                setDialog({
                                                                    kind: "file",
                                                                    id: note.id,
                                                                    file,
                                                                })
                                                            }
                                                        >
                                                            {file.type.startsWith(
                                                                "image/",
                                                            ) ? (
                                                                <img
                                                                    src={
                                                                        file.url
                                                                    }
                                                                    alt={
                                                                        file.name
                                                                    }
                                                                />
                                                            ) : (
                                                                <FileText
                                                                    size={25}
                                                                />
                                                            )}
                                                            <span>
                                                                {file.name}
                                                                <small>
                                                                    {Math.ceil(
                                                                        file.size /
                                                                            1024,
                                                                    )}{" "}
                                                                    KB
                                                                </small>
                                                            </span>
                                                        </button>
                                                        <a
                                                            className="icon-button"
                                                            href={file.url}
                                                            download={file.name}
                                                            aria-label={
                                                                text(
                                                                    "Download: ",
                                                                    "Tải về: ",
                                                                ) + file.name
                                                            }
                                                        >
                                                            <Download
                                                                size={16}
                                                            />
                                                        </a>
                                                        {file.type.startsWith(
                                                            "image/",
                                                        ) && (
                                                            <button
                                                                className="text-button"
                                                                disabled={
                                                                    !editable
                                                                }
                                                                onClick={() =>
                                                                    patch(
                                                                        note.id,
                                                                        {
                                                                            background:
                                                                                file.url,
                                                                        },
                                                                    )
                                                                }
                                                            >
                                                                {text(
                                                                    "Use as background",
                                                                    "Dùng làm nền",
                                                                )}
                                                            </button>
                                                        )}
                                                        <button
                                                            className="icon-button"
                                                            disabled={!editable}
                                                            aria-label={
                                                                text(
                                                                    "Remove file: ",
                                                                    "Bỏ tệp: ",
                                                                ) + file.name
                                                            }
                                                            onClick={() => {
                                                                if (db.live) {
                                                                    void act(
                                                                        () =>
                                                                            db.live!.request(
                                                                                `/notes/${note.id}/attachments/${file.id}`,
                                                                                {
                                                                                    method: "DELETE",
                                                                                },
                                                                            ),
                                                                    );
                                                                    return;
                                                                }
                                                                patch(note.id, {
                                                                    files: note.files.filter(
                                                                        (row) =>
                                                                            row.id !==
                                                                            file.id,
                                                                    ),
                                                                    background:
                                                                        note.background ===
                                                                        file.url
                                                                            ? ""
                                                                            : note.background,
                                                                });
                                                                URL.revokeObjectURL(
                                                                    file.url,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ))}
                                                {!note.files.length && (
                                                    <p className="review-inline-empty">
                                                        {text(
                                                            "No attachments yet.",
                                                            "Chưa có tệp đính kèm.",
                                                        )}
                                                    </p>
                                                )}
                                                {note.background && (
                                                    <button
                                                        className="text-button"
                                                        disabled={!editable}
                                                        onClick={() =>
                                                            patch(note.id, {
                                                                background: "",
                                                            })
                                                        }
                                                    >
                                                        {text(
                                                            "Remove background",
                                                            "Bỏ nền ghi chú",
                                                        )}
                                                    </button>
                                                )}
                                            </details>
                                            <details className="goal-information-section">
                                                <summary>
                                                    {text(
                                                        "Resources",
                                                        "Tài nguyên",
                                                    )}
                                                </summary>
                                                {resources.map((url) => (
                                                    <p key={url}>
                                                        <a
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            {url}
                                                        </a>
                                                    </p>
                                                ))}
                                                {!resources.length && (
                                                    <p className="review-inline-empty">
                                                        {text(
                                                            "Links written in this note will appear here.",
                                                            "Liên kết viết trong ghi chú sẽ xuất hiện ở đây.",
                                                        )}
                                                    </p>
                                                )}
                                            </details>
                                        </article>
                                        <aside className="review-note-side review-note-metadata">
                                            <section className="planning-panel">
                                                <h2>
                                                    {text(
                                                        "Classification",
                                                        "Phân loại",
                                                    )}
                                                </h2>
                                                <fieldset
                                                    className="review-checkbox-list"
                                                    disabled={
                                                        !editable ||
                                                        (!!db.live &&
                                                            note.permission !==
                                                                "owner")
                                                    }
                                                >
                                                    <legend>
                                                        {text("Tags", "Nhãn")}
                                                    </legend>
                                                    {tags.map((tag) => (
                                                        <label key={tag.id}>
                                                            <input
                                                                type="checkbox"
                                                                checked={note.tags.includes(
                                                                    tag.id,
                                                                )}
                                                                onChange={() =>
                                                                    patch(
                                                                        note.id,
                                                                        {
                                                                            tags: note.tags.includes(
                                                                                tag.id,
                                                                            )
                                                                                ? note.tags.filter(
                                                                                      (
                                                                                          id,
                                                                                      ) =>
                                                                                          id !==
                                                                                          tag.id,
                                                                                  )
                                                                                : [
                                                                                      ...note.tags,
                                                                                      tag.id,
                                                                                  ],
                                                                        },
                                                                    )
                                                                }
                                                            />
                                                            {text(...tag.label)}
                                                        </label>
                                                    ))}
                                                </fieldset>
                                                <Field
                                                    label={text(
                                                        "Goal",
                                                        "Mục tiêu",
                                                    )}
                                                >
                                                    <select
                                                        disabled={
                                                            !editable ||
                                                            (!!db.live &&
                                                                note.permission !==
                                                                    "owner")
                                                        }
                                                        value={note.goal}
                                                        onChange={(event) =>
                                                            patch(note.id, {
                                                                goal: event
                                                                    .target
                                                                    .value,
                                                                task: null,
                                                            })
                                                        }
                                                    >
                                                        <option value="">
                                                            {text(
                                                                "No Goal link",
                                                                "Chưa liên kết mục tiêu",
                                                            )}
                                                        </option>
                                                        {db.goals
                                                            .filter(
                                                                (goal) =>
                                                                    !goal.archived,
                                                            )
                                                            .map((goal) => (
                                                                <option
                                                                    key={
                                                                        goal.id
                                                                    }
                                                                    value={
                                                                        goal.id
                                                                    }
                                                                >
                                                                    {text(
                                                                        ...goal.title,
                                                                    )}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </Field>
                                                {note.goal && (
                                                    <button
                                                        className="text-button"
                                                        onClick={() =>
                                                            db.navigate(
                                                                "goals",
                                                                {
                                                                    goal: note.goal,
                                                                },
                                                            )
                                                        }
                                                    >
                                                        {text(
                                                            "Open Goal",
                                                            "Mở mục tiêu",
                                                        )}
                                                    </button>
                                                )}
                                                <Field
                                                    label={text(
                                                        "Task",
                                                        "Công việc",
                                                    )}
                                                >
                                                    <select
                                                        disabled={
                                                            !editable ||
                                                            (!!db.live &&
                                                                note.permission !==
                                                                    "owner")
                                                        }
                                                        value={note.task || ""}
                                                        onChange={(event) =>
                                                            patch(note.id, {
                                                                task: event
                                                                    .target
                                                                    .value
                                                                    ? Number(
                                                                          event
                                                                              .target
                                                                              .value,
                                                                      )
                                                                    : null,
                                                            })
                                                        }
                                                    >
                                                        <option value="">
                                                            {text(
                                                                "No Task link",
                                                                "Chưa liên kết công việc",
                                                            )}
                                                        </option>
                                                        {db.tasks
                                                            .filter(
                                                                (task) =>
                                                                    !task.archived,
                                                            )
                                                            .map((task) => (
                                                                <option
                                                                    key={
                                                                        task.id
                                                                    }
                                                                    value={
                                                                        task.id
                                                                    }
                                                                >
                                                                    {text(
                                                                        ...task.title,
                                                                    )}
                                                                </option>
                                                            ))}
                                                    </select>
                                                </Field>
                                                {note.task && (
                                                    <button
                                                        className="text-button"
                                                        onClick={() =>
                                                            db.navigate(
                                                                "tasks",
                                                                {
                                                                    task: note.task!,
                                                                },
                                                            )
                                                        }
                                                    >
                                                        {text(
                                                            "Open task",
                                                            "Mở công việc",
                                                        )}
                                                    </button>
                                                )}
                                                <div
                                                    className="review-color-options"
                                                    role="group"
                                                    aria-label={text(
                                                        "Note color",
                                                        "Màu ghi chú",
                                                    )}
                                                >
                                                    {[
                                                        "#ffffff",
                                                        "#e7f3ef",
                                                        "#fff2dc",
                                                        "#eeeafa",
                                                        "#e9f2fc",
                                                        "#fbe9ed",
                                                    ].map((color) => (
                                                        <button
                                                            key={color}
                                                            className="review-color-dot"
                                                            disabled={
                                                                !editable ||
                                                                (!!db.live &&
                                                                    note.permission !==
                                                                        "owner")
                                                            }
                                                            aria-label={color}
                                                            aria-pressed={
                                                                note.color ===
                                                                color
                                                            }
                                                            style={{
                                                                background:
                                                                    color,
                                                            }}
                                                            onClick={() =>
                                                                patch(note.id, {
                                                                    color,
                                                                })
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            </section>
                                            <section className="planning-panel review-note-summary">
                                                <div className="section-heading">
                                                    <h2>
                                                        <Sparkles size={16} />
                                                        {text(
                                                            "AI summary",
                                                            "Tóm tắt AI",
                                                        )}
                                                    </h2>
                                                </div>
                                                {note.summaryOutdated && (
                                                    <p className="notice">
                                                        {text(
                                                            "The note changed after this summary.",
                                                            "Ghi chú đã thay đổi sau bản tóm tắt này.",
                                                        )}
                                                    </p>
                                                )}
                                                {note.summary ? (
                                                    <p className="review-prose">
                                                        {note.summary}
                                                    </p>
                                                ) : (
                                                    <p className="subtle-copy">
                                                        {text(
                                                            db.live
                                                                ? "Generate a summary from this Note."
                                                                : "Generate a sample summary to review its presentation.",
                                                            db.live
                                                                ? "Tạo tóm tắt từ nội dung ghi chú."
                                                                : "Tạo tóm tắt mẫu để xem cách trình bày.",
                                                        )}
                                                    </p>
                                                )}
                                                <button
                                                    className="button button-quiet"
                                                    disabled={
                                                        !editable || offline
                                                    }
                                                    onClick={() => {
                                                        if (db.live) {
                                                            void askNote(true);
                                                            return;
                                                        }
                                                        patch(note.id, {
                                                            summary:
                                                                draft!.content.slice(
                                                                    0,
                                                                    260,
                                                                ),
                                                            summaryOutdated: false,
                                                        });
                                                    }}
                                                >
                                                    {text(
                                                        note.summary
                                                            ? db.live
                                                                ? "Regenerate summary"
                                                                : "Regenerate sample"
                                                            : db.live
                                                              ? "Generate summary"
                                                              : "Generate sample summary",
                                                        note.summary
                                                            ? db.live
                                                                ? "Tạo lại tóm tắt"
                                                                : "Tạo lại bản mẫu"
                                                            : db.live
                                                              ? "Tạo tóm tắt"
                                                              : "Tạo tóm tắt mẫu",
                                                    )}
                                                </button>
                                                <form
                                                    className="stack-form review-spaced"
                                                    onSubmit={(event) => {
                                                        event.preventDefault();
                                                        if (!ask.trim()) return;
                                                        if (db.live) {
                                                            void askNote(false);
                                                            return;
                                                        }
                                                        setAnswer(
                                                            text(
                                                                "Sample answer based on this note: ",
                                                                "Câu trả lời minh họa dựa trên ghi chú này: ",
                                                            ) +
                                                                (note.summary ||
                                                                    draft!.content.slice(
                                                                        0,
                                                                        180,
                                                                    )),
                                                        );
                                                    }}
                                                >
                                                    <Field
                                                        label={text(
                                                            "Ask about this note",
                                                            "Hỏi về ghi chú này",
                                                        )}
                                                    >
                                                        <input
                                                            value={ask}
                                                            disabled={
                                                                offline ||
                                                                (!!db.live &&
                                                                    (note.locked ||
                                                                        note.permission !==
                                                                            "owner"))
                                                            }
                                                            onChange={(event) =>
                                                                setAsk(
                                                                    event.target
                                                                        .value,
                                                                )
                                                            }
                                                        />
                                                    </Field>
                                                    <button
                                                        className="button button-quiet"
                                                        disabled={
                                                            offline ||
                                                            (!!db.live &&
                                                                (note.locked ||
                                                                    note.permission !==
                                                                        "owner"))
                                                        }
                                                    >
                                                        {text("Ask", "Hỏi")}
                                                    </button>
                                                </form>
                                                {answer && (
                                                    <div className="review-answer">
                                                        <p>{answer}</p>
                                                        <span className="context-chip">
                                                            {draft!.title}
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    className="text-button review-spaced"
                                                    onClick={() => {
                                                        db.setAssistantContext(
                                                            note.id,
                                                        );
                                                        db.setAssistantOpen(
                                                            true,
                                                        );
                                                    }}
                                                >
                                                    {text(
                                                        "Open assistant",
                                                        "Mở trợ lý",
                                                    )}
                                                </button>
                                            </section>
                                            {!db.live && (
                                                <details className="review-simulation">
                                                    <summary>
                                                        {text(
                                                            "Preview a saved/draft conflict",
                                                            "Xem thử xung đột bản lưu/bản nháp",
                                                        )}
                                                    </summary>
                                                    <button
                                                        className="button button-quiet"
                                                        disabled={!editable}
                                                        onClick={() => {
                                                            setDrafts(
                                                                (values) => ({
                                                                    ...values,
                                                                    [note.id]:
                                                                        values[
                                                                            note
                                                                                .id
                                                                        ] || {
                                                                            title: note.title,
                                                                            content:
                                                                                note.content +
                                                                                "\n" +
                                                                                text(
                                                                                    "Unsaved example",
                                                                                    "Ví dụ chưa lưu",
                                                                                ),
                                                                        },
                                                                }),
                                                            );
                                                            setConflict(
                                                                note.id,
                                                            );
                                                        }}
                                                    >
                                                        {text(
                                                            "Show conflict",
                                                            "Hiện xung đột",
                                                        )}
                                                    </button>
                                                </details>
                                            )}
                                        </aside>
                                    </div>
                                </>
                            )}
                        </>

                        <div className="review-note-modal-actions">
                            {db.live && note.permission !== "owner" && (
                                <button
                                    className="button button-quiet"
                                    onClick={() =>
                                        void act(async () => {
                                            await db.live!.request(
                                                `/notes/${note.id}/leave`,
                                                { method: "DELETE" },
                                            );
                                            setSelectedId("");
                                        })
                                    }
                                >
                                    {text(
                                        "Leave shared Note",
                                        "Rời ghi chú chia sẻ",
                                    )}
                                </button>
                            )}
                            <button
                                className="button button-quiet"
                                disabled={note.permission !== "owner" || locked}
                                onClick={() => {
                                    setError("");
                                    setDialog({ kind: "share", id: note.id });
                                }}
                            >
                                <Share2 size={16} />
                                {text("Share", "Chia sẻ")}
                            </button>
                            <button
                                className="button button-quiet"
                                disabled={note.permission !== "owner"}
                                onClick={() => {
                                    setError("");
                                    setDialog({
                                        kind: locked ? "unlock" : "lock",
                                        id: note.id,
                                    });
                                }}
                            >
                                <LockKeyhole size={17} />
                                {text("Note password", "Mật khẩu ghi chú")}
                            </button>
                        </div>
                    </div>
                </Dialog>
            )}
            {manageTags && (
                <FormDialog
                    title={text("Manage tags", "Quản lý nhãn")}
                    text={text}
                    onClose={() => setManageTags(false)}
                    onSubmit={async (form) => {
                        const fields = new FormData(form);
                        const next = tags
                            .map((tag) => ({
                                ...tag,
                                label: [
                                    String(fields.get(tag.id) || "").trim(),
                                    String(fields.get(tag.id) || "").trim(),
                                ] as [string, string],
                            }))
                            .filter((tag) => tag.label[0]);
                        const added = String(fields.get("newTag") || "").trim();
                        if (
                            added &&
                            !next.some(
                                (tag) =>
                                    tag.label[0].toLowerCase() ===
                                    added.toLowerCase(),
                            )
                        )
                            next.push({
                                id: `note-tag-${Date.now()}`,
                                label: [added, added],
                            });
                        if (db.live) {
                            const renamed = new Map(
                                tags.map((t) => [
                                    t.id,
                                    String(fields.get(t.id) || "").trim(),
                                ]),
                            );
                            const names = next.map((t) => t.label[0]);
                            db.setNotes((rows) =>
                                rows.map((row) =>
                                    row.permission !== "owner"
                                        ? row
                                        : {
                                              ...row,
                                              tags: row.tags
                                                  .map(
                                                      (t) =>
                                                          renamed.get(t) || "",
                                                  )
                                                  .filter(Boolean),
                                          },
                                ),
                            );
                            if (!(await db.live.flush())) return false;
                            await db.live.saveTags(names);
                            setManageTags(false);
                            return;
                        }
                        setTags(next);
                        setActiveTags((ids) =>
                            ids.filter((id) =>
                                next.some((tag) => tag.id === id),
                            ),
                        );
                        db.setNotes((notes) =>
                            notes.map((note) => ({
                                ...note,
                                tags: note.tags.filter((id) =>
                                    next.some((tag) => tag.id === id),
                                ),
                            })),
                        );
                        setManageTags(false);
                    }}
                >
                    <p className="subtle-copy">
                        {text(
                            "Rename a tag, or clear its name to remove it from Notes.",
                            "Đổi tên nhãn hoặc xóa tên để bỏ nhãn khỏi Ghi chú.",
                        )}
                    </p>
                    {tags.map((tag) => (
                        <Field key={tag.id} label={text(...tag.label)}>
                            <input
                                name={tag.id}
                                defaultValue={text(...tag.label)}
                                maxLength={80}
                            />
                        </Field>
                    ))}
                    <Field label={text("New tag", "Nhãn mới")}>
                        <input name="newTag" maxLength={80} />
                    </Field>
                </FormDialog>
            )}
            {dialog?.kind === "unlock" && modalNote && (
                <FormDialog
                    text={text}
                    title={text("Unlock note", "Mở khóa ghi chú")}
                    submitLabel={text("Unlock", "Mở khóa")}
                    onClose={() => {
                        setDialog(null);
                        setOpeningNote(false);
                        setError("");
                    }}
                    onSubmit={async (form) => {
                        const values = new FormData(form);
                        if (db.live) {
                            await db.live.request(
                                `/notes/${modalNote.id}/unlock`,
                                {
                                    method: "POST",
                                    body: JSON.stringify({
                                        password: String(
                                            values.get("password"),
                                        ),
                                    }),
                                },
                            );
                            await db.live.refresh();
                            if (openingNote) setSelectedId(modalNote.id);
                            setDialog(null);
                            setError("");
                            return;
                        }
                        if (values.get("password") !== modalNote.lockPassword) {
                            setError(
                                text(
                                    "The sample password does not match.",
                                    "Mật khẩu mẫu chưa khớp.",
                                ),
                            );
                            return false;
                        }
                        patch(modalNote.id, { unlocked: true });
                        if (openingNote) setSelectedId(modalNote.id);
                        setDialog(null);
                        setError("");
                    }}
                >
                    <Field
                        label={text("Password", "Mật khẩu")}
                        hint={
                            db.live
                                ? undefined
                                : text(
                                      "Fixture password: 123456",
                                      "Mật khẩu minh họa: 123456",
                                  )
                        }
                    >
                        <input
                            name="password"
                            type="password"
                            required
                            autoComplete="off"
                        />
                    </Field>
                    {error && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                </FormDialog>
            )}
            {dialog?.kind === "lock" && modalNote && (
                <FormDialog
                    text={text}
                    title={text(
                        modalNote.locked
                            ? "Change note password"
                            : "Protect this note",
                        modalNote.locked
                            ? "Đổi mật khẩu ghi chú"
                            : "Đặt mật khẩu ghi chú",
                    )}
                    onClose={() => {
                        setDialog(null);
                        setError("");
                    }}
                    onSubmit={async (form) => {
                        const values = new FormData(form),
                            current = String(values.get("current") || ""),
                            password = String(values.get("password") || "");
                        if (db.live) {
                            if (password !== values.get("confirm"))
                                throw new Error(
                                    text(
                                        "Passwords do not match",
                                        "Mật khẩu xác nhận chưa khớp",
                                    ),
                                );
                            await db.live.request(
                                `/notes/${modalNote.id}/password`,
                                {
                                    method: "POST",
                                    body: JSON.stringify({
                                        current_password: current,
                                        new_password: password || null,
                                    }),
                                },
                            );
                            await db.live.refresh();
                            setDialog(null);
                            setSelectedId("");
                            return;
                        }
                        if (
                            modalNote.locked &&
                            current !== modalNote.lockPassword
                        ) {
                            setError(
                                text(
                                    "The current sample password does not match.",
                                    "Mật khẩu mẫu hiện tại chưa khớp.",
                                ),
                            );
                            return false;
                        }
                        if (password !== values.get("confirm")) {
                            setError(
                                text(
                                    "The passwords do not match.",
                                    "Hai mật khẩu chưa khớp.",
                                ),
                            );
                            return false;
                        }
                        patch(modalNote.id, {
                            locked: !!password,
                            lockPassword: password,
                            unlocked: !password,
                        });
                        setDialog(null);
                        setError("");
                    }}
                >
                    <p className="subtle-copy">
                        {text(
                            db.live
                                ? "Use at least 8 characters. This password also protects attachments and shared access."
                                : "Use a test password. This preview does not encrypt or store files on a server.",
                            db.live
                                ? "Dùng ít nhất 8 ký tự. Mật khẩu cũng bảo vệ tệp và truy cập được chia sẻ."
                                : "Dùng mật khẩu thử. Bản xem này không mã hóa hay lưu tệp trên máy chủ.",
                        )}
                    </p>
                    {modalNote.locked && (
                        <Field
                            label={text(
                                "Current password",
                                "Mật khẩu hiện tại",
                            )}
                        >
                            <input
                                name="current"
                                type="password"
                                required
                                autoComplete="off"
                            />
                        </Field>
                    )}
                    <Field
                        label={text(
                            "New password (empty removes protection)",
                            "Mật khẩu mới (để trống để bỏ khóa)",
                        )}
                    >
                        <input
                            name="password"
                            type="password"
                            autoComplete="off"
                        />
                    </Field>
                    <Field
                        label={text("Confirm password", "Nhập lại mật khẩu")}
                    >
                        <input
                            name="confirm"
                            type="password"
                            autoComplete="off"
                        />
                    </Field>
                    {error && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                </FormDialog>
            )}
            {dialog?.kind === "share" && modalNote && (
                <Dialog
                    title={text("Share note", "Chia sẻ ghi chú")}
                    closeLabel={text("Close", "Đóng")}
                    className="preview-dialog review-dialog review-compact"
                    onClose={() => {
                        setDialog(null);
                        setError("");
                    }}
                >
                    <form
                        className="preview-dialog-form"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            const emails = recipients
                                .split(/[\s,;]+/)
                                .map((email) => email.trim().toLowerCase())
                                .filter(Boolean);
                            if (db.live) {
                                try {
                                    for (const email of emails)
                                        await shareNote(
                                            modalNote.id,
                                            email,
                                            permission === "edit",
                                        );
                                    await db.live.refresh();
                                    setRecipients("");
                                    setError("");
                                    db.setMessage(
                                        text(
                                            "Invitations saved.",
                                            "Đã lưu lời mời.",
                                        ),
                                    );
                                } catch (err) {
                                    setError((err as Error).message);
                                    await db.live.refresh();
                                }
                                return;
                            }
                            if (
                                !emails.length ||
                                emails.some(
                                    (email) =>
                                        email === db.profile.email ||
                                        !db.members.some(
                                            (member) => member.email === email,
                                        ),
                                )
                            ) {
                                setError(
                                    text(
                                        "Choose registered sample accounts: binh@example.test or chi@example.test.",
                                        "Chọn tài khoản mẫu đã đăng ký: binh@example.test hoặc chi@example.test.",
                                    ),
                                );
                                return;
                            }
                            patch(modalNote.id, {
                                shared: true,
                                shares: [
                                    ...modalNote.shares.filter(
                                        (share) =>
                                            !emails.includes(share.email),
                                    ),
                                    ...emails.map((email) => ({
                                        id: email,
                                        email,
                                        permission,
                                    })),
                                ],
                            });
                            setRecipients("");
                            setError("");
                            db.setMessage(
                                text(
                                    "Sample sharing permissions updated. No email was sent.",
                                    "Đã cập nhật quyền chia sẻ mẫu. Không gửi email.",
                                ),
                            );
                        }}
                    >
                        <div className="preview-dialog-body stack-form">
                            <Field
                                label={text(
                                    "Registered account emails",
                                    "Email tài khoản đã đăng ký",
                                )}
                            >
                                <textarea
                                    rows={2}
                                    value={recipients}
                                    onChange={(event) =>
                                        setRecipients(event.target.value)
                                    }
                                    placeholder={
                                        db.live
                                            ? "friend@example.com"
                                            : "binh@example.test, chi@example.test"
                                    }
                                />
                            </Field>
                            <Field label={text("Permission", "Quyền")}>
                                <select
                                    value={permission}
                                    onChange={(event) =>
                                        setPermission(
                                            event.target.value as
                                                | "read"
                                                | "edit",
                                        )
                                    }
                                >
                                    <option value="read">
                                        {text("Can read", "Chỉ đọc")}
                                    </option>
                                    <option value="edit">
                                        {text("Can edit", "Có thể sửa")}
                                    </option>
                                </select>
                            </Field>
                            {modalNote.shares.map((share) => (
                                <div
                                    key={share.id}
                                    className="review-share-row"
                                >
                                    <span>{share.email}</span>
                                    <select
                                        aria-label={
                                            text(
                                                "Permission for ",
                                                "Quyền của ",
                                            ) + share.email
                                        }
                                        value={share.permission}
                                        onChange={(event) => {
                                            if (db.live) {
                                                void act(() =>
                                                    shareNote(
                                                        modalNote.id,
                                                        share.email,
                                                        event.target.value ===
                                                            "edit",
                                                    ),
                                                );
                                                return;
                                            }
                                            patch(modalNote.id, {
                                                shares: modalNote.shares.map(
                                                    (row) =>
                                                        row.id === share.id
                                                            ? {
                                                                  ...row,
                                                                  permission:
                                                                      event
                                                                          .target
                                                                          .value as
                                                                          | "read"
                                                                          | "edit",
                                                              }
                                                            : row,
                                                ),
                                            });
                                        }}
                                    >
                                        <option value="read">
                                            {text("Can read", "Chỉ đọc")}
                                        </option>
                                        <option value="edit">
                                            {text("Can edit", "Có thể sửa")}
                                        </option>
                                    </select>
                                    <button
                                        className="icon-button"
                                        type="button"
                                        aria-label={text(
                                            "Revoke share",
                                            "Thu hồi chia sẻ",
                                        )}
                                        onClick={() => {
                                            if (db.live) {
                                                void act(() =>
                                                    db.live!.request(
                                                        `/notes/${modalNote.id}/share/${share.id}`,
                                                        { method: "DELETE" },
                                                    ),
                                                );
                                                return;
                                            }
                                            patch(modalNote.id, {
                                                shares: modalNote.shares.filter(
                                                    (row) =>
                                                        row.id !== share.id,
                                                ),
                                                shared:
                                                    modalNote.shares.length > 1,
                                            });
                                        }}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                            {error && (
                                <p className="field-error" role="alert">
                                    {error}
                                </p>
                            )}
                        </div>
                        <footer className="preview-dialog-footer">
                            <button
                                type="button"
                                className="button button-quiet"
                                onClick={() => setDialog(null)}
                            >
                                {text("Close", "Đóng")}
                            </button>
                            <button className="button button-primary">
                                {text("Share", "Chia sẻ")}
                            </button>
                        </footer>
                    </form>
                </Dialog>
            )}
            {dialog?.kind === "delete" && modalNote && (
                <Confirm
                    text={text}
                    title={text("Delete this note?", "Xóa ghi chú này?")}
                    danger
                    onClose={() => setDialog(null)}
                    onConfirm={async () => {
                        modalNote.files.forEach((file) =>
                            URL.revokeObjectURL(file.url),
                        );
                        db.setNotes((notes) =>
                            notes.filter((note) => note.id !== modalNote.id),
                        );
                        if (db.live && !(await db.live.flush()))
                            throw new Error(
                                text(
                                    "The deletion could not be saved.",
                                    "Chưa lưu được thao tác xóa.",
                                ),
                            );
                        if (db.live)
                            await db.live.discardNoteDraft(modalNote.id);
                        setSelectedId("");
                        setDialog(null);
                    }}
                >
                    <p>{modalNote.title}</p>
                    <p>
                        {text(
                            db.live
                                ? "This permanently deletes the Note and its attachments."
                                : "This removes only the sample note. Refresh restores the fixture.",
                            db.live
                                ? "Ghi chú và tệp đính kèm sẽ bị xóa vĩnh viễn."
                                : "Chỉ xóa ghi chú mẫu. Tải lại trang để khôi phục dữ liệu minh họa.",
                        )}
                    </p>
                </Confirm>
            )}
            {dialog?.kind === "file" && dialog.file && (
                <Dialog
                    title={dialog.file.name}
                    closeLabel={text("Close", "Đóng")}
                    className="preview-dialog review-dialog review-compact"
                    onClose={() => setDialog(null)}
                >
                    <div className="preview-dialog-body">
                        {dialog.file.type.startsWith("image/") ? (
                            <img
                                className="review-image-preview"
                                src={dialog.file.url}
                                alt={dialog.file.name}
                            />
                        ) : dialog.file.content ? (
                            <pre className="review-file-text">
                                {dialog.file.content}
                            </pre>
                        ) : (
                            <p>
                                {text(
                                    "This file is available to download in the preview.",
                                    "Bạn có thể tải tệp này trong bản xem thử.",
                                )}
                            </p>
                        )}
                    </div>
                    <footer className="preview-dialog-footer">
                        <a
                            className="button button-primary"
                            href={dialog.file.url}
                            download={dialog.file.name}
                        >
                            {text("Download", "Tải về")}
                        </a>
                    </footer>
                </Dialog>
            )}
        </div>
    );
}
