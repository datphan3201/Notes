"use client";

import {
    createContext,
    useEffect,
    useContext,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";
import {
    seriesFixtures,
    taskFixtures,
    type SeriesRecord,
    type TaskRecord,
    type TaskDraft,
} from "./task-data";
import type { Label, PlanningStatus } from "./dashboard-data";
import { previewSections, type PreviewLocale } from "./shared";

export type ArchiveKind = "areas" | "goals" | "milestones" | "tasks" | "habits" | "task-series" | "notes" | "reviews";
export type Archived = { archived: boolean; archivedWith?: string };
export type Area = Archived & {
    id: string;
    title: Label;
    importance: number;
    icon: string;
    color: string;
};
export type Goal = Archived & {
    id: string;
    title: Label;
    area: string;
    parent: string;
    status: PlanningStatus;
    importance: number;
    icon: string;
    color: string;
    start: string;
    due: string;
    description: Label;
    outcome: Label;
    criteria: Label;
    strategy: string;
    related: string[];
};
export type Milestone = Archived & {
    related?: string[];
    weekly?: boolean;
    id: string;
    title: Label;
    goal: string;
    status: PlanningStatus;
    importance: number;
    icon: string;
    color: string;
    start: string;
    due: string;
    criteria: string;
    prerequisites: string[];
};
export type NoteFile = {
    id: string;
    name: string;
    type: string;
    size: number;
    url: string;
    content?: string;
};
export type Note = {
    archived?: boolean;
    archivedWith?: string;
    document?: import("@/lib/note-document").RichNoteDocument | null;
    updatedAt?: string;
    id: string;
    title: string;
    content: string;
    color: string;
    pinned: boolean;
    tags: string[];
    goal: string;
    task: number | null;
    locked: boolean;
    lockPassword: string;
    unlocked: boolean;
    permission: "owner" | "edit" | "read";
    shared: boolean;
    shares: { id: string; email: string; permission: "read" | "edit" }[];
    files: NoteFile[];
    background: string;
    summary: string;
    summaryOutdated: boolean;
};
export type Habit = Archived & {
    created?: string;
    today?: string;
    description?: string;
    tags?: string[];
    started?: boolean;
    id: string;
    title: Label;
    goal: string;
    frequency: "daily" | "weekly";
    target: number;
    timezone: string;
    importance: number;
    icon: string;
    color: string;
    checkins: string[];
    rests: string[];
};
export type Review = {
    archived?: boolean;
    archivedWith?: string;
    id: string;
    kind: "daily" | "weekly" | "monthly";
    from: string;
    to: string;
    title: string;
    reflection: string;
    wentWell?: string;
    improve?: string;
    nextSteps?: string;
    finalized?: boolean;
    snapshot: {
        done: number;
        total: number;
        habits: number;
        actions?: number;
        wins?: number;
        days?: { date: string; count: number }[];
        facts?: ActivityFact[];
    };
    createdAt: string;
};
export type ActivityFact = {
    id: string;
    title: Label;
    kind: "task" | "habit" | "checklist";
    target: string;
    date: string;
    at: string;
    reversed?: boolean;
};
export type Appearance = {
    theme: "light" | "dark";
    scene: string;
    showBackground: boolean;
    showIllustrations: boolean;
    showQuote: boolean;
    quote: string;
    accent: string;
    background: string;
    backgrounds: string[];
};
export type Profile = {
    retentionDays?: number | null;
    name: string;
    bio: string;
    email: string;
    pendingEmail: string;
    avatar: string;
    timezone: string;
    mfa: "none" | "email" | "app";
    passwordChanged: boolean;
    accountDeleted: boolean;
    notifications: {
        inApp: boolean;
        email: boolean;
        reminders: boolean;
        shares: boolean;
    };
    completedHours: number;
    overdueDays: number;
};
export type Report = {
    id: string;
    reporter_id?: string | null;
    kind: "note" | "user";
    target: string;
    owner: string;
    reporter: string;
    reason: string;
    evidence: string[];
    snapshot: string;
    state: "open" | "resolved" | "dismissed";
    actions: string[];
    reply: string;
};
export type Member = {
    id: string;
    name: string;
    email: string;
    admin: boolean;
    locked: boolean;
    warned: boolean;
};
export type Nav = {
    section: string;
    goal?: string;
    milestone?: string;
    task?: number;
    note?: string;
    stamp: number;
};
export type Data = {
    planningAction: {
        kind: "goal" | "milestone";
        view?: boolean;
        id?: string;
        goal?: string;
        parent?: string;
        area?: string;
    } | null;
    taskAction: {
        kind: "create" | "edit" | "complete";
        id?: number;
        draft?: TaskDraft;
    } | null;
    assistantOpen: boolean;
    assistantContext: string;
    message: string;
    locale: PreviewLocale;
    nav: Nav;
    tasks: TaskRecord[];
    series: SeriesRecord[];
    areas: Area[];
    goals: Goal[];
    milestones: Milestone[];
    notes: Note[];
    habits: Habit[];
    reviews: Review[];
    events: ActivityFact[];
    focus: string;
    appearance: Appearance;
    appearancePreview: Appearance | null;
    profile: Profile;
    reports: Report[];
    members: Member[];
    admin: boolean;
    registration: "open" | "invitation" | "closed";
    invitations: string[];
    adminLog: { id: string; title: string; at: string }[];
};
export const label = (value: string): Label => [value, value];
export const day = "2026-11-07";
export function addDays(value: string, offset: number) {
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
}
export function dateLabel(value: string, locale: PreviewLocale, full = false) {
    return value
        ? new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: full ? "long" : "short",
              ...(full ? { year: "numeric" as const } : {}),
              timeZone: "UTC",
          }).format(new Date(`${value}T00:00:00Z`))
        : "—";
}
export const palette = [
    "#067287",
    "#408e73",
    "#b27935",
    "#7773b1",
    "#c16f83",
    "#517eac",
    "#9c8261",
    "#6b8c50",
];
const goal = (id: string, title: Label, extra: Partial<Goal> = {}): Goal => ({
    id,
    title,
    area: "learning-area",
    parent: "",
    status: "NotStarted",
    importance: 3,
    icon: "target",
    color: palette[0],
    start: "2026-11-02",
    due: "2026-12-20",
    description: [
        "Make room for steady progress.",
        "Dành không gian cho những bước tiến đều đặn.",
    ],
    outcome: ["A sustainable routine.", "Một nhịp thực hiện bền vững."],
    criteria: [
        "Finish the planned finite work.",
        "Hoàn thành các công việc hữu hạn đã chọn.",
    ],
    strategy: "",
    related: [],
    archived: false,
    ...extra,
});
const milestone = (
    id: string,
    title: Label,
    extra: Partial<Milestone> = {},
): Milestone => ({
    id,
    title,
    goal: "learning",
    status: "NotStarted",
    importance: 3,
    icon: "flag",
    color: palette[0],
    start: "2026-11-02",
    due: "2026-11-15",
    criteria: "Ghi lại kết quả và điều cần cải thiện.",
    prerequisites: [],
    archived: false,
    ...extra,
});
function fixtures(locale: PreviewLocale, section: string): Data {
    return {
        planningAction: null,
        taskAction: null,
        assistantOpen: false,
        assistantContext: "",
        message: "",
        locale,
        nav: { section, stamp: 0 },
        tasks: [
            ...taskFixtures,
            {
                ...taskFixtures[5],
                id: 99,
                title: ["Archived reading plan", "Kế hoạch đọc đã lưu trữ"],
                parent: "archived-milestone",
                archived: true,
                archivedWith: "goals:archived-goal",
            },
        ],
        series: seriesFixtures,
        areas: [
            {
                id: "learning-area",
                title: ["Learning", "Học tập"],
                importance: 4,
                icon: "book",
                color: palette[0],
                archived: false,
            },
            {
                id: "life-area",
                title: ["Personal life", "Cuộc sống"],
                importance: 3,
                icon: "leaf",
                color: palette[1],
                archived: false,
            },
            {
                id: "work-area",
                title: ["Work", "Công việc"],
                importance: 3,
                icon: "briefcase",
                color: palette[5],
                archived: false,
            },
        ],
        goals: [
            goal(
                "learning",
                [
                    "Build a steady learning routine",
                    "Xây dựng nhịp học đều đặn",
                ],
                {
                    importance: 5,
                    strategy:
                        "Mỗi tuần dành ba buổi tập trung. Cuối tuần nhìn lại điều đã học.",
                    status: "InProgress",
                },
            ),
            goal(
                "reading",
                ["Read a little every day", "Đọc một chút mỗi ngày"],
                {
                    area: "life-area",
                    icon: "book",
                    color: palette[1],
                    due: "2026-12-31",
                },
            ),
            goal(
                "finished",
                [
                    "Completed introductory course",
                    "Khóa nhập môn đã hoàn thành",
                ],
                { status: "Done", due: "2026-11-01" },
            ),
            goal("writing", ["Practise clear writing", "Luyện viết rõ ràng"], {
                parent: "learning",
                importance: 4,
                start: "2026-11-10",
                due: "2026-12-10",
            }),
            goal(
                "vocabulary",
                ["Build a vocabulary notebook", "Xây dựng sổ từ vựng"],
                { parent: "writing", due: "2026-11-30" },
            ),
            goal(
                "archived-goal",
                ["Previous reading plan", "Kế hoạch đọc trước đây"],
                { archived: true, archivedWith: "goals:archived-goal" },
            ),
        ],
        milestones: [
            milestone("basics", ["Prepare the basics", "Chuẩn bị nền tảng"], {
                status: "Done",
                due: "2026-11-05",
            }),
            milestone(
                "listening",
                ["Practise listening and reading", "Luyện nghe và đọc"],
                { importance: 5, prerequisites: ["basics"], due: "2026-11-08" },
            ),
            milestone("essay", ["Write a short essay", "Viết bài ngắn"], {
                due: "2026-11-25",
                prerequisites: ["listening"],
            }),
            milestone("review", ["Review progress", "Nhìn lại tiến độ"], {
                due: "2026-12-01",
                prerequisites: ["essay"],
            }),
            milestone("practice", ["Independent practice", "Tự luyện tập"], {
                due: "2026-12-05",
            }),
            milestone(
                "reflection",
                ["Share a reflection", "Chia sẻ điều đã học"],
                { due: "2026-12-10" },
            ),
            milestone(
                "finish",
                ["Finish the learning cycle", "Hoàn thành vòng học"],
                { due: "2026-12-20" },
            ),
            milestone(
                "reading-start",
                ["Choose the first book", "Chọn cuốn sách đầu tiên"],
                {
                    goal: "reading",
                    due: "2026-11-09",
                    icon: "book",
                    color: palette[1],
                },
            ),
            milestone(
                "archived-milestone",
                ["Previous chapter", "Chương trước"],
                {
                    goal: "archived-goal",
                    archived: true,
                    archivedWith: "goals:archived-goal",
                },
            ),
        ],
        notes: [
            {
                id: "welcome",
                title: "Những điều muốn học",
                content:
                    "Một không gian cho các ý tưởng đang hình thành.\n- [ ] Đọc chương đầu\n- [x] Chuẩn bị sổ ghi chép\nTài nguyên: https://example.com/learning",
                color: "#e7f3ef",
                pinned: true,
                tags: ["study"],
                goal: "learning",
                task: 1,
                locked: false,
                lockPassword: "",
                unlocked: true,
                permission: "owner",
                shared: false,
                shares: [],
                files: [],
                background: "",
                summary: "",
                summaryOutdated: false,
            },
            {
                id: "reflection-note",
                title: "Nhìn lại một tuần",
                content:
                    "Điều hiệu quả: những buổi học ngắn nhưng đều.\nTuần tới: dành thời gian xem lại các đoạn khó.",
                color: "#fff2dc",
                pinned: false,
                tags: ["personal"],
                goal: "reading",
                task: null,
                locked: false,
                lockPassword: "",
                unlocked: true,
                permission: "owner",
                shared: true,
                shares: [
                    {
                        id: "share-1",
                        email: "binh@example.test",
                        permission: "read",
                    },
                ],
                files: [],
                background: "",
                summary:
                    "Một tuần học đều đặn; tuần tới dành thời gian ôn lại.",
                summaryOutdated: false,
            },
            {
                id: "private-note",
                title: "Ghi chú riêng",
                content: "Nội dung minh họa của ghi chú đã mở khóa.",
                color: "#eeeafa",
                pinned: false,
                tags: [],
                goal: "",
                task: null,
                locked: true,
                lockPassword: "123456",
                unlocked: false,
                permission: "owner",
                shared: false,
                shares: [],
                files: [],
                background: "",
                summary: "",
                summaryOutdated: false,
            },
            {
                id: "shared-note",
                title: "Tài liệu được chia sẻ",
                content:
                    "Tài liệu mẫu có quyền chỉ đọc.\nhttps://example.com/reference",
                color: "#e9f2fc",
                pinned: false,
                tags: ["study"],
                goal: "",
                task: null,
                locked: false,
                lockPassword: "",
                unlocked: true,
                permission: "read",
                shared: true,
                shares: [],
                files: [],
                background: "",
                summary: "",
                summaryOutdated: false,
            },
        ],
        habits: [
            {
                id: "walk",
                title: ["Go for a walk", "Đi dạo"],
                goal: "reading",
                frequency: "weekly",
                target: 3,
                timezone: "Asia/Ho_Chi_Minh",
                importance: 3,
                icon: "leaf",
                color: palette[1],
                checkins: [
                    "2026-10-19",
                    "2026-10-21",
                    "2026-10-23",
                    "2026-10-26",
                    "2026-10-28",
                    "2026-10-30",
                    "2026-11-05",
                    "2026-11-06",
                ],
                rests: [],
                archived: false,
            },
            {
                id: "read-habit",
                title: ["Read for 15 minutes", "Đọc sách 15 phút"],
                goal: "learning",
                frequency: "daily",
                target: 1,
                timezone: "Asia/Ho_Chi_Minh",
                importance: 4,
                icon: "book",
                color: palette[0],
                checkins: [
                    "2026-11-02",
                    "2026-11-03",
                    "2026-11-05",
                    "2026-11-06",
                ],
                rests: ["2026-11-04"],
                archived: false,
            },
        ],
        reviews: [
            {
                id: "review-week",
                kind: "weekly",
                from: "2026-10-26",
                to: "2026-11-01",
                title: "Một tuần học đều",
                reflection:
                    "Những buổi học ngắn giúp giữ nhịp. Tuần tới tập trung vào việc ôn lại.",
                snapshot: { done: 4, total: 6, habits: 8 },
                createdAt: "2026-11-01T12:00:00Z",
            },
        ],
        events: Array.from({ length: 35 }, (_, index) => ({
            id: `sample-event-${index}`,
            title:
                index % 3
                    ? ["Completed a learning step", "Hoàn thành một bước học"]
                    : ["Checked in a Habit", "Điểm danh một thói quen"],
            kind: index % 3 ? "task" : "habit",
            target: index % 3 ? "1" : "read-habit",
            date: addDays(day, -Math.floor(index * 0.85)),
            at: `${addDays(day, -Math.floor(index * 0.85))}T09:00:00Z`,
        })),
        focus: "learning",
        appearance: {
            theme: "light",
            scene: "mountain",
            showBackground: true,
            showIllustrations: true,
            showQuote: true,
            quote: "",
            accent: "",
            background: "",
            backgrounds: [],
        },
        appearancePreview: null,
        profile: {
            name: "Minh An",
            bio: "Dành một chút thời gian mỗi ngày cho điều quan trọng.",
            email: "minhan@example.test",
            pendingEmail: "",
            avatar: "",
            timezone: "Asia/Ho_Chi_Minh",
            mfa: "none",
            passwordChanged: false,
            accountDeleted: false,
            notifications: {
                inApp: true,
                email: true,
                reminders: true,
                shares: true,
            },
            completedHours: 24,
            overdueDays: 3,
        },
        reports: [
            {
                id: "report-1",
                kind: "note",
                target: "reflection-note",
                owner: "member-binh",
                reporter: "member-an",
                reason: "Nội dung được chia sẻ không phù hợp.",
                evidence: [],
                snapshot:
                    "Ảnh chụp nội dung tại thời điểm báo cáo. Không truy cập ghi chú riêng.",
                state: "open",
                actions: [],
                reply: "",
            },
            {
                id: "report-2",
                kind: "user",
                target: "unknown@example.test",
                owner: "",
                reporter: "member-an",
                reason: "Yêu cầu xem xét tài khoản này.",
                evidence: [],
                snapshot: "",
                state: "open",
                actions: [],
                reply: "",
            },
        ],
        members: [
            {
                id: "member-an",
                name: "Minh An",
                email: "minhan@example.test",
                admin: true,
                locked: false,
                warned: false,
            },
            {
                id: "member-binh",
                name: "Bình",
                email: "binh@example.test",
                admin: false,
                locked: false,
                warned: false,
            },
            {
                id: "member-chi",
                name: "Chi",
                email: "chi@example.test",
                admin: false,
                locked: false,
                warned: false,
            },
        ],
        admin: false,
        registration: "open",
        invitations: ["friend@example.test"],
        adminLog: [
            {
                id: "initial",
                title: "Đã tạo tình huống quản trị minh họa",
                at: "2026-11-07T09:00:00Z",
            },
        ],
    };
}
type Setters = {
    [K in keyof Data as `set${Capitalize<K>}`]: Dispatch<
        SetStateAction<Data[K]>
    >;
};
export type ContextValue = Data &
    Setters & {
        live?: import("../live-contract").LiveRuntime;
        today?: string;
        checkHabit: (id: string, date: string) => void;
        parents: {
            id: string;
            label: Label;
            goal: string;
            archived?: boolean;
        }[];
        navigate: (
            section: string,
            target?: {
                goal?: string;
                milestone?: string;
                task?: number;
                note?: string;
            },
        ) => void;
        archiveEntity: (
            kind: ArchiveKind,
            id: string,
            contents: boolean,
        ) => boolean | void | Promise<boolean>;
        restoreEntity: (
            kind: ArchiveKind,
            id: string,
        ) => boolean | void | Promise<boolean>;
        deleteEntity: (
            kind: ArchiveKind,
            id: string,
        ) => boolean | void | Promise<boolean>;
        deleteEntities: (entries: { kind: ArchiveKind; id: string }[]) => boolean | void | Promise<boolean>;
    };
export const WorkspaceDataContext = createContext<ContextValue | null>(null);
const Context = WorkspaceDataContext;
export function PreviewDataProvider({
    children,
    locale,
    section,
}: {
    children: React.ReactNode;
    locale: PreviewLocale;
    section: string;
}) {
    const [data, setData] = useState(() => fixtures(locale, section));
    useEffect(() => {
        const restore = () => {
            const params = new URLSearchParams(window.location.search),
                section = params.get("section") || "dashboard";
            setData((old) => ({
                ...old,
                nav: {
                    section: previewSections.includes(section)
                        ? section
                        : "dashboard",
                    goal: params.get("goal") || undefined,
                    milestone: params.get("milestone") || undefined,
                    task: params.get("task")
                        ? Number(params.get("task"))
                        : undefined,
                    note: params.get("note") || undefined,
                    stamp: Date.now(),
                },
            }));
        };
        restore();
        window.addEventListener("popstate", restore);
        return () => window.removeEventListener("popstate", restore);
    }, []);
    const set = <K extends keyof Data>(
        key: K,
        value: SetStateAction<Data[K]>,
    ) =>
        setData((previous) => {
            const next =
                typeof value === "function"
                    ? (value as (current: Data[K]) => Data[K])(previous[key])
                    : value;
            let events = previous.events;
            if (key === "tasks") {
                for (const task of next as TaskRecord[]) {
                    const old = previous.tasks.find(
                        (row) => row.id === task.id,
                    );
                    if (old)
                        for (const item of task.checklist) {
                            const previousItem = old.checklist.find(
                                (row) => row.id === item.id,
                            );
                            if (
                                previousItem &&
                                previousItem.checked !== item.checked
                            )
                                events = [
                                    ...events,
                                    {
                                        id: `checklist-${Date.now()}-${task.id}-${item.id}`,
                                        title: item.checked
                                            ? [
                                                  "Checked: " + item.text,
                                                  "Đánh dấu: " + item.text,
                                              ]
                                            : [
                                                  "Unchecked: " + item.text,
                                                  "Bỏ đánh dấu: " + item.text,
                                              ],
                                        kind: "checklist",
                                        target: String(task.id),
                                        date: day,
                                        at: new Date().toISOString(),
                                        reversed: !item.checked,
                                    },
                                ];
                        }
                    if (
                        old &&
                        (old.status === "Done") !== (task.status === "Done")
                    )
                        events = [
                            ...events,
                            {
                                id: `event-${Date.now()}-${task.id}`,
                                title:
                                    task.status === "Done"
                                        ? [
                                              "Completed: " + task.title[0],
                                              "Hoàn thành: " + task.title[1],
                                          ]
                                        : [
                                              "Reopened: " + task.title[0],
                                              "Mở lại: " + task.title[1],
                                          ],
                                kind: "task",
                                target: String(task.id),
                                date: day,
                                at: new Date().toISOString(),
                                reversed: task.status !== "Done",
                            },
                        ];
                }
            }
            return {
                ...previous,
                [key]: next,
                ...(key === "tasks" ? { events } : {}),
            };
        });
    const setters = Object.fromEntries(
        Object.keys(data).map((key) => [
            `set${key[0].toUpperCase()}${key.slice(1)}`,
            (value: unknown) => set(key as keyof Data, value as never),
        ]),
    ) as Setters;
    const parents = [
        {
            id: "",
            label: [
                "Inbox · organize later",
                "Hộp thư đến · sắp xếp sau",
            ] as Label,
            goal: "inbox",
        },
        ...data.goals.map((goal) => ({
            id: goal.id,
            label: goal.title,
            goal: goal.id,
            archived: goal.archived,
        })),
        ...data.milestones.map((item) => ({
            id: item.id,
            label: ["↳ " + item.title[0], "↳ " + item.title[1]] as Label,
            goal: item.goal,
            archived:
                item.archived ||
                !!data.goals.find((goal) => goal.id === item.goal)?.archived,
        })),
    ];
    function descendants(id: string, goals: Goal[]) {
        const result = new Set([id]);
        for (let changed = true; changed; ) {
            changed = false;
            for (const row of goals)
                if (result.has(row.parent) && !result.has(row.id)) {
                    result.add(row.id);
                    changed = true;
                }
        }
        return result;
    }
    function archiveEntity(
        kind: ArchiveKind,
        id: string,
        contents: boolean,
    ) {
        setData((old) => {
            const stamp = `${kind}:${id}`;
            const ids =
                kind === "goals" && contents
                    ? descendants(id, old.goals)
                    : new Set(kind === "goals" ? [id] : []);
            const mids = new Set(
                old.milestones
                    .filter((row) => ids.has(row.goal))
                    .map((row) => row.id),
            );
            if (kind === "milestones") mids.add(id);
            const mark = <T extends Archived>(row: T, match: boolean): T =>
                match && !row.archived
                    ? { ...row, archived: true, archivedWith: stamp }
                    : row;
            return {
                ...old,
                areas: old.areas.map((row) =>
                    mark(row, kind === "areas" && row.id === id),
                ),
                goals: old.goals.map((row) => mark(row, ids.has(row.id))),
                tasks: old.tasks.map((row) =>
                    mark(
                        row,
                        (kind === "tasks" && String(row.id) === id) ||
                            (contents &&
                                (ids.has(row.parent) || mids.has(row.parent))),
                    ),
                ),
                habits: old.habits.map((row) =>
                    mark(
                        row,
                        (kind === "habits" && row.id === id) ||
                            (contents && ids.has(row.goal)),
                    ),
                ),
                series: old.series.map((row) =>
                    (kind === "task-series" && String(row.id) === id) ||
                    (contents && (ids.has(row.template.parent) || mids.has(row.template.parent)))
                        ? { ...row, template: mark(row.template, true) }
                        : row,
                ),
                milestones: old.milestones.map((row) =>
                    mark(
                        {
                            ...row,
                            prerequisites: row.prerequisites.filter(
                                (id) => !mids.has(id),
                            ),
                        },
                        (contents && mids.has(row.id)) ||
                            (kind === "milestones" && row.id === id),
                    ),
                ),
                focus: ids.has(old.focus) ? "" : old.focus,
            };
        });
    }
    function restoreEntity(
        kind: ArchiveKind,
        id: string,
    ) {
        setData((old) => {
            const own = kind === "task-series"
                ? old.series.find((row) => String(row.id) === id)?.template
                : old[kind].find((row) => String(row.id) === id);
            const stamp = own?.archivedWith || `${kind}:${id}`;
            const restore = <T extends { archived?: boolean; archivedWith?: string; id: string | number }>(
                rows: T[],
                name: string,
            ) =>
                rows.map((row) =>
                    row.archived &&
                    (row.archivedWith === stamp ||
                        (name === kind && String(row.id) === id))
                        ? { ...row, archived: false, archivedWith: undefined }
                        : row,
                );
            return {
                ...old,
                areas: restore(old.areas, "areas"),
                goals: restore(old.goals, "goals"),
                milestones: restore(old.milestones, "milestones"),
                tasks: restore(old.tasks, "tasks"),
                habits: restore(old.habits, "habits"),
                notes: restore(old.notes, "notes"),
                reviews: restore(old.reviews, "reviews"),
                series: old.series.map(row => ({ ...row, template: restore([row.template], "task-series")[0] })),
            };
        });
    }
    function deleteEntity(
        kind: ArchiveKind,
        id: string,
    ) {
        setData((old) => {
            const gids =
                kind === "goals"
                    ? descendants(id, old.goals)
                    : kind === "areas"
                      ? new Set(
                            old.goals
                                .filter((goal) => goal.area === id)
                                .map((goal) => goal.id),
                        )
                      : new Set<string>();
            const mids = new Set(
                old.milestones
                    .filter(
                        (row) =>
                            gids.has(row.goal) ||
                            (kind === "milestones" && row.id === id),
                    )
                    .map((row) => row.id),
            );
            const tids = new Set(
                old.tasks
                    .filter(
                        (row) =>
                            gids.has(row.parent) ||
                            mids.has(row.parent) ||
                            (kind === "tasks" && String(row.id) === id),
                    )
                    .map((row) => row.id),
            );
            return {
                ...old,
                areas: old.areas.filter(
                    (row) => !(kind === "areas" && row.id === id),
                ),
                goals: old.goals
                    .filter((row) => !gids.has(row.id))
                    .map((row) => ({
                        ...row,
                        related: row.related.filter((id) => !gids.has(id)),
                    })),
                milestones: old.milestones
                    .filter((row) => !mids.has(row.id))
                    .map((row) => ({
                        ...row,
                        prerequisites: row.prerequisites.filter(
                            (id) => !mids.has(id),
                        ),
                    })),
                tasks: old.tasks
                    .filter((row) => !tids.has(row.id))
                    .map((row) => ({
                        ...row,
                        related: row.related.filter((id) => !gids.has(id)),
                    })),
                habits: old.habits
                    .filter((row) => !(kind === "habits" && row.id === id))
                    .map((row) => ({
                        ...row,
                        goal: gids.has(row.goal) ? "" : row.goal,
                    })),
                series: old.series.filter(row => !(kind === "task-series" && String(row.id) === id)),
                reviews: old.reviews.filter(row => !(kind === "reviews" && row.id === id)),
                notes: old.notes.filter(row => !(kind === "notes" && row.id === id)).map((note) => ({
                    ...note,
                    goal: gids.has(note.goal) ? "" : note.goal,
                    task: note.task && tids.has(note.task) ? null : note.task,
                })),
                focus: gids.has(old.focus) ? "" : old.focus,
            };
        });
    }
    return (
        <Context.Provider
            value={{
                ...data,
                ...setters,
                parents,
                checkHabit: (id, date) =>
                    setData((old) => {
                        const habit = old.habits.find((row) => row.id === id);
                        if (
                            !habit ||
                            habit.archived ||
                            date > day ||
                            habit.rests.includes(date)
                        )
                            return old;
                        const undo = habit.checkins.includes(date);
                        return {
                            ...old,
                            habits: old.habits.map((row) =>
                                row.id === id
                                    ? {
                                          ...row,
                                          started: true,
                                          checkins: undo
                                              ? row.checkins.filter(
                                                    (value) => value !== date,
                                                )
                                              : [...row.checkins, date],
                                      }
                                    : row,
                            ),
                            events: [
                                ...old.events,
                                {
                                    id: `habit-${Date.now()}`,
                                    title: undo
                                        ? [
                                              "Undid check-in: " +
                                                  habit.title[0],
                                              "Bỏ điểm danh: " + habit.title[1],
                                          ]
                                        : [
                                              "Checked in: " + habit.title[0],
                                              "Điểm danh: " + habit.title[1],
                                          ],
                                    kind: "habit",
                                    target: id,
                                    date,
                                    at: new Date().toISOString(),
                                    reversed: undo,
                                },
                            ],
                        };
                    }),
                navigate: (section, target = {}) => {
                    const url = new URL(window.location.href);
                    url.searchParams.set("section", section);
                    url.searchParams.set("lang", data.locale);
                    for (const key of [
                        "goal",
                        "milestone",
                        "task",
                        "note",
                    ] as const) {
                        if (target[key] !== undefined)
                            url.searchParams.set(key, String(target[key]));
                        else url.searchParams.delete(key);
                    }
                    window.history.pushState(null, "", url);
                    set("nav", { section, ...target, stamp: Date.now() });
                    window.scrollTo(0, 0);
                },
                archiveEntity,
                restoreEntity,
                deleteEntity,
                deleteEntities: entries => { entries.forEach(row => deleteEntity(row.kind, row.id)); return true; },
            }}
        >
            {children}
        </Context.Provider>
    );
}
export function usePreviewData() {
    const value = useContext(Context);
    if (!value) throw new Error("PreviewDataProvider is required");
    return value;
}
export function goalProgress(
    goalId: string,
    goals: Goal[],
    milestones: Milestone[],
    tasks: TaskRecord[],
    visited = new Set<string>(),
): number | null {
    if (visited.has(goalId)) return null;
    const next = new Set(visited).add(goalId);
    const values: number[] = [];
    for (const goal of goals.filter(
        (row) => row.parent === goalId && !row.archived,
    )) {
        const value = goalProgress(goal.id, goals, milestones, tasks, next);
        if (value !== null) values.push(value);
    }
    for (const milestone of milestones.filter(
        (row) => row.goal === goalId && !row.archived,
    ))
        values.push(milestone.status === "Done" ? 100 : 0);
    for (const task of tasks.filter(
        (row) => row.parent === goalId && !row.archived && !row.seriesId,
    ))
        values.push(task.status === "Done" ? 100 : 0);
    return values.length
        ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
        : goals.find((goal) => goal.id === goalId)?.status === "Done"
          ? 100
          : null;
}
