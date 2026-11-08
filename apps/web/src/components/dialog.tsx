"use client";
import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

export default function Dialog({
    title,
    onClose,
    children,
    wide = false,
    closeLabel = "Close",
    className = "",
    heading,
}: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    wide?: boolean;
    closeLabel?: string;
    className?: string;
    heading?: React.ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current!;
        dialog.showModal();
        const field = dialog.querySelector<
            HTMLInputElement | HTMLTextAreaElement
        >("input:not([disabled]), textarea:not([disabled])");
        field?.focus();
        return () => dialog.close();
    }, []);
    return (
        <dialog
            ref={ref}
            className={`drawer ${wide ? "wide" : ""} ${className}`}
            aria-labelledby={titleId}
            onClick={(event) => {
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (
                    event.clientX < rect.left ||
                    event.clientX > rect.right ||
                    event.clientY < rect.top ||
                    event.clientY > rect.bottom
                )
                    onClose();
            }}
            onCancel={(event) => {
                event.preventDefault();
                onClose();
            }}
        >
            <div className="drawer-heading">
                {heading ? (
                    <div id={titleId}>{heading}</div>
                ) : (
                    <h2 id={titleId}>{title}</h2>
                )}
                <button
                    className="icon-button"
                    aria-label={closeLabel}
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
            </div>
            {children}
        </dialog>
    );
}
