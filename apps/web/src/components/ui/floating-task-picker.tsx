"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, GripHorizontal, GripVertical, Plus, Search, Undo2, X } from "lucide-react";
import { Button, IconButton } from "./button";
import { Input, Select } from "./field";
import { Notice } from "./feedback";
import type { LocalizedText } from "./types";
import { TASK_PICKER_MIME, TASK_RETURN_MIME, readPickedTask } from "@/lib/task-picker";
import "@/styles/task-picker.css";

export type PickableTask = {
    id: number; title: string; goalId: string; goalLabel: string;
    metadata: string; scheduled: boolean; selected: boolean; returnable?: boolean; disabledReason?: string;
};
type Point = { x: number; y: number };

export function FloatingTaskPicker({ className = "", tasks, goals, destination, hint, busyIds, error, text,
    onAdd, onClose, onCreate, onPointerDrop, onReturn, returnTarget, returnLabel, returnHint }: {
    className?: string;
    tasks: PickableTask[];
    goals: { id: string; title: string }[];
    destination: string; hint: string; busyIds: number[]; error: string;
    text: LocalizedText;
    onAdd: (id: number) => void; onClose: () => void; onCreate: () => void;
    onPointerDrop: (id: number, target: string) => void;
    onReturn?: (id: number) => void;
    returnTarget?: string; returnLabel?: string; returnHint?: string;
}) {
    const headingId = useId();
    const panel = useRef<HTMLElement>(null);
    const search = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState("");
    const [goal, setGoal] = useState("");
    const [returnOver, setReturnOver] = useState(false);
    const [unscheduled, setUnscheduled] = useState(false);
    const [position, setPosition] = useState<Point | null>(null);
    const move = useRef<{ pointer: number; offset: Point } | null>(null);
    const taskDrag = useRef<{ id: number; pointer: number; start: Point; active: boolean } | null>(null);
    const hovered = useRef<HTMLElement | null>(null);
    const [ghost, setGhost] = useState<{ task: PickableTask; point: Point } | null>(null);
    const clamp = (point: Point): Point => {
        const rect = panel.current!.getBoundingClientRect();
        return {
            x: Math.max(8, Math.min(point.x, innerWidth - rect.width - 8)),
            y: Math.max(8, Math.min(point.y, innerHeight - rect.height - 8)),
        };
    };
    const clearTaskDrag = () => {
        hovered.current?.removeAttribute("data-task-drop-active");
        hovered.current = null;
        taskDrag.current = null;
        setGhost(null);
    };
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        search.current?.focus();
        const resized = () => setPosition(point => point ? clamp(point) : null);
        window.addEventListener("resize", resized);
        const observer = new ResizeObserver(resized);
        observer.observe(panel.current!);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", resized);
            hovered.current?.removeAttribute("data-task-drop-active");
            if (previous?.isConnected && previous.getClientRects().length) previous.focus();
        };
    }, []);
    const pointerMoveTask = (event: PointerEvent<HTMLButtonElement>, task: PickableTask) => {
        const drag = taskDrag.current;
        if (!drag || drag.pointer !== event.pointerId || drag.id !== task.id) return;
        if (!drag.active && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 6) return;
        drag.active = true;
        setGhost({ task, point: { x: event.clientX, y: event.clientY } });
        const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-task-drop-target]") || null;
        if (zone !== hovered.current) {
            hovered.current?.removeAttribute("data-task-drop-active");
            zone?.setAttribute("data-task-drop-active", "true");
            hovered.current = zone;
        }
    };
    const filtered = tasks.filter(task =>
        (!goal || task.goalId === goal) && (!unscheduled || !task.scheduled) &&
        `${task.title} ${task.goalLabel}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    return createPortal(<>
        <section ref={panel} className={`floating-task-picker ${className}`} role="dialog" aria-modal="false"
            aria-labelledby={headingId} data-task-picker
            style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined}
            onKeyDown={event => {
                if (event.key === "Escape") { event.stopPropagation(); onClose(); }
            }}>
            <header className="task-picker-heading">
                <button type="button" className="task-picker-move" aria-label={text("Move task picker", "Di chuyển bảng chọn công việc")}
                    title={text("Drag to move. Arrow keys also move the panel.", "Kéo để di chuyển. Có thể dùng các phím mũi tên.")}
                    onPointerDown={event => {
                        if (event.button !== 0) return;
                        const rect = panel.current!.getBoundingClientRect();
                        move.current = { pointer: event.pointerId, offset: { x: event.clientX - rect.x, y: event.clientY - rect.y } };
                        event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={event => {
                        if (move.current?.pointer !== event.pointerId) return;
                        setPosition(clamp({ x: event.clientX - move.current.offset.x, y: event.clientY - move.current.offset.y }));
                    }}
                    onPointerUp={() => { move.current = null; }}
                    onPointerCancel={() => { move.current = null; }}
                    onKeyDown={event => {
                        const offsets: Record<string, Point> = { ArrowLeft: { x: -16, y: 0 }, ArrowRight: { x: 16, y: 0 }, ArrowUp: { x: 0, y: -16 }, ArrowDown: { x: 0, y: 16 } };
                        const delta = offsets[event.key];
                        if (!delta) return;
                        event.preventDefault();
                        const rect = panel.current!.getBoundingClientRect();
                        setPosition(clamp({ x: rect.x + delta.x, y: rect.y + delta.y }));
                    }}><GripHorizontal size={20} aria-hidden="true" /></button>
                <h2 id={headingId}>{text("Choose tasks", "Chọn công việc")}</h2>
                <IconButton label={text("Close task picker", "Đóng bảng chọn công việc")} onClick={onClose}><X size={18} aria-hidden="true" /></IconButton>
            </header>
            <div className="task-picker-controls">
                <p className="task-picker-destination">{text("Add to: ", "Thêm vào: ")}{destination}</p>
                {onReturn && returnTarget && <div className="task-picker-return" role="region" aria-label={returnLabel}
                    data-task-return data-task-drop-target={returnTarget} data-task-drop-active={returnOver || undefined}
                    onDragOver={event => {
                        if ([TASK_RETURN_MIME, TASK_PICKER_MIME].some(type => event.dataTransfer.types.includes(type))) {
                            event.preventDefault(); event.stopPropagation(); setReturnOver(true);
                        }
                    }}
                    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setReturnOver(false); }}
                    onDrop={event => {
                        event.preventDefault(); event.stopPropagation(); setReturnOver(false);
                        const id = readPickedTask(event.dataTransfer.getData(TASK_RETURN_MIME) || event.dataTransfer.getData(TASK_PICKER_MIME));
                        if (id !== null) onReturn(id);
                    }}><Undo2 size={18} aria-hidden="true" /><span>{returnHint}</span></div>}
                <label className="task-picker-search"><Search size={17} aria-hidden="true" /><Input ref={search}
                    aria-label={text("Search tasks", "Tìm công việc")} placeholder={text("Search tasks…", "Tìm công việc…")}
                    value={query} onChange={event => setQuery(event.target.value)} /></label>
                <Select aria-label={text("Filter by goal", "Lọc theo mục tiêu")} value={goal} onChange={event => setGoal(event.target.value)}>
                    <option value="">{text("All goals", "Tất cả mục tiêu")}</option>
                    <option value="inbox">{text("Inbox", "Hộp thư đến")}</option>
                    {goals.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
                </Select>
                <label className="task-picker-filter"><input type="checkbox" checked={unscheduled} onChange={event => setUnscheduled(event.target.checked)} />{text("Unscheduled only", "Chỉ công việc chưa lên lịch")}</label>
                <p className="task-picker-hint">{hint}</p>
                {error && <Notice tone="error">{error}</Notice>}
            </div>
            <div className="task-picker-list" role="list" aria-label={text("Available tasks", "Công việc có thể chọn")}>
                {filtered.map(task => {
                    const busy = busyIds.includes(task.id);
                    const disabled = busy || task.selected || !!task.disabledReason;
                    const draggable = !busy && !task.disabledReason;
                    return <article key={task.id} role="listitem" className={`task-picker-row ${task.selected ? "is-selected" : ""}`}
                        draggable={draggable} onDragStart={event => {
                            if (!draggable) { event.preventDefault(); return; }
                            event.dataTransfer.setData(TASK_PICKER_MIME, String(task.id));
                            event.dataTransfer.effectAllowed = "all";
                        }}>
                        <button type="button" className="task-picker-grip" disabled={!draggable} draggable={false}
                            aria-label={text("Drag task: ", "Kéo công việc: ") + task.title}
                            onPointerDown={event => {
                                if (event.button !== 0) return;
                                event.preventDefault();
                                taskDrag.current = { id: task.id, pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, active: false };
                                event.currentTarget.setPointerCapture(event.pointerId);
                            }}
                            onPointerMove={event => pointerMoveTask(event, task)}
                            onPointerUp={event => {
                                if (taskDrag.current?.pointer !== event.pointerId) return;
                                if (taskDrag.current.active) {
                                    const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-task-drop-target]");
                                    if (zone?.dataset.taskDropTarget) onPointerDrop(task.id, zone.dataset.taskDropTarget);
                                }
                                clearTaskDrag();
                            }} onPointerCancel={clearTaskDrag}>
                            <GripVertical size={18} aria-hidden="true" />
                        </button>
                        <div className="task-picker-copy"><strong title={task.title}>{task.title}</strong><small>{task.goalLabel}{task.metadata ? ` · ${task.metadata}` : ""}</small>{task.disabledReason && <small>{task.disabledReason}</small>}</div>
                        <Button className="task-picker-add" variant={task.selected ? "ghost" : "secondary"}
                            busy={busy} disabled={disabled} aria-label={text("Add: ", "Thêm: ") + task.title}
                            onClick={() => onAdd(task.id)}>
                            {!busy && (task.selected ? <Check size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />)}
                            {text(busy ? "Saving…" : task.selected ? "Selected" : "Add", busy ? "Đang lưu…" : task.selected ? "Đã chọn" : "Thêm")}
                        </Button>
                        {onReturn && task.returnable && !task.disabledReason && <IconButton className="task-picker-remove"
                            label={`${returnLabel}: ${task.title}`} title={returnLabel} disabled={busy} onClick={() => onReturn(task.id)}>
                            <Undo2 size={17} aria-hidden="true" />
                        </IconButton>}
                    </article>;
                })}
                {!filtered.length && <p className="task-picker-empty">{text("No matching tasks. Try another filter or create a task.", "Không có công việc phù hợp. Thử bộ lọc khác hoặc tạo công việc mới.")}</p>}
            </div>
            <footer className="task-picker-footer"><Button variant="primary" onClick={onCreate}><Plus size={17} aria-hidden="true" />{text("New task", "Công việc mới")}</Button></footer>
        </section>
        {ghost && <div className="task-picker-ghost" aria-hidden="true" style={{ left: Math.min(ghost.point.x + 12, innerWidth - 220), top: ghost.point.y + 12 }}>{ghost.task.title}</div>}
    </>, document.body);
}
