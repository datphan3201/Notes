"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Maximize2, Minimize2 } from "lucide-react";
import { IconButton } from "./button";
import type { LocalizedText } from "./types";

export function DashboardPanel({ header, children, summary, className = "", label, text }: {
    header: ReactNode; children: ReactNode; summary?: ReactNode; className?: string; label: string; text: LocalizedText;
}) {
    const [collapsed, setCollapsed] = useState(false), [expanded, setExpanded] = useState(false);
    const body = useId();
    useEffect(() => {
        if (!expanded) return;
        const close = (event: KeyboardEvent) => {
            if (event.key === "Escape") { event.stopPropagation(); setExpanded(false); }
        };
        document.addEventListener("keydown", close);
        return () => document.removeEventListener("keydown", close);
    }, [expanded]);
    return <section className={`planning-panel ui-dashboard-panel ${className}`} aria-label={label} data-expanded={expanded} data-collapsed={collapsed}>
        <div className="ui-dashboard-panel-heading">
            <div className="ui-dashboard-panel-title">{header}</div>
            <div className="ui-dashboard-panel-controls">
                <IconButton label={`${text(collapsed ? "Show" : "Collapse", collapsed ? "Hiện" : "Thu gọn")} ${label}`}
                    aria-expanded={!collapsed} aria-controls={body} onClick={() => { setCollapsed(!collapsed); setExpanded(false); }}>
                    {collapsed ? <ChevronDown size={17} /> : <ChevronUp size={17} />}
                </IconButton>
                <IconButton label={`${text(expanded ? "Restore" : "Expand", expanded ? "Khôi phục" : "Phóng to")} ${label}`}
                    aria-pressed={expanded} onClick={() => { setExpanded(!expanded); setCollapsed(false); }}>
                    {expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </IconButton>
            </div>
        </div>
        {collapsed && summary && <div className="ui-dashboard-panel-summary">{summary}</div>}
        <div className="ui-dashboard-panel-body" id={body} hidden={collapsed}>{children}</div>
    </section>;
}
