"use client";

import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "./button";

export function CollectionToolbar({ search, children, label, filtersLabel, className = "" }: {
    search: ReactNode; children: ReactNode; label: string; filtersLabel: string; className?: string;
}) {
    const [open, setOpen] = useState(false);
    const controls = useId();
    return <div className={`ui-collection-toolbar ${className}`} role="search" aria-label={label}>
        <div className="ui-collection-search">{search}</div>
        <Button className="ui-collection-toggle" aria-expanded={open} aria-controls={controls} onClick={() => setOpen(!open)}>
            <SlidersHorizontal size={17} aria-hidden="true" />{filtersLabel}
        </Button>
        <div className="ui-collection-controls" id={controls} data-open={open}>{children}</div>
    </div>;
}
