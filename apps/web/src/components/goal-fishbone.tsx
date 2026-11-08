"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Flag, Target } from "lucide-react";
import type { Entity } from "@/lib/api";
import type { PageContext } from "./workspace-context";
import { Empty, Tabs } from "./workspace-context";
import { statusName, TaskRow } from "./workspace-controls";
import Dialog from "./dialog";

// The retained layout's ribs express Goal membership, never prerequisite edges.
export default function GoalFishbone({
    ctx,
    goal,
    milestones,
    tasks,
}: {
    ctx: PageContext;
    goal: Entity;
    milestones: Entity[];
    tasks: Entity[];
}) {
    const root = useRef<HTMLDivElement>(null),
        head = useRef<HTMLButtonElement>(null);
    const branches = useRef<(HTMLButtonElement | null)[]>([]);
    const [page, setPage] = useState(0),
        [selected, setSelected] = useState<string | null>(null),
        [tab, setTab] = useState("tasks");
    const [drawing, setDrawing] = useState({
        width: 0,
        height: 0,
        spine: "",
        ribs: [] as string[],
    });
    const marker = useId().replace(/:/g, "");
    const visible = milestones.slice(page * 6, page * 6 + 6);
    const milestone = milestones.find((row) => row.id === selected);
    useEffect(() => {
        const element = root.current!;
        let frame = 0;
        function draw() {
            const box = element.getBoundingClientRect(),
                origin = head.current!.getBoundingClientRect();
            const bounds = branches.current
                .slice(0, visible.length)
                .filter(Boolean)
                .map((branch) => branch!.getBoundingClientRect());
            if (!bounds.length) {
                setDrawing({
                    width: box.width,
                    height: box.height,
                    spine: "",
                    ribs: [],
                });
                return;
            }
            const vertical = window.matchMedia("(max-width: 1000px)").matches;
            element.dataset.roadmapOrientation = vertical
                ? "vertical"
                : "horizontal";
            const x = origin.left + origin.width / 2 - box.left,
                y = origin.top + origin.height / 2 - box.top;
            const spine = vertical
                ? `M ${x} ${Math.min(...bounds.map((rect) => rect.top)) - box.top - 12} V ${origin.top - box.top}`
                : `M ${Math.min(...bounds.map((rect) => rect.left)) - box.left - 12} ${y} H ${origin.left - box.left}`;
            const ribs = bounds.map((rect) => {
                if (vertical) {
                    const left =
                        rect.left + rect.width / 2 <
                        origin.left + origin.width / 2;
                    const startY = rect.top + rect.height / 2 - box.top;
                    return `M ${(left ? rect.right : rect.left) - box.left} ${startY} L ${x} ${startY + 28}`;
                }
                const above =
                    rect.top + rect.height / 2 < origin.top + origin.height / 2;
                const startX = rect.left + rect.width / 2 - box.left;
                return `M ${startX} ${(above ? rect.bottom : rect.top) - box.top} L ${startX + Math.min(72, rect.width * 0.32)} ${y}`;
            });
            setDrawing({ width: box.width, height: box.height, spine, ribs });
        }
        const observer = new ResizeObserver(() => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(draw);
        });
        observer.observe(element);
        for (const branch of branches.current.slice(0, visible.length))
            if (branch) observer.observe(branch);
        return () => {
            observer.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [page, milestones.length, visible.map((row) => row.title).join("\n")]);
    return (
        <>
            <div
                ref={root}
                className="goal-roadmap"
                data-roadmap-layout="fishbone"
                data-roadmap-empty={!milestones.length}
                style={
                    {
                        "--fishbone-pairs": Math.ceil(visible.length / 2),
                        "--fishbone-head-row":
                            Math.ceil(visible.length / 2) + 1,
                        "--fishbone-page-row":
                            Math.ceil(visible.length / 2) + 2,
                    } as CSSProperties
                }
            >
                <svg
                    className="roadmap-connections"
                    viewBox={`0 0 ${drawing.width || 1} ${drawing.height || 1}`}
                    aria-hidden="true"
                >
                    <defs>
                        <marker
                            id={marker}
                            viewBox="0 0 10 10"
                            refX="9"
                            refY="5"
                            markerWidth="5"
                            markerHeight="5"
                            orient="auto"
                        >
                            <path
                                d="M 1 1 L 9 5 L 1 9"
                                className="roadmap-arrow-tip"
                            />
                        </marker>
                    </defs>
                    <path
                        className="roadmap-spine"
                        d={drawing.spine}
                        markerEnd={`url(#${marker})`}
                    />
                    {drawing.ribs.map((path, index) => (
                        <path key={index} d={path} className="roadmap-rib" />
                    ))}
                </svg>
                <button
                    ref={head}
                    className="roadmap-center"
                    aria-label={
                        ctx.text(
                            "View goal information",
                            "Xem thông tin mục tiêu",
                        ) +
                        ": " +
                        goal.title
                    }
                    onClick={() => ctx.open("goals", goal)}
                >
                    <span className="reference-anchor">
                        <Target size={28} />
                    </span>
                    <strong className="roadmap-goal-name">{goal.title}</strong>
                    <small data-roadmap-goal-state>
                        {goal.progress == null
                            ? "—"
                            : Math.round(goal.progress) + "%"}{" "}
                        · {statusName(ctx, goal.status)}
                    </small>
                    <span className="section-link">
                        {ctx.text("Goal information →", "Thông tin mục tiêu →")}
                    </span>
                </button>
                {visible.map((row, index) => {
                    const children = tasks.filter(
                            (task) =>
                                task.milestone_id === row.id &&
                                !task.occurrence_date,
                        ),
                        done = children.filter(
                            (task) => task.status === "done",
                        ).length;
                    const percentage = children.length
                        ? Math.round((done / children.length) * 100)
                        : row.status === "done"
                          ? 100
                          : 0;
                    return (
                        <button
                            key={row.id}
                            ref={(element) => {
                                branches.current[index] = element;
                            }}
                            className="roadmap-branch"
                            aria-haspopup="dialog"
                            style={
                                {
                                    "--branch-column":
                                        Math.floor(index / 2) + 1,
                                    "--branch-row": index % 2 === 0 ? 1 : 3,
                                    "--mobile-column": (index % 2) + 1,
                                    "--mobile-row": Math.floor(index / 2) + 1,
                                } as CSSProperties
                            }
                            onClick={() => {
                                setSelected(row.id);
                                setTab("tasks");
                            }}
                        >
                            <span className="milestone-icon">
                                <Flag size={17} />
                            </span>
                            <strong>{row.title}</strong>
                            <small>
                                {done}/{children.length}{" "}
                                {ctx.text("tasks", "công việc")} ·{" "}
                                {statusName(ctx, row.status)}
                            </small>
                            <small className="task-importance">
                                {"★".repeat(row.importance)}
                                {"☆".repeat(5 - row.importance)}
                            </small>
                            <span className="progress-track">
                                <i
                                    style={
                                        {
                                            "--progress": percentage + "%",
                                        } as CSSProperties
                                    }
                                />
                            </span>
                        </button>
                    );
                })}
                {!milestones.length && (
                    <div className="roadmap-empty">
                        <Empty>
                            {ctx.text(
                                "Add a milestone to build your roadmap.",
                                "Thêm cột mốc để xây dựng lộ trình.",
                            )}
                        </Empty>
                    </div>
                )}
                {milestones.length > 6 && (
                    <nav
                        className="roadmap-pagination"
                        aria-label={ctx.text(
                            "Milestone pages",
                            "Trang cột mốc",
                        )}
                    >
                        <button
                            className="button button-quiet"
                            disabled={!page}
                            onClick={() => setPage(page - 1)}
                        >
                            ←
                        </button>
                        <span>
                            {page + 1} / {Math.ceil(milestones.length / 6)}
                        </span>
                        <button
                            className="button button-quiet"
                            disabled={(page + 1) * 6 >= milestones.length}
                            onClick={() => setPage(page + 1)}
                        >
                            →
                        </button>
                    </nav>
                )}
            </div>
            {milestone && (
                <Dialog
                    title={milestone.title}
                    onClose={() => setSelected(null)}
                    wide
                >
                    <div className="section-heading">
                        <p>
                            {statusName(ctx, milestone.status)} ·{" "}
                            {milestone.due_date || "—"}
                        </p>
                        <button
                            className="button button-quiet"
                            onClick={() => {
                                ctx.open("milestones", milestone);
                            }}
                        >
                            {ctx.text("Edit milestone", "Sửa cột mốc")}
                        </button>
                    </div>
                    <Tabs
                        label={ctx.t.milestones}
                        value={tab}
                        onChange={setTab}
                        items={[
                            ["tasks", ctx.t.tasks],
                            [
                                "criteria",
                                ctx.text(
                                    "Completion criteria",
                                    "Tiêu chí hoàn thành",
                                ),
                            ],
                        ]}
                    />
                    {tab === "tasks" ? (
                        <>
                            {tasks
                                .filter(
                                    (task) =>
                                        task.milestone_id === milestone.id,
                                )
                                .map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        ctx={ctx}
                                        task={task}
                                        compact
                                    />
                                ))}
                            <button
                                className="button button-primary"
                                onClick={() => {
                                    ctx.open("tasks", null, {
                                        milestone_id: milestone.id,
                                    });
                                }}
                            >
                                <span aria-hidden="true">＋</span>
                                {ctx.text("Add task", "Thêm công việc")}
                            </button>
                        </>
                    ) : (
                        <p>{milestone.completion_criteria || "—"}</p>
                    )}
                </Dialog>
            )}
        </>
    );
}
