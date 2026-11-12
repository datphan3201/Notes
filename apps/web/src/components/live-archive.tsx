"use client";
import { useEffect, useRef, useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import type { Kind } from "@/lib/api";
import type { LiveRuntime } from "./live-contract";
import { Confirm } from "./preview/ui";
import type { Text } from "./preview/shared";
import { workspaceKinds } from "@/lib/workspace-refresh";

type Root = { kind: Kind; id: string; title: string; version: number };
type Cursor = { kind: Kind; id: string } | null;
type Page = { items: Root[]; next_cursor: Cursor };
const names = ["Areas", "Goals", "Milestones", "Tasks", "Habits", "Notes", "Reviews", "Repeating series"];
const vietnamese = ["Lĩnh vực", "Mục tiêu", "Cột mốc", "Công việc", "Thói quen", "Ghi chú", "Đánh giá", "Chuỗi lặp"];

export default function LiveArchive({ runtime, text }: { runtime: LiveRuntime; text: Text }) {
    const [query, setQuery] = useState(""), [kind, setKind] = useState("");
    const [rows, setRows] = useState<Root[]>([]), [cursor, setCursor] = useState<Cursor>(null);
    const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
    const [error, setError] = useState(""), [revision, setRevision] = useState(0);
    const [remove, setRemove] = useState<Root[] | null>(null), [ack, setAck] = useState(false);
    const generation = useRef(0);
    const page = (q: string, type: string, before: Cursor = null) => {
        const params = new URLSearchParams({ size: "100", q });
        if (type) params.set("kind", type);
        if (before) { params.set("before_id", before.id); params.set("before_kind", before.kind); }
        return runtime.request<Page>(`/workspace/archived?${params}`);
    };
    useEffect(() => {
        const current = ++generation.current;
        setLoading(true); setError(""); setRows([]); setCursor(null);
        const timer = setTimeout(() => {
            page(query, kind).then(result => {
                if (current === generation.current) { setRows(result.items); setCursor(result.next_cursor); }
            }).catch(err => { if (current === generation.current) setError((err as Error).message); })
                .finally(() => { if (current === generation.current) setLoading(false); });
        }, 150);
        return () => { clearTimeout(timer); ++generation.current; };
    }, [query, kind, revision]);
    async function loadMore() {
        const current = generation.current;
        setLoading(true); setError("");
        try {
            const result = await page(query, kind, cursor);
            if (current === generation.current) {
                setRows(previous => [...previous, ...result.items]); setCursor(result.next_cursor);
            }
        } catch (err) { if (current === generation.current) setError((err as Error).message); }
        finally { if (current === generation.current) setLoading(false); }
    }
    async function selectAll() {
        setBusy(true); setError("");
        try {
            let before: Cursor = null;
            const all: Root[] = [];
            do {
                const result: Page = await page("", "", before);
                all.push(...result.items); before = result.next_cursor;
                if (all.length > 20000) throw new Error(text("Too many items. Delete smaller groups.", "Quá nhiều mục. Hãy xóa từng nhóm nhỏ hơn."));
            } while (before);
            if (all.length) { setAck(false); setRemove(all); }
        } catch (err) { setError((err as Error).message); }
        finally { setBusy(false); }
    }
    return <>
        <div className="review-toolbar"><div><h2>{text("Your archived work", "Nội dung đã lưu trữ")}</h2>
            <p className="review-caption">{text("Items archived together are restored together.", "Các mục lưu trữ cùng nhau sẽ được khôi phục cùng nhau.")}</p></div>
            <button className="button button-danger" disabled={busy || loading} onClick={() => void selectAll()}>
                <Trash2 size={15} />{text("Empty archive", "Dọn sạch lưu trữ")}</button></div>
        <div className="review-toolbar">
            <input className="review-search" aria-label={text("Search archive", "Tìm trong lưu trữ")}
                placeholder={text("Search archived work…", "Tìm nội dung đã lưu trữ…")}
                value={query} onChange={event => setQuery(event.target.value)} />
            <select aria-label={text("Archive type", "Loại lưu trữ")} value={kind} onChange={event => setKind(event.target.value)}>
                <option value="">{text("Everything", "Tất cả")}</option>
                {workspaceKinds.map((value, index) => <option key={value} value={value}>{text(names[index], vietnamese[index])}</option>)}
            </select></div>
        {error && <p role="alert" className="field-error">{error} <button className="text-button" onClick={() => setRevision(value => value + 1)}>{text("Retry", "Thử lại")}</button></p>}
        {rows.map(row => <article className="review-archive-row" key={`${row.kind}:${row.id}`}>
            <Archive size={20} /><div><strong>{row.title}</strong><small>{text(names[workspaceKinds.indexOf(row.kind)], vietnamese[workspaceKinds.indexOf(row.kind)])}</small></div>
            <button className="button button-quiet" disabled={busy} onClick={async () => {
                setBusy(true); setError("");
                try {
                    if (!await runtime.flush()) return;
                    await runtime.request("/workspace/changes", { method: "POST", body: JSON.stringify({ changes: [{
                        action: "restore", kind: row.kind, id: row.id, version: row.version, fields: { include_contents: true },
                    }] }) });
                    await runtime.refresh(); setRevision(value => value + 1);
                } catch (err) { setError((err as Error).message); }
                finally { setBusy(false); }
            }}>{text("Restore", "Khôi phục")}</button>
            <button className="icon-button danger-text" disabled={busy} aria-label={text("Delete permanently: ", "Xóa vĩnh viễn: ") + row.title}
                onClick={() => { setAck(false); setRemove([row]); }}><Trash2 size={17} /></button>
        </article>)}
        {loading && <p role="status">{text("Loading…", "Đang tải…")}</p>}
        {!loading && !error && !rows.length && <p className="review-inline-empty">{text("No archived items match.", "Không có mục lưu trữ phù hợp.")}</p>}
        {cursor && <button className="button button-quiet" disabled={loading} onClick={() => void loadMore()}>{text("Load more", "Tải thêm")}</button>}
        {remove && <Confirm text={text} title={text("Delete permanently?", "Xóa vĩnh viễn?")} danger disabled={!ack}
            onClose={() => setRemove(null)} onConfirm={async () => {
                if (!await runtime.flush()) throw new Error(text("Save pending changes first.", "Hãy lưu các thay đổi đang chờ trước."));
                try {
                    await runtime.request("/workspace/archived/delete", { method: "POST", body: JSON.stringify({ items: remove.map(row => ({
                        action: "delete", kind: row.kind, id: row.id, version: row.version, fields: {},
                    })) }) });
                } catch (err) {
                    throw new Error(text("Deletion was not saved. Retry after refreshing.", "Chưa lưu thao tác xóa. Hãy tải lại rồi thử lại.") + " " + (err as Error).message);
                }
                await runtime.refresh(); setRemove(null); setRevision(value => value + 1);
            }}>
            <p>{remove.length === 1 ? remove[0].title : `${remove.length} ${text("groups and their contents", "nhóm cùng nội dung bên trong")}`}</p>
            <p>{text("This permanently removes the selected work and its contents. References from remaining work are cleared; saved review snapshots remain.", "Xóa vĩnh viễn nội dung được chọn cùng các mục bên trong. Liên kết từ nội dung còn lại được bỏ; ảnh chụp của lần nhìn lại vẫn được giữ.")}</p>
            <label className="review-checkbox"><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} />
                {text("I understand this permanent-delete action.", "Tôi hiểu thao tác xóa vĩnh viễn này.")}</label>
        </Confirm>}
    </>;
}
