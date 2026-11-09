"use client";
import { api, type Entity } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
    Empty,
    QueryState,
    Tabs,
    useItems,
    type PageContext,
} from "./workspace-context";
import { TaskRow } from "./workspace-controls";
import GoalFishbone from "./goal-fishbone";

export function RoadmapPage({ ctx, id }: { ctx: PageContext; id: string }) {
    const goal = useQuery({
        queryKey: ["entity", "goals", id],
        queryFn: () => api<Entity>(`/goals/${id}`),
    });
    const milestones = useItems("milestones", ctx.identity.user.id),
        tasks = useItems("tasks", ctx.identity.user.id),
        goals = useItems("goals", ctx.identity.user.id);
    const [tab, setTab] = useState("roadmap");
    const own = milestones.data?.filter((row) => row.goal_id === id) || [];
    return (
        <>
            <QueryState locale={ctx.identity.user.locale} queries={[goal, milestones, tasks]} />
            {goal.data && (
                <>
                    <header className="workspace-header scene-header">
                        <div>
                            <Link href="/goals">← {ctx.t.goals}</Link>
                            <h1>{goal.data.title}</h1>
                            <p>{goal.data.content}</p>
                        </div>
                        <div className="action-row">
                            <button
                                className="button button-quiet"
                                onClick={() => ctx.open("goals", goal.data)}
                            >
                                {ctx.text(
                                    "Goal information",
                                    "Thông tin mục tiêu",
                                )}
                            </button>
                            <button
                                className="button button-primary"
                                onClick={() =>
                                    ctx.open("milestones", null, {
                                        goal_id: id,
                                    })
                                }
                            >
                                <span aria-hidden="true">＋</span>{" "}
                                {ctx.text("New milestone", "Cột mốc mới")}
                            </button>
                        </div>
                    </header>
                    <Tabs
                        label={ctx.text(
                            "Goal sections",
                            "Các mục của mục tiêu",
                        )}
                        value={tab}
                        onChange={setTab}
                        items={[
                            ["roadmap", ctx.text("Roadmap", "Lộ trình")],
                            ["strategy", ctx.text("Strategy", "Chiến lược")],
                            ["tasks", ctx.t.tasks],
                        ]}
                    />
                    {tab === "strategy" ? (
                        <article className="planning-panel">
                            <h2>
                                {ctx.text(
                                    "Expected result",
                                    "Kết quả mong đợi",
                                )}
                            </h2>
                            <p>{goal.data.expected_result || "—"}</p>
                            <h2>
                                {ctx.text(
                                    "Completion criteria",
                                    "Tiêu chí hoàn thành",
                                )}
                            </h2>
                            <p>{goal.data.completion_criteria || "—"}</p>
                            <button
                                className="button button-quiet"
                                onClick={() => ctx.open("goals", goal.data)}
                            >
                                {ctx.text("Edit strategy", "Sửa chiến lược")}
                            </button>
                        </article>
                    ) : tab === "roadmap" ? (
                        <GoalFishbone
                            ctx={ctx}
                            goal={{
                                ...goal.data,
                                progress: goals.data?.find(
                                    (row) => row.id === id,
                                )?.progress,
                            }}
                            milestones={own}
                            tasks={tasks.data || []}
                        />
                    ) : (
                        <section className="planning-panel">
                            {tasks.data
                                ?.filter(
                                    (task) =>
                                        task.goal_id === id ||
                                        own.some(
                                            (milestone) =>
                                                milestone.id ===
                                                task.milestone_id,
                                        ),
                                )
                                .map((task) => (
                                    <TaskRow
                                        key={task.id}
                                        task={task}
                                        ctx={ctx}
                                        compact
                                    />
                                ))}
                            <button
                                className="button button-quiet"
                                onClick={() =>
                                    ctx.open("tasks", null, { goal_id: id })
                                }
                            >
                                <span aria-hidden="true">＋</span>{" "}
                                {ctx.text("Add task", "Thêm công việc")}
                            </button>
                        </section>
                    )}
                    {goals.data
                        ?.filter((child) => child.parent_goal_id === id)
                        .map((child) => (
                            <Link
                                className="goal-tree-row"
                                href={`/goals/${child.id}`}
                                key={child.id}
                            >
                                {child.title} →
                            </Link>
                        ))}
                </>
            )}
        </>
    );
}
