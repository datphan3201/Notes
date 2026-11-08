import type { Label, TaskStatus } from "./dashboard-data";
import type { PreviewLocale, Text } from "./shared";

export const demoToday = "2026-11-07";
export type RepeatRule = {
    frequency: "none" | "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    weekdays: number[];
    start: string;
    end: string;
};
export type TaskDraft = {
    title: string;
    description: string;
    criteria: string;
    outcome: string;
    parent: string;
    status: TaskStatus;
    importance: number;
    start: string;
    due: string;
    scheduledStart: string;
    scheduledEnd: string;
    estimate: string;
    reminder: string;
    reminderAt: string;
    tags: string[];
    plan: "none" | "today" | "week";
    rule: RepeatRule;
    checklistTemplate: string;
};
export type TaskRecord = Omit<
    TaskDraft,
    | "title"
    | "description"
    | "criteria"
    | "outcome"
    | "plan"
    | "rule"
    | "checklistTemplate"
> & {
    history?: boolean;
    archivedWith?: string;
    id: number;
    title: Label;
    description: Label;
    criteria: Label;
    outcome: Label;
    working: Label;
    daily: boolean;
    weekly: boolean;
    pinned: boolean;
    archived: boolean;
    seriesId?: number;
    checklist: { id: number; text: string; checked: boolean }[];
    related: string[];
    linkedNotes: { id: number; title: string; content: string }[];
};
export type SeriesRecord = {
    id: number;
    template: TaskRecord;
    rule: RepeatRule;
    state: "active" | "paused" | "ended";
};
export const parents = [
    {
        id: "",
        label: ["Inbox · organize later", "Hộp thư đến · sắp xếp sau"] as Label,
        goal: "inbox",
    },
    {
        id: "learning",
        label: [
            "Build a steady learning routine",
            "Xây dựng nhịp học đều đặn",
        ] as Label,
        goal: "learning",
    },
    {
        id: "listening",
        label: [
            "↳ Practise listening and reading",
            "↳ Luyện nghe và đọc",
        ] as Label,
        goal: "learning",
    },
    {
        id: "reading",
        label: ["Read a little every day", "Đọc một chút mỗi ngày"] as Label,
        goal: "reading",
    },
    {
        id: "finished",
        label: [
            "Completed introductory course",
            "Khóa nhập môn đã hoàn thành",
        ] as Label,
        goal: "finished",
    },
];
export const tagOptions: { id: string; label: Label }[] = [
    { id: "english", label: ["English", "Tiếng Anh"] },
    { id: "personal", label: ["Personal", "Cá nhân"] },
    { id: "study", label: ["Study", "Học tập"] },
];
export const views: [string, string, string][] = [
    ["today", "Today", "Hôm nay"],
    ["next", "Next", "Sắp tới"],
    ["week", "This week", "Tuần này"],
    ["backlog", "Backlog", "Chưa lên lịch"],
    ["overdue", "Overdue", "Quá hạn"],
    ["all", "All", "Tất cả"],
    ["repeating", "Repeating", "Lặp lại"],
];
export const seriesStates: [SeriesRecord["state"], string, string][] = [
    ["active", "Active", "Đang hoạt động"],
    ["paused", "Paused", "Tạm dừng"],
    ["ended", "Ended", "Đã kết thúc"],
];
export const frequencies: [RepeatRule["frequency"], string, string][] = [
    ["none", "Does not repeat", "Không lặp lại"],
    ["daily", "Daily", "Hàng ngày"],
    ["weekly", "Weekly", "Hàng tuần"],
    ["monthly", "Monthly", "Hàng tháng"],
    ["yearly", "Yearly", "Hàng năm"],
];
export const blankDraft = (): TaskDraft => ({
    title: "",
    description: "",
    criteria: "",
    outcome: "",
    parent: "",
    status: "NotStarted",
    importance: 3,
    start: "",
    due: "",
    scheduledStart: "",
    scheduledEnd: "",
    estimate: "",
    reminder: "none",
    reminderAt: "",
    tags: [],
    plan: "none",
    checklistTemplate: "",
    rule: {
        frequency: "none",
        interval: 1,
        weekdays: [0, 2, 4],
        start: demoToday,
        end: "",
    },
});
const pair = (value: string): Label => [value, value];
export const recordFromDraft = (draft: TaskDraft, id: number): TaskRecord => ({
    ...draft,
    id,
    title: pair(draft.title.trim()),
    description: pair(draft.description),
    criteria: pair(draft.criteria),
    outcome: pair(draft.outcome),
    working: ["", ""],
    daily: draft.plan === "today",
    weekly: draft.plan !== "none",
    pinned: false,
    archived: false,
    checklist: draft.checklistTemplate
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text, index) => ({ id: index + 1, text, checked: false })),
    related: [],
    linkedNotes: [],
});
export const draftFromRecord = (
    task: TaskRecord,
    text: Text,
    rule?: RepeatRule,
): TaskDraft => ({
    ...task,
    title: text(...task.title),
    description: text(...task.description),
    criteria: text(...task.criteria),
    outcome: text(...task.outcome),
    checklistTemplate: task.checklist.map((item) => item.text).join("\n"),
    plan: task.daily ? "today" : task.weekly ? "week" : "none",
    rule: rule || { ...blankDraft().rule, start: task.start || demoToday },
});
export const updateFromDraft = (
    task: TaskRecord,
    draft: TaskDraft,
): TaskRecord => ({
    ...task,
    ...recordFromDraft(draft, task.id),
    working: task.working,
    checklist: task.checklist,
    related: task.related,
    pinned: task.pinned,
    seriesId: task.seriesId,
    linkedNotes: task.linkedNotes,
});
const sample = (
    id: number,
    title: Label,
    fields: Partial<TaskRecord>,
): TaskRecord => ({ ...recordFromDraft(blankDraft(), id), title, ...fields });
export const taskFixtures: TaskRecord[] = [
    sample(1, ["Practise one listening exercise", "Luyện một bài nghe"], {
        parent: "listening",
        importance: 5,
        status: "InProgress",
        due: demoToday,
        daily: true,
        weekly: true,
        estimate: "30",
        tags: ["english"],
        description: [
            "Listen once without a transcript, then review the difficult parts.",
            "Nghe một lần không nhìn bản chép, sau đó xem lại phần còn khó.",
        ],
        criteria: [
            "Understand the main idea and write down five useful expressions.",
            "Hiểu ý chính và ghi lại năm cách diễn đạt hữu ích.",
        ],
        outcome: [
            "A short review of the recording.",
            "Một ghi chú ngắn về bài nghe.",
        ],
        working: [
            "First pass: focus on the main idea.\n- [ ] Revisit the second section\nResource: https://example.com/listening",
            "Lượt đầu: tập trung vào ý chính.\n- [ ] Nghe lại đoạn thứ hai\nTài nguyên: https://example.com/listening",
        ],
        checklist: [
            { id: 1, text: "Nghe lượt đầu", checked: true },
            {
                id: 2,
                text: "Xem lại đoạn khó",
                checked: false,
            },
            {
                id: 3,
                text: "Viết tóm tắt",
                checked: false,
            },
        ],
    }),
    sample(
        2,
        ["Review the first reading draft", "Xem lại bản nháp bài đọc đầu tiên"],
        {
            parent: "learning",
            status: "NotStarted",
            due: "2026-11-06",
            importance: 4,
            tags: ["study"],
        },
    ),
    sample(3, ["Read for fifteen minutes", "Đọc sách mười lăm phút"], {
        parent: "reading",
        status: "NotStarted",
        start: "2026-11-09",
        due: "2026-11-09",
        scheduledStart: "2026-11-09T19:00",
        scheduledEnd: "2026-11-09T19:30",
        weekly: true,
        seriesId: 1,
        importance: 3,
    }),
    sample(4, ["Prepare the study corner", "Sắp xếp góc học tập"], {
        status: "Done",
        due: "2026-11-04",
        parent: "finished",
        importance: 2,
        checklist: [{ id: 1, text: "Dọn bàn", checked: true }],
    }),
    sample(5, ["Ask for feedback", "Xin góp ý"], {
        parent: "learning",
        status: "Blocked",
        weekly: true,
        importance: 3,
        tags: ["english"],
    }),
    sample(6, ["Choose the next book", "Chọn cuốn sách tiếp theo"], {
        parent: "reading",
        importance: 2,
        tags: ["personal"],
    }),
    sample(7, ["Plan a short walk", "Lên kế hoạch đi dạo"], {
        importance: 2,
        daily: true,
        weekly: true,
        pinned: true,
    }),
    sample(8, ["Read today's chapter", "Đọc chương sách hôm nay"], {
        parent: "reading",
        due: demoToday,
        start: demoToday,
        seriesId: 1,
        status: "InProgress",
        weekly: true,
    }),
];
export const seriesFixtures: SeriesRecord[] = [
    {
        id: 1,
        template: sample(
            101,
            ["Read for fifteen minutes", "Đọc sách mười lăm phút"],
            {
                parent: "reading",
                estimate: "15",
                reminder: "start",
                scheduledStart: "2026-11-07T19:00",
                scheduledEnd: "2026-11-07T19:15",
                checklist: [
                    {
                        id: 1,
                        text: "Đọc một phần",
                        checked: false,
                    },
                ],
            },
        ),
        rule: {
            frequency: "daily",
            interval: 1,
            weekdays: [],
            start: demoToday,
            end: "",
        },
        state: "active",
    },
    {
        id: 2,
        template: sample(
            102,
            ["Weekly vocabulary review", "Ôn từ vựng hàng tuần"],
            {
                parent: "learning",
                importance: 4,
                tags: ["english"],
                reminder: "due",
                due: demoToday,
            },
        ),
        rule: {
            frequency: "weekly",
            interval: 1,
            weekdays: [0, 2, 4],
            start: demoToday,
            end: "2026-12-31",
        },
        state: "paused",
    },
    {
        id: 3,
        template: sample(103, ["Previous study routine", "Nếp học trước đây"], {
            parent: "reading",
        }),
        rule: {
            frequency: "monthly",
            interval: 1,
            weekdays: [],
            start: "2026-01-31",
            end: "2026-10-31",
        },
        state: "ended",
    },
];
export function nextDates(rule: RepeatRule): string[] {
    if (rule.frequency === "none" || !rule.start || rule.interval < 1)
        return [];
    const anchor = new Date(`${rule.start}T00:00:00Z`);
    if (!Number.isFinite(anchor.getTime())) return [];
    const dates: string[] = [];
    for (let period = 0; period < 7 && dates.length < 6; period++) {
        const candidates: Date[] = [];
        if (rule.frequency === "weekly") {
            for (const day of [...rule.weekdays].sort((a, b) => a - b))
                candidates.push(
                    new Date(
                        Date.UTC(
                            anchor.getUTCFullYear(),
                            anchor.getUTCMonth(),
                            anchor.getUTCDate() -
                                ((anchor.getUTCDay() + 6) % 7) +
                                period * rule.interval * 7 +
                                day,
                        ),
                    ),
                );
        } else if (rule.frequency === "daily")
            candidates.push(
                new Date(
                    Date.UTC(
                        anchor.getUTCFullYear(),
                        anchor.getUTCMonth(),
                        anchor.getUTCDate() + period * rule.interval,
                    ),
                ),
            );
        else {
            const month = new Date(
                Date.UTC(
                    anchor.getUTCFullYear() +
                        (rule.frequency === "yearly"
                            ? period * rule.interval
                            : 0),
                    anchor.getUTCMonth() +
                        (rule.frequency === "monthly"
                            ? period * rule.interval
                            : 0),
                    1,
                ),
            );
            const lastDay = new Date(
                Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
            ).getUTCDate();
            candidates.push(
                new Date(
                    Date.UTC(
                        month.getUTCFullYear(),
                        month.getUTCMonth(),
                        Math.min(anchor.getUTCDate(), lastDay),
                    ),
                ),
            );
        }
        for (const date of candidates) {
            const value = date.toISOString().slice(0, 10);
            if (
                value >= rule.start &&
                (!rule.end || value <= rule.end) &&
                dates.length < 6
            )
                dates.push(value);
        }
    }
    return dates;
}
export const formatTaskDate = (value: string, locale: PreviewLocale) =>
    value
        ? new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
          }).format(new Date(`${value}T00:00:00Z`))
        : "—";
export function isToday(task: TaskRecord, today=demoToday): boolean {
    return (
        task.daily ||
        task.due === today ||
        task.start === today ||
        (!!task.scheduledStart &&
            task.scheduledStart.slice(0, 10) <= today &&
            (task.scheduledEnd || task.scheduledStart).slice(0, 10) >=
                today) ||
        (!!task.due && task.due < today && task.status !== "Done")
    );
}
export function matchesTaskView(task: TaskRecord, view: string, today=demoToday): boolean {
    const dates = [
        task.start,
        task.due,
        task.scheduledStart.slice(0, 10),
        task.scheduledEnd.slice(0, 10),
    ].filter(Boolean);
    if (view === "today") return isToday(task,today);
    if (view === "next") return dates.some((date) => date > today);
    if (view === "week")
        return (
            task.weekly ||
            dates.some((date) => date >= mondayDate(today) && date <= addDaysLocal(mondayDate(today),6))
        );
    if (view === "backlog") return !dates.length;
    if (view === "overdue")
        return !!task.due && task.due < today && task.status !== "Done";
    return true;
}

function addDaysLocal(day:string,count:number){const value=new Date(day+"T12:00:00Z");value.setUTCDate(value.getUTCDate()+count);return value.toISOString().slice(0,10);}
function mondayDate(day:string){return addDaysLocal(day,-((new Date(day+"T12:00:00Z").getUTCDay()+6)%7));}
