"use client";
import { localDate } from "@/lib/dates";
import { monday } from "@/lib/task-views";
import { useState } from "react";
import {
    Empty,
    QueryState,
    Tabs,
    useItems,
    type PageContext,
} from "./workspace-context";

export function ReviewsPage({ ctx }: { ctx: PageContext }) {
    const reviews = useItems("reviews", ctx.identity.user.id);
    const [period, setPeriod] = useState("daily");
    return (
        <>
            <QueryState queries={[reviews]} />
            <Tabs
                label={ctx.t.reviews}
                value={period}
                onChange={setPeriod}
                items={[
                    ["daily", ctx.text("Daily", "Hàng ngày")],
                    ["weekly", ctx.text("Weekly", "Hàng tuần")],
                    ["monthly", ctx.text("Monthly", "Hàng tháng")],
                ]}
            />
            <section className="planning-panel">
                <div className="section-heading">
                    <h2>{ctx.t.reviews}</h2>
                    <button
                        className="button button-quiet"
                        onClick={() =>
                            ctx.open("reviews", null, {
                                period,
                                period_date:
                                    period === "weekly"
                                        ? monday(
                                              localDate(
                                                  ctx.identity.user.timezone,
                                              ),
                                          )
                                        : period === "monthly"
                                          ? localDate(
                                                ctx.identity.user.timezone,
                                            ).slice(0, 7) + "-01"
                                          : localDate(
                                                ctx.identity.user.timezone,
                                            ),
                            })
                        }
                    >
                        <span aria-hidden="true">＋</span>{" "}
                        {ctx.text("New review", "Bài nhìn lại mới")}
                    </button>
                </div>
                {reviews.data
                    ?.filter((row) => row.period === period)
                    .map((review) => (
                        <article className="goal-tree-row" key={review.id}>
                            <button
                                className="task-row-main"
                                onClick={() => ctx.open("reviews", review)}
                            >
                                <strong>{review.title}</strong>
                                <small>{review.period_date}</small>
                                <p>{review.content.slice(0, 200)}</p>
                            </button>
                        </article>
                    ))}
                {!reviews.isPending &&
                    !reviews.data?.some((row) => row.period === period) && (
                        <Empty>
                            {ctx.text(
                                "No reviews for this period yet.",
                                "Chưa có bài nhìn lại cho kỳ này.",
                            )}
                        </Empty>
                    )}
            </section>
        </>
    );
}
