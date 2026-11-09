"use client";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api, type Dashboard, type Entity } from "@/lib/api";
import { localDate } from "@/lib/dates";
import { addDays, monday } from "@/lib/task-views";
import {
    dashboardGoal,
    dashboardHabit,
    dashboardMilestone,
    dashboardTask,
} from "@/lib/dashboard-model";
import { DashboardView } from "./preview/dashboard";
import { ActivityView } from "./preview/reviews";
import type { ActivityFact } from "./preview/workspace-data";
import { update, usePlan } from "./workspace-controls";
import { QueryState, useItems, type PageContext } from "./workspace-context";
import Dialog from "./dialog";

export function DashboardPage({ ctx }: { ctx: PageContext }) {
    const { user, csrf } = ctx.identity;
    const today = localDate(user.timezone);
    const router = useRouter();
    const cache = useQueryClient();
    const dashboard = useQuery({
        queryKey: ["dashboard", user.id, today],
        queryFn: () =>
            api<Dashboard & { focus_goal: Entity | null }>("/dashboard"),
    });
    const tasks = useItems("tasks", user.id),
        goals = useItems("goals", user.id),
        milestones = useItems("milestones", user.id),
        habits = useItems("habits", user.id);
    const plan = usePlan(ctx);
    const days = useQuery<Record<string, { day: string; state: string }[]>>({
        queryKey: [
            "dashboard-habit-days",
            user.id,
            today,
            habits.data?.map((h) => h.id),
        ],
        enabled: !!habits.data,
        queryFn: async ({ signal }) =>
            Object.fromEntries(
                await Promise.all(
                    habits.data!.map(async (habit) => {
                        const end = localDate(habit.timezone || user.timezone);
                        const result = await api<{
                            days: { day: string; state: string }[];
                        }>(
                            `/habits/${habit.id}/days?start=${addDays(end, -365)}&end=${end}`,
                            { signal },
                        );
                        return [habit.id, result.days];
                    }),
                ),
            ),
    });
    const activity = useQuery({
        queryKey: ["dashboard-activity", user.id, today],
        queryFn: () =>
            api<
                {
                    id: string;
                    kind: string;
                    entity_id: string;
                    created_at: string;
                }[]
            >(`/activity?start=${addDays(today, -364)}&end=${today}`),
    });
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState("");
    const mutation = useRef(false);
    const [transition, setTransition] = useState<Entity | null>(null);
    const [acknowledged, setAcknowledged] = useState(false),
        [due, setDue] = useState("");
    async function run(work: () => Promise<unknown>) {
        if (mutation.current) return false;
        mutation.current = true;
        setBusy(true);
        setMessage("");
        try {
            const saved = await ctx.action(work);
            await cache.invalidateQueries({
                predicate: (query) => query.queryKey[0] !== "identity",
            });
            if (saved) {
                setMessage(ctx.text("Changes saved.", "Đã lưu thay đổi."));
            }
            return saved;
        } finally {
            mutation.current = false;
            setBusy(false);
        }
    }
    const queries = [
        dashboard,
        tasks,
        goals,
        milestones,
        habits,
        plan,
        days,
        activity,
    ];
    if (queries.some((query) => query.isPending || query.error))
        return <QueryState locale={ctx.identity.user.locale} queries={queries} />;
    const rows = tasks.data!;
    const taskData = rows.map((row, index) =>
        dashboardTask(
            row,
            index,
            today,
            user.timezone,
            plan.data!,
            user.preferences,
        ),
    );
    const events: ActivityFact[] = activity
        .data!.filter((item) => /^(task|habit|checklist)\./.test(item.kind))
        .map((item) => ({
            id: item.id,
            title: [
                (item.kind === "task.completed"
                    ? "Completed: "
                    : item.kind === "task.reopened"
                      ? "Reopened: "
                      : item.kind === "habit.completed"
                        ? "Checked in: "
                        : item.kind === "habit.undone"
                          ? "Undid check-in: "
                          : "Activity: ") +
                    ([...rows, ...habits.data!].find(
                        (row) => row.id === item.entity_id,
                    )?.title || "—"),
                (item.kind === "task.completed"
                    ? "Hoàn thành: "
                    : item.kind === "task.reopened"
                      ? "Mở lại: "
                      : item.kind === "habit.completed"
                        ? "Điểm danh: "
                        : item.kind === "habit.undone"
                          ? "Bỏ điểm danh: "
                          : "Hoạt động: ") +
                    ([...rows, ...habits.data!].find(
                        (row) => row.id === item.entity_id,
                    )?.title || "—"),
            ],
            kind: item.kind.split(".")[0] as ActivityFact["kind"],
            target: item.entity_id,
            date: localDate(user.timezone, new Date(item.created_at)),
            at: item.created_at,
            reversed: /reopened|undone|cleared/.test(item.kind),
        }));
    const reopen = transition?.status === "done";
    const overdue =
        !!transition?.due_date && transition.due_date < today && reopen;
    const unchecked =
        transition?.checklist?.filter((item) => !item.checked).length || 0;
    return (
        <>
            <div role="status" aria-live="polite">
                {busy ? ctx.text("Saving…", "Đang lưu…") : message}
            </div>
            <div inert={busy} aria-busy={busy}>
                <DashboardView
                    locale={user.locale}
                    text={ctx.text}
                    state="ready"
                    connected
                    today={today}
                    timezone={user.timezone}
                    onReady={ctx.refresh}
                    onNavigate={(section) =>
                        router.push(section === "notes" ? "/" : `/${section}`)
                    }
                    activity={
                        <ActivityView
                            text={ctx.text}
                            today={today}
                            data={{
                                events,
                                locale: user.locale,
                                profile: { timezone: user.timezone },
                            }}
                            onOpen={(fact) =>
                                router.push(
                                    fact.kind === "task"
                                        ? `/tasks/${fact.target}`
                                        : "/habits",
                                )
                            }
                        />
                    }
                    data={{
                        focus: dashboard.data!.focus_goal?.id || "",
                        setFocus: (value) => {
                            const id =
                                typeof value === "function"
                                    ? value(
                                          dashboard.data!.focus_goal?.id || "",
                                      )
                                    : value;
                            void run(() =>
                                api(
                                    "/focus",
                                    {
                                        method: "PUT",
                                        body: JSON.stringify({
                                            goal_id: id || null,
                                        }),
                                    },
                                    csrf,
                                ),
                            );
                        },
                        tasks: taskData,
                        goals: goals.data!.map(dashboardGoal),
                        milestones: milestones.data!.map(dashboardMilestone),
                        habits: habits.data!.map((row) =>
                            dashboardHabit(row, days.data![row.id] || []),
                        ),
                        events,
                        appearance: {
                            theme: user.theme,
                            scene: user.preferences.visual_theme || "mountain",
                            quote: user.preferences.custom_quote || "",
                            showBackground:
                                user.preferences.show_background ?? true,
                            showIllustrations:
                                user.preferences.show_illustrations ?? true,
                            showQuote: user.preferences.show_quote ?? true,
                            accent: "",
                            background: "",
                            backgrounds: [],
                        },
                        setTasks: (value) => {
                            const next =
                                typeof value === "function"
                                    ? value(taskData)
                                    : value;
                            const changes = next.flatMap((task) => {
                                const old = taskData.find(
                                    (item) => item.id === task.id,
                                )!;
                                return (["daily", "weekly"] as const)
                                    .filter(
                                        (period) =>
                                            old[period] !== task[period] &&
                                            !(
                                                period === "weekly" &&
                                                task.daily &&
                                                !old.daily
                                            ),
                                    )
                                    .map((period) => ({
                                        id: rows[task.id].id,
                                        period,
                                        selected: task[period],
                                    }));
                            });
                            void run(async () => {
                                for (const change of changes)
                                    await api(
                                        `/plan/tasks/${change.id}`,
                                        {
                                            method: "PUT",
                                            body: JSON.stringify({
                                                period: change.period,
                                                selected: change.selected,
                                                day:
                                                    change.period === "daily"
                                                        ? today
                                                        : monday(today),
                                            }),
                                        },
                                        csrf,
                                    );
                            });
                        },
                        setTaskAction: (value) => {
                            const action =
                                typeof value === "function"
                                    ? value(null)
                                    : value;
                            if (!action) return;
                            const row =
                                action.id === undefined
                                    ? null
                                    : rows[action.id];
                            if (action.kind === "complete" && row) {
                                setTransition(row);
                                setAcknowledged(false);
                                setDue("");
                            } else
                                ctx.open(
                                    "tasks",
                                    row,
                                    row
                                        ? undefined
                                        : {
                                              plan_for:
                                                  action.draft?.plan === "week"
                                                      ? "weekly"
                                                      : "daily",
                                          },
                                );
                        },
                        setPlanningAction: (value) => {
                            const action =
                                typeof value === "function"
                                    ? value(null)
                                    : value;
                            if (!action?.id) return;
                            const row = milestones.data!.find(
                                (item) => item.id === action.id,
                            );
                            if (row) ctx.open("milestones", row);
                        },
                        navigate: (section, target) =>
                            router.push(
                                target?.goal
                                    ? `/goals/${target.goal}`
                                    : `/${section}`,
                            ),
                        checkHabit: (id, day) => {
                            const checked = days.data![id]?.some(
                                (item) =>
                                    item.day === day && item.state === "done",
                            );
                            void run(() =>
                                api(
                                    `/habits/${id}/checkin`,
                                    {
                                        method: "PUT",
                                        body: JSON.stringify({
                                            day,
                                            state: checked ? "clear" : "done",
                                        }),
                                    },
                                    csrf,
                                ),
                            );
                        },
                    }}
                />
            </div>
            {transition && (
                <Dialog
                    closeLabel={ctx.t.close}
                    title={ctx.text(
                        reopen ? "Reopen this task?" : "Complete this task?",
                        reopen
                            ? "Mở lại công việc này?"
                            : "Hoàn thành công việc này?",
                    )}
                    onClose={() => {
                        if (!busy) setTransition(null);
                    }}
                >
                    <form
                        className="stack-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void run(() =>
                                update(ctx, "tasks", transition, {
                                    status: reopen ? "todo" : "done",
                                    ...(overdue
                                        ? { due_date: due || null }
                                        : {}),
                                }),
                            ).then((saved) => {
                                if (saved) setTransition(null);
                            });
                        }}
                    >
                        <strong>{transition.title}</strong>
                        {!reopen && unchecked > 0 && (
                            <label className="review-checkbox">
                                <input
                                    type="checkbox"
                                    required
                                    checked={acknowledged}
                                    onChange={(event) =>
                                        setAcknowledged(event.target.checked)
                                    }
                                />
                                {ctx.text(
                                    `Complete with ${unchecked} unchecked items. Checklist records stay unchanged.`,
                                    `Hoàn thành với ${unchecked} mục chưa đánh dấu. Giữ nguyên danh sách kiểm tra.`,
                                )}
                            </label>
                        )}
                        {overdue && (
                            <label className="field">
                                {ctx.text(
                                    "New due date (leave empty to clear)",
                                    "Hạn mới (để trống để bỏ hạn cũ)",
                                )}
                                <input
                                    type="date"
                                    min={today}
                                    value={due}
                                    onChange={(event) =>
                                        setDue(event.target.value)
                                    }
                                />
                            </label>
                        )}
                        <div className="action-row">
                            <button
                                className="button button-quiet"
                                type="button"
                                disabled={busy}
                                onClick={() => setTransition(null)}
                            >
                                {ctx.text("Cancel", "Hủy")}
                            </button>
                            <button
                                className="button button-primary"
                                disabled={
                                    busy ||
                                    (!reopen && unchecked > 0 && !acknowledged)
                                }
                            >
                                {ctx.text("Confirm", "Xác nhận")}
                            </button>
                        </div>
                    </form>
                </Dialog>
            )}
        </>
    );
}
