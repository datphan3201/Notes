"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Text } from "./shared";
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
// Compatibility exports keep existing feature imports on the shared UI system.
export { PageHeader as Header } from "../ui/layout";
export { Field } from "../ui/field";
export { State, Tabs, Panel, FormDialog, Confirm, Toast } from "../ui/patterns";

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
