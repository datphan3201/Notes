"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Archive,
    Check,
    FilePlus2,
    LockKeyhole,
    Plus,
    Share2,
    Trash2,
} from "lucide-react";
import {
    api,
    type Collection,
    type Entity,
    type Identity,
    type Kind,
} from "@/lib/api";
import { translate, type Words } from "@/lib/i18n";
import { localDate, zonedInput, zonedInstant } from "@/lib/dates";
import Dialog from "./dialog";
import NoteDocument from "./note-document";

function initial(
    kind: Kind,
    row: Entity | null,
    identity: Identity,
): Record<string, unknown> {
    const keys: Record<Kind, string[]> = {
        areas: [],
        goals: [
            "area_id",
            "parent_goal_id",
            "start_date",
            "due_date",
            "status",
            "expected_result",
            "completion_criteria",
        ],
        milestones: [
            "goal_id",
            "start_date",
            "due_date",
            "status",
            "completion_criteria",
        ],
        tasks: [
            "goal_id",
            "milestone_id",
            "status",
            "start_date",
            "due_date",
            "scheduled_at",
            "scheduled_end",
            "reminder_at",
            "estimated_minutes",
            "checklist",
            "working_note",
        ],
        notes: ["pinned", "tags", "goal_id", "task_id", "color"],
        habits: ["timezone", "frequency", "target"],
        reviews: ["period", "period_date"],
        "task-series": [
            "frequency",
            "interval_count",
            "weekdays",
            "start_date",
            "end_date",
            "timezone",
            "state",
        ],
    };
    const base: Record<string, unknown> = {
        title: row?.title || "",
        content: row?.content || "",
        importance: row?.importance || 3,
    };
    if (row) for (const key of keys[kind]) base[key] = row[key as keyof Entity];
    else if (kind === "tasks")
        Object.assign(base, {
            status: "todo",
            checklist: [],
            working_note: "",
        });
    else if (kind === "habits")
        Object.assign(base, {
            timezone: identity.user.timezone,
            frequency: "daily",
            target: 1,
        });
    else if (kind === "reviews")
        Object.assign(base, {
            period: "daily",
            period_date: localDate(identity.user.timezone),
        });
    else if (kind === "task-series")
        Object.assign(base, {
            timezone: identity.user.timezone,
            frequency: "daily",
            interval_count: 1,
            weekdays: [],
            start_date: localDate(identity.user.timezone),
            state: "active",
        });
    return base;
}

export default function Editor({
    kind,
    row: incomingRow,
    identity,
    t,
    onClose,
    onSaved,
    initialValues,
}: {
    kind: Kind;
    row: Entity | null;
    identity: Identity;
    t: Words;
    onClose: () => void;
    onSaved: () => void;
    initialValues?: Record<string, unknown>;
}) {
    const [created, setCreated] = useState<Entity | null>(null);
    const row = incomingRow || created;
    const [draft, setDraft] = useState(() => ({
        ...initial(kind, row, identity),
        ...(!row ? initialValues : {}),
    }));
    const current = useRef(row);
    const lastSaved = useRef(JSON.stringify(draft));
    const busy = useRef(false);
    const mounted = useRef(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [conflict, setConflict] = useState(false);
    const [saved, setSaved] = useState(false);
    const [share, setShare] = useState("");
    const [notePassword, setNotePassword] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [checkText, setCheckText] = useState("");
    const [tagsText, setTagsText] = useState((row?.tags || []).join(", "));
    const [includeContents, setIncludeContents] = useState(false);
    const [leave, setLeave] = useState(false);
    const [dependencyIds, setDependencyIds] = useState("");
    const [recovery, setRecovery] = useState<{
        fields: Record<string, unknown>;
        id: string | null;
        version: number | null;
    } | null>(null);
    const [recoveryChecked, setRecoveryChecked] = useState(false);
    const recoveryKey = `planner-draft:${identity.user.id}:${kind}:${incomingRow?.id || "new"}`;
    const text = (message: string) => translate(message, identity.user.locale);
    const kindName = {
        areas: "Area",
        goals: "Goal",
        milestones: "Milestone",
        tasks: "Task",
        notes: "Note",
        habits: "Habit",
        reviews: "Review",
        "task-series": "Repeating task",
    }[kind];
    const displayValue = (value: string) =>
        text(
            (
                {
                    todo: "Not started",
                    doing: "In progress",
                    blocked: "Blocked",
                    done: "Completed",
                    completed: "Completed",
                    active: "Active",
                    paused: "Paused",
                    ended: "Ended",
                    daily: "Daily",
                    weekly: "Weekly",
                    monthly: "Monthly",
                    yearly: "Yearly",
                } as Record<string, string>
            )[value] || value,
        );
    useEffect(() => {
        try {
            const saved = JSON.parse(
                sessionStorage.getItem(recoveryKey) || "null",
            );
            if (
                saved &&
                saved.fields &&
                typeof saved.fields.title === "string" &&
                typeof saved.fields.content === "string" &&
                (saved.id === null || typeof saved.id === "string") &&
                (saved.version === null || Number.isInteger(saved.version)) &&
                JSON.stringify(saved.fields) !== lastSaved.current
            )
                setRecovery(saved);
        } catch {
            /* Storage may be unavailable; saving remains server-authoritative. */
        } finally {
            setRecoveryChecked(true);
        }
    }, [recoveryKey]);
    useEffect(() => {
        if (!recoveryChecked || recovery) return;
        const dirty = JSON.stringify(draft) !== lastSaved.current;
        try {
            if (dirty)
                sessionStorage.setItem(
                    recoveryKey,
                    JSON.stringify({
                        fields: draft,
                        id: current.current?.id || null,
                        version: current.current?.version || null,
                    }),
                );
            else sessionStorage.removeItem(recoveryKey);
        } catch {
            /* A disabled local store must not prevent an ordinary save. */
        }
        if (!dirty) return;
        const guard = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", guard);
        return () => window.removeEventListener("beforeunload", guard);
    }, [draft, recovery, recoveryChecked, recoveryKey, saving]);
    const needsRelations = ["goals", "milestones", "tasks", "notes"].includes(
        kind,
    );
    const areas = useQuery({
        queryKey: ["areas", "editor"],
        queryFn: () => api<Collection>("/areas?size=100"),
        enabled: kind === "goals",
    });
    const goals = useQuery({
        queryKey: ["goals", "editor"],
        queryFn: () => api<Collection>("/goals?size=100"),
        enabled: needsRelations,
    });
    const milestones = useQuery({
        queryKey: ["milestones", "editor"],
        queryFn: () => api<Collection>("/milestones?size=100"),
        enabled: ["tasks", "milestones"].includes(kind),
    });
    const files = useQuery({
        queryKey: ["attachments", row?.id],
        queryFn: () =>
            api<{ id: string; filename: string; size: number }[]>(
                `/notes/${row!.id}/attachments`,
            ),
        enabled: kind === "notes" && !!row,
    });
    const [shareEdit, setShareEdit] = useState(false);
    const shares = useQuery({
        queryKey: ["note-shares", row?.id],
        queryFn: () =>
            api<
                { id: string; name: string; email: string; can_edit: boolean }[]
            >(`/notes/${row!.id}/share`),
        enabled: kind === "notes" && !!row && !row.shared,
    });
    const prerequisites = useQuery({
        queryKey: ["prerequisites", row?.id],
        queryFn: () => api<string[]>(`/milestones/${row!.id}/prerequisites`),
        enabled: kind === "milestones" && !!row,
    });
    useEffect(() => {
        if (prerequisites.data) setDependencyIds(prerequisites.data.join(","));
    }, [prerequisites.data]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);
    const field = (name: string, value: unknown) => {
        setDraft((previous) => ({ ...previous, [name]: value }));
        setSaved(false);
    };

    const save = useCallback(
        async (value: Record<string, unknown>, close = false) => {
            if (busy.current || !String(value.title || "").trim() || conflict)
                return false;
            busy.current = true;
            setSaving(true);
            setError("");
            try {
                const existing = current.current;
                const updated = existing
                    ? await api<Entity>(
                          `/${kind}/${existing.id}`,
                          {
                              method: "PATCH",
                              body: JSON.stringify({
                                  version: existing.version,
                                  fields:
                                      kind === "notes" && row?.shared
                                          ? {
                                                title: value.title,
                                                content: value.content,
                                            }
                                          : value,
                              }),
                          },
                          identity.csrf,
                      )
                    : await api<Entity>(
                          `/${kind}`,
                          { method: "POST", body: JSON.stringify(value) },
                          identity.csrf,
                      );
                current.current = updated;
                lastSaved.current = JSON.stringify(value);
                try {
                    if (
                        JSON.stringify(
                            JSON.parse(
                                sessionStorage.getItem(recoveryKey) || "null",
                            )?.fields,
                        ) === lastSaved.current
                    )
                        sessionStorage.removeItem(recoveryKey);
                } catch {
                    /* Optional local recovery. */
                }
                onSaved();
                if (mounted.current) {
                    if (!incomingRow) setCreated(updated);
                    setSaved(true);
                    if (close) onClose();
                }
                return true;
            } catch (err) {
                if (mounted.current) {
                    setError((err as Error).message);
                    if ((err as { status?: number }).status === 409)
                        setConflict(true);
                }
                return false;
            } finally {
                busy.current = false;
                if (mounted.current) setSaving(false);
            }
        },
        [kind, identity.csrf, onSaved, onClose, conflict, recoveryKey],
    );

    useEffect(() => {
        if (
            kind !== "notes" ||
            recovery ||
            JSON.stringify(draft) === lastSaved.current ||
            !String(draft.title).trim() ||
            conflict
        )
            return;
        const timer = setTimeout(() => {
            void save(draft);
        }, 700);
        return () => clearTimeout(timer);
    }, [draft, kind, save, conflict, saving, recovery]);

    async function close() {
        if (saving) return;
        if (JSON.stringify(draft) !== lastSaved.current) {
            if (kind !== "notes") {
                setLeave(true);
                return;
            }
            if (conflict || !(await save(draft))) return;
        }
        onClose();
    }
    async function run(action: () => Promise<unknown>) {
        setError("");
        try {
            await action();
            onSaved();
        } catch (err) {
            setError((err as Error).message);
        }
    }
    function selectRelation(
        label: string,
        name: string,
        rows: Entity[],
        clears?: string,
    ) {
        return (
            <label>
                {label}
                <select
                    aria-label={label}
                    disabled={kind === "notes" && row?.shared}
                    value={String(draft[name] || "")}
                    onChange={(event) => {
                        field(name, event.target.value || null);
                        if (clears) field(clears, null);
                    }}
                >
                    <option value="">—</option>
                    {rows
                        .filter((item) => item.id !== row?.id)
                        .map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.title}
                            </option>
                        ))}
                </select>
            </label>
        );
    }
    const dated = ["goals", "milestones", "tasks"].includes(kind);
    function scheduleField(name: string, value: string) {
        try {
            field(name, zonedInstant(value, identity.user.timezone));
            setError("");
        } catch (err) {
            setError((err as Error).message);
        }
    }
    return (
        <>
            <Dialog
                title={
                    row
                        ? `${t.details} · ${text(kindName)}`
                        : text(`New ${kindName.toLowerCase()}`)
                }
                onClose={() => {
                    void close();
                }}
                wide
            >
                {recovery && (
                    <section className="draft-recovery" role="status">
                        <p>{text("A recovered draft is available.")}</p>
                        <button
                            className="secondary"
                            onClick={() => {
                                void run(async () => {
                                    if (recovery.id) {
                                        const fresh = await api<Entity>(
                                            `/${kind}/${recovery.id}`,
                                        );
                                        current.current = {
                                            ...fresh,
                                            version:
                                                recovery.version ||
                                                fresh.version,
                                        };
                                    }
                                    setDraft(recovery.fields);
                                    setTagsText(
                                        Array.isArray(recovery.fields.tags)
                                            ? recovery.fields.tags.join(", ")
                                            : "",
                                    );
                                    setRecovery(null);
                                });
                            }}
                        >
                            {text("Restore draft")}
                        </button>
                        <button
                            className="secondary"
                            onClick={() => {
                                setRecovery(null);
                                try {
                                    sessionStorage.removeItem(recoveryKey);
                                } catch {
                                    /* Optional local recovery. */
                                }
                            }}
                        >
                            {text("Use saved version")}
                        </button>
                    </section>
                )}
                <form
                    inert={
                        !!recovery ||
                        (kind === "notes" && row?.can_edit === false)
                    }
                    className="editor"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save(draft, kind !== "notes");
                    }}
                >
                    <label>
                        {t.title}
                        <input
                            autoFocus
                            value={String(draft.title)}
                            required
                            maxLength={300}
                            onChange={(event) =>
                                field("title", event.target.value)
                            }
                        />
                    </label>
                    {kind === "notes" ? (
                        <section>
                            <span>{t.content}</span>
                            <NoteDocument
                                value={String(draft.content)}
                                label={t.content}
                                onChange={(value) => field("content", value)}
                                readOnly={row?.can_edit === false}
                            />
                        </section>
                    ) : (
                        <label>
                            {t.content}
                            <textarea
                                value={String(draft.content)}
                                maxLength={100000}
                                rows={4}
                                onChange={(event) =>
                                    field("content", event.target.value)
                                }
                            />
                        </label>
                    )}
                    {dated && (
                        <label>
                            {text("Completion criteria")}
                            <textarea
                                rows={2}
                                value={String(draft.completion_criteria || "")}
                                onChange={(e) =>
                                    field("completion_criteria", e.target.value)
                                }
                            />
                        </label>
                    )}
                    {["goals", "tasks"].includes(kind) && (
                        <label>
                            {text("Expected result")}
                            <textarea
                                rows={2}
                                value={String(draft.expected_result || "")}
                                onChange={(e) =>
                                    field("expected_result", e.target.value)
                                }
                            />
                        </label>
                    )}
                    {["goals", "milestones"].includes(kind) && (
                        <label>
                            {t.status}
                            <select
                                value={String(
                                    draft.status ||
                                        (kind === "goals" ? "active" : "todo"),
                                )}
                                onChange={(e) =>
                                    field("status", e.target.value)
                                }
                            >
                                {(kind === "goals"
                                    ? ["active", "completed"]
                                    : ["todo", "doing", "done"]
                                ).map((status) => (
                                    <option key={status} value={status}>
                                        {displayValue(status)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    )}
                    {kind === "notes" && !row?.shared && (
                        <div className="form-row">
                            <label>
                                {identity.user.locale === "vi"
                                    ? "Màu ghi chú"
                                    : "Note color"}
                                <select
                                    value={String(draft.color || "neutral")}
                                    onChange={(event) =>
                                        field("color", event.target.value)
                                    }
                                >
                                    {[
                                        ["neutral", "Neutral", "Trung tính"],
                                        ["lemon", "Lemon", "Vàng chanh"],
                                        ["mint", "Mint", "Xanh bạc hà"],
                                        ["sky", "Sky", "Xanh trời"],
                                        ["rose", "Rose", "Hồng"],
                                    ].map(([key, en, vi]) => (
                                        <option key={key} value={key}>
                                            {identity.user.locale === "vi"
                                                ? vi
                                                : en}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="inline">
                                <input
                                    type="checkbox"
                                    checked={!!draft.pinned}
                                    onChange={(event) =>
                                        field("pinned", event.target.checked)
                                    }
                                />
                                {text("Pin")}
                            </label>
                            <label>
                                {text("Tags")}
                                <input
                                    value={tagsText}
                                    onChange={(event) => {
                                        setTagsText(event.target.value);
                                        field(
                                            "tags",
                                            event.target.value
                                                .split(",")
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                        );
                                    }}
                                />
                            </label>
                        </div>
                    )}
                    <div className="form-row">
                        <label>
                            {t.importance}
                            <select
                                disabled={kind === "notes" && row?.shared}
                                value={Number(draft.importance)}
                                onChange={(event) =>
                                    field(
                                        "importance",
                                        Number(event.target.value),
                                    )
                                }
                            >
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <option key={value}>{value}</option>
                                ))}
                            </select>
                        </label>
                        {kind === "tasks" && (
                            <label>
                                {t.status}
                                <select
                                    value={String(draft.status)}
                                    onChange={(event) =>
                                        field("status", event.target.value)
                                    }
                                >
                                    <option value="todo">
                                        {text("To do")}
                                    </option>
                                    <option value="doing">
                                        {text("In progress")}
                                    </option>
                                    <option value="blocked">
                                        {text("Blocked")}
                                    </option>
                                    <option value="done">
                                        {text("Completed")}
                                    </option>
                                </select>
                            </label>
                        )}
                    </div>
                    {kind === "goals" && (
                        <div className="form-row">
                            {selectRelation(
                                "Area",
                                "area_id",
                                areas.data?.items || [],
                                "parent_goal_id",
                            )}
                            {selectRelation(
                                t.goals,
                                "parent_goal_id",
                                goals.data?.items || [],
                                "area_id",
                            )}
                        </div>
                    )}
                    {["milestones", "tasks", "notes"].includes(kind) &&
                        selectRelation(
                            t.goals,
                            "goal_id",
                            goals.data?.items || [],
                            kind === "tasks" ? "milestone_id" : "task_id",
                        )}
                    {kind === "tasks" &&
                        selectRelation(
                            t.milestones,
                            "milestone_id",
                            milestones.data?.items || [],
                            "goal_id",
                        )}
                    {dated && (
                        <div className="form-row">
                            <label>
                                {t.start}
                                <input
                                    type="date"
                                    value={String(draft.start_date || "")}
                                    onChange={(event) =>
                                        field(
                                            "start_date",
                                            event.target.value || null,
                                        )
                                    }
                                />
                            </label>
                            <label>
                                {t.due}
                                <input
                                    type="date"
                                    value={String(draft.due_date || "")}
                                    onChange={(event) =>
                                        field(
                                            "due_date",
                                            event.target.value || null,
                                        )
                                    }
                                />
                            </label>
                        </div>
                    )}
                    {kind === "tasks" && (
                        <>
                            {!row && (
                                <label>
                                    {identity.user.locale === "vi"
                                        ? "Lên kế hoạch cho"
                                        : "Plan for"}
                                    <select
                                        value={String(draft.plan_for || "none")}
                                        onChange={(event) =>
                                            field(
                                                "plan_for",
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="none">
                                            {identity.user.locale === "vi"
                                                ? "Quyết định sau"
                                                : "Decide later"}
                                        </option>
                                        <option value="daily">{t.today}</option>
                                        <option value="weekly">{t.week}</option>
                                    </select>
                                </label>
                            )}
                            <label>
                                {text("Schedule (")}
                                {identity.user.timezone})
                                <input
                                    type="datetime-local"
                                    value={zonedInput(
                                        draft.scheduled_at as string,
                                        identity.user.timezone,
                                    )}
                                    onChange={(event) =>
                                        scheduleField(
                                            "scheduled_at",
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                            <label>
                                {identity.user.locale === "vi"
                                    ? "Kết thúc lịch"
                                    : "Scheduled end"}{" "}
                                ({identity.user.timezone})
                                <input
                                    type="datetime-local"
                                    value={zonedInput(
                                        draft.scheduled_end as string,
                                        identity.user.timezone,
                                    )}
                                    onChange={(event) =>
                                        scheduleField(
                                            "scheduled_end",
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                            <label>
                                {text("Reminder (")}
                                {identity.user.timezone})
                                <input
                                    type="datetime-local"
                                    value={zonedInput(
                                        draft.reminder_at as string,
                                        identity.user.timezone,
                                    )}
                                    onChange={(event) =>
                                        scheduleField(
                                            "reminder_at",
                                            event.target.value,
                                        )
                                    }
                                />
                            </label>
                            <label>
                                {text("Estimate (minutes)")}
                                <input
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={String(
                                        draft.estimated_minutes || "",
                                    )}
                                    onChange={(event) =>
                                        field(
                                            "estimated_minutes",
                                            event.target.value
                                                ? Number(event.target.value)
                                                : null,
                                        )
                                    }
                                />
                            </label>
                            <fieldset>
                                <legend>{text("Checklist")}</legend>
                                {(
                                    (draft.checklist as {
                                        text: string;
                                        checked: boolean;
                                    }[]) || []
                                ).map((item, index, items) => (
                                    <div className="check-item" key={index}>
                                        <input
                                            aria-label={item.text}
                                            type="checkbox"
                                            checked={item.checked}
                                            onChange={(event) =>
                                                field(
                                                    "checklist",
                                                    items.map((c, i) =>
                                                        i === index
                                                            ? {
                                                                  ...c,
                                                                  checked:
                                                                      event
                                                                          .target
                                                                          .checked,
                                                              }
                                                            : c,
                                                    ),
                                                )
                                            }
                                        />
                                        <span>{item.text}</span>
                                        <button
                                            type="button"
                                            className="icon-button"
                                            aria-label="Remove item"
                                            onClick={() =>
                                                field(
                                                    "checklist",
                                                    items.filter(
                                                        (_, i) => i !== index,
                                                    ),
                                                )
                                            }
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                                <div className="form-row">
                                    <input
                                        aria-label="Checklist item"
                                        value={checkText}
                                        onChange={(e) =>
                                            setCheckText(e.target.value)
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="secondary"
                                        aria-label="Add checklist item"
                                        onClick={() => {
                                            if (checkText.trim()) {
                                                field("checklist", [
                                                    ...((draft.checklist as object[]) ||
                                                        []),
                                                    {
                                                        text: checkText,
                                                        checked: false,
                                                    },
                                                ]);
                                                setCheckText("");
                                            }
                                        }}
                                    >
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </fieldset>
                            <label>
                                {text("Working note")}
                                <textarea
                                    rows={5}
                                    value={String(draft.working_note || "")}
                                    onChange={(e) =>
                                        field("working_note", e.target.value)
                                    }
                                />
                            </label>
                        </>
                    )}
                    {kind === "habits" && (
                        <>
                            <label>
                                {t.timezone}
                                <input
                                    value={String(draft.timezone)}
                                    onChange={(event) =>
                                        field("timezone", event.target.value)
                                    }
                                />
                            </label>
                            <div className="form-row">
                                <label>
                                    {text("Frequency")}
                                    <select
                                        value={String(draft.frequency)}
                                        onChange={(event) =>
                                            field(
                                                "frequency",
                                                event.target.value,
                                            )
                                        }
                                    >
                                        <option value="daily">
                                            {text("Daily")}
                                        </option>
                                        <option value="weekly">
                                            {text("Weekly")}
                                        </option>
                                    </select>
                                </label>
                                <label>
                                    {text("Target")}
                                    <input
                                        type="number"
                                        min={1}
                                        max={7}
                                        value={Number(draft.target)}
                                        onChange={(event) =>
                                            field(
                                                "target",
                                                Number(event.target.value),
                                            )
                                        }
                                    />
                                </label>
                            </div>
                        </>
                    )}
                    {kind === "reviews" && (
                        <div className="form-row">
                            <label>
                                {text("Period")}
                                <select
                                    value={String(draft.period)}
                                    onChange={(event) =>
                                        field("period", event.target.value)
                                    }
                                >
                                    {["daily", "weekly", "monthly"].map((p) => (
                                        <option key={p} value={p}>
                                            {displayValue(p)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                {text("Date")}
                                <input
                                    type="date"
                                    required
                                    value={String(draft.period_date)}
                                    onChange={(event) =>
                                        field("period_date", event.target.value)
                                    }
                                />
                            </label>
                        </div>
                    )}
                    {kind === "task-series" && (
                        <>
                            <div className="form-row">
                                <label>
                                    {text("Frequency")}
                                    <select
                                        value={String(draft.frequency)}
                                        onChange={(event) => {
                                            field(
                                                "frequency",
                                                event.target.value,
                                            );
                                            field(
                                                "weekdays",
                                                event.target.value === "weekly"
                                                    ? [1]
                                                    : [],
                                            );
                                        }}
                                    >
                                        {[
                                            "daily",
                                            "weekly",
                                            "monthly",
                                            "yearly",
                                        ].map((v) => (
                                            <option key={v} value={v}>
                                                {displayValue(v)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    {text("Every")}
                                    <input
                                        type="number"
                                        min={1}
                                        max={52}
                                        value={Number(draft.interval_count)}
                                        onChange={(e) =>
                                            field(
                                                "interval_count",
                                                Number(e.target.value),
                                            )
                                        }
                                    />
                                </label>
                            </div>
                            {draft.frequency === "weekly" && (
                                <fieldset>
                                    <legend>{text("Weekdays")}</legend>
                                    <div className="action-row">
                                        {[
                                            "Monday",
                                            "Tuesday",
                                            "Wednesday",
                                            "Thursday",
                                            "Friday",
                                            "Saturday",
                                            "Sunday",
                                        ].map((label, index) => (
                                            <label
                                                className="check-row"
                                                key={label}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={(
                                                        draft.weekdays as number[]
                                                    ).includes(index + 1)}
                                                    onChange={(event) => {
                                                        const days = new Set(
                                                            draft.weekdays as number[],
                                                        );
                                                        if (
                                                            event.target.checked
                                                        )
                                                            days.add(index + 1);
                                                        else
                                                            days.delete(
                                                                index + 1,
                                                            );
                                                        field(
                                                            "weekdays",
                                                            [...days].sort(
                                                                (a, b) => a - b,
                                                            ),
                                                        );
                                                    }}
                                                />
                                                {text(label)}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>
                            )}
                            <div className="form-row">
                                <label>
                                    {t.start}
                                    <input
                                        type="date"
                                        value={String(draft.start_date)}
                                        onChange={(e) =>
                                            field("start_date", e.target.value)
                                        }
                                    />
                                </label>
                                <label>
                                    {text("End")}
                                    <input
                                        type="date"
                                        value={String(draft.end_date || "")}
                                        onChange={(e) =>
                                            field(
                                                "end_date",
                                                e.target.value || null,
                                            )
                                        }
                                    />
                                </label>
                            </div>
                            <label>
                                {t.timezone}
                                <input
                                    value={String(draft.timezone)}
                                    onChange={(e) =>
                                        field("timezone", e.target.value)
                                    }
                                />
                            </label>
                            <label>
                                {t.status}
                                <select
                                    value={String(draft.state)}
                                    onChange={(e) =>
                                        field("state", e.target.value)
                                    }
                                >
                                    {["active", "paused", "ended"].map((v) => (
                                        <option key={v} value={v}>
                                            {displayValue(v)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </>
                    )}
                    {error && (
                        <p className="error" role="alert">
                            {error}
                        </p>
                    )}
                    {conflict && (
                        <div className="conflict">
                            <p>
                                Your draft is kept here. Copy it before
                                reloading the current version.
                            </p>
                            <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                    const blob = new Blob(
                                        [JSON.stringify(draft, null, 2)],
                                        { type: "application/json" },
                                    );
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement("a");
                                    a.href = url;
                                    a.download = "planner-draft.json";
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }}
                            >
                                {text("Download draft")}
                            </button>
                        </div>
                    )}
                    <div className="editor-actions">
                        <span className="muted" role="status">
                            {saving ? t.saving : saved ? t.saved : ""}
                        </span>
                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                try {
                                    sessionStorage.removeItem(recoveryKey);
                                } catch {
                                    /* Optional local recovery. */
                                }
                                onClose();
                            }}
                            disabled={saving}
                        >
                            {t.cancel}
                        </button>
                        <button
                            className="primary"
                            disabled={saving || conflict}
                        >
                            <Check size={16} />
                            {t.save}
                        </button>
                    </div>
                </form>
                {row && (
                    <div className="editor-extras">
                        {kind === "notes" && (
                            <>
                                <section>
                                    <h3>
                                        <FilePlus2 size={17} />
                                        {text("Attachments")}
                                    </h3>
                                    {files.data?.map((file) => (
                                        <a
                                            className="file"
                                            key={file.id}
                                            href={`/api/v1/files/${file.id}`}
                                        >
                                            {file.filename}
                                            <small>
                                                {Math.ceil(file.size / 1024)}{" "}
                                                {text("KB")}
                                            </small>
                                        </a>
                                    ))}
                                    {row.can_edit !== false && (
                                        <label className="upload">
                                            {t.attachment}
                                            <input
                                                type="file"
                                                onChange={(event) => {
                                                    const file =
                                                        event.target.files?.[0];
                                                    if (!file) return;
                                                    const data = new FormData();
                                                    data.append("file", file);
                                                    void run(async () => {
                                                        await api(
                                                            `/notes/${row.id}/attachments`,
                                                            {
                                                                method: "POST",
                                                                body: data,
                                                            },
                                                            identity.csrf,
                                                        );
                                                        await files.refetch();
                                                    });
                                                }}
                                            />
                                        </label>
                                    )}
                                </section>
                                {!row.shared && (
                                    <>
                                        <section>
                                            <h3>
                                                <Share2 size={17} />
                                                {t.share}
                                            </h3>
                                            {shares.error && (
                                                <p
                                                    role="alert"
                                                    className="error"
                                                >
                                                    {shares.error.message}
                                                </p>
                                            )}
                                            {shares.data?.map((person) => (
                                                <div
                                                    className="form-row"
                                                    key={person.id}
                                                >
                                                    <span>
                                                        {person.name} ·{" "}
                                                        {person.email}
                                                    </span>
                                                    <select
                                                        aria-label={
                                                            text("Permission") +
                                                            ": " +
                                                            person.email
                                                        }
                                                        value={
                                                            person.can_edit
                                                                ? "edit"
                                                                : "view"
                                                        }
                                                        onChange={(event) =>
                                                            void run(() =>
                                                                api(
                                                                    `/notes/${row.id}/share`,
                                                                    {
                                                                        method: "PUT",
                                                                        body: JSON.stringify(
                                                                            {
                                                                                email: person.email,
                                                                                can_edit:
                                                                                    event
                                                                                        .target
                                                                                        .value ===
                                                                                    "edit",
                                                                            },
                                                                        ),
                                                                    },
                                                                    identity.csrf,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        <option value="view">
                                                            {text("View")}
                                                        </option>
                                                        <option value="edit">
                                                            {text("Edit")}
                                                        </option>
                                                    </select>
                                                    <button
                                                        className="secondary"
                                                        onClick={() =>
                                                            void run(() =>
                                                                api(
                                                                    `/notes/${row.id}/share/${person.id}`,
                                                                    {
                                                                        method: "DELETE",
                                                                    },
                                                                    identity.csrf,
                                                                ),
                                                            )
                                                        }
                                                    >
                                                        {text("Remove access")}
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="form-row">
                                                <input
                                                    type="email"
                                                    aria-label="Recipient email"
                                                    placeholder="Email"
                                                    value={share}
                                                    onChange={(e) =>
                                                        setShare(e.target.value)
                                                    }
                                                />
                                                <label>
                                                    {text("Permission")}
                                                    <select
                                                        value={
                                                            shareEdit
                                                                ? "edit"
                                                                : "view"
                                                        }
                                                        onChange={(event) =>
                                                            setShareEdit(
                                                                event.target
                                                                    .value ===
                                                                    "edit",
                                                            )
                                                        }
                                                    >
                                                        <option value="view">
                                                            {text("View")}
                                                        </option>
                                                        <option value="edit">
                                                            {text("Edit")}
                                                        </option>
                                                    </select>
                                                </label>
                                                <button
                                                    className="secondary"
                                                    onClick={() =>
                                                        void run(() =>
                                                            api(
                                                                `/notes/${row.id}/share`,
                                                                {
                                                                    method: "PUT",
                                                                    body: JSON.stringify(
                                                                        {
                                                                            email: share,
                                                                        },
                                                                    ),
                                                                },
                                                                identity.csrf,
                                                            ),
                                                        )
                                                    }
                                                >
                                                    {t.share}
                                                </button>
                                            </div>
                                        </section>
                                        <section>
                                            <h3>
                                                <LockKeyhole size={17} />
                                                {t.password}
                                            </h3>
                                            {row.locked && (
                                                <input
                                                    type="password"
                                                    aria-label="Current password"
                                                    placeholder="Current password"
                                                    value={currentPassword}
                                                    onChange={(e) =>
                                                        setCurrentPassword(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                            )}
                                            <div className="form-row">
                                                <input
                                                    type="password"
                                                    aria-label="New note password"
                                                    placeholder="New password (8+ characters)"
                                                    value={notePassword}
                                                    onChange={(e) =>
                                                        setNotePassword(
                                                            e.target.value,
                                                        )
                                                    }
                                                />
                                                <button
                                                    className="secondary"
                                                    onClick={() =>
                                                        void run(async () => {
                                                            await api(
                                                                `/notes/${row.id}/password`,
                                                                {
                                                                    method: "POST",
                                                                    body: JSON.stringify(
                                                                        {
                                                                            current_password:
                                                                                currentPassword,
                                                                            new_password:
                                                                                notePassword ||
                                                                                null,
                                                                        },
                                                                    ),
                                                                },
                                                                identity.csrf,
                                                            );
                                                            onClose();
                                                        })
                                                    }
                                                >
                                                    {t.save}
                                                </button>
                                            </div>
                                        </section>
                                    </>
                                )}
                            </>
                        )}
                        {kind === "milestones" && (
                            <section>
                                <h3>{text("Prerequisites")}</h3>
                                {milestones.data?.items
                                    .filter(
                                        (item) =>
                                            item.id !== row.id &&
                                            item.goal_id === row.goal_id,
                                    )
                                    .map((item) => (
                                        <label
                                            className="check-row"
                                            key={item.id}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={dependencyIds
                                                    .split(",")
                                                    .includes(item.id)}
                                                onChange={(event) => {
                                                    const ids = new Set(
                                                        dependencyIds
                                                            .split(",")
                                                            .filter(Boolean),
                                                    );
                                                    if (event.target.checked)
                                                        ids.add(item.id);
                                                    else ids.delete(item.id);
                                                    setDependencyIds(
                                                        [...ids].join(","),
                                                    );
                                                }}
                                            />
                                            {item.title}
                                        </label>
                                    ))}
                                <button
                                    className="secondary"
                                    onClick={() =>
                                        void run(async () => {
                                            await api(
                                                `/milestones/${row.id}/prerequisites`,
                                                {
                                                    method: "PUT",
                                                    body: JSON.stringify({
                                                        version:
                                                            current.current!
                                                                .version,
                                                        ids: dependencyIds
                                                            .split(",")
                                                            .map((s) =>
                                                                s.trim(),
                                                            )
                                                            .filter(Boolean),
                                                    }),
                                                },
                                                identity.csrf,
                                            );
                                            onClose();
                                        })
                                    }
                                >
                                    {t.save}
                                </button>
                            </section>
                        )}
                        {["areas", "goals", "milestones"].includes(kind) &&
                            !row.archived_at && (
                                <label className="inline">
                                    <input
                                        type="checkbox"
                                        checked={includeContents}
                                        onChange={(e) =>
                                            setIncludeContents(e.target.checked)
                                        }
                                    />
                                    {identity.user.locale === "vi"
                                        ? "Lưu trữ cả nội dung bên trong"
                                        : "Also archive this item's contents"}
                                </label>
                            )}
                        {kind === "tasks" && !row.archived_at && (
                            <button
                                className="secondary"
                                onClick={() =>
                                    void run(async () => {
                                        await api(
                                            `/plan/tasks/${row.id}`,
                                            {
                                                method: "PUT",
                                                body: JSON.stringify({
                                                    day: localDate(
                                                        identity.user.timezone,
                                                    ),
                                                    period: "daily",
                                                    selected: true,
                                                }),
                                            },
                                            identity.csrf,
                                        );
                                        onClose();
                                    })
                                }
                            >
                                {identity.user.locale === "vi"
                                    ? "Thêm vào hôm nay"
                                    : "Add to today"}
                            </button>
                        )}
                        {!row.shared && (
                            <button
                                className="danger"
                                onClick={() =>
                                    void run(async () => {
                                        await api(
                                            `/${kind}/${row.id}/archive`,
                                            {
                                                method: "POST",
                                                body: JSON.stringify({
                                                    version:
                                                        current.current!
                                                            .version,
                                                    archived: !row.archived_at,
                                                    include_contents:
                                                        includeContents,
                                                }),
                                            },
                                            identity.csrf,
                                        );
                                        onClose();
                                    })
                                }
                            >
                                <Archive size={16} />
                                {row.archived_at ? t.restore : t.archive}
                            </button>
                        )}
                    </div>
                )}
            </Dialog>
            {leave && (
                <Dialog
                    title={
                        identity.user.locale === "vi"
                            ? "Giữ thay đổi?"
                            : "Keep your changes?"
                    }
                    onClose={() => setLeave(false)}
                >
                    <p>
                        {identity.user.locale === "vi"
                            ? "Bản nháp chưa được lưu."
                            : "Your draft has not been saved."}
                    </p>
                    <div className="action-row">
                        <button
                            className="secondary"
                            onClick={() => setLeave(false)}
                        >
                            {identity.user.locale === "vi"
                                ? "Tiếp tục sửa"
                                : "Keep editing"}
                        </button>
                        <button
                            className="danger"
                            onClick={() => {
                                try {
                                    sessionStorage.removeItem(recoveryKey);
                                } catch {
                                    /* Optional local recovery. */
                                }
                                onClose();
                            }}
                        >
                            {identity.user.locale === "vi"
                                ? "Bỏ thay đổi"
                                : "Discard changes"}
                        </button>
                        <button
                            className="primary"
                            onClick={() => void save(draft, true)}
                        >
                            {t.save}
                        </button>
                    </div>
                </Dialog>
            )}
        </>
    );
}
