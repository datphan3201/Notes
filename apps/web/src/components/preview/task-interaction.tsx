"use client";
import { useEffect, useState } from "react";
import TaskPreviewEditor from "./task-editor";
import {
    blankDraft,
    demoToday as fixtureToday,
    draftFromRecord,
    recordFromDraft,
    updateFromDraft,
} from "./task-data";
import { usePreviewData } from "./workspace-data";
import { Confirm, Field } from "./ui";
import type { Text } from "./shared";
export default function SharedTaskInteraction({ text }: { text: Text }) {
    const db = usePreviewData();
    const demoToday = db.today || fixtureToday;
    const action = db.taskAction;
    const task = db.tasks.find((task) => task.id === action?.id);
    const [ack, setAck] = useState(false);
    const [due, setDue] = useState("");
    useEffect(() => {
        setAck(false);
        setDue("");
    }, [action]);
    if (!action) return null;
    const close = () => db.setTaskAction(null);
    const parents = db.goals
        .filter((goal) => goal.status === "Done")
        .map((goal) => goal.id);
    if (action.kind === "complete" && task) {
        const reopen = task.status === "Done",
            past = reopen && !!task.due && task.due < demoToday,
            closed =
                reopen &&
                parents.includes(
                    db.parents.find((parent) => parent.id === task.parent)!
                        .goal,
                ),
            unchecked = task.checklist.filter((item) => !item.checked).length;
        return (
            <Confirm
                text={text}
                title={text(
                    reopen ? "Reopen this task?" : "Complete this task?",
                    reopen
                        ? "Mở lại công việc này?"
                        : "Hoàn thành công việc này?",
                )}
                onClose={close}
                disabled={((!reopen && unchecked > 0) || closed) && !ack}
                onConfirm={() => {
                    db.live?.acknowledge(
                        ack ? [reopen ? "reopen_parents" : "unchecked"] : [],
                    );
                    db.setTasks((items) =>
                        items.map((row) =>
                            row.id === task.id
                                ? {
                                      ...row,
                                      status: reopen ? "NotStarted" : "Done",
                                      due: past ? due : row.due,
                                  }
                                : row,
                        ),
                    );
                    if (closed) {
                        const id = db.parents.find(
                            (parent) => parent.id === task.parent,
                        )!.goal;
                        db.setGoals((goals) =>
                            goals.map((goal) =>
                                goal.id === id
                                    ? { ...goal, status: "NotStarted" }
                                    : goal,
                            ),
                        );
                    }
                    db.setMessage(
                        text(
                            reopen
                                ? db.live
                                    ? "Task reopened."
                                    : "Task reopened in this preview."
                                : "Task completed. Checklist records are unchanged.",
                            reopen
                                ? db.live
                                    ? "Đã mở lại công việc."
                                    : "Đã mở lại công việc trong bản xem thử."
                                : "Đã hoàn thành công việc. Danh sách kiểm tra được giữ nguyên.",
                        ),
                    );
                    close();
                }}
            >
                <strong>{text(...task.title)}</strong>
                {!reopen && unchecked > 0 && (
                    <>
                        <p>
                            {unchecked}{" "}
                            {text(
                                "items remain unchecked. They will not be checked automatically.",
                                "mục chưa được đánh dấu và sẽ không tự được đánh dấu.",
                            )}
                        </p>
                        <label className="review-checkbox">
                            <input
                                type="checkbox"
                                checked={ack}
                                onChange={(event) =>
                                    setAck(event.target.checked)
                                }
                            />
                            {text(
                                "Complete with these items unchecked.",
                                "Hoàn thành dù còn các mục chưa đánh dấu.",
                            )}
                        </label>
                    </>
                )}
                {past && (
                    <Field
                        label={text(
                            "New due date (leave empty to clear)",
                            "Hạn mới (để trống để bỏ hạn cũ)",
                        )}
                        hint={text(
                            "The old due date is in the past.",
                            "Hạn cũ đã qua.",
                        )}
                    >
                        <input
                            type="date"
                            min={demoToday}
                            value={due}
                            onChange={(event) => setDue(event.target.value)}
                        />
                    </Field>
                )}
                {closed && (
                    <label className="review-checkbox">
                        <input
                            type="checkbox"
                            checked={ack}
                            onChange={(event) => setAck(event.target.checked)}
                        />
                        {text(
                            "Also reopen the completed parent Goal.",
                            "Cùng mở lại mục tiêu cha đã hoàn thành.",
                        )}
                    </label>
                )}
            </Confirm>
        );
    }
    const initial =
        action.draft || (task ? draftFromRecord(task, text) : blankDraft());
    if (db.today && !task && initial.rule.start === fixtureToday)
        initial.rule.start = db.today;
    return (
        <TaskPreviewEditor
            key={`${action.kind}-${action.id || "new"}`}
            initial={initial}
            mode={action.kind === "edit" ? "edit" : "create"}
            locale={db.locale}
            text={text}
            completedParents={parents}
            onClose={close}
            onSave={async (draft) => {
                if (task && action.kind === "edit")
                    db.setTasks((items) =>
                        items.map((row) =>
                            row.id === task.id
                                ? updateFromDraft(row, draft)
                                : row,
                        ),
                    );
                else if (draft.rule.frequency !== "none") {
                    const id = Date.now();
                    db.setSeries((items) => [
                        ...items,
                        {
                            id,
                            template: recordFromDraft(draft, id),
                            rule: draft.rule,
                            state: "active",
                        },
                    ]);
                } else
                    db.setTasks((items) => [
                        ...items,
                        recordFromDraft(draft, Date.now()),
                    ]);
                db.setMessage(
                    db.live
                        ? text("Saving…", "Đang lưu…")
                        : text(
                              "Saved in this preview.",
                              "Đã lưu trong bản xem thử.",
                          ),
                );
                if (db.live && !(await db.live.flush())) return false;
                close();
            }}
        />
    );
}
