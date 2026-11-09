"use client";
import { api, type Kind, type WorkspacePreferences } from "@/lib/api";
import Link from "next/link";
import { useState } from "react";
import AccountSecurity from "./account-security";
import { TasksPage } from "./tasks-page";
import {
    Empty,
    QueryState,
    Tabs,
    useItems,
    type PageContext,
} from "./workspace-context";

export function SettingsPage({
    ctx,
    setting,
}: {
    ctx: PageContext;
    setting: string;
}) {
    const [saved, setSaved] = useState(false);
    const [appearanceTab, setAppearanceTab] = useState("themes");
    const [draft, setDraft] = useState({
        name: ctx.identity.user.name,
        timezone: ctx.identity.user.timezone,
        locale: ctx.identity.user.locale,
    });
    const [prefs, setPrefs] = useState<WorkspacePreferences>({
        ...ctx.identity.user.preferences,
    });
    async function save(values: Partial<typeof ctx.identity.user>) {
        setSaved(false);
        const success = await ctx.action(() => ctx.preferences(values));
        if (success) setSaved(true);
    }
    const themeNames: [
        NonNullable<WorkspacePreferences["visual_theme"]>,
        string,
        string,
    ][] = [
        ["mountain", "Summit trail", "Đường lên đỉnh"],
        ["forest", "Forest path", "Lối rừng"],
        ["ocean", "Coastal cove", "Vịnh biển"],
        ["pisces", "Pisces", "Song Ngư"],
        ["stars", "Starlit lake", "Hồ sao"],
    ];
    return (
        <>
            <header className="settings-header">
                <h1>
                    {setting === "preferences"
                        ? ctx.text("Appearance", "Giao diện")
                        : setting === "history"
                          ? ctx.text("Task history", "Lịch sử công việc")
                          : setting === "archive"
                            ? ctx.t.archived
                            : ctx.t.settings}
                </h1>
                <Link className="button button-quiet" href="/dashboard">
                    ← {ctx.t.dashboard}
                </Link>
            </header>
            {setting === "password" ? (
                <AccountSecurity
                    identity={ctx.identity}
                    onSaved={ctx.refresh}
                />
            ) : setting === "archive" ? (
                <ArchivePage ctx={ctx} />
            ) : setting === "history" ? (
                <>
                    <form
                        className="settings-panel stack-form"
                        onSubmit={(event) => {
                            event.preventDefault();
                            void save({ preferences: prefs });
                        }}
                    >
                        <label>
                            {ctx.text(
                                "Move completed tasks to history after (hours)",
                                "Chuyển việc đã xong vào lịch sử sau (giờ)",
                            )}
                            <input
                                type="number"
                                min={1}
                                max={8760}
                                value={prefs.history_completed_hours || 24}
                                onChange={(event) =>
                                    setPrefs({
                                        ...prefs,
                                        history_completed_hours: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <label>
                            {ctx.text(
                                "Move overdue tasks to history after (days)",
                                "Chuyển việc quá hạn vào lịch sử sau (ngày)",
                            )}
                            <input
                                type="number"
                                min={1}
                                max={365}
                                value={prefs.history_overdue_days || 3}
                                onChange={(event) =>
                                    setPrefs({
                                        ...prefs,
                                        history_overdue_days: Number(
                                            event.target.value,
                                        ),
                                    })
                                }
                            />
                        </label>
                        <button className="button button-primary">
                            {ctx.t.save}
                        </button>
                    </form>
                    <TasksPage ctx={ctx} history />
                </>
            ) : setting === "preferences" ? (
                <>
                    <Tabs
                        label={ctx.text(
                            "Appearance sections",
                            "Các mục giao diện",
                        )}
                        value={appearanceTab}
                        onChange={setAppearanceTab}
                        items={[
                            ["themes", ctx.text("Themes", "Chủ đề")],
                            [
                                "decoration",
                                ctx.text(
                                    "Scenery and quote",
                                    "Cảnh nền và trích dẫn",
                                ),
                            ],
                        ]}
                    />
                    {appearanceTab === "themes" ? (
                        <section className="settings-panel">
                            <h2>
                                {ctx.text(
                                    "Choose your scenery",
                                    "Chọn cảnh nền",
                                )}
                            </h2>
                            <div className="theme-picker">
                                {themeNames.map(([key, en, vi]) => (
                                    <button
                                        className="theme-choice"
                                        key={key}
                                        aria-pressed={
                                            (ctx.identity.user.preferences
                                                ?.visual_theme ||
                                                "mountain") === key
                                        }
                                        onClick={() => {
                                            const next = {
                                                ...ctx.identity.user
                                                    .preferences,
                                                visual_theme: key,
                                            };
                                            setPrefs(next);
                                            void save({ preferences: next });
                                        }}
                                    >
                                        <img
                                            src={`/themes/${key}.webp`}
                                            alt=""
                                        />
                                        <span>{ctx.text(en, vi)}</span>
                                    </button>
                                ))}
                            </div>
                            <h2>{ctx.t.theme}</h2>
                            <div className="segmented-control">
                                {(["light", "dark"] as const).map((value) => (
                                    <button
                                        className="segment-button"
                                        key={value}
                                        aria-pressed={
                                            ctx.identity.user.theme === value
                                        }
                                        onClick={() =>
                                            void save({ theme: value })
                                        }
                                    >
                                        {value === "light"
                                            ? ctx.text("Light", "Sáng")
                                            : ctx.text("Dark", "Tối")}
                                    </button>
                                ))}
                            </div>
                        </section>
                    ) : (
                        <form
                            className="settings-panel stack-form"
                            onSubmit={(event) => {
                                event.preventDefault();
                                void save({ preferences: prefs });
                            }}
                        >
                            <img
                                className="theme-preview"
                                src={`/themes/${prefs.visual_theme || "mountain"}.webp`}
                                alt={ctx.text(
                                    "Theme preview",
                                    "Xem trước chủ đề",
                                )}
                            />
                            {[
                                [
                                    "show_background",
                                    "Page background",
                                    "Nền trang",
                                ],
                                [
                                    "show_illustrations",
                                    "Scenery in cards and roadmap",
                                    "Hình minh họa trong thẻ và lộ trình",
                                ],
                                ["show_quote", "Quote card", "Thẻ trích dẫn"],
                            ].map(([key, en, vi]) => (
                                <label className="check-row" key={key}>
                                    <input
                                        type="checkbox"
                                        checked={
                                            (prefs[
                                                key as keyof WorkspacePreferences
                                            ] as boolean | undefined) ?? true
                                        }
                                        onChange={(event) =>
                                            setPrefs({
                                                ...prefs,
                                                [key]: event.target.checked,
                                            })
                                        }
                                    />
                                    {ctx.text(en, vi)}
                                </label>
                            ))}
                            <label>
                                {ctx.text(
                                    "Your quote (optional)",
                                    "Trích dẫn của bạn (tùy chọn)",
                                )}
                                <textarea
                                    maxLength={500}
                                    value={prefs.custom_quote || ""}
                                    onChange={(event) =>
                                        setPrefs({
                                            ...prefs,
                                            custom_quote: event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <label>
                                {ctx.text("Background color", "Màu nền")}
                                <input
                                    type="color"
                                    value={prefs.background_color || "#eaf4fb"}
                                    onChange={(event) =>
                                        setPrefs({
                                            ...prefs,
                                            background_color:
                                                event.target.value,
                                        })
                                    }
                                />
                            </label>
                            <div className="action-row">
                                <button className="button button-primary">
                                    {ctx.t.save}
                                </button>
                                <button
                                    className="button button-quiet"
                                    type="button"
                                    onClick={() => {
                                        const next = {
                                            ...prefs,
                                            custom_quote: "",
                                            background_color: null,
                                        };
                                        setPrefs(next);
                                        void save({ preferences: next });
                                    }}
                                >
                                    {ctx.text(
                                        "Restore preset",
                                        "Khôi phục mặc định",
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </>
            ) : setting === "notifications" ? (
                <form
                    className="settings-panel stack-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save({ preferences: prefs });
                    }}
                >
                    <h2>{ctx.text("Notifications", "Thông báo")}</h2>
                    <label className="check-row">
                        <input
                            type="checkbox"
                            checked={prefs.notifications_enabled ?? true}
                            onChange={(event) =>
                                setPrefs({
                                    ...prefs,
                                    notifications_enabled: event.target.checked,
                                })
                            }
                        />
                        {ctx.text(
                            "In-app notifications",
                            "Thông báo trong ứng dụng",
                        )}
                    </label>
                    <label className="check-row">
                        <input
                            type="checkbox"
                            checked={prefs.email_notifications ?? true}
                            onChange={(event) =>
                                setPrefs({
                                    ...prefs,
                                    email_notifications: event.target.checked,
                                })
                            }
                        />
                        {ctx.text("Email reminders", "Nhắc nhở qua email")}
                    </label>
                    <button className="button button-primary">
                        {ctx.t.save}
                    </button>
                </form>
            ) : (
                <form
                    className="settings-panel stack-form"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void save(draft);
                    }}
                >
                    <label>
                        {ctx.t.name}
                        <input
                            value={draft.name}
                            required
                            maxLength={120}
                            onChange={(event) =>
                                setDraft({ ...draft, name: event.target.value })
                            }
                        />
                    </label>
                    <label>
                        Email
                        <input
                            value={ctx.identity.user.email}
                            type="email"
                            disabled
                        />
                    </label>
                    <label>
                        {ctx.t.timezone}
                        <input
                            value={draft.timezone}
                            required
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    timezone: event.target.value,
                                })
                            }
                        />
                    </label>
                    <label>
                        {ctx.t.language}
                        <select
                            value={draft.locale}
                            onChange={(event) =>
                                setDraft({
                                    ...draft,
                                    locale: event.target.value as "en" | "vi",
                                })
                            }
                        >
                            <option value="en">English</option>
                            <option value="vi">Tiếng Việt</option>
                        </select>
                    </label>
                    <button className="button button-primary">
                        {ctx.t.save}
                    </button>
                </form>
            )}
            {saved && (
                <p className="save-status" role="status">
                    {ctx.t.saved}
                </p>
            )}
        </>
    );
}
function ArchivePage({ ctx }: { ctx: PageContext }) {
    const kinds: Kind[] = [
        "areas",
        "goals",
        "milestones",
        "tasks",
        "habits",
        "notes",
        "reviews",
    ];
    const [kind, setKind] = useState<Kind>("tasks");
    const items = useItems(kind, ctx.identity.user.id, true);
    return (
        <section className="planning-panel">
            <label>
                {ctx.text("Type", "Loại")}
                <select
                    value={kind}
                    onChange={(event) => setKind(event.target.value as Kind)}
                >
                    {kinds.map((value) => (
                        <option key={value} value={value}>
                            {value === "areas"
                                ? ctx.text("Areas", "Lĩnh vực")
                                : ctx.t[value as "tasks"]}
                        </option>
                    ))}
                </select>
            </label>
            <QueryState locale={ctx.identity.user.locale} queries={[items]} />
            {items.data?.map((row) => (
                <div className="goal-tree-row" key={row.id}>
                    <span className="goal-tree-link">{row.title}</span>
                    <button
                        className="button button-quiet"
                        onClick={() =>
                            void ctx.action(() =>
                                api(
                                    `/${kind}/${row.id}/archive`,
                                    {
                                        method: "POST",
                                        body: JSON.stringify({
                                            version: row.version,
                                            archived: false,
                                        }),
                                    },
                                    ctx.identity.csrf,
                                ),
                            )
                        }
                    >
                        {ctx.t.restore}
                    </button>
                </div>
            ))}
            {!items.isPending && !items.data?.length && (
                <Empty>{ctx.t.empty}</Empty>
            )}
        </section>
    );
}
