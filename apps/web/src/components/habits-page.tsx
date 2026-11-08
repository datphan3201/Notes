"use client";
import { useState } from "react";
import {
    Empty,
    QueryState,
    Tabs,
    useItems,
    type PageContext,
} from "./workspace-context";
import { HabitCard } from "./workspace-controls";

export function HabitsPage({ ctx }: { ctx: PageContext }) {
    const habits = useItems("habits", ctx.identity.user.id);
    const [tab, setTab] = useState("daily");
    return (
        <>
            <QueryState queries={[habits]} />
            <Tabs
                label={ctx.t.habits}
                value={tab}
                onChange={setTab}
                items={[
                    ["daily", ctx.text("Daily", "Hàng ngày")],
                    ["weekly", ctx.text("Weekly", "Hàng tuần")],
                    ["all", ctx.t.all],
                ]}
            />
            <div className="planning-panel">
                {habits.data
                    ?.filter((row) => tab === "all" || row.frequency === tab)
                    .map((habit) => (
                        <HabitCard key={habit.id} habit={habit} ctx={ctx} />
                    ))}
                {!habits.isPending && !habits.data?.length && (
                    <Empty>{ctx.t.noHabits}</Empty>
                )}
            </div>
        </>
    );
}
