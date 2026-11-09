"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, CircleHelp, Plus, X } from "lucide-react";
import Dialog from "../dialog";
import LoadingSpinner from "../loading-spinner";
import { createPortal } from "react-dom";
import type { Text, ViewState } from "./shared";
import { entityIcons } from "./entity-icons";
import { palette } from "./workspace-data";

// Symbols retained from frontend/src/views/layouts/icons.php.
export function BaselineIcon({
    name,
    className = "ui-icon",
}: {
    name: string;
    className?: string;
}) {
    return (
        <svg className={className} aria-hidden="true" viewBox="0 0 24 24">
            <use href={`/icons/workspace.svg#icon-${name}`} />
        </svg>
    );
}
export function ReferenceDecoration({ kind }: { kind: "plant" | "trophy" }) {
    const id = useId();
    const region = kind === "plant" ? "1005 574 48 66" : "1359 570 22 24";
    return (
        <svg
            className={`reference-decoration reference-${kind}`}
            viewBox={region}
            preserveAspectRatio={
                kind === "plant" ? "xMaxYMax meet" : "xMidYMid slice"
            }
            aria-hidden="true"
        >
            <defs>
                <clipPath id={id}>
                    <path
                        d={
                            kind === "plant"
                                ? "M1005 574h48v66h-48Z M1005 585h9v18h-9Z"
                                : "M1359 570h22v24h-22Z"
                        }
                        clipRule="evenodd"
                    />
                </clipPath>
            </defs>
            <image
                href="/themes/reference.png"
                width="1536"
                height="1024"
                clipPath={`url(#${id})`}
            />
        </svg>
    );
}
export function Header({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children?: React.ReactNode;
}) {
    return (
        <header className="workspace-header scene-header review-page-header">
            <div>
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {children && (
                <div className="workspace-header-actions action-row">
                    {children}
                </div>
            )}
        </header>
    );
}
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
                    <button className="button button-primary" onClick={onRetry}>
                        {text("Try again", "Thử lại")}
                    </button>
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
                    <button className="button button-quiet" onClick={onRetry}>
                        {text("Show samples", "Hiện nội dung mẫu")}
                    </button>
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
export function Field({
    label,
    children,
    hint,
}: {
    label: string;
    children: React.ReactNode;
    hint?: string;
}) {
    return (
        <label className="field review-field">
            <span>{label}</span>
            {children}
            {hint && <small>{hint}</small>}
        </label>
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
            {discard ? (
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
                        <button
                            ref={keep}
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
                        <button
                            type="button"
                            className="button button-quiet"
                            onClick={close}
                        >
                            {text("Cancel", "Hủy")}
                        </button>
                        <button
                            disabled={submitting}
                            className="button button-primary"
                        >
                            <Check size={16} />
                            {submitLabel ||
                                text("Save changes", "Lưu thay đổi")}
                        </button>
                    </footer>
                </form>
            )}
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
    disabled = false,
}: {
    title: string;
    text: Text;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    children: React.ReactNode;
    danger?: boolean;
    label?: string;
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
                <button
                    autoFocus
                    className="button button-quiet"
                    disabled={running}
                    onClick={onClose}
                >
                    {text("Cancel", "Hủy")}
                </button>
                <button
                    disabled={disabled || running}
                    className={`button ${danger ? "button-danger" : "button-primary"}`}
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
                </button>
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
            <button
                className="icon-button"
                aria-label={closeLabel}
                onClick={onClose}
            >
                <X size={16} />
            </button>
        </div>
    ) : null;
}
export const icons = entityIcons;
export function EntityIcon({
    name = "target",
    color,
    onClick,
    label,
    onChange,
    text,
    defaultIcon = "target",
    expanded,
}: {
    name?: string;
    color?: string;
    onClick?: () => void;
    label?: string;
    onChange?: (icon: string, color: string) => void;
    text?: Text;
    defaultIcon?: string;
    expanded?: boolean;
}) {
    if (onChange && text)
        return (
            <EntityIconControl
                name={name}
                color={color}
                label={label}
                onChange={onChange}
                text={text}
                defaultIcon={defaultIcon}
            />
        );
    const paths = icons[name] || icons.target;
    const artwork = (
        <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths.map((d, index) => (
                <path key={index} d={d} />
            ))}
        </svg>
    );
    return onClick ? (
        <button
            className="review-entity-icon"
            style={{ color }}
            aria-label={label}
            aria-haspopup={expanded !== undefined ? "dialog" : undefined}
            aria-expanded={expanded}
            onClick={onClick}
        >
            {artwork}
        </button>
    ) : (
        <span className="review-entity-icon" style={{ color }}>
            {artwork}
        </span>
    );
}
function EntityIconControl({
    name = "target",
    color,
    label,
    text,
    onChange,
    defaultIcon,
}: {
    name?: string;
    color?: string;
    label?: string;
    text: Text;
    onChange: (icon: string, color: string) => void;
    defaultIcon: string;
}) {
    const anchor = useRef<HTMLSpanElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{
        left: number;
        top: number;
    } | null>(null);
    const [chosenColor, setChosenColor] = useState(color || palette[0]);
    const close = () => {
        setPosition(null);
        anchor.current?.querySelector<HTMLButtonElement>("button")?.focus();
    };
    useEffect(() => {
        if (!position) return;
        panel.current
            ?.querySelector<HTMLButtonElement>(
                '.review-entity-options [aria-pressed="true"]',
            )
            ?.focus();
        const outside = (event: PointerEvent) => {
            if (
                !anchor.current?.contains(event.target as Node) &&
                !panel.current?.contains(event.target as Node)
            )
                setPosition(null);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopImmediatePropagation();
                close();
            }
        };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("keydown", escape, true);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("keydown", escape, true);
        };
    }, [position]);
    const choose = (icon: string) => {
        onChange(icon, chosenColor);
        close();
    };
    return (
        <span className="review-icon-anchor" ref={anchor}>
            <EntityIcon
                name={name}
                color={color}
                label={label}
                expanded={!!position}
                onClick={() => {
                    if (position) return close();
                    const rect = anchor.current!.getBoundingClientRect();
                    setChosenColor(color || palette[0]);
                    setPosition({
                        left: Math.max(
                            8,
                            Math.min(rect.left, window.innerWidth - 320),
                        ),
                        top: Math.max(
                            8,
                            Math.min(rect.bottom + 6, window.innerHeight - 350),
                        ),
                    });
                }}
            />
            {position &&
                createPortal(
                    <div
                        className="review-entity-popover"
                        ref={panel}
                        role="dialog"
                        aria-label={text("Choose an icon", "Chọn biểu tượng")}
                        style={position}
                    >
                        <div
                            className="review-color-options"
                            role="group"
                            aria-label={text("Color", "Màu sắc")}
                        >
                            {palette.map((value) => (
                                <button
                                    type="button"
                                    className="review-color-dot"
                                    key={value}
                                    style={{ background: value }}
                                    aria-label={value}
                                    aria-pressed={chosenColor === value}
                                    onClick={() => setChosenColor(value)}
                                />
                            ))}
                        </div>
                        <div className="review-entity-options">
                            {Object.keys(icons).map((icon) => (
                                <button
                                    type="button"
                                    className="icon-button"
                                    key={icon}
                                    aria-label={icon}
                                    aria-pressed={name === icon}
                                    onClick={() => choose(icon)}
                                >
                                    <EntityIcon
                                        name={icon}
                                        color={chosenColor}
                                    />
                                </button>
                            ))}
                        </div>
                        <button
                            className="text-button"
                            onClick={() => {
                                onChange(defaultIcon, palette[0]);
                                close();
                            }}
                        >
                            {text(
                                "Use default icon",
                                "Dùng biểu tượng mặc định",
                            )}
                        </button>
                    </div>,
                    anchor.current?.closest("dialog[open]") || document.body,
                )}
        </span>
    );
}
export function IconPicker({
    icon,
    color,
    text,
    onChange,
}: {
    icon: string;
    color: string;
    text: Text;
    onChange: (icon: string, color: string) => void;
}) {
    return (
        <div className="review-icon-picker">
            <div role="group" aria-label={text("Icon", "Biểu tượng")}>
                {Object.keys(icons).map((name) => (
                    <button
                        type="button"
                        key={name}
                        className="icon-button"
                        aria-label={name}
                        aria-pressed={icon === name}
                        onClick={() => onChange(name, color)}
                    >
                        <EntityIcon name={name} />
                    </button>
                ))}
            </div>
            <div role="group" aria-label={text("Accent color", "Màu nhấn")}>
                {palette.map((value) => (
                    <button
                        type="button"
                        key={value}
                        className="review-color-dot"
                        style={{ background: value }}
                        aria-label={value}
                        aria-pressed={color === value}
                        onClick={() => onChange(icon, value)}
                    />
                ))}
            </div>
        </div>
    );
}
export function Stars({
    value,
    text,
    onChange,
}: {
    value: number;
    text: Text;
    onChange?: (value: number) => void;
}) {
    return (
        <span
            className="review-stars"
            role="group"
            aria-label={text("Importance", "Mức quan trọng")}
        >
            {[1, 2, 3, 4, 5].map((star) =>
                onChange ? (
                    <button
                        key={star}
                        type="button"
                        aria-pressed={value === star}
                        aria-label={`${text("Importance", "Mức quan trọng")} ${star}/5`}
                        onClick={() => onChange(star)}
                    >
                        {star <= value ? "★" : "☆"}
                    </button>
                ) : (
                    <span key={star}>{star <= value ? "★" : "☆"}</span>
                ),
            )}
        </span>
    );
}
