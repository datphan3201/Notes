"use client";
import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, Plus, X } from "lucide-react";
import Dialog from "../dialog";
import LoadingSpinner from "../loading-spinner";
import { Button, IconButton } from "./button";
import type { LocalizedText as Text, ContentState as ViewState } from "./types";

export function State({
    state,
    text,
    onRetry,
    emptyTitle,
    children,
}: {
    state: ViewState;
    text: Text;
    onRetry: () => void;
    emptyTitle?: string;
    children: React.ReactNode;
}) {
    if (state === "ready") return children;
    if (state === "loading")
        return <LoadingSpinner label={text("Loading…", "Đang tải…")} />;
    return (
        <section
            className="planning-panel review-state"
            role={state === "error" ? "alert" : "status"}
        >
            {state === "error" ? (
                <>
                    <CircleHelp />
                    <h2>
                        {text(
                            "This content could not be loaded",
                            "Chưa tải được nội dung",
                        )}
                    </h2>
                    <p>
                        {text(
                            "Try again to continue.",
                            "Thử tải lại để tiếp tục.",
                        )}
                    </p>
                    <Button variant="primary" onClick={onRetry}>
                        {text("Try again", "Thử lại")}
                    </Button>
                </>
            ) : (
                <>
                    <Plus />
                    <h2>
                        {emptyTitle ||
                            text(
                                "Room for your next step",
                                "Sẵn sàng cho bước tiếp theo",
                            )}
                    </h2>
                    <p>
                        {text(
                            "Choose Populated in the preview controls to restore the sample content.",
                            "Chọn Có dữ liệu trong thanh xem thử để khôi phục nội dung mẫu.",
                        )}
                    </p>
                    <Button variant="secondary" onClick={onRetry}>
                        {text("Show samples", "Hiện nội dung mẫu")}
                    </Button>
                </>
            )}
        </section>
    );
}
export function Tabs({
    items,
    value,
    onChange,
    label,
    id,
}: {
    items: [string, string][];
    value: string;
    onChange: (value: string) => void;
    label: string;
    id: string;
}) {
    return (
        <nav
            className="workspace-section-menu"
            role="tablist"
            aria-label={label}
            onKeyDown={(event) => {
                const index = items.findIndex(([key]) => key === value),
                    next =
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
            {items.map(([key, label]) => (
                <button
                    key={key}
                    role="tab"
                    id={`${id}-tab-${key}`}
                    aria-controls={`${id}-panel-${key}`}
                    aria-selected={value === key}
                    tabIndex={value === key ? 0 : -1}
                    onClick={() => onChange(key)}
                >
                    {label}
                </button>
            ))}
        </nav>
    );
}
export function Panel({
    id,
    tab,
    value,
    children,
}: {
    id: string;
    tab: string;
    value: string;
    children: React.ReactNode;
}) {
    return (
        <section
            id={`${id}-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`${id}-tab-${tab}`}
            hidden={value !== tab}
        >
            {children}
        </section>
    );
}
export function FormDialog({
    title,
    text,
    onClose,
    onSubmit,
    children,
    dirty = false,
    submitLabel,
    wide = false,
}: {
    title: string;
    text: Text;
    onClose: () => void;
    onSubmit: (
        form: HTMLFormElement,
    ) => void | boolean | Promise<void | boolean>;
    children: React.ReactNode;
    dirty?: boolean;
    submitLabel?: string;
    wide?: boolean;
}) {
    const [discard, setDiscard] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const root = useRef<HTMLDivElement>(null);
    const keep = useRef<HTMLButtonElement>(null);
    const [touched, setTouched] = useState(false);
    useEffect(() => {
        if (discard) keep.current?.focus();
        else
            root.current
                ?.querySelector<HTMLInputElement>(
                    "input:not([disabled]),textarea",
                )
                ?.focus();
    }, [discard]);
    const close = () => (dirty || touched ? setDiscard(true) : onClose());
    return (
        <Dialog
            title={
                discard
                    ? text("Discard unsaved changes?", "Bỏ thay đổi chưa lưu?")
                    : title
            }
            closeLabel={text("Close", "Đóng")}
            onClose={discard ? () => setDiscard(false) : close}
            className={`preview-dialog review-dialog ${discard ? "preview-confirm" : wide ? "preview-sheet" : "review-compact"}`}
        >
            {discard && (
                <>
                    <div className="preview-dialog-body">
                        <p>
                            {text(
                                "Keep editing to preserve your draft, or discard it.",
                                "Tiếp tục sửa để giữ bản nháp, hoặc bỏ những thay đổi này.",
                            )}
                        </p>
                    </div>
                    <footer className="preview-dialog-footer">
                        <Button
                            ref={keep}
                            variant="secondary"
                            onClick={() => setDiscard(false)}
                        >
                            {text("Keep editing", "Tiếp tục sửa")}
                        </Button>
                        <Button
                            variant="danger"
                            onClick={onClose}
                        >
                            {text("Discard changes", "Bỏ thay đổi")}
                        </Button>
                    </footer>
                </>
            )}
                <form
                    hidden={discard}
                    inert={discard}
                    className="preview-dialog-form"
                    onChange={() => setTouched(true)}
                    onSubmit={async (event) => {
                        event.preventDefault();
                        const form = event.currentTarget;
                        setSubmitting(true);
                        setSubmitError("");
                        try {
                            if ((await onSubmit(form)) !== false)
                                setTouched(false);
                        } catch (err) {
                            setSubmitError((err as Error).message);
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                >
                    <div ref={root} className="preview-dialog-body stack-form">
                        {children}
                        {submitError && (
                            <p role="alert" className="field-error">
                                {submitError}
                            </p>
                        )}
                    </div>
                    <footer className="preview-dialog-footer">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={close}
                        >
                            {text("Cancel", "Hủy")}
                        </Button>
                        <Button type="submit"
                            busy={submitting}
                            variant="primary"
                        >
                            <Check size={16} />
                            {submitLabel ||
                                text("Save changes", "Lưu thay đổi")}
                        </Button>
                    </footer>
                </form>
        </Dialog>
    );
}
export function Confirm({
    title,
    text,
    onClose,
    onConfirm,
    children,
    danger = false,
    label,
    cancelLabel,
    disabled = false,
}: {
    title: string;
    text: Text;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    children: React.ReactNode;
    danger?: boolean;
    label?: string;
    cancelLabel?: string;
    disabled?: boolean;
}) {
    const [running, setRunning] = useState(false),
        [error, setError] = useState("");
    return (
        <Dialog
            title={title}
            closeLabel={text("Close", "Đóng")}
            className="preview-dialog review-dialog preview-confirm"
            onClose={() => {
                if (!running) onClose();
            }}
        >
            <div className="preview-dialog-body stack-form">
                {children}
                {error && (
                    <p className="field-error" role="alert">
                        {error}
                    </p>
                )}
            </div>
            <footer className="preview-dialog-footer">
                <Button
                    autoFocus
                    variant="secondary"
                    disabled={running}
                    onClick={onClose}
                >
                    {cancelLabel || text("Cancel", "Hủy")}
                </Button>
                <Button
                    disabled={disabled}
                    busy={running}
                    variant={danger ? "danger" : "primary"}
                    onClick={async () => {
                        if (running) return;
                        setRunning(true);
                        setError("");
                        try {
                            await onConfirm();
                        } catch (err) {
                            setError((err as Error).message);
                        } finally {
                            setRunning(false);
                        }
                    }}
                >
                    {label || text("Confirm", "Xác nhận")}
                </Button>
            </footer>
        </Dialog>
    );
}
export function Toast({
    message,
    onClose,
    closeLabel,
}: {
    message: string;
    onClose: () => void;
    closeLabel: string;
}) {
    return message ? (
        <div className="review-toast notice" role="status">
            <Check size={17} />
            <span>{message}</span>
            <IconButton
                label={closeLabel}
                onClick={onClose}
            >
                <X size={16} />
            </IconButton>
        </div>
    ) : null;
}
