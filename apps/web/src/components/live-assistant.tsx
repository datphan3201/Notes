"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    Check,
    ChevronDown,
    ChevronUp,
    MessageCircle,
    Send,
    Square,
    Trash2,
    X,
} from "lucide-react";
import { api, ApiError, type Kind, type Run } from "@/lib/api";
import { usePreviewData } from "./preview/workspace-data";
import { Confirm } from "./preview/ui";
import type { Text } from "./preview/shared";

export class RunObservationPaused extends Error {
    constructor(public reason: "stopped" | "timeout") {
        super(
            reason === "stopped"
                ? "Stopped waiting. The request is kept on the server."
                : "This request is still processing. Reconnect to read its result.",
        );
        this.name = "RunObservationPaused";
    }
}

export function waitForRun(
    id: string,
    onProgress?: (run: Run) => void,
    signal?: AbortSignal,
): Promise<Run> {
    return new Promise((resolve, reject) => {
        const source = new EventSource(`/api/v1/assistant/runs/${id}/events`);
        let finished = false,
            polling = false;
        let pollTimer: ReturnType<typeof setTimeout>;
        const finish = (run?: Run, error?: Error) => {
            if (finished) return;
            finished = true;
            source.close();
            clearTimeout(timer);
            clearTimeout(pollTimer);
            signal?.removeEventListener("abort", abort);
            if (error) reject(error);
            else resolve(run!);
        };
        const abort = () =>
            finish(undefined, new RunObservationPaused("stopped"));
        const timer = setTimeout(
            () => finish(undefined, new RunObservationPaused("timeout")),
            125000,
        );
        const consume = (run: Run) => {
            if (finished) return;
            onProgress?.(run);
            if (["completed", "rejected"].includes(run.status)) finish(run);
            else if (run.status === "failed")
                finish(
                    undefined,
                    new Error(
                        "The assistant could not finish this request. Please try again.",
                    ),
                );
        };
        async function poll() {
            if (finished || polling) return;
            polling = true;
            clearTimeout(pollTimer);
            try {
                consume(await api<Run>(`/assistant/runs/${id}`));
            } catch (error) {
                if (
                    error instanceof ApiError &&
                    [401, 404, 423].includes(error.status)
                )
                    finish(undefined, error);
            } finally {
                polling = false;
                if (!finished) pollTimer = setTimeout(poll, 2000);
            }
        }
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) {
            abort();
            return;
        }
        source.onmessage = (event) => {
            try {
                consume(JSON.parse(event.data) as Run);
            } catch {
                void poll();
            }
        };
        // Proxies may buffer or interrupt SSE. A durable GET also recovers completed output.
        source.onerror = () => {
            void poll();
        };
        pollTimer = setTimeout(poll, 2000);
    });
}

type Message = {
    id: string;
    prompt: string;
    run?: Run;
    error?: string;
    rejected?: boolean;
    paused?: boolean;
};
type StoredRun = Run & { prompt: string | null };
type HistoryPage = { items: StoredRun[]; next_cursor: string | null };
export default function LiveAssistant({ text }: { text: Text }) {
    const db = usePreviewData(),
        live = db.live!;
    const [messages, setMessages] = useState<Message[]>([]),
        [input, setInput] = useState("");
    const [pending, setPending] = useState(false),
        [collapsed, setCollapsed] = useState(false),
        [clear, setClear] = useState(false),
        [confirm, setConfirm] = useState("");
    const [acknowledged, setAcknowledged] = useState<string[]>([]);
    const [historyError, setHistoryError] = useState("");
    const [historyCursor, setHistoryCursor] = useState<string | null>(null);
    const [historyBusy, setHistoryBusy] = useState(false);
    const controller = useRef<AbortController | null>(null),
        bottom = useRef<HTMLDivElement>(null),
        field = useRef<HTMLTextAreaElement>(null),
        lastVisible = useRef("");
    useEffect(() => {
        let alive = true;
        setHistoryBusy(true);
        api<HistoryPage>("/assistant/runs")
            .then((history) => {
                if (!alive) return;
                setMessages(history.items.map(storedMessage));
                setHistoryCursor(history.next_cursor);
                const active = history.items.findLast((run) =>
                    ["queued", "running"].includes(run.status),
                );
                if (active) void connect(active.id);
            })
            .catch((error) => {
                if (alive) setHistoryError(error.message);
            })
            .finally(() => {
                if (alive) setHistoryBusy(false);
            });
        return () => {
            alive = false;
            controller.current?.abort();
        };
    }, []);
    function storedMessage(run: StoredRun): Message {
        return {
            id: run.id,
            prompt: run.prompt || text("Previous request", "Yêu cầu trước"),
            run,
            rejected: run.status === "rejected",
            error:
                run.error_code === "SOURCE_UNAVAILABLE"
                    ? text(
                          "This answer's source is no longer available.",
                          "Nguồn của câu trả lời không còn khả dụng.",
                      )
                    : undefined,
        };
    }
    async function earlier() {
        if (!historyCursor || historyBusy) return;
        setHistoryBusy(true);
        try {
            const history = await api<HistoryPage>(
                `/assistant/runs?before=${encodeURIComponent(historyCursor)}`,
            );
            setMessages((current) => [
                ...history.items.map(storedMessage),
                ...current,
            ]);
            setHistoryCursor(history.next_cursor);
            setHistoryError("");
        } catch (error) {
            setHistoryError((error as Error).message);
        } finally {
            setHistoryBusy(false);
        }
    }
    useEffect(() => {
        if (db.assistantOpen && !collapsed) field.current?.focus();
    }, [db.assistantOpen, collapsed]);
    useLayoutEffect(() => {
        if (!db.assistantOpen || collapsed) return;
        const resize = () => {
            const target = field.current;
            if (!target) return;
            target.style.height = "auto";
            target.style.height = `${target.scrollHeight}px`;
        };
        resize();
        window.addEventListener("resize", resize);
        return () => window.removeEventListener("resize", resize);
    }, [input, db.assistantOpen, collapsed]);
    useEffect(() => {
        const tail = messages.at(-1),
            key = `${tail?.id}:${tail?.run?.answer}`;
        if (key !== lastVisible.current)
            bottom.current?.scrollIntoView({ block: "nearest" });
        lastVisible.current = key;
    }, [messages]);
    useEffect(() => {
        if (db.assistantContext) {
            setInput(db.assistantContext);
            db.setAssistantContext("");
        }
    }, [db.assistantContext]);
    const update = (id: string, values: Partial<Message>) =>
        setMessages((rows) =>
            rows.map((row) => (row.id === id ? { ...row, ...values } : row)),
        );
    async function connect(id: string) {
        setPending(true);
        controller.current = new AbortController();
        update(id, { error: "", paused: false });
        try {
            await waitForRun(
                id,
                (run) => update(id, { run }),
                controller.current.signal,
            );
        } catch (err) {
            if (err instanceof RunObservationPaused)
                update(id, { paused: true, error: "" });
            else update(id, { error: (err as Error).message });
        } finally {
            controller.current = null;
            setPending(false);
        }
    }
    async function send() {
        if (!input.trim() || pending || historyBusy || historyError) return;
        setPending(true);
        const prompt = input;
        try {
            const run = await live.request<{ id: string }>("/assistant/runs", {
                method: "POST",
                body: JSON.stringify({
                    prompt,
                    history: messages
                        .filter(
                            (message) =>
                                message.run &&
                                ["completed", "rejected"].includes(
                                    message.run.status,
                                ),
                        )
                        .slice(-6)
                        .flatMap((message) => [
                            { role: "user", content: message.prompt },
                            {
                                role: "assistant",
                                content: (
                                    message.run!.answer +
                                    (message.run!.applied_at
                                        ? "\n[Proposed changes: applied]"
                                        : message.rejected
                                          ? "\n[Proposed changes: rejected; do not apply]"
                                          : message.run!.proposal
                                            ? "\n[Proposed changes: awaiting user confirmation]"
                                            : "")
                                ).slice(-8000),
                            },
                        ])
                        .filter((turn) => turn.content),
                }),
            });
            setMessages((rows) => [...rows, { id: run.id, prompt }]);
            setInput("");
            await connect(run.id);
        } catch (err) {
            setMessages((rows) => [
                ...rows,
                {
                    id: crypto.randomUUID(),
                    prompt,
                    error: (err as Error).message,
                },
            ]);
            setPending(false);
        }
    }
    const rows = (kind: Kind) =>
        kind === "task-series" ? db.series : db[kind];
    const title = (kind: Kind, id?: string) => {
        const row = rows(kind).find((row) => live.serverId(row.id) === id);
        if (!row) return text("Unavailable item", "Mục không còn khả dụng");
        const value = "title" in row ? row.title : "";
        return Array.isArray(value) ? text(value[0], value[1]) : value;
    };
    const kindName: Record<Kind, string> = {
        areas: text("Area", "Lĩnh vực"),
        goals: text("Goal", "Mục tiêu"),
        milestones: text("Milestone", "Cột mốc"),
        tasks: text("Task", "Công việc"),
        notes: text("Note", "Ghi chú"),
        habits: text("Habit", "Thói quen"),
        reviews: text("Review", "Đánh giá"),
        "task-series": text("Repeating task", "Công việc lặp lại"),
    };
    const labels: Record<string, string> = {
        title: text("Name", "Tên"),
        content: text("Description", "Mô tả"),
        status: text("Status", "Trạng thái"),
        due_date: text("Due date", "Hạn chót"),
        start_date: text("Start date", "Ngày bắt đầu"),
        importance: text("Importance", "Mức quan trọng"),
        goal_id: kindName.goals,
        milestone_id: kindName.milestones,
        area_id: kindName.areas,
        estimated_minutes: text("Minutes", "Số phút"),
        ids: text("Prerequisites", "Điều kiện tiên quyết"),
        day: text("Date", "Ngày"),
        state: text("State", "Trạng thái"),
        include_contents: text(
            "Include child work",
            "Bao gồm nội dung bên trong",
        ),
        parent_goal_id: text("Parent Goal", "Mục tiêu cha"),
        primary_goal_id: kindName.goals,
        timezone: text("Timezone", "Múi giờ"),
        frequency: text("Period", "Chu kỳ"),
        target: text("Target", "Chỉ tiêu"),
        scheduled_at: text("Scheduled start", "Bắt đầu lịch"),
        scheduled_end: text("Scheduled end", "Kết thúc lịch"),
    };
    const referenceTitle = (
        kind: Kind,
        id: string,
        proposal?: Run["proposal"],
    ) => {
        const created = proposal?.operations.find(
            (op) => op.ref === id && op.kind === kind,
        );
        return created
            ? String(created.fields.title || kindName[kind])
            : title(kind, id);
    };
    const value = (
        key: string,
        value: unknown,
        proposal?: Run["proposal"],
    ): string => {
        const refs: Record<string, Kind> = {
            goal_id: "goals",
            parent_goal_id: "goals",
            milestone_id: "milestones",
            area_id: "areas",
            task_id: "tasks",
            primary_goal_id: "goals",
        };
        if (refs[key] && typeof value === "string")
            return referenceTitle(refs[key], value, proposal);
        if (value === null || value === "") return "—";
        if (["ids", "related"].includes(key) && Array.isArray(value))
            return value
                .map((id) =>
                    referenceTitle(
                        key === "ids" ? "milestones" : "goals",
                        String(id),
                        proposal,
                    ),
                )
                .join(", ");
        if (Array.isArray(value))
            return value
                .map((v) =>
                    typeof v === "object" && v
                        ? String(v.text || "")
                        : String(v),
                )
                .join(", ");
        if (typeof value === "object")
            return text("Updated details", "Nội dung được cập nhật");
        return String(value);
    };
    async function apply() {
        const message = messages.find((m) => m.id === confirm);
        if (!message?.run) return;
        setPending(true);
        setConfirm("");
        try {
            const run = await live.request<Run>(
                `/assistant/runs/${message.id}/apply`,
                {
                    method: "POST",
                    body: JSON.stringify({
                        proposal_hash: message.run.proposal_hash,
                        acknowledgements: acknowledged,
                    }),
                },
            );
            update(message.id, { run, error: "" });
            await live.refresh();
        } catch (err) {
            update(message.id, { error: (err as Error).message });
        } finally {
            setPending(false);
        }
    }
    const requiredAcks = [
        ...new Set(
            messages
                .find((message) => message.id === confirm)
                ?.run?.proposal?.operations.flatMap(
                    (op) => op.acknowledgements || [],
                ) || [],
        ),
    ];
    const ackLabels: Record<string, string> = {
        unchecked: text(
            "Complete this Task while keeping unchecked checklist items.",
            "Hoàn tất công việc và giữ nguyên các mục checklist chưa đánh dấu.",
        ),
        unfinished: text(
            "Complete the parent while keeping unfinished child work.",
            "Hoàn tất mục cha và giữ nguyên nội dung con chưa hoàn tất.",
        ),
        reopen_parents: text(
            "Reopen completed parents when reopening this work.",
            "Mở lại các mục cha đã hoàn tất khi mở lại nội dung này.",
        ),
    };
    return (
        <>
            {!db.assistantOpen && (
                <button
                    className="review-assistant-launcher"
                    aria-label={text("Ask AI", "Hỏi AI")}
                    onClick={() => db.setAssistantOpen(true)}
                >
                    <MessageCircle size={19} />
                    <span>{text("Ask AI", "Hỏi AI")}</span>
                </button>
            )}
            {db.assistantOpen && (
                <aside
                    className={`review-assistant ${collapsed ? "is-collapsed" : ""}`}
                    aria-label={text("Planner assistant", "Trợ lý Planner")}
                >
                    <header>
                        <MessageCircle size={21} />
                        <div>
                            <strong>
                                {text("Planner assistant", "Trợ lý Planner")}
                            </strong>
                            <small>
                                {text(
                                    "You confirm every change",
                                    "Bạn xác nhận mọi thay đổi",
                                )}
                            </small>
                        </div>
                        <button
                            className="icon-button"
                            aria-label={text(
                                "Clear conversation",
                                "Xóa hội thoại",
                            )}
                            onClick={() => setClear(true)}
                        >
                            <Trash2 size={16} />
                        </button>
                        <button
                            className="icon-button"
                            aria-label={text(
                                "Collapse or expand",
                                "Thu gọn hoặc mở rộng",
                            )}
                            onClick={() => setCollapsed(!collapsed)}
                        >
                            {collapsed ? (
                                <ChevronUp size={17} />
                            ) : (
                                <ChevronDown size={17} />
                            )}
                        </button>
                        <button
                            className="icon-button"
                            aria-label={text("Close assistant", "Đóng trợ lý")}
                            onClick={() => db.setAssistantOpen(false)}
                        >
                            <X size={18} />
                        </button>
                    </header>
                    <div hidden={collapsed} className="review-assistant-body">
                        <div
                            className="review-chat-log"
                            role="log"
                            aria-live="polite"
                        >
                            {historyBusy && (
                                <p role="status">
                                    {text(
                                        "Loading conversation…",
                                        "Đang tải hội thoại…",
                                    )}
                                </p>
                            )}
                            {historyError && (
                                <p role="alert">
                                    {text(
                                        "Could not load conversation: ",
                                        "Chưa tải được hội thoại: ",
                                    )}
                                    {historyError}
                                </p>
                            )}
                            {historyCursor && (
                                <button
                                    className="text-button"
                                    disabled={historyBusy}
                                    onClick={() => void earlier()}
                                >
                                    {text(
                                        "Load earlier messages",
                                        "Tải tin nhắn trước",
                                    )}
                                </button>
                            )}
                            {!messages.length && !historyBusy && (
                                <div className="review-chat-welcome">
                                    <MessageCircle size={32} />
                                    <h2>
                                        {text(
                                            "Where would you like to start?",
                                            "Bạn muốn bắt đầu từ đâu?",
                                        )}
                                    </h2>
                                    <p>
                                        {text(
                                            "Talk through your plans, find a Note, or review a next step.",
                                            "Cùng xem kế hoạch, tìm ghi chú hoặc duyệt bước tiếp theo.",
                                        )}
                                    </p>
                                </div>
                            )}
                            {messages.map((message) => (
                                <div key={message.id}>
                                    <article className="review-chat-message is-user">
                                        <p>{message.prompt}</p>
                                    </article>
                                    <article className="review-chat-message is-assistant">
                                        {message.run?.answer && (
                                            <p
                                                style={{
                                                    whiteSpace: "pre-wrap",
                                                }}
                                            >
                                                {message.run.answer}
                                            </p>
                                        )}
                                        {message.run?.sources?.map((source) => (
                                            <button
                                                className="review-citation text-button"
                                                key={source.kind + source.id}
                                                onClick={() =>
                                                    db.navigate(
                                                        source.kind === "areas"
                                                            ? "goals"
                                                            : source.kind ===
                                                                "notes"
                                                              ? "notes"
                                                              : source.kind ===
                                                                      "goals" ||
                                                                  source.kind ===
                                                                      "milestones"
                                                                ? "goals"
                                                                : source.kind,
                                                        source.kind === "notes"
                                                            ? {
                                                                  note: source.id,
                                                              }
                                                            : source.kind ===
                                                                "goals"
                                                              ? {
                                                                    goal: source.id,
                                                                }
                                                              : source.kind ===
                                                                  "tasks"
                                                                ? {
                                                                      task: db.tasks.find(
                                                                          (t) =>
                                                                              live.serverId(
                                                                                  t.id,
                                                                              ) ===
                                                                              source.id,
                                                                      )?.id,
                                                                  }
                                                                : source.kind ===
                                                                    "milestones"
                                                                  ? {
                                                                        goal: db.milestones.find(
                                                                            (
                                                                                m,
                                                                            ) =>
                                                                                live.serverId(
                                                                                    m.id,
                                                                                ) ===
                                                                                source.id,
                                                                        )?.goal,
                                                                        milestone:
                                                                            source.id,
                                                                    }
                                                                  : {},
                                                    )
                                                }
                                            >
                                                {title(source.kind, source.id)}
                                            </button>
                                        ))}
                                        {message.run?.proposal && (
                                            <section className="review-proposal">
                                                <h3>
                                                    {text(
                                                        "Proposed changes",
                                                        "Thay đổi đề xuất",
                                                    )}
                                                </h3>
                                                {message.run.proposal.operations.map(
                                                    (op, i) => (
                                                        <div key={i}>
                                                            <strong>
                                                                {op.action ===
                                                                "create"
                                                                    ? text(
                                                                          "Create",
                                                                          "Tạo",
                                                                      )
                                                                    : op.action ===
                                                                        "prerequisites"
                                                                      ? text(
                                                                            "Set prerequisites",
                                                                            "Đặt điều kiện",
                                                                        )
                                                                      : op.action ===
                                                                          "checkin"
                                                                        ? text(
                                                                              "Check in",
                                                                              "Điểm danh",
                                                                          )
                                                                        : op.action ===
                                                                            "delete"
                                                                          ? text(
                                                                                "Delete permanently",
                                                                                "Xóa vĩnh viễn",
                                                                            )
                                                                          : op.action ===
                                                                              "archive"
                                                                            ? text(
                                                                                  "Archive",
                                                                                  "Lưu trữ",
                                                                              )
                                                                            : text(
                                                                                  "Update",
                                                                                  "Cập nhật",
                                                                              )}{" "}
                                                                ·{" "}
                                                                {op.id
                                                                    ? referenceTitle(
                                                                          op.kind,
                                                                          op.id,
                                                                          message
                                                                              .run
                                                                              ?.proposal,
                                                                      )
                                                                    : String(
                                                                          op
                                                                              .fields
                                                                              .title ||
                                                                              kindName[
                                                                                  op
                                                                                      .kind
                                                                              ],
                                                                      )}
                                                            </strong>
                                                            {Object.entries(
                                                                op.fields,
                                                            ).map(
                                                                ([key, v]) => (
                                                                    <p
                                                                        key={
                                                                            key
                                                                        }
                                                                    >
                                                                        <span>
                                                                            {labels[
                                                                                key
                                                                            ] ||
                                                                                key.replaceAll(
                                                                                    "_",
                                                                                    " ",
                                                                                )}

                                                                            :{" "}
                                                                        </span>
                                                                        <strong>
                                                                            {op.action ===
                                                                                "update" &&
                                                                                message
                                                                                    .run
                                                                                    ?.preview?.[
                                                                                    i
                                                                                ] && (
                                                                                    <>
                                                                                        {value(
                                                                                            key,
                                                                                            message
                                                                                                .run
                                                                                                .preview[
                                                                                                i
                                                                                            ]![
                                                                                                key
                                                                                            ],
                                                                                        )}
                                                                                        {
                                                                                            " → "
                                                                                        }
                                                                                    </>
                                                                                )}
                                                                            {value(
                                                                                key,
                                                                                v,
                                                                                message
                                                                                    .run
                                                                                    ?.proposal,
                                                                            )}
                                                                        </strong>
                                                                    </p>
                                                                ),
                                                            )}
                                                        </div>
                                                    ),
                                                )}
                                                {message.run.applied_at ? (
                                                    <p>
                                                        {text(
                                                            "Applied",
                                                            "Đã áp dụng",
                                                        )}
                                                    </p>
                                                ) : message.rejected ? (
                                                    <p>
                                                        {text(
                                                            "Rejected; no changes applied",
                                                            "Đã từ chối; chưa áp dụng thay đổi",
                                                        )}
                                                    </p>
                                                ) : (
                                                    <div className="review-form-footer">
                                                        <button
                                                            className="button button-quiet"
                                                            disabled={pending}
                                                            onClick={async () => {
                                                                try {
                                                                    await live.request(
                                                                        `/assistant/runs/${message.id}/reject`,
                                                                        {
                                                                            method: "POST",
                                                                            body: JSON.stringify(
                                                                                {
                                                                                    proposal_hash:
                                                                                        message
                                                                                            .run!
                                                                                            .proposal_hash,
                                                                                },
                                                                            ),
                                                                        },
                                                                    );
                                                                    update(
                                                                        message.id,
                                                                        {
                                                                            rejected: true,
                                                                            run: {
                                                                                ...message.run!,
                                                                                status: "rejected",
                                                                            },
                                                                            error: "",
                                                                        },
                                                                    );
                                                                } catch (error) {
                                                                    update(
                                                                        message.id,
                                                                        {
                                                                            error: (
                                                                                error as Error
                                                                            )
                                                                                .message,
                                                                        },
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {text(
                                                                "Reject",
                                                                "Từ chối",
                                                            )}
                                                        </button>
                                                        <button
                                                            className="button button-primary"
                                                            disabled={pending}
                                                            onClick={() => {
                                                                setAcknowledged(
                                                                    [],
                                                                );
                                                                setConfirm(
                                                                    message.id,
                                                                );
                                                            }}
                                                        >
                                                            <Check size={16} />
                                                            {text(
                                                                "Review and confirm",
                                                                "Duyệt và xác nhận",
                                                            )}
                                                        </button>
                                                    </div>
                                                )}
                                            </section>
                                        )}
                                        {message.paused && (
                                            <div role="status">
                                                <p>
                                                    {text(
                                                        "Stopped waiting. Your request is saved; use Reconnect to read the result.",
                                                        "Đã dừng chờ. Yêu cầu đã được giữ lại; bấm Kết nối lại để xem kết quả.",
                                                    )}
                                                </p>
                                                <button
                                                    className="text-button"
                                                    disabled={pending}
                                                    onClick={() =>
                                                        void connect(message.id)
                                                    }
                                                >
                                                    {text(
                                                        "Reconnect",
                                                        "Kết nối lại",
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                        {message.error && (
                                            <div role="alert">
                                                <p className="field-error">
                                                    {message.error}
                                                </p>
                                                {message.run && (
                                                    <button
                                                        className="text-button"
                                                        disabled={pending}
                                                        onClick={() =>
                                                            void connect(
                                                                message.id,
                                                            )
                                                        }
                                                    >
                                                        {text(
                                                            "Reconnect",
                                                            "Kết nối lại",
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </article>
                                </div>
                            ))}
                            {pending && (
                                <p role="status">
                                    {text("Working…", "Đang xử lý…")}
                                </p>
                            )}
                            <div ref={bottom} />
                        </div>
                        <form
                            className="review-chat-input"
                            onSubmit={(e) => {
                                e.preventDefault();
                                void send();
                            }}
                        >
                            <textarea
                                ref={field}
                                aria-label={text("Message", "Tin nhắn")}
                                placeholder={text(
                                    "Message the assistant…",
                                    "Nhắn cho trợ lý…",
                                )}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
                                    e.preventDefault();
                                    if (e.ctrlKey) {
                                        const target = e.currentTarget;
                                        const length = target.value.length -
                                            (target.selectionEnd - target.selectionStart) + 1;
                                        if (length > target.maxLength) return;
                                        target.setRangeText(
                                            "\n",
                                            target.selectionStart,
                                            target.selectionEnd,
                                            "end",
                                        );
                                        setInput(target.value);
                                    } else if (!e.repeat) {
                                        e.currentTarget.form?.requestSubmit();
                                    }
                                }}
                                maxLength={4000}
                                required
                                rows={2}
                            />
                            {pending ? (
                                <button
                                    type="button"
                                    className="button button-quiet"
                                    disabled={!controller.current}
                                    aria-label={text(
                                        "Stop waiting",
                                        "Dừng chờ",
                                    )}
                                    onClick={() => controller.current?.abort()}
                                >
                                    <Square size={18} />
                                    {text("Stop", "Dừng")}
                                </button>
                            ) : (
                                <button
                                    className="button button-primary"
                                    disabled={
                                        !input.trim() ||
                                        historyBusy ||
                                        !!historyError
                                    }
                                    aria-label={text("Send", "Gửi")}
                                >
                                    <Send size={18} />
                                </button>
                            )}
                        </form>
                    </div>
                </aside>
            )}
            {confirm && (
                <Confirm
                    text={text}
                    title={text(
                        "Apply these changes?",
                        "Áp dụng các thay đổi này?",
                    )}
                    onClose={() => setConfirm("")}
                    onConfirm={() => void apply()}
                    disabled={requiredAcks.some(
                        (ack) => !acknowledged.includes(ack),
                    )}
                >
                    <p>
                        {text(
                            "The server will recheck the current data before applying the entire proposal.",
                            "Hệ thống sẽ kiểm tra dữ liệu hiện tại trước khi áp dụng toàn bộ đề xuất.",
                        )}
                    </p>
                    {requiredAcks.map((ack) => (
                        <label key={ack} className="review-checkbox">
                            <input
                                type="checkbox"
                                checked={acknowledged.includes(ack)}
                                onChange={(event) =>
                                    setAcknowledged((items) =>
                                        event.target.checked
                                            ? [...items, ack]
                                            : items.filter(
                                                  (item) => item !== ack,
                                              ),
                                    )
                                }
                            />
                            {ackLabels[ack]}
                        </label>
                    ))}
                </Confirm>
            )}
            {clear && (
                <Confirm
                    text={text}
                    title={text("Clear conversation?", "Xóa hội thoại?")}
                    onClose={() => setClear(false)}
                    onConfirm={async () => {
                        await live.request("/assistant/runs", {
                            method: "DELETE",
                        });
                        controller.current?.abort();
                        setMessages([]);
                        setHistoryCursor(null);
                        setHistoryError("");
                        setClear(false);
                    }}
                >
                    <p>
                        {text(
                            "This clears chat history for your account. Your planning data is kept.",
                            "Thao tác này xóa lịch sử chat của tài khoản. Dữ liệu kế hoạch vẫn được giữ.",
                        )}
                    </p>
                </Confirm>
            )}
        </>
    );
}
