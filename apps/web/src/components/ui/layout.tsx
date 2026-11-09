import type { ComponentProps, ReactNode } from "react";

export function PageHeaderFrame({ className = "", illustrated = true, ...props }:
    ComponentProps<"header"> & { illustrated?: boolean }) {
    return <header {...props} className={`ui-page-header ${illustrated ? "workspace-header scene-header" : ""} ${className}`} />;
}

export function PageHeader({ title, description, children, className = "" }: {
    title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string;
}) {
    return <PageHeaderFrame className={`review-page-header ${className}`}>
        <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
        {children && <div className="workspace-header-actions action-row">{children}</div>}
    </PageHeaderFrame>;
}

export function Surface({ className = "", ...props }: ComponentProps<"section">) {
    return <section {...props} className={`planning-panel ui-surface ${className}`} />;
}
