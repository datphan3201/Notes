import type { ComponentProps, ReactNode } from "react";

export function PageHeaderFrame({ className = "", illustrated = true, ...props }:
    ComponentProps<"header"> & { illustrated?: boolean }) {
    return <header {...props} className={`ui-page-header ${illustrated ? "workspace-header scene-header" : ""} ${className}`} />;
}

export function PageActionBar({ label, className = "", ...props }:
    ComponentProps<"div"> & { label?: string }) {
    return <div {...props} role="group" aria-label={label}
        className={`ui-page-actions ${className}`} />;
}

export function PageHeader({ title, description, children, className = "", actionsLabel }: {
    title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; actionsLabel?: string;
}) {
    return <>
        <PageHeaderFrame className={`review-page-header ${className}`}>
            <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
        </PageHeaderFrame>
        {children && <PageActionBar label={actionsLabel || (typeof title === "string" ? title : undefined)}>{children}</PageActionBar>}
    </>;
}

export function Surface({ className = "", ...props }: ComponentProps<"section">) {
    return <section {...props} className={`planning-panel ui-surface ${className}`} />;
}
