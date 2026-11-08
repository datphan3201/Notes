"use client";
import { useState } from "react";
import { ArrowUpRight, Bell, Check, RefreshCw, X } from "lucide-react";
import type { Text, ViewState } from "./shared";

export type PreviewNotice = {
    id: number | string;
    read: boolean;
    title: [string, string];
    description: [string, string];
    time: [string, string];
    destination: string;
    task?: number;
};
export default function PreviewNotifications({
    items,
    state,
    text,
    onRead,
    onReadAll,
    onOpen,
    onClose,
    onRetry,
}: {
    items: PreviewNotice[];
    state: ViewState;
    text: Text;
    onRead: (id: number | string) => void;
    onReadAll: () => void;
    onOpen: (section: string, task?: number) => void;
    onClose: () => void;
    onRetry: () => void;
}) {
    const [unreadOnly, setUnreadOnly] = useState(false);
    const rows = items.filter((item) => !unreadOnly || !item.read);
    return (
        <section
            id="preview-notices"
            className="notification-panel planning-panel preview-notifications"
            aria-labelledby="preview-notices-title"
        >
            <header className="section-heading">
                <h2 id="preview-notices-title">
                    {text("Notifications", "Thông báo")}
                </h2>
                <button
                    className="icon-button"
                    aria-label={text("Close notifications", "Đóng thông báo")}
                    onClick={onClose}
                >
                    <X className="ui-icon" />
                </button>
            </header>
            <div className="preview-notice-controls">
                <div
                    className="segmented-control"
                    role="group"
                    aria-label={text("Filter notifications", "Lọc thông báo")}
                >
                    <button
                        className="segment-button"
                        aria-pressed={!unreadOnly}
                        onClick={() => setUnreadOnly(false)}
                    >
                        {text("All", "Tất cả")}
                    </button>
                    <button
                        className="segment-button"
                        aria-pressed={unreadOnly}
                        onClick={() => setUnreadOnly(true)}
                    >
                        {text("Unread", "Chưa đọc")}
                    </button>
                </div>
                <button
                    className="text-button"
                    disabled={
                        state !== "ready" || !items.some((item) => !item.read)
                    }
                    onClick={onReadAll}
                >
                    {text("Mark all read", "Đọc tất cả")}
                </button>
            </div>
            <div className="preview-notice-list">
                {state === "loading" ? (
                    <p className="preview-state" role="status">
                        <RefreshCw size={20} className="preview-spin" />
                        {text("Loading notifications…", "Đang tải thông báo…")}
                    </p>
                ) : state === "error" ? (
                    <div className="preview-state" role="alert">
                        <p>
                            {text(
                                "Notifications could not be loaded.",
                                "Chưa tải được thông báo.",
                            )}
                        </p>
                        <button
                            className="button button-quiet"
                            onClick={onRetry}
                        >
                            {text("Try again", "Thử lại")}
                        </button>
                    </div>
                ) : state === "empty" || !rows.length ? (
                    <div className="preview-state" role="status">
                        <Bell size={25} />
                        <strong>
                            {text(
                                unreadOnly
                                    ? "You're all caught up"
                                    : "No notifications yet",
                                unreadOnly
                                    ? "Bạn đã đọc hết thông báo"
                                    : "Chưa có thông báo",
                            )}
                        </strong>
                        <p>
                            {text(
                                "Updates about your plans will appear here.",
                                "Cập nhật về kế hoạch của bạn sẽ xuất hiện ở đây.",
                            )}
                        </p>
                    </div>
                ) : (
                    rows.map((item) => (
                        <article
                            className={`preview-notice ${item.read ? "" : "is-unread"}`}
                            key={item.id}
                        >
                            <button
                                className="preview-notice-main"
                                onClick={() => {
                                    onRead(item.id);
                                    onOpen(item.destination, item.task);
                                }}
                            >
                                <span
                                    className="preview-notice-dot"
                                    aria-label={
                                        item.read
                                            ? undefined
                                            : text("Unread", "Chưa đọc")
                                    }
                                />
                                <span>
                                    <strong>{text(...item.title)}</strong>
                                    <p>{text(...item.description)}</p>
                                    <small>{text(...item.time)}</small>
                                </span>
                                <ArrowUpRight size={16} />
                            </button>
                            {!item.read && (
                                <button
                                    className="icon-button"
                                    aria-label={
                                        text(
                                            "Mark read: ",
                                            "Đánh dấu đã đọc: ",
                                        ) + text(...item.title)
                                    }
                                    title={text("Mark read", "Đánh dấu đã đọc")}
                                    onClick={() => onRead(item.id)}
                                >
                                    <Check size={16} />
                                </button>
                            )}
                        </article>
                    ))
                )}
            </div>
        </section>
    );
}
