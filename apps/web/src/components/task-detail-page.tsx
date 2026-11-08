"use client";
import { api, type Entity } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { QueryState, type PageContext } from "./workspace-context";
import { update } from "./workspace-controls";
import NoteDocument from "./note-document";

export function TaskDetailPage({ ctx, id }: { ctx: PageContext; id: string }) {
    const task = useQuery({
        queryKey: ["entity", "tasks", id],
        queryFn: () => api<Entity>(`/tasks/${id}`),
    });
    const [working, setWorking] = useState<string | null>(null),
        [saved, setSaved] = useState(false);
    return (
        <>
            <QueryState queries={[task]} />
            {task.data && (
                <>
                    <header className="workspace-header scene-header">
                        <div>
                            <Link href="/tasks">← {ctx.t.tasks}</Link>
                            <h1>{task.data.title}</h1>
                            <p>{task.data.content}</p>
                        </div>
                        <button
                            className="button button-primary"
                            onClick={() => ctx.open("tasks", task.data)}
                        >
                            {ctx.text("Edit task", "Sửa công việc")}
                        </button>
                    </header>
                    <section className="planning-panel">
                        <h2>
                            {ctx.text(
                                "Completion criteria",
                                "Tiêu chí hoàn thành",
                            )}
                        </h2>
                        <p>{task.data.completion_criteria || "—"}</p>
                        {task.data.checklist?.map((item, index) => (
                            <label className="check-row" key={index}>
                                <input
                                    type="checkbox"
                                    checked={item.checked}
                                    onChange={() =>
                                        void ctx.action(() =>
                                            update(ctx, "tasks", task.data!, {
                                                checklist:
                                                    task.data!.checklist!.map(
                                                        (row, i) =>
                                                            i === index
                                                                ? {
                                                                      ...row,
                                                                      checked:
                                                                          !row.checked,
                                                                  }
                                                                : row,
                                                    ),
                                            }),
                                        )
                                    }
                                />
                                {item.text}
                            </label>
                        ))}
                    </section>
                    <form
                        className="planning-panel stack-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void ctx.action(async () => {
                                await update(ctx, "tasks", task.data!, {
                                    working_note:
                                        working ??
                                        task.data!.working_note ??
                                        "",
                                });
                                setSaved(true);
                            });
                        }}
                    >
                        <section>
                            <span>
                                {ctx.text("Working note", "Ghi chép công việc")}
                            </span>
                            <NoteDocument
                                value={working ?? task.data.working_note ?? ""}
                                label={ctx.text(
                                    "Working note",
                                    "Ghi chép công việc",
                                )}
                                onChange={(value) => {
                                    setWorking(value);
                                    setSaved(false);
                                }}
                            />
                        </section>
                        <button className="button button-primary">
                            {ctx.t.save}
                        </button>
                        {saved && <p role="status">{ctx.t.saved}</p>}
                    </form>
                </>
            )}
        </>
    );
}
