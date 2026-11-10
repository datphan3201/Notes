"use client";
import { useEffect, useRef, useState } from "react";
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
import { usePreviewData } from "./workspace-data";
import { blankDraft, recordFromDraft } from "./task-data";
import { BaselineIcon, Confirm } from "./ui";
import type { Text } from "./shared";
import { AssistantCompiledMessage } from "../assistant-compiled-message";
type Proposal = {
    id: string;
    kind: "plan" | "create";
    target: number;
    before: string;
    after: string;
    snapshot: string;
    state: "pending" | "applied" | "rejected" | "stale";
};
type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    note?: string;
    proposal?: Proposal;
};
export default function AssistantPreview({ text }: { text: Text }) {
    const db = usePreviewData();
    const [messages, setMessages] = useState<Message[]>([]),
        [input, setInput] = useState(""),
        [pending, setPending] = useState(false),
        [collapsed, setCollapsed] = useState(false),
        [mode, setMode] = useState("normal"),
        [clear, setClear] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
        bottom = useRef<HTMLDivElement>(null),
        field = useRef<HTMLTextAreaElement>(null);
    useEffect(
        () => () => {
            if (timer.current) clearTimeout(timer.current);
        },
        [],
    );
    useEffect(() => {
        if (db.assistantOpen && !collapsed) field.current?.focus();
    }, [db.assistantOpen, collapsed]);
    useEffect(() => {
        bottom.current?.scrollIntoView({ block: "nearest" });
    }, [messages, pending]);
    useEffect(() => {
        if (db.assistantContext) {
            setInput(
                text("Help me with this Note: ", "Giúp tôi với ghi chú này: ") +
                    db.assistantContext,
            );
            db.setAssistantContext("");
        }
    }, [db.assistantContext]);
    const push = (row: Message) =>
        setMessages((previous) => [...previous, row]);
    function send(value = input) {
        if (!value.trim() || pending) return;
        push({ id: crypto.randomUUID(), role: "user", content: value.trim() });
        setInput("");
        setPending(true);
        timer.current = setTimeout(
            () => {
                setPending(false);
                if (mode === "error") {
                    push({
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: text(
                            "The sample reply could not be loaded. Your message is kept; choose Normal and try again.",
                            "Chưa tải được câu trả lời mẫu. Tin nhắn vẫn được giữ; chọn Bình thường và thử lại.",
                        ),
                    });
                    return;
                }
                if (mode === "interrupted") {
                    push({
                        id: crypto.randomUUID(),
                        role: "assistant",
                        content: text(
                            "Response interrupted. You can send the request again.",
                            "Câu trả lời bị ngắt. Bạn có thể gửi lại yêu cầu.",
                        ),
                    });
                    return;
                }
                const source = db.notes.find(
                        (n) => !n.locked && n.permission === "owner",
                    ),
                    task = db.tasks.find(
                        (t) => !t.archived && t.status !== "Done" && !t.daily,
                    ),
                    create = /new|create|tạo|thêm/i.test(value);
                let proposal: Proposal | undefined;
                if (task || create) {
                    proposal = {
                        id: crypto.randomUUID(),
                        kind: create ? "create" : "plan",
                        target: task?.id || 0,
                        before: create
                            ? text("No new task", "Chưa có công việc mới")
                            : text(...task!.title) +
                              ". " +
                              text(
                                  "Not selected today",
                                  "Chưa chọn cho hôm nay",
                              ),
                        after: create
                            ? text(
                                  "New task: Review my next step",
                                  "Công việc mới: Xem lại bước tiếp theo",
                              )
                            : text(...task!.title) +
                              ". " +
                              text(
                                  "Selected for today and this week; dates unchanged",
                                  "Chọn hôm nay và tuần này; giữ nguyên ngày",
                              ),
                        snapshot: create
                            ? JSON.stringify(db.tasks.map((t) => t.id))
                            : JSON.stringify(task),
                        state: "pending",
                    };
                }
                push({
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: text(
                        "Here is an illustrative suggestion. Review the proposed change below. Nothing is changed until you confirm. This is a local example, not a response from an AI provider.",
                        "Đây là gợi ý minh họa. Hãy xem thay đổi bên dưới. Chỉ khi bạn xác nhận, dữ liệu mẫu mới thay đổi. Câu trả lời này được tạo sẵn trong giao diện.",
                    ),
                    note: source?.id,
                    proposal,
                });
            },
            mode === "pending" ? 8000 : 650,
        );
    }
    function stop() {
        if (timer.current) clearTimeout(timer.current);
        setPending(false);
        push({
            id: crypto.randomUUID(),
            role: "assistant",
            content: text(
                "Stopped. No changes were applied.",
                "Đã dừng. Chưa áp dụng thay đổi nào.",
            ),
        });
    }
    function update(id: string, state: Proposal["state"]) {
        setMessages((rows) =>
            rows.map((row) =>
                row.proposal?.id === id
                    ? { ...row, proposal: { ...row.proposal, state } }
                    : row,
            ),
        );
    }
    function apply(proposal: Proposal) {
        const task = db.tasks.find((t) => t.id === proposal.target),
            snapshot =
                proposal.kind === "create"
                    ? JSON.stringify(db.tasks.map((t) => t.id))
                    : JSON.stringify(task);
        if (
            mode === "stale" ||
            snapshot !== proposal.snapshot ||
            task?.archived
        ) {
            update(proposal.id, "stale");
            return;
        }
        if (proposal.kind === "create") {
            const draft = {
                ...blankDraft(),
                title: text("Review my next step", "Xem lại bước tiếp theo"),
            };
            db.setTasks((rows) => [
                ...rows,
                recordFromDraft(
                    draft,
                    Math.max(0, ...rows.map((t) => t.id)) + 1,
                ),
            ]);
        } else
            db.setTasks((rows) =>
                rows.map((t) =>
                    t.id === proposal.target
                        ? { ...t, daily: true, weekly: true }
                        : t,
                ),
            );
        update(proposal.id, "applied");
        db.setMessage(
            text(
                "Confirmed change applied to sample work.",
                "Đã áp dụng thay đổi được xác nhận vào dữ liệu mẫu.",
            ),
        );
    }
    return (
        <>
            <button
                className="assistant-launcher"
                aria-label={text("Open assistant", "Mở trợ lý")}
                aria-expanded={db.assistantOpen}
                onClick={() => {
                    db.setAssistantOpen(!db.assistantOpen);
                    setCollapsed(false);
                }}
            >
                <BaselineIcon name="ai" />
            </button>
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
                                    "Sample conversation",
                                    "Hội thoại minh họa",
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
                                collapsed ? "Expand" : "Collapse",
                                collapsed ? "Mở rộng" : "Thu gọn",
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
                            {!messages.length && (
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
                                            "Talk through your plans, find a Note, or review a proposed next step.",
                                            "Cùng xem kế hoạch, tìm ghi chú hoặc duyệt một bước tiếp theo.",
                                        )}
                                    </p>
                                    {[
                                        [
                                            "Help me plan today",
                                            "Giúp tôi lên kế hoạch hôm nay",
                                        ],
                                        [
                                            "Create a task for my next step",
                                            "Tạo công việc cho bước tiếp theo",
                                        ],
                                    ].map(([en, vi]) => (
                                        <button
                                            className="button button-quiet"
                                            key={en}
                                            onClick={() => send(text(en, vi))}
                                        >
                                            {text(en, vi)}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {messages.map((row) => (
                                <article
                                    className={`review-chat-message is-${row.role}`}
                                    key={row.id}
                                >
                                    <small>
                                        {row.role === "user"
                                            ? db.profile.name
                                            : text("Planner", "Planner")}
                                    </small>
                                    {row.role === "assistant" ? (
                                        <AssistantCompiledMessage
                                            content={row.content}
                                            db={db}
                                            text={text}
                                        />
                                    ) : (
                                        <p>{row.content}</p>
                                    )}
                                    {row.note &&
                                        (() => {
                                            const note = db.notes.find(
                                                (n) =>
                                                    n.id === row.note &&
                                                    !n.locked,
                                            );
                                            return note ? (
                                                <button
                                                    className="review-citation"
                                                    onClick={() =>
                                                        db.navigate("notes", {
                                                            note: note.id,
                                                        })
                                                    }
                                                >
                                                    [1] {note.title}
                                                </button>
                                            ) : null;
                                        })()}
                                    {row.proposal && (
                                        <section className="review-proposal">
                                            <strong>
                                                {text(
                                                    "Proposed change",
                                                    "Thay đổi đề xuất",
                                                )}
                                            </strong>
                                            <dl>
                                                <dt>
                                                    {text("Before", "Trước")}
                                                </dt>
                                                <dd>{row.proposal.before}</dd>
                                                <dt>{text("After", "Sau")}</dt>
                                                <dd>{row.proposal.after}</dd>
                                            </dl>
                                            {row.proposal.state ===
                                            "pending" ? (
                                                <div className="action-row">
                                                    <button
                                                        className="button button-quiet"
                                                        onClick={() =>
                                                            update(
                                                                row.proposal!
                                                                    .id,
                                                                "rejected",
                                                            )
                                                        }
                                                    >
                                                        {text(
                                                            "Reject",
                                                            "Từ chối",
                                                        )}
                                                    </button>
                                                    <button
                                                        className="button button-primary"
                                                        onClick={() =>
                                                            apply(row.proposal!)
                                                        }
                                                    >
                                                        <Check size={15} />
                                                        {text(
                                                            "Confirm change",
                                                            "Xác nhận thay đổi",
                                                        )}
                                                    </button>
                                                </div>
                                            ) : (
                                                <p role="status">
                                                    {row.proposal.state ===
                                                    "stale"
                                                        ? text(
                                                              "The work changed after this proposal. Nothing applied; ask for a fresh proposal.",
                                                              "Dữ liệu đã thay đổi sau đề xuất. Chưa áp dụng gì; hãy yêu cầu đề xuất mới.",
                                                          )
                                                        : row.proposal.state ===
                                                            "applied"
                                                          ? text(
                                                                "Applied",
                                                                "Đã áp dụng",
                                                            )
                                                          : text(
                                                                "Rejected; no change",
                                                                "Đã từ chối; không thay đổi",
                                                            )}
                                                </p>
                                            )}
                                        </section>
                                    )}
                                </article>
                            ))}
                            {pending && (
                                <div
                                    className="review-chat-thinking"
                                    role="status"
                                >
                                    {text(
                                        "Preparing sample reply…",
                                        "Đang chuẩn bị câu trả lời mẫu…",
                                    )}
                                    <button
                                        className="text-button"
                                        onClick={stop}
                                    >
                                        <Square size={13} />
                                        {text("Stop", "Dừng")}
                                    </button>
                                </div>
                            )}
                            <div ref={bottom} />
                        </div>
                        <form
                            className="review-chat-input"
                            onSubmit={(e) => {
                                e.preventDefault();
                                send();
                            }}
                        >
                            <textarea
                                ref={field}
                                aria-label={text(
                                    "Message to assistant",
                                    "Tin nhắn cho trợ lý",
                                )}
                                rows={2}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (
                                        e.key === "Enter" &&
                                        !e.shiftKey &&
                                        !e.nativeEvent.isComposing
                                    ) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                placeholder={text(
                                    "Ask about your next step…",
                                    "Hỏi về bước tiếp theo…",
                                )}
                            />
                            <button
                                className="icon-button"
                                disabled={pending || !input.trim()}
                                aria-label={text(
                                    "Send message",
                                    "Gửi tin nhắn",
                                )}
                            >
                                <Send size={19} />
                            </button>
                        </form>
                        <details className="review-chat-examples">
                            <summary>
                                {text(
                                    "Preview response states",
                                    "Xem trạng thái phản hồi",
                                )}
                            </summary>
                            <select
                                aria-label={text(
                                    "Assistant example",
                                    "Ví dụ trợ lý",
                                )}
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                            >
                                {[
                                    ["normal", "Normal", "Bình thường"],
                                    ["pending", "Pending", "Đang chờ"],
                                    ["error", "Error", "Lỗi"],
                                    ["interrupted", "Interrupted", "Bị ngắt"],
                                    ["stale", "Stale proposal", "Đề xuất cũ"],
                                ].map(([value, en, vi]) => (
                                    <option key={value} value={value}>
                                        {text(en, vi)}
                                    </option>
                                ))}
                            </select>
                        </details>
                    </div>
                </aside>
            )}
            {clear && (
                <Confirm
                    text={text}
                    title={text(
                        "Clear this conversation?",
                        "Xóa hội thoại này?",
                    )}
                    onClose={() => setClear(false)}
                    onConfirm={() => {
                        if (timer.current) clearTimeout(timer.current);
                        setPending(false);
                        setMessages([]);
                        setClear(false);
                    }}
                >
                    <p>
                        {text(
                            "Confirmed changes to sample work stay in place.",
                            "Các thay đổi đã xác nhận vào dữ liệu mẫu vẫn được giữ.",
                        )}
                    </p>
                </Confirm>
            )}
        </>
    );
}
