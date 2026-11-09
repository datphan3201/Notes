"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

export function Field({ label, children, hint, error, htmlFor }: {
    label: string; children: ReactNode; hint?: string; error?: string; htmlFor?: string;
}) {
    return <label className="field review-field ui-field" htmlFor={htmlFor}>
        <span>{label}</span>
        {children}
        {hint && <small>{hint}</small>}
        {error && <small className="field-error" role="alert">{error}</small>}
    </label>;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
    return <input {...props} className={`ui-control ${className}`} />;
}
export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
    return <textarea {...props} className={`ui-control ${className}`} />;
}
export function Select({ className = "", ...props }: ComponentProps<"select">) {
    return <select {...props} className={`ui-control ${className}`} />;
}

export function TextField({ label, hint, error, id, "aria-describedby": describedBy, ...props }:
    ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
    const generatedId = useId();
    const controlId = id || generatedId;
    const description = [describedBy, hint && `${controlId}-hint`, error && `${controlId}-error`].filter(Boolean).join(" ");
    return <div className="field review-field ui-field">
        <label htmlFor={controlId}>{label}</label>
        <Input {...props} id={controlId} aria-invalid={!!error || props["aria-invalid"]}
            aria-describedby={description || undefined} />
        {hint && <small id={`${controlId}-hint`}>{hint}</small>}
        {error && <small id={`${controlId}-error`} className="field-error" role="alert">{error}</small>}
    </div>;
}
