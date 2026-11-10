"use client";
import { api, type Dashboard, type Entity } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Flag, MoreHorizontal, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import Dialog from "./dialog";
import {
    QueryState,
    useItems,
    type PageContext,
} from "./workspace-context";
import { FocusPicker } from "./workspace-controls";

export function GoalsPage({ ctx }: { ctx: PageContext }) {
    const areas = useItems("areas", ctx.identity.user.id),
        goals = useItems("goals", ctx.identity.user.id);
    const dashboard = useQuery({
        queryKey: ["dashboard", ctx.identity.user.id],
        queryFn: () =>
            api<Dashboard & { focus_goal: Entity | null }>("/dashboard"),
    });
    const [manage, setManage] = useState(false),
        [expanded, setExpanded] = useState(true);
    const renderGoal = (goal: Entity): React.ReactNode => (
        <div key={goal.id}>
            <div className="goal-tree-row">
                <Flag size={18} />
                <Link className="goal-tree-link" href={`/goals/${goal.id}`}>
                    <strong>{goal.title}</strong>
                </Link>
                <progress
                    max={100}
                    value={goal.progress || 0}
                    aria-label={ctx.text("Goal progress", "Tiến độ mục tiêu")}
                />
                <span>{Math.round(goal.progress || 0)}%</span>
                <button
                    className="icon-button"
                    title={ctx.text("Edit", "Sửa")}
                    aria-label={ctx.text("Edit", "Sửa") + ": " + goal.title}
                    onClick={() => ctx.open("goals", goal)}
                >
                    <MoreHorizontal size={18} />
                </button>
                <button
                    className="icon-button"
                    title={ctx.text("Add subgoal", "Thêm mục tiêu con")}
                    aria-label={
                        ctx.text("Add subgoal", "Thêm mục tiêu con") +
                        ": " +
                        goal.title
                    }
                    onClick={() =>
                        ctx.open("goals", null, {
                            parent_goal_id: goal.id,
                            area_id: null,
                        })
                    }
                >
                    <Plus size={18} />
                </button>
            </div>
            {expanded && (
                <div className="goal-tree-branch">
                    {goals.data
                        ?.filter((child) => child.parent_goal_id === goal.id)
                        .map(renderGoal)}
                </div>
            )}
        </div>
    );
    return (
        <>
            <QueryState locale={ctx.identity.user.locale} queries={[areas, goals, dashboard]} />
            <div className="planning-panel">
                <div className="section-heading">
                    <h2>{ctx.text("Main goal", "Mục tiêu chính")}</h2>
                    <FocusPicker
                        ctx={ctx}
                        goals={goals.data || []}
                        value={dashboard.data?.focus_goal?.id}
                    />
                </div>
            </div>
            <div className="action-row">
                <button
                    className="button button-quiet"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded
                        ? ctx.text("Collapse all", "Thu gọn")
                        : ctx.text("Expand all", "Mở rộng")}
                </button>
                <button
                    className="button button-quiet"
                    onClick={() => setManage(true)}
                >
                    {ctx.text("Manage areas", "Quản lý lĩnh vực")}
                </button>
            </div>
            <div className="planning-panel">
                {areas.data?.map((area) => (
                    <details
                        className="area-block"
                        key={area.id}
                        open={expanded}
                    >
                        <summary>
                            <strong>{area.title}</strong>
                            <span className="count-badge">
                                {
                                    goals.data?.filter(
                                        (goal) => goal.area_id === area.id,
                                    ).length
                                }
                            </span>
                        </summary>
                        {goals.data
                            ?.filter(
                                (goal) =>
                                    goal.area_id === area.id &&
                                    !goal.parent_goal_id,
                            )
                            .map(renderGoal)}
                        <button
                            className="text-button"
                            onClick={() =>
                                ctx.open("goals", null, {
                                    area_id: area.id,
                                })
                            }
                        >
                            <span aria-hidden="true">＋</span>{" "}
                            {ctx.text("New goal", "Mục tiêu mới")}
                        </button>
                    </details>
                ))}
                {goals.data
                    ?.filter(
                        (goal) => !goal.area_id && !goal.parent_goal_id,
                    )
                    .map(renderGoal)}
                <button
                    className="button button-quiet"
                    onClick={() => setManage(true)}
                >
                    ＋{" "}
                    {ctx.text(
                        "Add another life area",
                        "Thêm lĩnh vực cuộc sống",
                    )}
                </button>
            </div>
            {manage && (
                <Dialog
                    title={ctx.text("Manage areas", "Quản lý lĩnh vực")}
                    onClose={() => setManage(false)}
                >
                    {areas.data?.map((area) => (
                        <div className="goal-tree-row" key={area.id}>
                            <span className="goal-tree-link">{area.title}</span>
                            <button
                                className="button button-quiet"
                                onClick={() => {
                                    setManage(false);
                                    ctx.open("areas", area);
                                }}
                            >
                                {ctx.text("Edit", "Chỉnh sửa")}
                            </button>
                        </div>
                    ))}
                    <button
                        className="button button-primary"
                        onClick={() => {
                            setManage(false);
                            ctx.open("areas");
                        }}
                    >
                        <span aria-hidden="true">＋</span>{" "}
                        {ctx.text("Add area", "Thêm lĩnh vực")}
                    </button>
                </Dialog>
            )}
        </>
    );
}
