"use client";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { api, ApiError, type Kind } from "@/lib/api";
import { localDate } from "@/lib/dates";
import {
    cachedNotes,
    cacheNotes,
    queueNoteChanges,
    clearNoteChanges,
    forgetOfflineNotes,
    restoreOfflineDrafts,
    keepNoteDraft,
    discardNoteDraft,
    type NoteDraft,
} from "@/lib/offline-notes";
import {
    WorkspaceDataContext,
    type ContextValue,
    type Data,
    type Nav,
} from "./preview/workspace-data";
import { WorkspaceView } from "./preview/workspace";
import {
    WorkspaceIds,
    changesBetween,
    fromSnapshot,
    type Snapshot,
    type Change,
} from "./live-model";
import type { LiveRuntime } from "./live-contract";
import type { PreviewNotice } from "./preview/notifications";
import "@/styles/tasks-preview.css";
import "@/styles/full-preview.css";

const settings: Record<string, string> = {
    profile: "profile",
    preferences: "appearance",
    password: "security",
    notifications: "notifications",
    history: "history",
    archive: "archive",
    reports: "reports",
};
function route(ids: WorkspaceIds): Nav {
    const [section, id] = window.location.pathname.split("/").filter(Boolean),
        p = new URLSearchParams(location.search);
    if (section === "settings")
        return { section: settings[id] || "profile", stamp: Date.now() };
    return {
        section: section || "notes",
        goal: section === "goals" ? ids.view(id || "") || undefined : undefined,
        milestone: ids.view(p.get("milestone") || "") || undefined,
        note: ids.view(p.get("note") || "") || undefined,
        task: section === "tasks" && id ? ids.number(id) : undefined,
        stamp: Date.now(),
    };
}
export function liveHref(
    section: string,
    target: {
        goal?: string;
        task?: number;
        milestone?: string;
        note?: string;
    } = {},
    ids?: WorkspaceIds,
) {
    const paths: Record<string, string> = {
        notes: "/",
        profile: "/settings/profile",
        appearance: "/settings/preferences",
        security: "/settings/password",
        notifications: "/settings/notifications",
        history: "/settings/history",
        archive: "/settings/archive",
        reports: "/settings/reports",
    };
    let path = target.goal
        ? `/goals/${ids?.server(target.goal) || target.goal}`
        : target.task !== undefined
          ? `/tasks/${ids?.id(target.task) || target.task}`
          : paths[section] || `/${section}`;
    const params = new URLSearchParams();
    if (target.milestone)
        params.set(
            "milestone",
            ids?.server(target.milestone) || target.milestone,
        );
    if (target.note)
        params.set("note", ids?.server(target.note) || target.note);
    return path + (params.size ? "?" + params : "");
}
export default function LiveWorkspace() {
    const ids = useRef(new WorkspaceIds()).current;
    const raw = useRef<Snapshot | null>(null),
        base = useRef<Data | null>(null),
        current = useRef<Data | null>(null);
    const [data, setData] = useState<Data | null>(null),
        [busy, renderBusy] = useState(false),
        [error, setError] = useState("");
    const [offline, setOffline] = useState(false),
        [notices, setNotices] = useState<PreviewNotice[]>([]);
    const mutationBusy = useRef(false);
    const setBusy = (value: boolean) => {
        mutationBusy.current = value;
        renderBusy(value);
    };
    const [historyLimit, setHistoryLimit] = useState(1000);
    const [recovery, setRecovery] = useState<Record<string, NoteDraft>>({});
    const [failed, setFailed] = useState<Data | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
        pending = useRef<Promise<boolean> | null>(null),
        acks = useRef<string[]>([]);
    const deferred = useRef<{ key: keyof Data; value: unknown }[]>([]);
    const offlineRef = useRef(false);
    const patch = (next: Data) => {
        current.current = next;
        setData(next);
    };
    async function refresh() {
        let snapshot = await api<Snapshot>("/workspace/snapshot");
        let preservedDeletion = false;
        const cached = await cachedNotes(snapshot.identity.user.id).catch(
            () => undefined,
        );
        if (cached?.changes.length) {
            const replay: Change[] = [];
            for (const change of cached.changes) {
                const server = snapshot.notes.find(
                    (note) =>
                        note.id === change.id ||
                        (change.client_id &&
                            note.client_key === change.client_id),
                );
                if (server?.locked || server?.shared) continue;
                if (change.action === "delete") {
                    if (!server) continue;
                    if (server.version === change.version) replay.push(change);
                    else preservedDeletion = true;
                    continue;
                }
                if (
                    server &&
                    Object.entries(change.fields).every(
                        ([key, value]) =>
                            JSON.stringify(value) ===
                            JSON.stringify(server[key as keyof typeof server]),
                    )
                )
                    continue;
                if (
                    change.action === "update" &&
                    server?.version === change.version
                ) {
                    replay.push(change);
                    continue;
                }
                const original = cached.snapshot.notes.find(
                    (note) => note.id === change.id,
                );
                const fields = { ...original, ...change.fields };
                replay.push({
                    action: "create",
                    kind: "notes",
                    client_id:
                        change.action === "create" && !server
                            ? change.client_id
                            : `recovery:${change.id || change.client_id}:${change.version || 1}`,
                    fields: {
                        title:
                            String(fields.title || "Note") +
                            (server ? " (recovered)" : ""),
                        content: fields.content || "",
                        tags: fields.tags || [],
                        color: fields.color || "neutral",
                        pinned: fields.pinned || false,
                    },
                });
            }
            if (replay.length) {
                const result = await api<{ aliases: Record<string, string> }>(
                    "/workspace/changes",
                    {
                        method: "POST",
                        body: JSON.stringify({ changes: replay }),
                    },
                    snapshot.identity.csrf,
                );
                ids.aliases(result.aliases);
                snapshot = await api<Snapshot>("/workspace/snapshot");
            }
            await clearNoteChanges(snapshot.identity.user.id);
        }
        if (!raw.current && cached?.drafts) setRecovery(cached.drafts);
        offlineRef.current = false;
        await cacheNotes(snapshot).catch(() => undefined);
        let extra: Partial<Data>;
        if (snapshot.identity.user.role === "admin") {
            const admin = await api<{
                history_limit: number;
                members: Data["members"];
                reports: Data["reports"];
                registration: Data["registration"];
                invitations: string[];
                log: Data["adminLog"];
            }>("/admin/state");
            setHistoryLimit(admin.history_limit);
            extra = {
                members: admin.members,
                reports: admin.reports,
                registration: admin.registration,
                invitations: admin.invitations,
                adminLog: admin.log,
            };
        } else extra = { reports: await api<Data["reports"]>("/reports") };
        raw.current = snapshot;
        const previous = current.current;
        const loaded = fromSnapshot(snapshot, ids, previous?.nav || route(ids));
        const next = {
            ...loaded,
            ...extra,
            planningAction: previous?.planningAction || null,
            taskAction: previous?.taskAction || null,
            assistantOpen: previous?.assistantOpen || false,
            assistantContext: previous?.assistantContext || "",
            appearancePreview: previous?.appearancePreview || null,
        };

        if (preservedDeletion)
            next.message =
                next.locale === "vi"
                    ? "Ghi chú đã thay đổi trên máy khác được giữ lại. Hãy xem lại trước khi xóa."
                    : "A Note changed on another device was kept. Review it before deleting.";
        base.current = next;
        patch(next);
        setOffline(false);
        const alerts = await api<
            {
                id: string;
                message: string;
                read: boolean;
                created_at?: string;
                destination?: string;
                task_id?: string;
            }[]
        >("/notifications");
        setNotices(
            alerts.map((item) => ({
                id: item.id,
                read: item.read,
                title: [item.message, item.message],
                description: ["", ""],
                time: [
                    item.created_at
                        ? new Date(item.created_at).toLocaleString(
                              snapshot.identity.user.locale,
                              { timeZone: snapshot.identity.user.timezone },
                          )
                        : "",
                    item.created_at
                        ? new Date(item.created_at).toLocaleString(
                              snapshot.identity.user.locale,
                              { timeZone: snapshot.identity.user.timezone },
                          )
                        : "",
                ],
                destination: item.destination || "notifications",
                task: item.task_id ? ids.number(item.task_id) : undefined,
            })),
        );
    }
    async function flush(): Promise<boolean> {
        if (timer.current) {
            clearTimeout(timer.current);
            timer.current = null;
        }
        if (pending.current) return pending.current;
        if (!base.current || !current.current || !raw.current) return false;
        const previous = base.current,
            next = current.current,
            snapshot = raw.current;
        let changes: Change[];
        try {
            changes = changesBetween(
                previous,
                next,
                snapshot,
                ids,
                acks.current,
            );
        } catch (err) {
            setError((err as Error).message);
            return false;
        }
        const profile =
            JSON.stringify(previous.profile) !== JSON.stringify(next.profile) ||
            JSON.stringify(previous.appearance) !==
                JSON.stringify(next.appearance) ||
            previous.locale !== next.locale;
        if (!changes.length && !profile) return true;
        if (offlineRef.current || !navigator.onLine) {
            try {
                if (
                    profile ||
                    changes.some((change) => {
                        const row = snapshot.notes.find(
                            (note) => note.id === change.id,
                        );
                        return (
                            change.kind !== "notes" ||
                            row?.locked ||
                            row?.shared
                        );
                    })
                )
                    throw new Error("Reconnect before editing this item.");
                await queueNoteChanges(snapshot.identity.user.id, changes);
                for (const change of changes)
                    if (change.action === "delete" && change.id)
                        await discardNoteDraft(
                            snapshot.identity.user.id,
                            change.id,
                        );
                setOffline(true);
                offlineRef.current = true;
                patch({
                    ...next,
                    message:
                        next.locale === "vi"
                            ? "Đã giữ bản nháp trên thiết bị. Sẽ đồng bộ khi kết nối lại."
                            : "Draft kept on this device. It will sync when reconnected.",
                });
                return true;
            } catch (err) {
                setError((err as Error).message);
                return false;
            }
        }
        setBusy(true);
        setError("");
        const work = (async () => {
            try {
                if (profile) {
                    const p = next.profile,
                        a = next.appearance,
                        u = snapshot.identity.user;
                    await api(
                        "/preferences",
                        {
                            method: "PUT",
                            body: JSON.stringify({
                                name: p.name,
                                timezone: p.timezone,
                                locale: next.locale,
                                theme: a.theme,
                                preferences: {
                                    ...u.preferences,
                                    visual_theme: a.scene,
                                    show_background: a.showBackground,
                                    show_illustrations: a.showIllustrations,
                                    show_quote: a.showQuote,
                                    custom_quote: a.quote,
                                    accent: a.accent,
                                    background_color: a.background.startsWith(
                                        "#",
                                    )
                                        ? a.background
                                        : null,
                                    background_id: a.background.startsWith(
                                        "/api/v1/account-files/",
                                    )
                                        ? a.background.split("/").pop()
                                        : null,
                                    notifications_enabled:
                                        p.notifications.inApp,
                                    email_notifications: p.notifications.email,
                                    show_reminders: p.notifications.reminders,
                                    show_shares: p.notifications.shares,
                                    history_completed_hours: p.completedHours,
                                    history_retention_days:
                                        p.retentionDays ?? null,
                                    history_overdue_days: p.overdueDays,
                                },
                            }),
                        },
                        snapshot.identity.csrf,
                    );
                    if (previous.profile.bio !== p.bio)
                        await api(
                            "/profile",
                            {
                                method: "PUT",
                                body: JSON.stringify({ bio: p.bio }),
                            },
                            snapshot.identity.csrf,
                        );
                }
                if (changes.length) {
                    const result = await api<{
                        aliases: Record<string, string>;
                    }>(
                        "/workspace/changes",
                        { method: "POST", body: JSON.stringify({ changes }) },
                        snapshot.identity.csrf,
                    );
                    ids.aliases(result.aliases);
                }
                await refresh();
                setFailed(null);
                if (current.current)
                    patch({
                        ...current.current,
                        message:
                            next.locale === "vi"
                                ? "Đã lưu thay đổi."
                                : "Changes saved.",
                    });
                return true;
            } catch (err) {
                setError((err as Error).message);
                setFailed(next);
                try {
                    await refresh();
                } catch {
                    if (
                        !navigator.onLine &&
                        changes.every(
                            (change) =>
                                change.kind === "notes" &&
                                ["create", "update"].includes(change.action) &&
                                !snapshot.notes.find(
                                    (note) => note.id === change.id,
                                )?.locked &&
                                !snapshot.notes.find(
                                    (note) => note.id === change.id,
                                )?.shared,
                        ) &&
                        !profile
                    ) {
                        await queueNoteChanges(
                            snapshot.identity.user.id,
                            changes,
                        );
                        offlineRef.current = true;
                        setOffline(true);
                        return true;
                    }
                    setOffline(!navigator.onLine);
                }
                return false;
            } finally {
                setBusy(false);
                pending.current = null;
                acks.current = [];
                const queued = deferred.current.splice(0);
                for (const item of queued) set(item.key, item.value as never);
            }
        })();
        pending.current = work;
        return work;
    }
    function set<K extends keyof Data>(key: K, value: SetStateAction<Data[K]>) {
        const old = current.current;
        if (!old) return;
        if (
            pending.current &&
            [
                "tasks",
                "series",
                "areas",
                "goals",
                "milestones",
                "notes",
                "habits",
                "reviews",
                "focus",
                "profile",
                "appearance",
                "locale",
            ].includes(key)
        ) {
            deferred.current.push({ key, value });
            return;
        }
        if (
            key === "message" &&
            (timer.current || pending.current || mutationBusy.current)
        )
            return;
        const nextValue =
            typeof value === "function"
                ? (value as (v: Data[K]) => Data[K])(old[key])
                : value;
        patch({ ...old, [key]: nextValue });
        if (
            [
                "tasks",
                "series",
                "areas",
                "goals",
                "milestones",
                "notes",
                "habits",
                "reviews",
                "focus",
                "profile",
                "appearance",
                "locale",
            ].includes(key)
        ) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => void flush(), 100);
        }
    }
    useEffect(() => {
        let alive = true;
        refresh().catch(async (err) => {
            if (!alive) return;
            if (err instanceof ApiError && err.status === 401) {
                await forgetOfflineNotes();
                if (!alive) return;
                window.location.replace("/login");
                return;
            }
            const cached = await cachedNotes().catch(() => undefined);
            if (!alive) return;
            if (cached && !(err instanceof ApiError)) {
                raw.current = cached.snapshot;
                base.current = fromSnapshot(cached.snapshot, ids, {
                    section: "notes",
                    stamp: Date.now(),
                });
                patch(
                    fromSnapshot(
                        restoreOfflineDrafts(cached.snapshot, cached.changes),
                        ids,
                        { section: "notes", stamp: Date.now() },
                    ),
                );
                offlineRef.current = true;
                setOffline(true);
            } else setError(err.message);
        });
        if ("serviceWorker" in navigator)
            void navigator.serviceWorker
                .register("/planner-sw.js")
                .catch(() => undefined);
        const restore = () => {
            if (current.current) set("nav", route(ids));
        };
        const before = (event: BeforeUnloadEvent) => {
            if (pending.current || timer.current) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("popstate", restore);
        window.addEventListener("beforeunload", before);
        const online = () => {
            setOffline(false);
            void refresh().catch((err) => setError(err.message));
        };
        window.addEventListener("online", online);
        const off = () => setOffline(true);
        window.addEventListener("offline", off);
        return () => {
            alive = false;
            if (timer.current) clearTimeout(timer.current);
            window.removeEventListener("popstate", restore);
            window.removeEventListener("beforeunload", before);
            window.removeEventListener("online", online);
            window.removeEventListener("offline", off);
        };
    }, []);
    if (!data || !raw.current)
        return (
            <main className="loading-page">
                <p role={error ? "alert" : "status"}>
                    {error || "Đang tải… / Loading…"}
                </p>
                {error && (
                    <button onClick={() => location.reload()}>
                        Thử lại / Retry
                    </button>
                )}
            </main>
        );
    const identity = raw.current.identity;
    const catalogue = [
        ...new Set([
            ...(identity.user.preferences.tags || []),
            ...data.notes.flatMap((r) => r.tags),
            ...data.tasks.flatMap((r) => r.tags),
            ...data.habits.flatMap((r) => r.tags || []),
        ]),
    ];
    const runtime: LiveRuntime = {
        identity,
        historyLimit,
        busy,
        offline,
        notices,
        flush,
        refresh,
        preferences: async (values) => {
            await api(
                "/preferences",
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: identity.user.name,
                        timezone: identity.user.timezone,
                        locale: identity.user.locale,
                        theme: identity.user.theme,
                        preferences: {
                            ...identity.user.preferences,
                            ...values,
                        },
                    }),
                },
                identity.csrf,
            );
            await refresh();
        },
        href: (section) => liveHref(section, {}, ids),
        keepNoteDraft: async (id, draft) => {
            const server = ids.server(id),
                row = raw.current!.notes.find((n) => n.id === server);
            if (row?.locked || row?.shared) return;
            await keepNoteDraft(identity.user.id, server, {
                ...draft,
                version: row?.version,
            });
        },
        discardNoteDraft: async (id) => {
            await discardNoteDraft(identity.user.id, id);
            if (ids.server(id) !== id)
                await discardNoteDraft(identity.user.id, ids.server(id));
        },
        tags: catalogue.map((id) => ({ id, label: [id, id] })),
        invitations: raw.current.invitations,
        saveTags: async (tags) => {
            await api(
                "/preferences",
                {
                    method: "PUT",
                    body: JSON.stringify({
                        name: identity.user.name,
                        timezone: identity.user.timezone,
                        locale: identity.user.locale,
                        theme: identity.user.theme,
                        preferences: { ...identity.user.preferences, tags },
                    }),
                },
                identity.csrf,
            );
            await refresh();
        },
        acknowledge: (values) => {
            acks.current = [...new Set([...acks.current, ...values])];
        },
        serverId: (value) =>
            typeof value === "number" ? ids.id(value) : ids.server(value),
        request: async <T,>(path: string, options: RequestInit = {}) => {
            if (!(await flush()))
                throw new Error("Save the pending changes first");
            const actual = path
                .split("/")
                .map((part) => ids.server(part))
                .join("/");
            try {
                return await api<T>(actual, options, identity.csrf);
            } catch (err) {
                setError((err as Error).message);
                throw err;
            }
        },
        upload: async (path, file, purpose) => {
            if (!(await flush()))
                throw new Error("Save the pending changes first");
            const form = new FormData();
            form.append("file", file);
            if (purpose) form.append("purpose", purpose);
            return api(
                path
                    .split("/")
                    .map((part) => ids.server(part))
                    .join("/"),
                { method: "POST", body: form },
                identity.csrf,
            );
        },
        logout: async () => {
            if (!(await flush())) return;
            await api("/auth/logout", { method: "POST" }, identity.csrf);
            await forgetOfflineNotes(identity.user.id);
            location.assign("/login");
        },
    };
    const setters = Object.fromEntries(
        Object.keys(data).map((key) => [
            `set${key[0].toUpperCase()}${key.slice(1)}`,
            (value: unknown) => set(key as keyof Data, value as never),
        ]),
    );
    const parents = [
        {
            id: "",
            label: ["Inbox · organize later", "Hộp thư đến · sắp xếp sau"] as [
                string,
                string,
            ],
            goal: "inbox",
        },
        ...data.goals.map((g) => ({
            id: g.id,
            label: g.title,
            goal: g.id,
            archived: g.archived,
        })),
        ...data.milestones.map((m) => ({
            id: m.id,
            label: ["↳ " + m.title[0], "↳ " + m.title[1]] as [string, string],
            goal: m.goal,
            archived:
                m.archived || data.goals.find((g) => g.id === m.goal)?.archived,
        })),
    ];
    const action = async (
        kind: Kind,
        id: string,
        operation: string,
        contents = false,
    ) => {
        if (!(await flush())) return;
        const actual = kind === "tasks" ? ids.id(Number(id)) : ids.server(id),
            row = raw.current![kind].find((r) => r.id === actual);
        if (!row) return;
        setBusy(true);
        setError("");
        try {
            await api(
                "/workspace/changes",
                {
                    method: "POST",
                    body: JSON.stringify({
                        changes: [
                            {
                                action: operation,
                                kind,
                                id: actual,
                                version: row.version,
                                fields: { include_contents: contents },
                            },
                        ],
                    }),
                },
                identity.csrf,
            );
            await refresh();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    };
    const context = {
        ...data,
        ...setters,
        live: runtime,
        today: localDate(data.profile.timezone),
        parents,
        navigate: (section: string, target = {}) => {
            history.pushState(null, "", liveHref(section, target, ids));
            set("nav", { section, ...target, stamp: Date.now() });
            window.scrollTo(0, 0);
            if (!offlineRef.current)
                void flush()
                    .then((ok) => {
                        if (ok) return refresh();
                    })
                    .catch((err) => setError(err.message));
        },
        checkHabit: (id: string, day: string) =>
            set("habits", (rows) =>
                rows.map((row) =>
                    row.id !== id || row.rests.includes(day)
                        ? row
                        : {
                              ...row,
                              checkins: row.checkins.includes(day)
                                  ? row.checkins.filter((d) => d !== day)
                                  : [...row.checkins, day],
                          },
                ),
            ),
        archiveEntity: (kind: Kind, id: string, contents: boolean) =>
            void action(kind, id, "archive", contents),
        restoreEntity: (kind: Kind, id: string) =>
            void action(kind, id, "restore"),
        deleteEntity: (kind: Kind, id: string) =>
            void action(kind, id, "delete"),
    } as ContextValue;
    return (
        <WorkspaceDataContext.Provider value={context}>
            {!!Object.keys(recovery).length && (
                <aside className="notice live-draft-recovery" role="alert">
                    <span>
                        {data.locale === "vi"
                            ? "Có bản nháp Ghi chú chưa lưu trên thiết bị này."
                            : "There are unsaved Note drafts on this device."}
                    </span>
                    <button
                        className="text-button"
                        onClick={async () => {
                            const copies = Object.values(recovery).map(
                                (draft) => ({
                                    id: `recovered-${crypto.randomUUID()}`,
                                    title: draft.title + " (recovered)",
                                    content: draft.content,
                                    color: "neutral",
                                    pinned: false,
                                    tags: [],
                                    goal: "",
                                    task: null,
                                    locked: false,
                                    lockPassword: "",
                                    unlocked: true,
                                    permission: "owner" as const,
                                    shared: false,
                                    shares: [],
                                    files: [],
                                    background: "",
                                    summary: "",
                                    summaryOutdated: false,
                                }),
                            );
                            set("notes", (rows) => [...copies, ...rows]);
                            if (await flush()) {
                                setRecovery({});
                                await discardNoteDraft(identity.user.id);
                            }
                        }}
                    >
                        {data.locale === "vi"
                            ? "Khôi phục thành bản sao"
                            : "Restore as copies"}
                    </button>
                    <button
                        className="text-button"
                        onClick={() => {
                            setRecovery({});
                            void discardNoteDraft(identity.user.id);
                        }}
                    >
                        {data.locale === "vi"
                            ? "Bỏ bản nháp"
                            : "Discard drafts"}
                    </button>
                </aside>
            )}
            {error && (
                <div className="live-save-error notice" role="alert">
                    {error}
                    {failed && (
                        <button
                            className="text-button"
                            onClick={() => {
                                patch(failed);
                                setError("");
                                void flush();
                            }}
                        >
                            Thử lưu lại / Retry save
                        </button>
                    )}
                    <button
                        className="text-button"
                        onClick={() => setError("")}
                    >
                        Đóng / Close
                    </button>
                </div>
            )}
            {busy && (
                <div className="live-save-status" role="status">
                    Đang lưu… / Saving…
                </div>
            )}
            <div inert={busy}>
                <WorkspaceView
                    initialLocale={data.locale}
                    initialSection={data.nav.section}
                />
            </div>
        </WorkspaceDataContext.Provider>
    );
}
