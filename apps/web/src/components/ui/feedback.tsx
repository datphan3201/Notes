import type { ComponentProps, ReactNode } from "react";
import { Check, CircleHelp, Info } from "lucide-react";

export function Notice({ tone = "info", children, className = "", ...props }:
    ComponentProps<"div"> & { tone?: "info" | "success" | "error" }) {
    const Icon = tone === "error" ? CircleHelp : tone === "success" ? Check : Info;
    return <div role={tone === "error" ? "alert" : "status"} {...props}
        className={`notice ui-notice ui-notice-${tone} ${className}`}>
        <Icon size={18} aria-hidden="true" /><div>{children}</div>
    </div>;
}

export function Badge({ children, tone = "neutral" }: {
    children: ReactNode; tone?: "neutral" | "accent" | "success" | "danger";
}) {
    return <span className={`ui-badge ui-badge-${tone}`}>{children}</span>;
}
