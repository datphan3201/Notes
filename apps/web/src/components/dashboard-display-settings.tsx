"use client";

import { useState, type FormEvent } from "react";
import { usePreviewData } from "./preview/workspace-data";
import { Button, Field, Input, Surface } from "./ui";
import type { Text } from "./preview/shared";

export default function DashboardDisplaySettings({ text }: { text: Text }) {
    const db = usePreviewData();
    const [busy, setBusy] = useState(false), [error, setError] = useState("");
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const values = new FormData(event.currentTarget);
        const dashboard = { tasks: Number(values.get("tasks")), habits: Number(values.get("habits")), completed: Number(values.get("completed")) };
        setBusy(true); setError("");
        try {
            if (db.live) await db.live.preferences({ dashboard });
            else db.setDashboard(dashboard);
            db.setMessage(text("Dashboard preferences saved.", "Đã lưu tùy chọn Tổng quan."));
        } catch (cause) { setError((cause as Error).message); }
        finally { setBusy(false); }
    }
    return <Surface className="review-settings-card">
        <h2>{text("Dashboard", "Tổng quan")}</h2>
        <p className="subtle-copy">{text("Choose how many items each list shows. Show more reveals the rest.", "Chọn số mục hiển thị cho mỗi danh sách. Bấm Xem thêm để hiện các mục còn lại.")}</p>
        <form className="stack-form" onSubmit={save}>
            {([["tasks", "Tasks", "Công việc"], ["habits", "Habits", "Thói quen"], ["completed", "Completed tasks", "Công việc đã hoàn thành"]] as const).map(([key, en, vi]) =>
                <Field key={key} label={text(en, vi)}><Input type="number" name={key} defaultValue={db.dashboard[key]} min={1} max={20} required disabled={busy} /></Field>)}
            {error && <p className="field-error" role="alert">{error}</p>}
            <Button type="submit" variant="primary" busy={busy}>{text("Save preferences", "Lưu tùy chọn")}</Button>
        </form>
    </Surface>;
}
