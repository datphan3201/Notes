"use client";

import { useId, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import "@/styles/floating-actions.css";

export default function FloatingActions({
    label,
    closeLabel,
    children,
    closeOnAction = true,
}: {
    label: string;
    closeLabel: string;
    children: ReactNode;
    closeOnAction?: boolean;
}) {
    const id = useId();
    const [open, setOpen] = useState(false);
    return (
        <div className="floating-actions">
            <button type="button" className="floating-actions-trigger"
                popoverTarget={id} aria-controls={id} aria-expanded={open}
                aria-label={open ? closeLabel : label} title={open ? closeLabel : label}>
                {open ? <X size={24} aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}
            </button>
            <div id={id} popover="auto" className="floating-actions-panel"
                role="group" aria-label={label}
                onToggle={event => setOpen(event.newState === "open")}
                onClickCapture={event => {
                    if (closeOnAction && event.target instanceof Element && event.target.closest("button"))
                        event.currentTarget.hidePopover();
                }}>
                {children}
            </div>
        </div>
    );
}
