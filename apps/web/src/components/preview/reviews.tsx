"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
    usePreviewData,
    day as fixtureToday,
    addDays,
    dateLabel,
    type Review,
    type ActivityFact,
    type ActivityCount,
} from "./workspace-data";
import { monday } from "./calendar";
import { PageActionBar } from "../ui/layout";
import { Confirm, Field, FormDialog, Header, ReferenceDecoration } from "./ui";
import type { Text } from "./shared";
export function ActivityView({
    text,
    compact = false,
    data: db,
    today = fixtureToday,
    onOpen,
    fetchActivity,
}: {
    text: Text;
    compact?: boolean;
    data: {
        events: ActivityFact[];
        activityCounts?: ActivityCount[];
        locale: "vi" | "en";
        profile: { timezone: string };
    };
    today?: string;
    onOpen: (fact: ActivityFact) => void;
    fetchActivity?: (day: string, before?: string) => Promise<{
        items: ActivityFact[]; nextCursor: string | null;
    }>;
}) {
    const day = today;
    const [selected, setSelected] = useState(day),
        [month, setMonth] = useState(day.slice(0, 7)),
        [kind, setKind] = useState("all");
    const [remote, setRemote] = useState<ActivityFact[]>([]),
        [cursor, setCursor] = useState<string | null>(null),
        [loading, setLoading] = useState(false),
        [error, setError] = useState(false),
        [retry, setRetry] = useState(0);
    const fetchRef = useRef(fetchActivity), requestId = useRef(0);
    fetchRef.current = fetchActivity;
    const refreshKey = JSON.stringify(db.activityCounts?.filter((row) => row.date === selected));
    useEffect(() => {
        if (!fetchRef.current) return;
        const request = ++requestId.current;
        setRemote([]);
        setCursor(null);
        setError(false);
        setLoading(true);
        fetchRef.current(selected).then((page) => {
            if (request !== requestId.current) return;
            setRemote(page.items);
            setCursor(page.nextCursor);
        }).catch(() => {
            if (request === requestId.current) setError(true);
        }).finally(() => {
            if (request === requestId.current) setLoading(false);
        });
        return () => { requestId.current++; };
    }, [selected, refreshKey, retry, !!fetchActivity]);
    async function loadMore() {
        if (!fetchRef.current || !cursor || loading) return;
        const request = requestId.current;
        setLoading(true);
        setError(false);
        try {
            const page = await fetchRef.current(selected, cursor);
            if (request !== requestId.current) return;
            setRemote((items) => [...items, ...page.items]);
            setCursor(page.nextCursor);
        } catch {
            if (request === requestId.current) setError(true);
        } finally {
            if (request === requestId.current) setLoading(false);
        }
    }
    const facts = (fetchActivity ? remote : db.events).filter((e) => kind === "all" || e.kind === kind),
        count = (date: string) =>
            db.activityCounts
                ? db.activityCounts.filter((row) => row.date === date && (kind === "all" || row.kind === kind))
                    .reduce((total, row) => total + row.count, 0)
                : facts.filter((e) => e.date === date && !e.reversed).length;
    const days = Array.from({ length: compact ? 30 : 365 }, (_, i) =>
            addDays(day, i - (compact ? 29 : 364)),
        ),
        filtered = facts
            .filter((e) => e.date === selected)
            .sort((a, b) => b.at.localeCompare(a.at));
    return (
        <section className="planning-panel review-activity">
            <div className="section-heading">
                <div>
                    <h2>{text("Activity", "Hoạt động")}</h2>
                    <p className="review-caption">
                        {text(
                            "Completion and reversal facts, without a score.",
                            "Các lần hoàn thành và hoàn tác, không quy đổi thành điểm.",
                        )}
                    </p>
                </div>
                <select
                    aria-label={text("Activity type", "Loại hoạt động")}
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                >
                    <option value="all">
                        {text("All activities", "Mọi hoạt động")}
                    </option>
                    <option value="task">{text("Tasks", "Công việc")}</option>
                    <option value="habit">{text("Habits", "Thói quen")}</option>
                    <option value="checklist">Checklist</option>
                </select>
            </div>
            <div className="review-heatmap-scroll">
                <div
                    className={`review-heatmap ${compact ? "is-compact" : ""}`}
                >
                    {days.map((date) => (
                        <button
                            key={date}
                            className={`review-heat-cell ${date === selected ? "is-selected" : ""}`}
                            data-level={Math.min(4, count(date))}
                            title={`${dateLabel(date, db.locale, true)}: ${count(date)}`}
                            aria-label={`${dateLabel(date, db.locale, true)}: ${count(date)}`}
                            onClick={() => {
                                setSelected(date);
                                setMonth(date.slice(0, 7));
                            }}
                        />
                    ))}
                </div>
            </div>
            <div className="review-activity-legend">
                <span>{text("Less", "Ít")}</span>
                {[0, 1, 2, 3, 4].map((n) => (
                    <i key={n} className="review-heat-cell" data-level={n} />
                ))}
                <span>{text("More", "Nhiều")}</span>
            </div>
            <div className="review-toolbar">
                <h3>{dateLabel(selected, db.locale, true)}</h3>
                <input
                    type="month"
                    aria-label={text("Activity month", "Tháng hoạt động")}
                    value={month}
                    onChange={(e) => {
                        setMonth(e.target.value);
                        if (e.target.value) setSelected(e.target.value + "-01");
                    }}
                />
                <input
                    type="date"
                    aria-label={text("Activity day", "Ngày hoạt động")}
                    max={day}
                    value={selected}
                    onChange={(e) => {
                        if (e.target.value) {
                            setSelected(e.target.value);
                            setMonth(e.target.value.slice(0, 7));
                        }
                    }}
                />
            </div>
            {filtered.length ? (
                filtered.map((e) => (
                    <div className="review-fact" key={e.id}>
                        <span
                            className={`review-fact-dot ${e.reversed ? "is-reversed" : ""}`}
                        />
                        <button
                            className="text-button"
                            onClick={() => onOpen(e)}
                        >
                            {text(...e.title)}
                        </button>
                        <time>
                            {new Intl.DateTimeFormat(db.locale, {
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: db.profile.timezone,
                            }).format(new Date(e.at))}
                        </time>
                    </div>
                ))
            ) : !loading && !error && !cursor ? (
                <p className="review-inline-empty">
                    {text(
                        "No recorded activity on this date.",
                        "Chưa có hoạt động được ghi nhận trong ngày này.",
                    )}
                </p>
            ) : !loading && !error && cursor ? (
                <p className="review-inline-empty">
                    {text("No matches in the loaded activities. Load more to continue.",
                          "Chưa có kết quả phù hợp trong các hoạt động đã tải. Hãy tải thêm.")}
                </p>
            ) : null}
            {fetchActivity && (
                <div className="review-toolbar" aria-live="polite">
                    {loading && <span>{text("Loading activity…", "Đang tải hoạt động…")}</span>}
                    {error && <>
                        <span>{text("Could not load activity.", "Không thể tải hoạt động.")}</span>
                        <button type="button" onClick={() => cursor ? void loadMore() : setRetry((n) => n + 1)}>
                            {text("Retry", "Thử lại")}
                        </button>
                    </>}
                    {!loading && !error && cursor && <button type="button" onClick={() => void loadMore()}>
                        {text("Load more", "Tải thêm")}
                    </button>}
                </div>
            )}
        </section>
    );
}
export function ActivityPreview({
    text,
    compact = false,
}: {
    text: Text;
    compact?: boolean;
}) {
    const data = usePreviewData();
    return (
        <ActivityView
            text={text}
            compact={compact}
            data={data}
            fetchActivity={data.live?.activityDay}
            today={data.today}
            onOpen={(fact) =>
                fact.kind === "task"
                    ? data.navigate("tasks", { task: Number(fact.target) })
                    : data.navigate("habits")
            }
        />
    );
}
export default function ReviewsPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const day = db.today || fixtureToday;
    const [tab, setTab] = useState("all"),
        [page, setPage] = useState(0),
        [selected, setSelected] = useState(""),
        [create, setCreate] = useState(false),
        [kind, setKind] = useState<Review["kind"]>("weekly"),
        [from, setFrom] = useState(monday(day)),
        [drafts, setDrafts] = useState<
            Record<
                string,
                Partial<
                    Pick<
                        Review,
                        "reflection" | "wentWell" | "improve" | "nextSteps"
                    >
                >
            >
        >({}),
        [remove, setRemove] = useState(false);
    const review = db.reviews.find((r) => r.id === selected && !r.archived);
    const end =
        kind === "daily"
            ? from
            : kind === "weekly"
              ? addDays(from, 6)
              : from
                ? new Date(
                      Date.UTC(
                          Number(from.slice(0, 4)),
                          Number(from.slice(5, 7)),
                          0,
                      ),
                  )
                      .toISOString()
                      .slice(0, 10)
                : "";
    const kindLabel = (kind: string) =>
        kind === "daily"
            ? text("Daily", "Hàng ngày")
            : kind === "weekly"
              ? text("Weekly", "Hàng tuần")
              : text("Monthly", "Hàng tháng");
    const fields = [
        ["reflection", text("Reflection", "Suy ngẫm")],
        ["wentWell", text("What went well", "Điều đã làm tốt")],
        ["improve", text("What to improve", "Điều cần cải thiện")],
        ["nextSteps", text("Next steps", "Bước tiếp theo")],
    ] as const;
    const filtered = db.reviews
        .filter((review) => !review.archived && (tab === "all" || review.kind === tab))
        .sort((a, b) => b.from.localeCompare(a.from));
    const siblings = review
        ? db.reviews
              .filter((row) => !row.archived && row.kind === review.kind)
              .sort((a, b) => a.from.localeCompare(b.from))
        : [];
    const index = siblings.findIndex((row) => row.id === review?.id);
    const draft = review ? drafts[review.id] || {} : {};
    const dirty =
        !!review &&
        fields.some(
            ([key]) =>
                draft[key] !== undefined && draft[key] !== (review[key] || ""),
        );
    function snapshot(from: string, to: string): Review["snapshot"] {
        const periodTasks = db.tasks.filter(
            (task) =>
                !task.archived &&
                !task.seriesId &&
                ((task.due && task.due >= from && task.due <= to) ||
                    (!task.due && task.daily && day >= from && day <= to)),
        );
        const facts = db.events
            .filter((event) => event.date >= from && event.date <= to)
            .map((event) => ({ ...event }));
        return {
            done: periodTasks.filter((task) => task.status === "Done").length,
            total: periodTasks.length,
            habits: db.habits.reduce(
                (count, habit) =>
                    count +
                    habit.checkins.filter((date) => date >= from && date <= to)
                        .length,
                0,
            ),
            actions: facts.filter((fact) => !fact.reversed).length,
            wins: facts.filter((fact) => !fact.reversed && fact.kind === "task")
                .length,
            days: Array.from(
                {
                    length:
                        Math.round(
                            (Date.parse(to) - Date.parse(from)) / 86400000,
                        ) + 1,
                },
                (_, i) => ({
                    date: addDays(from, i),
                    count: facts.filter(
                        (fact) =>
                            !fact.reversed && fact.date === addDays(from, i),
                    ).length,
                }),
            ),
            facts,
        };
    }
    async function save(finalized?: boolean) {
        if (!review) return;
        db.setReviews((rows) =>
            rows.map((row) =>
                row.id === review.id
                    ? {
                          ...row,
                          ...draft,
                          ...(finalized !== undefined ? { finalized } : {}),
                      }
                    : row,
            ),
        );
        if (db.live && !(await db.live.flush())) return;
        setDrafts((values) => {
            const next = { ...values };
            delete next[review.id];
            return next;
        });
        db.setMessage(text("Review saved.", "Đã lưu đánh giá."));
    }
    return (
        <div className="review-reviews planning-page">
            <Header
                title={text("Reviews", "Đánh giá")}
                description={text(
                    "Look back. Learn. Move forward.",
                    "Nhìn lại. Học hỏi. Tiến bước.",
                )}
            >
                {!review && <button
                    className="button button-primary"
                    onClick={() => setCreate(true)}
                >
                    <Plus size={17} />
                    {text("New review", "Đánh giá mới")}
                </button>}
            </Header>
            {review ? (
                <article className="planning-panel review-reflection">
                    <button
                        className="button button-quiet"
                        onClick={() => setSelected("")}
                    >
                        <ArrowLeft size={16} />
                        {text("Back to reviews", "Quay lại đánh giá")}
                    </button>
                    <div className="section-heading review-editor-heading">
                        <div>
                            <h2>{review.title}</h2>
                            <p className="subtle-copy">
                                {dateLabel(review.from, db.locale)} –{" "}
                                {dateLabel(review.to, db.locale)}
                            </p>
                        </div>
                    </div>
                    <PageActionBar label={text("Review actions", "Thao tác đánh giá")}>
                        <button
                            className="button button-quiet"
                            disabled={review.finalized}
                            onClick={() => {
                                if (db.live) {
                                    void db.live
                                        .flush()
                                        .then(async (ok) => {
                                            if (!ok) return;
                                            const row = await db.live!.request<{
                                                id: string; version: number;
                                            }>(`/reviews/${encodeURIComponent(db.live!.serverId(review.id))}`);
                                            if (row) {
                                                await db.live!.request(
                                                    "/workspace/changes",
                                                    {
                                                        method: "POST",
                                                        body: JSON.stringify(
                                                            {
                                                                changes: [
                                                                    {
                                                                        action: "review-refresh",
                                                                        kind: "reviews",
                                                                        id: row.id,
                                                                        version:
                                                                            row.version,
                                                                    },
                                                                ],
                                                            },
                                                        ),
                                                    },
                                                );
                                                await db.live!.refresh();
                                            }
                                        });
                                    return;
                                }
                                db.setReviews((rows) =>
                                    rows.map((row) =>
                                        row.id === review.id
                                            ? {
                                                  ...row,
                                                  snapshot: snapshot(
                                                      row.from,
                                                      row.to,
                                                  ),
                                              }
                                            : row,
                                    ),
                                );
                            }}
                        >
                            {text("Refresh facts", "Cập nhật dữ liệu")}
                        </button>
                        <button
                            className="button button-primary"
                            onClick={() => save(!review.finalized)}
                        >
                            {review.finalized
                                ? text("Reopen", "Mở lại")
                                : text("Finalize", "Hoàn tất")}
                        </button>
                        <button
                            className="button button-danger-quiet"
                            onClick={() => setRemove(true)}
                        >
                            {text("Delete", "Xóa")}
                        </button>
                    </PageActionBar>
                    <div className="review-period-navigation">
                        <button
                            className="icon-button"
                            aria-label={text(
                                "Previous review",
                                "Đánh giá trước",
                            )}
                            disabled={index <= 0}
                            onClick={() => setSelected(siblings[index - 1].id)}
                        >
                            <ChevronLeft size={17} />
                        </button>
                        <span>
                            {dateLabel(review.from, db.locale)} –{" "}
                            {dateLabel(review.to, db.locale)}
                        </span>
                        <button
                            className="icon-button"
                            aria-label={text("Next review", "Đánh giá tiếp")}
                            disabled={index < 0 || index >= siblings.length - 1}
                            onClick={() => setSelected(siblings[index + 1].id)}
                        >
                            <ChevronRight size={17} />
                        </button>
                    </div>
                    <div className="review-metrics">
                        <article className="insight-card">
                            <h2>{text("Actions", "Hoạt động")}</h2>
                            <strong>{review.snapshot.actions ?? "—"}</strong>
                            <p className="subtle-copy">
                                {text(
                                    "Recorded in this snapshot",
                                    "Ghi nhận trong kỳ này",
                                )}
                            </p>
                        </article>
                        <article className="insight-card">
                            <h2>{text("Completion", "Mức hoàn thành")}</h2>
                            <div
                                className="progress-ring review-completion-ring"
                                style={
                                    {
                                        "--progress": `${review.snapshot.total ? Math.round((review.snapshot.done / review.snapshot.total) * 100) : 0}%`,
                                    } as React.CSSProperties
                                }
                            >
                                <strong>
                                    {review.snapshot.total
                                        ? Math.round(
                                              (review.snapshot.done /
                                                  review.snapshot.total) *
                                                  100,
                                          )
                                        : 0}
                                    %
                                </strong>
                            </div>
                            <small className="subtle-copy">
                                {review.snapshot.done}/{review.snapshot.total}{" "}
                                {text("finite tasks", "công việc hữu hạn")}
                            </small>
                        </article>
                        <article className="insight-card review-wins-card">
                            <h2>{text("Wins", "Thành quả")}</h2>
                            <strong>{review.snapshot.wins ?? "—"}</strong>
                            <p className="subtle-copy">
                                {text(
                                    "Completed work",
                                    "Công việc đã hoàn thành",
                                )}
                            </p>
                            <ReferenceDecoration kind="trophy" />
                        </article>
                        <article className="insight-card">
                            <h2>
                                {text("Daily activity", "Hoạt động mỗi ngày")}
                            </h2>
                            <div className="review-snapshot-bars">
                                {review.snapshot.days?.map((row) => (
                                    <div
                                        key={row.date}
                                        title={`${dateLabel(row.date, db.locale)}: ${row.count}`}
                                    >
                                        <i
                                            style={{
                                                height: `${Math.max(3, (row.count / Math.max(1, ...review.snapshot.days!.map((value) => value.count))) * 64)}px`,
                                            }}
                                        />
                                        <small>
                                            {new Intl.DateTimeFormat(
                                                db.locale,
                                                {
                                                    weekday: "narrow",
                                                    timeZone: "UTC",
                                                },
                                            ).format(
                                                new Date(
                                                    row.date + "T00:00:00Z",
                                                ),
                                            )}
                                        </small>
                                    </div>
                                ))}
                            </div>
                        </article>
                    </div>
                    <details className="review-snapshot-facts">
                        <summary>
                            {review.snapshot.actions ?? "—"}{" "}
                            {text(
                                "recorded actions",
                                "hoạt động đã ghi nhận",
                            )}
                        </summary>
                        {review.snapshot.facts?.map((fact) => (
                            <p key={fact.id}>
                                <button
                                    className="text-button"
                                    onClick={() =>
                                        fact.kind === "habit"
                                            ? db.navigate("habits")
                                            : db.navigate("tasks", {
                                                  task: Number(fact.target),
                                              })
                                    }
                                >
                                    {text(...fact.title)}
                                </button>
                            </p>
                        ))}
                        <p className="subtle-copy">
                            {text(
                                "The snapshot stays unchanged until you explicitly refresh its facts.",
                                "Số liệu được giữ nguyên đến khi bạn chọn Cập nhật dữ liệu.",
                            )}
                        </p>
                    </details>
                    <div className="review-reflection-fields">
                        {fields.map(([key, title]) => (
                            <Field key={key} label={title}>
                                <textarea
                                    rows={5}
                                    readOnly={review.finalized}
                                    value={draft[key] ?? review[key] ?? ""}
                                    onChange={(event) =>
                                        setDrafts((values) => ({
                                            ...values,
                                            [review.id]: {
                                                ...values[review.id],
                                                [key]: event.target.value,
                                            },
                                        }))
                                    }
                                />
                            </Field>
                        ))}
                    </div>
                    {!review.finalized && (
                        <footer className="review-form-footer">
                            <span className="subtle-copy" role="status">
                                {dirty
                                    ? text("Unsaved draft", "Bản nháp chưa lưu")
                                    : text("Saved", "Đã lưu")}
                            </span>
                            <button
                                className="button button-quiet"
                                disabled={!dirty}
                                onClick={() =>
                                    setDrafts((values) => {
                                        const next = { ...values };
                                        delete next[review.id];
                                        return next;
                                    })
                                }
                            >
                                {text("Discard draft", "Bỏ bản nháp")}
                            </button>
                            <button
                                className="button button-primary"
                                disabled={!dirty}
                                onClick={() => save()}
                            >
                                {text("Save reflection", "Lưu suy ngẫm")}
                            </button>
                        </footer>
                    )}
                </article>
            ) : (
                <section className="planning-panel review-collection-panel">
                    <div className="section-heading">
                        <h2>{text("Your reviews", "Các đánh giá của bạn")}</h2>
                        <Field label={text("Period", "Kỳ")}>
                            <select
                                value={tab}
                                onChange={(event) => {
                                    setTab(event.target.value);
                                    setPage(0);
                                }}
                            >
                                <option value="all">
                                    {text("All periods", "Tất cả các kỳ")}
                                </option>
                                <option value="daily">
                                    {kindLabel("daily")}
                                </option>
                                <option value="weekly">
                                    {kindLabel("weekly")}
                                </option>
                                <option value="monthly">
                                    {kindLabel("monthly")}
                                </option>
                            </select>
                        </Field>
                    </div>
                    {filtered.slice(page * 12, page * 12 + 12).map((row) => (
                        <button
                            className="planning-list-item review-list-entry"
                            key={row.id}
                            onClick={() => setSelected(row.id)}
                        >
                            <span>
                                <strong>{row.title}</strong>
                                <small>
                                    {dateLabel(row.from, db.locale)} –{" "}
                                    {dateLabel(row.to, db.locale)}
                                </small>
                            </span>
                            <span className="context-chip">
                                {row.finalized
                                    ? text("Finalized", "Đã hoàn tất")
                                    : text("Draft", "Bản nháp")}
                            </span>
                            <ChevronRight size={18} />
                        </button>
                    ))}
                    {!filtered.length && (
                        <div className="review-state">
                            <h2>
                                {text(
                                    "Make space to reflect",
                                    "Dành một chút thời gian nhìn lại",
                                )}
                            </h2>
                            <button
                                className="button button-primary"
                                onClick={() => {
                                    if (tab !== "all")
                                        setKind(tab as Review["kind"]);
                                    setCreate(true);
                                }}
                            >
                                {text("Create review", "Tạo đánh giá")}
                            </button>
                        </div>
                    )}
                    {filtered.length > 12 && (
                        <nav
                            className="review-pagination"
                            aria-label={text("Review pages", "Trang đánh giá")}
                        >
                            <button
                                className="button button-quiet"
                                disabled={!page}
                                onClick={() => setPage(page - 1)}
                            >
                                {text("Previous", "Trước")}
                            </button>
                            <span>
                                {page + 1}/{Math.ceil(filtered.length / 12)}
                            </span>
                            <button
                                className="button button-quiet"
                                disabled={(page + 1) * 12 >= filtered.length}
                                onClick={() => setPage(page + 1)}
                            >
                                {text("Next", "Tiếp")}
                            </button>
                        </nav>
                    )}
                </section>
            )}
            {create && (
                <FormDialog
                    text={text}
                    title={text("Create review", "Tạo đánh giá")}
                    onClose={() => setCreate(false)}
                    submitLabel={text("Save snapshot", "Lưu ảnh chụp")}
                    onSubmit={async (form) => {
                        if (
                            db.reviews.some(
                                (r) => r.kind === kind && r.from === from,
                            )
                        ) {
                            db.setMessage(
                                text(
                                    "This period already has a review.",
                                    "Kỳ này đã có một lần nhìn lại.",
                                ),
                            );
                            return false;
                        }
                        const values = new FormData(form),
                            row: Review = {
                                id: `review-${Date.now()}`,
                                kind,
                                from,
                                to: end,
                                title: String(values.get("title")),
                                reflection: String(
                                    values.get("reflection") || "",
                                ),
                                snapshot: snapshot(from, end),
                                createdAt: new Date().toISOString(),
                            };
                        db.setReviews((rows) => [row, ...rows]);
                        if (db.live && !(await db.live.flush())) return false;
                        setSelected(row.id);
                        setCreate(false);
                    }}
                >
                    <Field label={text("Period", "Kỳ")}>
                        <select
                            value={kind}
                            onChange={(e) => {
                                const next = e.target.value as Review["kind"];
                                setKind(next);
                                setFrom(
                                    next === "weekly"
                                        ? monday(day)
                                        : next === "monthly"
                                          ? day.slice(0, 7) + "-01"
                                          : day,
                                );
                            }}
                        >
                            <option value="daily">
                                {text("Daily", "Ngày")}
                            </option>
                            <option value="weekly">
                                {text("Weekly", "Tuần")}
                            </option>
                            <option value="monthly">
                                {text("Monthly", "Tháng")}
                            </option>
                        </select>
                    </Field>
                    <Field
                        label={text("Start date", "Ngày bắt đầu")}
                        hint={text(
                            "Weekly reviews begin on Monday; monthly reviews on day 1.",
                            "Kỳ tuần bắt đầu thứ Hai; kỳ tháng bắt đầu ngày 1.",
                        )}
                    >
                        <input
                            type="date"
                            value={from}
                            required
                            max={day}
                            onChange={(e) => {
                                if (e.target.value)
                                    setFrom(
                                        kind === "weekly"
                                            ? monday(e.target.value)
                                            : kind === "monthly"
                                              ? e.target.value.slice(0, 7) +
                                                "-01"
                                              : e.target.value,
                                    );
                            }}
                        />
                    </Field>
                    <p>
                        {dateLabel(from, db.locale)} –{" "}
                        {dateLabel(end, db.locale)}
                    </p>
                    <Field label={text("Title", "Tiêu đề")}>
                        <input
                            name="title"
                            required
                            maxLength={160}
                            defaultValue={text(
                                "A moment to look back",
                                "Một khoảng dừng nhìn lại",
                            )}
                        />
                    </Field>
                    <Field label={text("Reflection", "Suy ngẫm")}>
                        <textarea name="reflection" rows={4} />
                    </Field>
                </FormDialog>
            )}
            {remove && review && (
                <Confirm
                    text={text}
                    title={text("Delete this review?", "Xóa lần nhìn lại này?")}
                    danger
                    onClose={() => setRemove(false)}
                    onConfirm={async () => {
                        db.setReviews((rows) =>
                            rows.filter((r) => r.id !== review.id),
                        );
                        if (db.live && !(await db.live.flush()))
                            throw new Error(
                                text(
                                    "The deletion could not be saved.",
                                    "Chưa lưu được thao tác xóa.",
                                ),
                            );
                        setSelected("");
                        setRemove(false);
                    }}
                >
                    <p>{review.title}</p>
                    <p>
                        {text(
                            "The saved reflection and snapshot will be permanently deleted.",
                            "Suy ngẫm và ảnh chụp đã lưu sẽ bị xóa vĩnh viễn.",
                        )}
                    </p>
                </Confirm>
            )}
        </div>
    );
}
