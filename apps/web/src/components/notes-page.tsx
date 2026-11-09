"use client";
import { Grid2X2, List, LockKeyhole, Pin, Search, X } from "lucide-react";
import { useState } from "react";
import {
    Empty,
    QueryState,
    useItems,
    type PageContext,
} from "./workspace-context";
import { update } from "./workspace-controls";

export function NotesPage({ ctx }: { ctx: PageContext }) {
    const notes = useItems("notes", ctx.identity.user.id);
    const [query, setQuery] = useState(""),
        [tag, setTag] = useState(""),
        [sort, setSort] = useState("updated:desc"),
        [shared, setShared] = useState(false);
    const [view, setView] = useState(
        ctx.identity.user.preferences?.notes_view || "grid",
    );
    const tags = [
        ...new Set(
            notes.data
                ?.filter((note) => !note.locked)
                .flatMap((note) => note.tags || []) || [],
        ),
    ].sort();
    const rows = (notes.data || [])
        .filter(
            (note) =>
                (!shared || note.shared) &&
                (!tag || note.tags?.includes(tag)) &&
                (!query ||
                    (!note.locked &&
                        `${note.title}\n${note.content}`
                            .toLowerCase()
                            .includes(query.toLowerCase()))),
        )
        .sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            const [field, direction] = sort.split(":");
            const left =
                field === "title"
                    ? a.title
                    : field === "created"
                      ? a.created_at
                      : a.updated_at;
            const right =
                field === "title"
                    ? b.title
                    : field === "created"
                      ? b.created_at
                      : b.updated_at;
            return left.localeCompare(right) * (direction === "asc" ? 1 : -1);
        });
    return (
        <>
            <QueryState locale={ctx.identity.user.locale} queries={[notes]} />
            <div className="workspace-layout">
                <aside
                    className="notes-filter-panel"
                    aria-label={ctx.text("Note filters", "Bộ lọc ghi chú")}
                >
                    <button
                        className={`filter-all ${!shared && !tag ? "is-active" : ""}`}
                        onClick={() => {
                            setShared(false);
                            setTag("");
                        }}
                    >
                        {ctx.text("All notes", "Tất cả ghi chú")}
                        <span className="filter-count">
                            {notes.data?.length || 0}
                        </span>
                    </button>
                    <button
                        className={`filter-all ${shared ? "is-active" : ""}`}
                        onClick={() => {
                            setShared(true);
                            setTag("");
                        }}
                    >
                        {ctx.text("Shared with me", "Được chia sẻ với tôi")}
                        <span className="filter-count">
                            {notes.data?.filter((note) => note.shared).length ||
                                0}
                        </span>
                    </button>
                    <div className="filter-divider" />
                    <div className="filter-heading">
                        {ctx.text("Tags", "Nhãn")}
                    </div>
                    {tags.map((value) => (
                        <button
                            key={value}
                            className={`filter-all ${tag === value ? "is-active" : ""}`}
                            onClick={() => setTag(tag === value ? "" : value)}
                        >
                            #{value}
                        </button>
                    ))}
                </aside>
                <section className="notes-column">
                    <div className="notes-toolbar">
                        <label className="search-field">
                            <Search size={18} />
                            <span className="sr-only">
                                {ctx.text("Search notes", "Tìm ghi chú")}
                            </span>
                            <input
                                type="search"
                                placeholder={ctx.text(
                                    "Search titles and content…",
                                    "Tìm tiêu đề và nội dung…",
                                )}
                                value={query}
                                onChange={(event) =>
                                    setQuery(event.target.value)
                                }
                            />
                            {query && (
                                <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={ctx.text(
                                        "Clear search",
                                        "Xóa tìm kiếm",
                                    )}
                                    onClick={() => setQuery("")}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </label>
                        <button
                            className="view-button"
                            aria-label={ctx.text(
                                "Toggle grid/list view",
                                "Đổi dạng lưới/danh sách",
                            )}
                            onClick={() => {
                                const next = view === "grid" ? "list" : "grid";
                                setView(next);
                                void ctx.action(() =>
                                    ctx.preferences({
                                        preferences: {
                                            ...ctx.identity.user.preferences,
                                            notes_view: next,
                                        },
                                    }),
                                );
                            }}
                        >
                            {view === "grid" ? (
                                <List size={20} />
                            ) : (
                                <Grid2X2 size={20} />
                            )}
                        </button>
                        <label className="note-sort">
                            <span className="sr-only">
                                {ctx.text("Sort by", "Sắp xếp theo")}
                            </span>
                            <select
                                value={sort}
                                onChange={(event) =>
                                    setSort(event.target.value)
                                }
                            >
                                {[
                                    [
                                        "updated:desc",
                                        "Date modified · newest",
                                        "Sửa gần nhất",
                                    ],
                                    [
                                        "updated:asc",
                                        "Date modified · oldest",
                                        "Sửa cũ nhất",
                                    ],
                                    [
                                        "title:asc",
                                        "Title · A to Z",
                                        "Tiêu đề · A đến Z",
                                    ],
                                    [
                                        "title:desc",
                                        "Title · Z to A",
                                        "Tiêu đề · Z đến A",
                                    ],
                                    [
                                        "created:desc",
                                        "Date created · newest",
                                        "Tạo gần nhất",
                                    ],
                                    [
                                        "created:asc",
                                        "Date created · oldest",
                                        "Tạo cũ nhất",
                                    ],
                                ].map(([key, en, vi]) => (
                                    <option key={key} value={key}>
                                        {ctx.text(en, vi)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    {tag && (
                        <p className="active-filter-row">
                            #{tag}
                            <button
                                className="text-button"
                                onClick={() => setTag("")}
                            >
                                {ctx.text("Clear filters", "Xóa bộ lọc")}
                            </button>
                        </p>
                    )}
                    <div
                        className={`notes-grid ${view === "list" ? "is-list" : ""}`}
                    >
                        {rows.map((note) => (
                            <article
                                className="note-card"
                                data-note-color={note.color || "neutral"}
                                key={note.id}
                            >
                                <button
                                    className="note-card-open"
                                    onClick={() => ctx.open("notes", note)}
                                >
                                    <h2>
                                        {note.locked ? (
                                            <>
                                                <LockKeyhole size={18} />{" "}
                                                {ctx.text(
                                                    "Locked Note",
                                                    "Ghi chú đã khóa",
                                                )}
                                            </>
                                        ) : (
                                            note.title
                                        )}
                                    </h2>
                                    <p>{note.content}</p>
                                    <small>
                                        {note.tags
                                            ?.map((value) => `#${value}`)
                                            .join(" ")}
                                    </small>
                                </button>
                                <div className="note-card-actions">
                                    <button
                                        className="icon-button"
                                        disabled={!!note.shared}
                                        aria-label={
                                            (note.pinned
                                                ? ctx.text("Unpin", "Bỏ ghim")
                                                : ctx.text("Pin", "Ghim")) +
                                            ": " +
                                            note.title
                                        }
                                        aria-pressed={!!note.pinned}
                                        onClick={() =>
                                            note.locked
                                                ? ctx.open("notes", note)
                                                : void ctx.action(() =>
                                                      update(
                                                          ctx,
                                                          "notes",
                                                          note,
                                                          {
                                                              pinned: !note.pinned,
                                                          },
                                                      ),
                                                  )
                                        }
                                    >
                                        <Pin
                                            size={16}
                                            fill={
                                                note.pinned
                                                    ? "currentColor"
                                                    : "none"
                                            }
                                        />
                                    </button>
                                    <button
                                        className="text-button"
                                        onClick={() => ctx.open("notes", note)}
                                    >
                                        {ctx.text("Open", "Mở")}
                                    </button>
                                </div>
                            </article>
                        ))}
                    </div>
                    {!notes.isPending && !rows.length && (
                        <Empty>{ctx.t.empty}</Empty>
                    )}
                </section>
            </div>
        </>
    );
}
