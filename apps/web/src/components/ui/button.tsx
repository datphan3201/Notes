"use client";

import type { ComponentProps } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonProps = ComponentProps<"button"> & {
    variant?: "primary" | "secondary" | "danger" | "ghost";
    busy?: boolean;
};

const variants = {
    primary: "button-primary",
    secondary: "button-quiet",
    danger: "button-danger",
    ghost: "button-ghost",
};

export function Button({
    variant = "secondary", busy = false, disabled, type = "button",
    className = "", children, ...props
}: ButtonProps) {
    return <button {...props} type={type}
        className={`button ui-button ${variants[variant]} ${className}`}
        disabled={disabled || busy} aria-busy={busy || undefined}>
        {busy && <LoaderCircle className="loading-spinner ui-button-spinner" aria-hidden="true" />}
        {children}
    </button>;
}

export function IconButton({
    label, className = "", type = "button", children, ...props
}: Omit<ComponentProps<"button">, "aria-label"> & { label: string }) {
    return <button {...props} type={type} aria-label={label}
        className={`icon-button ui-icon-button ${className}`}>
        {children}
    </button>;
}
