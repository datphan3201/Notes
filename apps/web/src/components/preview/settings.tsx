"use client";
import { PageHeaderFrame, Surface } from "../ui/layout";
import { Input, Textarea, Select } from "../ui/field";
import { timezones } from "@/lib/dates";
import { useEffect, useRef, useState } from "react";
import {
    Archive,
    ArrowLeft,
    Plus,
    Check,
    Eye,
    EyeOff,
    ImagePlus,
    LockKeyhole,
    ShieldCheck,
    Trash2,
    Upload,
} from "lucide-react";
import {
    usePreviewData,
    day as fixtureToday,
    addDays,
    dateLabel,
    type Appearance,
} from "./workspace-data";
import { Confirm, Field, FormDialog, Tabs } from "./ui";
import Dialog from "../dialog";
import LiveSecurity from "../live-security";
import { forgetOfflineNotes } from "@/lib/offline-notes";
import type { Text } from "./shared";
const scenes = [
    ["mountain", "Summit trail", "Đường lên đỉnh"],
    ["forest", "Forest path", "Lối mòn trong rừng"],
    ["ocean", "Coastal cove", "Vịnh ven biển"],
    ["pisces", "Pisces", "Song Ngư"],
    ["stars", "Starlit lake", "Hồ dưới trời sao"],
];
const archiveKinds = [
    "areas",
    "goals",
    "milestones",
    "tasks",
    "habits",
    "task-series",
    "notes",
    "reviews",
] as const;
type Kind = (typeof archiveKinds)[number];
type ArchivedRow = { kind: Kind; id: string; title: string; group: string };
export default function SettingsPreview({
    text,
    section,
}: {
    text: Text;
    section: string;
}) {
    const db = usePreviewData();
    const day = db.today || fixtureToday;
    const [appearance, setAppearance] = useState<Appearance | null>(null),
        [verify, setVerify] = useState(false),
        [password, setPassword] = useState(false),
        [showPassword, setShowPassword] = useState(false),
        [mfa, setMfa] = useState<"email" | "app" | "off" | null>(null),
        [step, setStep] = useState(1),
        [error, setError] = useState(""),
        [deleting, setDeleting] = useState(false),
        [query, setQuery] = useState(""),
        [filter, setFilter] = useState("all"),
        [page, setPage] = useState(0),
        [remove, setRemove] = useState<ArchivedRow | "all" | null>(null),
        [ack, setAck] = useState(false),
        [historyQuery, setHistoryQuery] = useState("");
    const files = useRef<string[]>([]);
    useEffect(
        () => () => files.current.forEach((url) => URL.revokeObjectURL(url)),
        [],
    );
    const [appearanceTab, setAppearanceTab] = useState("themes");
    const [backgroundOpen, setBackgroundOpen] = useState(false);
    const current = appearance || db.appearance;
    const change = (value: Partial<Appearance>) => {
        const next = { ...current, ...value };
        setAppearance(next);
        if (!("quote" in value)) {
            db.setAppearance(next);
            db.setAppearancePreview(null);
        }
    };
    async function liveAsset(file: File, purpose: "avatar" | "background") {
        try {
            const result = (await db.live!.upload(
                "/account-files",
                file,
                purpose,
            )) as { id: string; url: string };
            if (purpose === "avatar")
                await db.live!.request("/profile", {
                    method: "PUT",
                    body: JSON.stringify({ avatar_id: result.id }),
                });
            await db.live!.refresh();
            if (purpose === "background") {
                change({
                    background: result.url,
                    backgrounds: [...db.appearance.backgrounds, result.url],
                });
                await db.live!.flush();
            }
        } catch (err) {
            setError((err as Error).message);
        }
    }
    const fileUrl = (file: File) => {
        if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
            db.setMessage(
                text("Choose an image under 5 MB.", "Chọn ảnh dưới 5 MB."),
            );
            return "";
        }
        const url = URL.createObjectURL(file);
        files.current.push(url);
        return url;
    };
    const list: ArchivedRow[] = archiveKinds.flatMap((kind) =>
        (kind === "task-series" ? db.series.map(row => ({ ...row.template, id: row.id })) : db[kind])
            .filter((row) => row.archived)
            .map((row) => ({
                kind,
                id: String(row.id),
                title: typeof row.title === "string" ? row.title : text(...row.title),
                group: row.archivedWith || `${kind}:${row.id}`,
            })),
    );
    const roots = list.filter(
        (row) =>
            !list.some(
                (other) =>
                    other !== row && `${other.kind}:${other.id}` === row.group,
            ),
    );
    const matches = roots.filter(
        (row) =>
            (filter === "all" || row.kind === filter) &&
            row.title.toLowerCase().includes(query.toLowerCase()),
    );
    function blocker(row: ArchivedRow) {
        if (row.kind === "areas")
            return db.areas.filter((a) => !a.archived).length >= 4
                ? text(
                      "Four Areas are already active.",
                      "Đã có bốn lĩnh vực đang dùng.",
                  )
                : "";
        let parent:
            | {
                  title: readonly [string, string];
                  archived: boolean;
                  archivedWith?: string;
              }
            | undefined;
        if (row.kind === "goals") {
            const value = db.goals.find((g) => g.id === row.id)!;
            parent = value.parent
                ? db.goals.find((g) => g.id === value.parent)
                : db.areas.find((a) => a.id === value.area);
        }
        if (row.kind === "milestones")
            parent = db.goals.find(
                (g) =>
                    g.id === db.milestones.find((m) => m.id === row.id)?.goal,
            );
        if (row.kind === "tasks") {
            const value = db.tasks.find((t) => String(t.id) === row.id)!;
            parent =
                db.goals.find((g) => g.id === value.parent) ||
                db.milestones.find((m) => m.id === value.parent);
        }
        return parent?.archived && parent.archivedWith !== row.group
            ? text("Restore parent first: ", "Khôi phục mục cha trước: ") +
                  text(...parent.title)
            : "";
    }
    const title = (
        {
            profile: text("Profile", "Hồ sơ"),
            appearance: text("Appearance", "Giao diện"),
            security: text("Security", "Bảo mật"),
            notifications: text("Notifications", "Thông báo"),
            history: text("Task history", "Lịch sử công việc"),
            archive: text("Archive", "Lưu trữ"),
        } as Record<string, string>
    )[section];
    return (
        <div
            className="review-settings settings-page"
            data-settings-section={section}
        >
            <PageHeaderFrame illustrated={false} className="settings-header">
                <div>
                    {section !== "notifications" && (
                        <p className="eyebrow">
                            {text("Account", "Tài khoản")}
                        </p>
                    )}
                    <h1>{title || text("Settings", "Cài đặt")}</h1>
                    {error && db.live && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                    {section === "profile" && (
                        <p>
                            {text(
                                "Information shown in your planning workspace.",
                                "Thông tin hiển thị trong không gian lập kế hoạch của bạn.",
                            )}
                        </p>
                    )}
                    {section === "appearance" && (
                        <p>
                            {text(
                                "Choose a workspace that is comfortable to read and use.",
                                "Chọn giao diện dễ đọc và thuận tiện cho bạn.",
                            )}
                        </p>
                    )}
                    {section === "security" && (
                        <p>
                            {text(
                                "Change your password and protect sign-in with two-step verification.",
                                "Đổi mật khẩu và bảo vệ đăng nhập bằng xác minh hai bước.",
                            )}
                        </p>
                    )}
                    {section === "history" && (
                        <p>
                            {text(
                                "Finished and long-overdue tasks move here so your lists stay focused. Reopen any task to bring it back.",
                                "Công việc đã xong hoặc quá hạn lâu được đưa vào đây. Mở lại để đưa công việc về danh sách.",
                            )}
                        </p>
                    )}
                    {section === "archive" && (
                        <p>
                            {text(
                                "Archived items keep their data. Restore one to bring it back together with everything archived with it.",
                                "Các mục lưu trữ vẫn giữ dữ liệu. Khôi phục để đưa mục đó cùng nội dung đã lưu trữ chung trở lại danh sách.",
                            )}
                        </p>
                    )}
                </div>
                {["profile", "appearance", "security"].includes(section) && (
                    <button
                        className="button button-quiet"
                        onClick={() => db.navigate("dashboard")}
                    >
                        <ArrowLeft size={16} />
                        {text("Back to Dashboard", "Về Dashboard")}
                    </button>
                )}
            </PageHeaderFrame>
            {section === "history" && (
                <button
                    className="text-button"
                    onClick={() => db.navigate("tasks")}
                >
                    {text("Back to Tasks", "Về Công việc")}
                </button>
            )}
            {section === "profile" && (
                <>
                    <form
                        className="planning-panel stack-form review-settings-card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const form = new FormData(e.currentTarget);
                            db.setProfile((p) => ({
                                ...p,
                                name: String(form.get("name")).trim(),
                                bio: String(form.get("bio")),
                                timezone: String(form.get("timezone")),
                            }));
                            db.setMessage(
                                text("Profile saved.", "Đã lưu hồ sơ."),
                            );
                        }}
                    >
                        <h2>{text("Your profile", "Hồ sơ của bạn")}</h2>
                        <div className="review-avatar-row">
                            {db.profile.avatar ? (
                                <img
                                    className="review-avatar"
                                    src={db.profile.avatar}
                                    alt={db.profile.name}
                                />
                            ) : (
                                <span className="review-avatar">
                                    {db.profile.name.slice(0, 1)}
                                </span>
                            )}
                            <label className="button button-quiet review-file-input">
                                <Upload size={16} />
                                {text("Choose photo", "Chọn ảnh")}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (db.live) {
                                                void liveAsset(file, "avatar");
                                                e.target.value = "";
                                                return;
                                            }
                                            const url = fileUrl(file);
                                            if (url)
                                                db.setProfile((p) => ({
                                                    ...p,
                                                    avatar: url,
                                                }));
                                        }
                                        e.target.value = "";
                                    }}
                                />
                            </label>
                            {db.profile.avatar && (
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={async () => {
                                        if (db.live) {
                                            await db.live.request("/profile", {
                                                method: "PUT",
                                                body: JSON.stringify({
                                                    remove_avatar: true,
                                                }),
                                            });
                                            await db.live.refresh();
                                            return;
                                        }
                                        db.setProfile((p) => ({
                                            ...p,
                                            avatar: "",
                                        }));
                                    }}
                                >
                                    {text("Remove photo", "Bỏ ảnh")}
                                </button>
                            )}
                        </div>
                        <Field label={text("Display name", "Tên hiển thị")}>
                            <Input
                                name="name"
                                required
                                maxLength={100}
                                defaultValue={db.profile.name}
                            />
                        </Field>
                        <Field label={text("Biography", "Giới thiệu")}>
                            <Textarea
                                name="bio"
                                rows={3}
                                maxLength={500}
                                defaultValue={db.profile.bio}
                            />
                        </Field>
                        <Field label={text("Timezone", "Múi giờ")}>
                            <Select
                                name="timezone"
                                defaultValue={db.profile.timezone}
                            >
                                {timezones(db.profile.timezone).map((z) => (
                                    <option key={z}>{z}</option>
                                ))}
                            </Select>
                        </Field>
                        <div className="review-form-footer">
                            <button className="button button-primary">
                                {text("Save profile", "Lưu hồ sơ")}
                            </button>
                        </div>
                    </form>
                    <form
                        className="planning-panel stack-form review-settings-card"
                        onSubmit={async (e) => {
                            e.preventDefault();
                            const values = new FormData(e.currentTarget),
                                email = String(values.get("email"))
                                    .trim()
                                    .toLowerCase();
                            if (email === db.profile.email) return;
                            if (db.live) {
                                try {
                                    await db.live.request(
                                        "/auth/email/change",
                                        {
                                            method: "POST",
                                            body: JSON.stringify({
                                                email,
                                                current_password: String(
                                                    values.get("password"),
                                                ),
                                            }),
                                        },
                                    );
                                    await db.live.refresh();
                                    setVerify(true);
                                    setError("");
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                                return;
                            }
                            db.setProfile((p) => ({
                                ...p,
                                pendingEmail: email,
                            }));
                            setVerify(true);
                            setError("");
                        }}
                    >
                        <h2>{text("Email address", "Địa chỉ email")}</h2>
                        {db.live && (
                            <Field
                                label={text(
                                    "Current password",
                                    "Mật khẩu hiện tại",
                                )}
                            >
                                <input
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    maxLength={128}
                                />
                            </Field>
                        )}
                        <p>
                            {db.profile.email}{" "}
                            <span className="review-badge">
                                {db.live &&
                                !db.live.identity.user.email_verified
                                    ? text("Unverified", "Chưa xác minh")
                                    : text("Verified", "Đã xác minh")}
                            </span>
                        </p>
                        <Field label={text("New email", "Email mới")}>
                            <input
                                name="email"
                                type="email"
                                required
                                placeholder="you@example.test"
                            />
                        </Field>
                        <div className="review-form-footer">
                            <button className="button button-quiet">
                                {text("Change email", "Đổi email")}
                            </button>
                        </div>
                        {db.profile.pendingEmail && (
                            <aside className="notice">
                                <p>
                                    {text(
                                        "Pending confirmation: ",
                                        "Đang chờ xác nhận: ",
                                    )}
                                    {db.profile.pendingEmail}
                                </p>
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={() => {
                                        setVerify(true);
                                        setError("");
                                    }}
                                >
                                    {text(
                                        db.live
                                            ? "Enter code"
                                            : "Enter sample code",
                                        db.live ? "Nhập mã" : "Nhập mã mẫu",
                                    )}
                                </button>
                                <button
                                    className="text-button"
                                    type="button"
                                    onClick={async () => {
                                        if (db.live) {
                                            await db.live.request(
                                                "/auth/email/change",
                                                { method: "DELETE" },
                                            );
                                            await db.live.refresh();
                                            return;
                                        }
                                        db.setProfile((p) => ({
                                            ...p,
                                            pendingEmail: "",
                                        }));
                                    }}
                                >
                                    {text("Cancel change", "Hủy thay đổi")}
                                </button>
                            </aside>
                        )}
                    </form>
                </>
            )}
            {section === "appearance" && (
                <>
                    <Tabs
                        id="review-appearance"
                        value={appearanceTab}
                        onChange={setAppearanceTab}
                        label={text(
                            "Appearance sections",
                            "Các phần giao diện",
                        )}
                        items={[
                            ["themes", text("Themes", "Chủ đề")],
                            [
                                "decoration",
                                text(
                                    "Scenery and quote",
                                    "Phong cảnh và câu trích dẫn",
                                ),
                            ],
                        ]}
                    />
                    <Surface
                        className="stack-form review-settings-card review-appearance"
                        role="tabpanel"
                        id="review-appearance-panel-themes"
                        aria-labelledby="review-appearance-tab-themes"
                        hidden={appearanceTab !== "themes"}
                    >
                        <div>
                            <h2>
                                {text("Choose your scenery", "Chọn phong cảnh")}
                            </h2>
                            <p className="subtle-copy">
                                {text(
                                    "Five illustrated themes, made for your workspace.",
                                    "Năm chủ đề minh họa dành cho không gian của bạn.",
                                )}
                            </p>
                        </div>
                        <div className="review-scenery-grid">
                            {scenes.map(([key, en, vi]) => (
                                <button
                                    key={key}
                                    aria-pressed={
                                        current.scene === key &&
                                        !current.background
                                    }
                                    className="review-scenery"
                                    onClick={() =>
                                        change({ scene: key, background: "" })
                                    }
                                >
                                    <img src={`/themes/${key}.webp`} alt="" />
                                    <span>{text(en, vi)}</span>
                                    {current.scene === key &&
                                        !current.background && (
                                            <Check size={18} />
                                        )}
                                </button>
                            ))}
                            <button
                                className="review-scenery review-personal-scenery"
                                onClick={() => setBackgroundOpen(true)}
                            >
                                <Plus size={25} />
                                <span>
                                    {text(
                                        "Your image or color",
                                        "Ảnh hoặc màu của bạn",
                                    )}
                                </span>
                            </button>
                        </div>

                        <section className="preference-section">
                            <div>
                                <h2>
                                    {text("Display mode", "Chế độ giao diện")}
                                </h2>
                                <p className="subtle-copy">
                                    {text(
                                        "Change the interface color scheme.",
                                        "Thay đổi chế độ màu của giao diện.",
                                    )}
                                </p>
                            </div>
                            <div
                                className="segmented-control"
                                role="group"
                                aria-label={text("Theme", "Chế độ giao diện")}
                            >
                                {[
                                    ["light", text("Light", "Sáng")],
                                    ["dark", text("Dark", "Tối")],
                                ].map(([key, title]) => (
                                    <button
                                        className="segment-button"
                                        key={key}
                                        aria-pressed={current.theme === key}
                                        onClick={() =>
                                            change({
                                                theme: key as "light" | "dark",
                                            })
                                        }
                                    >
                                        {title}
                                    </button>
                                ))}
                            </div>
                        </section>
                    </Surface>
                    <Surface
                        className="stack-form review-settings-card review-appearance"
                        role="tabpanel"
                        id="review-appearance-panel-decoration"
                        aria-labelledby="review-appearance-tab-decoration"
                        hidden={appearanceTab !== "decoration"}
                    >
                        <div className="theme-preview-region">
                            <img
                                className="theme-preview"
                                src={`/themes/${current.scene}.webp`}
                                alt=""
                            />
                            <blockquote className="theme-quote">
                                {current.quote ||
                                    text(
                                        "Small steps add up to great results.",
                                        "Những bước nhỏ cộng dồn thành kết quả lớn.",
                                    )}
                            </blockquote>
                        </div>
                        {(
                            [
                                [
                                    "showBackground",
                                    "Show scenery",
                                    "Hiện khung cảnh",
                                ],
                                [
                                    "showIllustrations",
                                    "Show illustrations",
                                    "Hiện minh họa",
                                ],
                                ["showQuote", "Show quote", "Hiện câu nhắn"],
                            ] as const
                        ).map(([key, en, vi]) => (
                            <label className="review-toggle" key={key}>
                                <span>{text(en, vi)}</span>
                                <input
                                    type="checkbox"
                                    role="switch"
                                    checked={current[key]}
                                    onChange={(e) =>
                                        change({ [key]: e.target.checked })
                                    }
                                />
                            </label>
                        ))}
                        <Field
                            label={text(
                                "Your quote (optional)",
                                "Câu trích dẫn của bạn (tùy chọn)",
                            )}
                        >
                            <textarea
                                rows={2}
                                maxLength={500}
                                value={current.quote}
                                onChange={(e) =>
                                    change({ quote: e.target.value })
                                }
                                placeholder={text(
                                    "Small steps compound into big results.",
                                    "Những bước nhỏ cộng dồn thành kết quả lớn.",
                                )}
                            />
                        </Field>

                        <div className="action-row">
                            <button
                                className="button button-primary"
                                onClick={() => {
                                    db.setAppearance({
                                        ...db.appearance,
                                        quote: current.quote,
                                    });
                                    setAppearance(null);
                                    db.setMessage(
                                        text(
                                            "Quote saved.",
                                            "Đã lưu câu trích dẫn.",
                                        ),
                                    );
                                }}
                            >
                                {text("Save quote", "Lưu câu trích dẫn")}
                            </button>
                            <button
                                className="button button-quiet"
                                onClick={() => change({ quote: "" })}
                            >
                                {text("Restore preset", "Khôi phục mặc định")}
                            </button>
                        </div>
                    </Surface>
                    <Surface className="review-settings-card">
                        <Field label={text("Language", "Ngôn ngữ")}>
                            <select
                                value={db.locale}
                                onChange={(event) =>
                                    db.setLocale(
                                        event.target.value as "en" | "vi",
                                    )
                                }
                            >
                                <option value="en">English</option>
                                <option value="vi">Tiếng Việt</option>
                            </select>
                        </Field>
                    </Surface>
                    {backgroundOpen && (
                        <Dialog
                            title={text(
                                "Personal background",
                                "Nền riêng của bạn",
                            )}
                            className="preview-dialog review-dialog review-compact"
                            closeLabel={text("Close", "Đóng")}
                            onClose={() => setBackgroundOpen(false)}
                        >
                            <div className="preview-dialog-body stack-form">
                                <div className="review-backgrounds">
                                    {current.backgrounds.map((url) => (
                                        <div key={url}>
                                            <button
                                                className="review-background"
                                                aria-label={text(
                                                    "Use uploaded background",
                                                    "Dùng ảnh nền đã tải",
                                                )}
                                                aria-pressed={
                                                    current.background === url
                                                }
                                                onClick={() =>
                                                    change({ background: url })
                                                }
                                            >
                                                <img src={url} alt="" />
                                            </button>
                                            <button
                                                className="text-button"
                                                onClick={async () => {
                                                    if (db.live) {
                                                        try {
                                                            await db.live.request(
                                                                `/account-files/${url.split("/").pop()}`,
                                                                {
                                                                    method: "DELETE",
                                                                },
                                                            );
                                                            await db.live.refresh();
                                                            setAppearance(null);
                                                        } catch (err) {
                                                            setError(
                                                                (err as Error)
                                                                    .message,
                                                            );
                                                        }
                                                        return;
                                                    }
                                                    change({
                                                        backgrounds:
                                                            current.backgrounds.filter(
                                                                (value) =>
                                                                    value !==
                                                                    url,
                                                            ),
                                                        background:
                                                            current.background ===
                                                            url
                                                                ? ""
                                                                : current.background,
                                                    });
                                                }}
                                            >
                                                {text("Remove", "Bỏ")}
                                            </button>
                                        </div>
                                    ))}
                                    <label className="button button-quiet review-file-input">
                                        <ImagePlus size={17} />
                                        {text(
                                            "Upload background",
                                            "Tải ảnh nền",
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file =
                                                    e.target.files?.[0];
                                                if (file) {
                                                    if (db.live) {
                                                        void liveAsset(
                                                            file,
                                                            "background",
                                                        );
                                                        e.target.value = "";
                                                        return;
                                                    }
                                                    const url = fileUrl(file);
                                                    if (url)
                                                        change({
                                                            background: url,
                                                            backgrounds: [
                                                                ...current.backgrounds,
                                                                url,
                                                            ],
                                                        });
                                                }
                                                e.target.value = "";
                                            }}
                                        />
                                    </label>
                                </div>
                                <div className="review-field-pair">
                                    <Field
                                        label={text(
                                            "Custom background color (RGB)",
                                            "Màu nền riêng (RGB)",
                                        )}
                                    >
                                        <input
                                            type="color"
                                            value={
                                                current.background.startsWith(
                                                    "#",
                                                )
                                                    ? current.background
                                                    : "#f3f7ff"
                                            }
                                            onChange={(e) =>
                                                change({
                                                    background: e.target.value,
                                                })
                                            }
                                        />
                                    </Field>
                                    <button
                                        className="text-button"
                                        onClick={() =>
                                            change({ background: "" })
                                        }
                                    >
                                        {text(
                                            "Reset background",
                                            "Đặt lại màu nền",
                                        )}
                                    </button>
                                </div>

                                <button
                                    className="button button-primary"
                                    onClick={() => setBackgroundOpen(false)}
                                >
                                    {text("Done", "Xong")}
                                </button>
                            </div>
                        </Dialog>
                    )}
                </>
            )}
            {section === "security" && db.live && <LiveSecurity text={text} />}
            {section === "security" && !db.live && (
                <>
                    <article className="planning-panel review-settings-card">
                        <h2>
                            <LockKeyhole size={20} />
                            {text("Password", "Mật khẩu")}
                        </h2>
                        <p>
                            {text(
                                "Use a strong password unique to your account.",
                                "Dùng mật khẩu mạnh và riêng cho tài khoản này.",
                            )}
                        </p>
                        <button
                            className="button button-quiet"
                            onClick={() => {
                                setPassword(true);
                                setError("");
                            }}
                        >
                            {text("Change password", "Đổi mật khẩu")}
                        </button>
                        {db.profile.passwordChanged && (
                            <p className="notice">
                                {text(
                                    "Password change preview completed.",
                                    "Đã hoàn tất luồng đổi mật khẩu mẫu.",
                                )}
                            </p>
                        )}
                    </article>
                    <article className="planning-panel review-settings-card">
                        <h2>
                            <ShieldCheck size={20} />
                            {text(
                                "Two-factor authentication",
                                "Xác thực hai bước",
                            )}
                        </h2>
                        <p>
                            {text("Current method: ", "Phương thức hiện tại: ")}
                            {db.profile.mfa === "none"
                                ? text("Not enabled", "Chưa bật")
                                : db.profile.mfa === "app"
                                  ? text(
                                        "Authenticator app",
                                        "Ứng dụng xác thực",
                                    )
                                  : "Email"}
                        </p>
                        <div className="action-row">
                            <button
                                className="button button-quiet"
                                onClick={() => {
                                    setMfa("email");
                                    setStep(1);
                                    setError("");
                                }}
                            >
                                {text("Set up email", "Thiết lập email")}
                            </button>
                            <button
                                className="button button-quiet"
                                onClick={() => {
                                    setMfa("app");
                                    setStep(1);
                                    setError("");
                                }}
                            >
                                {text("Set up app", "Thiết lập ứng dụng")}
                            </button>
                            {db.profile.mfa !== "none" && (
                                <button
                                    className="text-button"
                                    onClick={() => {
                                        setMfa("off");
                                        setStep(2);
                                        setError("");
                                    }}
                                >
                                    {text("Turn off", "Tắt xác thực hai bước")}
                                </button>
                            )}
                        </div>
                    </article>
                    <article className="planning-panel review-settings-card review-danger-zone">
                        <h2>{text("Delete account", "Xóa tài khoản")}</h2>
                        <p>
                            {text(
                                "Review what will be removed before confirming.",
                                "Xem lại những gì bị xóa trước khi xác nhận.",
                            )}
                        </p>
                        <button
                            className="button button-danger"
                            onClick={() => {
                                setDeleting(true);
                                setAck(false);
                            }}
                        >
                            {text("Delete account", "Xóa tài khoản")}
                        </button>
                        {db.profile.accountDeleted && (
                            <p className="notice">
                                {text(
                                    "Deletion confirmation preview completed. This sample account is still available for review.",
                                    "Đã hoàn tất luồng xác nhận xóa mẫu. Tài khoản minh họa vẫn còn để tiếp tục duyệt.",
                                )}
                            </p>
                        )}
                    </article>
                    <p className="review-caption">
                        {text(
                            "UI example only. Use invented passwords and code 123456. No real credentials or emails are processed.",
                            "Chỉ là ví dụ giao diện. Dùng mật khẩu tự đặt và mã 123456. Không xử lý thông tin đăng nhập hoặc email thật.",
                        )}
                    </p>
                </>
            )}
            {section === "notifications" && (
                <form
                    className="planning-panel stack-form review-settings-card"
                    onSubmit={(e) => {
                        e.preventDefault();
                        const values = new FormData(e.currentTarget);
                        db.setProfile((p) => ({
                            ...p,
                            notifications: {
                                inApp: values.has("inApp"),
                                email: values.has("email"),
                                reminders: values.has("reminders"),
                                shares: values.has("shares"),
                            },
                        }));
                        db.setMessage(
                            text(
                                "Notification preferences saved.",
                                "Đã lưu tùy chọn thông báo.",
                            ),
                        );
                    }}
                >
                    <h2>{text("Stay informed", "Nhận thông tin cần thiết")}</h2>
                    {(
                        [
                            [
                                "inApp",
                                "In-app notifications",
                                "Thông báo trong ứng dụng",
                            ],
                            [
                                "email",
                                "Email notifications",
                                "Thông báo qua email",
                            ],
                            ["reminders", "Task reminders", "Nhắc công việc"],
                            [
                                "shares",
                                "Note sharing updates",
                                "Cập nhật chia sẻ ghi chú",
                            ],
                        ] as const
                    ).map(([key, en, vi]) => (
                        <label className="review-toggle" key={key}>
                            <span>{text(en, vi)}</span>
                            <input
                                type="checkbox"
                                role="switch"
                                name={key}
                                defaultChecked={db.profile.notifications[key]}
                            />
                        </label>
                    ))}
                    <p className="review-caption">
                        {text(
                            db.live
                                ? "Preferences apply to future notifications and email delivery."
                                : "Delivery is illustrative in this preview.",
                            db.live
                                ? "Tùy chọn áp dụng cho thông báo và email được gửi sau này."
                                : "Việc gửi thông báo chỉ được minh họa trong bản xem thử.",
                        )}
                    </p>
                    <div className="review-form-footer">
                        <button className="button button-primary">
                            {text("Save preferences", "Lưu tùy chọn")}
                        </button>
                    </div>
                </form>
            )}
            {section === "history" && (
                <>
                    <form
                        className="planning-panel stack-form review-settings-card"
                        onSubmit={(e) => {
                            e.preventDefault();
                            const values = new FormData(e.currentTarget);
                            db.setProfile((p) => ({
                                ...p,
                                completedHours: Number(values.get("hours")),
                                retentionDays: values.get("retention")
                                    ? Number(values.get("retention"))
                                    : null,
                                overdueDays: Number(values.get("days")),
                            }));
                            db.setMessage(
                                text(
                                    db.live
                                        ? "History preferences saved."
                                        : "History rules saved locally; no automatic archive job runs in this preview.",
                                    db.live
                                        ? "Đã lưu tùy chọn lịch sử."
                                        : "Đã lưu quy tắc mẫu; bản xem thử không chạy tác vụ lưu trữ tự động.",
                                ),
                            );
                        }}
                    >
                        <h2>
                            {text("Retention rules", "Quy tắc giữ lịch sử")}
                        </h2>
                        <div className="review-field-pair">
                            <Field
                                label={text(
                                    "Keep completed tasks (hours)",
                                    "Giữ công việc đã xong (giờ)",
                                )}
                            >
                                <input
                                    name="hours"
                                    type="number"
                                    min={1}
                                    max={8760}
                                    required
                                    defaultValue={db.profile.completedHours}
                                />
                            </Field>
                            <Field
                                label={text(
                                    "Keep overdue tasks (days)",
                                    "Giữ công việc quá hạn (ngày)",
                                )}
                            >
                                <input
                                    name="days"
                                    type="number"
                                    min={1}
                                    max={365}
                                    required
                                    defaultValue={db.profile.overdueDays}
                                />
                            </Field>
                        </div>
                        {db.live && (
                            <Field
                                label={text(
                                    "Archive history after (days, optional)",
                                    "Lưu trữ lịch sử sau (ngày, tùy chọn)",
                                )}
                                hint={text(
                                    "Retention starts when a Task enters History. The system cap still applies.",
                                    "Thời gian giữ tính từ lúc công việc vào Lịch sử. Giới hạn hệ thống vẫn áp dụng.",
                                )}
                            >
                                <input
                                    name="retention"
                                    type="number"
                                    min={1}
                                    max={3650}
                                    defaultValue={
                                        db.profile.retentionDays ?? ""
                                    }
                                />
                            </Field>
                        )}
                        <p className="review-caption">
                            {text(
                                "Expired items go to Archive. History rules never hard-delete work.",
                                "Mục hết thời gian giữ được chuyển vào Lưu trữ, không bị xóa vĩnh viễn.",
                            )}
                        </p>
                        <div className="review-form-footer">
                            <button className="button button-primary">
                                {text("Save rules", "Lưu quy tắc")}
                            </button>
                        </div>
                    </form>
                    <Surface className="review-settings-card">
                        <div className="section-heading">
                            <h2>
                                {text(
                                    "Retained tasks",
                                    "Công việc trong lịch sử",
                                )}
                            </h2>
                            <input
                                aria-label={text(
                                    "Search history",
                                    "Tìm lịch sử",
                                )}
                                placeholder={text(
                                    "Find a task…",
                                    "Tìm công việc…",
                                )}
                                value={historyQuery}
                                onChange={(e) =>
                                    setHistoryQuery(e.target.value)
                                }
                            />
                        </div>
                        {db.tasks
                            .filter(
                                (t) =>
                                    !t.archived &&
                                    (db.live
                                        ? t.history
                                        : t.status === "Done" ||
                                          (t.due && t.due < day)) &&
                                    text(...t.title)
                                        .toLowerCase()
                                        .includes(historyQuery.toLowerCase()),
                            )
                            .map((t) => (
                                <div className="review-history-row" key={t.id}>
                                    <div>
                                        <button
                                            className="text-button"
                                            onClick={() =>
                                                db.navigate("tasks", {
                                                    task: t.id,
                                                })
                                            }
                                        >
                                            {text(...t.title)}
                                        </button>
                                        <small>
                                            {dateLabel(t.due, db.locale)} ·{" "}
                                            {t.status === "Done"
                                                ? text(
                                                      "Completed",
                                                      "Hoàn thành",
                                                  )
                                                : text("Overdue", "Quá hạn")}
                                        </small>
                                    </div>
                                    <button
                                        className="button button-quiet"
                                        onClick={() =>
                                            db.setTaskAction({
                                                kind:
                                                    t.status === "Done"
                                                        ? "complete"
                                                        : "edit",
                                                id: t.id,
                                            })
                                        }
                                    >
                                        {text(
                                            t.status === "Done"
                                                ? "Reopen"
                                                : "Reschedule",
                                            t.status === "Done"
                                                ? "Mở lại"
                                                : "Đổi lịch",
                                        )}
                                    </button>
                                    <button
                                        className="text-button"
                                        onClick={() =>
                                            db.archiveEntity(
                                                "tasks",
                                                String(t.id),
                                                false,
                                            )
                                        }
                                    >
                                        {text("Archive", "Lưu trữ")}
                                    </button>
                                </div>
                            ))}
                    </Surface>
                </>
            )}
            {section === "archive" && (
                <Surface className="review-settings-card">
                    <div className="review-toolbar">
                        <div>
                            <h2>
                                {text(
                                    "Your archived work",
                                    "Nội dung đã lưu trữ",
                                )}
                            </h2>
                            <p className="review-caption">
                                {text(
                                    "Items archived together are restored together.",
                                    "Các mục lưu trữ cùng nhau sẽ được khôi phục cùng nhau.",
                                )}
                            </p>
                        </div>
                        <button
                            className="button button-danger"
                            disabled={!list.length}
                            onClick={() => {
                                setRemove("all");
                                setAck(false);
                            }}
                        >
                            <Trash2 size={15} />
                            {text("Empty archive", "Dọn sạch lưu trữ")}
                        </button>
                    </div>
                    <div className="review-toolbar">
                        <input
                            className="review-search"
                            aria-label={text(
                                "Search archive",
                                "Tìm trong lưu trữ",
                            )}
                            placeholder={text(
                                "Search archived work…",
                                "Tìm nội dung đã lưu trữ…",
                            )}
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                setPage(0);
                            }}
                        />
                        <select
                            aria-label={text("Archive type", "Loại lưu trữ")}
                            value={filter}
                            onChange={(e) => {
                                setFilter(e.target.value);
                                setPage(0);
                            }}
                        >
                            <option value="all">
                                {text("Everything", "Tất cả")}
                            </option>
                            {archiveKinds.map((kind, i) => (
                                <option key={kind} value={kind}>
                                    {text(
                                        [
                                            "Areas",
                                            "Goals",
                                            "Milestones",
                                            "Tasks",
                                            "Habits",
                                            "Repeating series", "Notes (recovery)", "Reviews (recovery)",
                                        ][i],
                                        [
                                            "Lĩnh vực",
                                            "Mục tiêu",
                                            "Cột mốc",
                                            "Công việc",
                                            "Thói quen",
                                            "Chuỗi lặp", "Ghi chú (khôi phục)", "Đánh giá (khôi phục)",
                                        ][i],
                                    )}
                                </option>
                            ))}
                        </select>
                    </div>
                    {matches.slice(page * 12, page * 12 + 12).map((row) => {
                        const blocked = blocker(row),
                            count = list.filter(
                                (item) => item.group === row.group,
                            ).length;
                        return (
                            <article
                                className="review-archive-row"
                                key={`${row.kind}:${row.id}`}
                            >
                                <Archive size={20} />
                                <div>
                                    <strong>{row.title}</strong>
                                    <small>
                                        {text(
                                            [
                                                "Area",
                                                "Goal",
                                                "Milestone",
                                                "Task",
                                                "Habit",
                                                "Repeating series", "Note", "Review",
                                            ][archiveKinds.indexOf(row.kind)],
                                            [
                                                "Lĩnh vực",
                                                "Mục tiêu",
                                                "Cột mốc",
                                                "Công việc",
                                                "Thói quen",
                                                "Chuỗi lặp", "Ghi chú", "Đánh giá",
                                            ][archiveKinds.indexOf(row.kind)],
                                        )}
                                        {count > 1
                                            ? text(
                                                  ` · returns with ${count - 1} items`,
                                                  ` · khôi phục cùng ${count - 1} mục`,
                                              )
                                            : ""}
                                    </small>
                                    {blocked && (
                                        <p className="field-error">{blocked}</p>
                                    )}
                                </div>
                                <button
                                    className="button button-quiet"
                                    disabled={!!blocked}
                                    title={blocked || undefined}
                                    onClick={async () => {
                                        const restored = await db.restoreEntity(row.kind, row.id);
                                        if (restored === false)
                                            return;
                                        db.setMessage(
                                            text(
                                                "Archived group restored.",
                                                "Đã khôi phục nhóm lưu trữ.",
                                            ),
                                        );
                                    }}
                                >
                                    {text("Restore", "Khôi phục")}
                                </button>
                                <button
                                    className="icon-button danger-text"
                                    aria-label={
                                        text(
                                            "Delete permanently: ",
                                            "Xóa vĩnh viễn: ",
                                        ) + row.title
                                    }
                                    onClick={() => {
                                        setRemove(row);
                                        setAck(false);
                                    }}
                                >
                                    <Trash2 size={17} />
                                </button>
                            </article>
                        );
                    })}
                    {!matches.length && (
                        <p className="review-inline-empty">
                            {text(
                                "No archived items match.",
                                "Không có mục lưu trữ phù hợp.",
                            )}
                        </p>
                    )}
                    {matches.length > 12 && (
                        <div className="review-form-footer">
                            <button
                                className="button button-quiet"
                                disabled={!page}
                                onClick={() => setPage(page - 1)}
                            >
                                {text("Previous", "Trước")}
                            </button>
                            <span>
                                {page + 1}/{Math.ceil(matches.length / 12)}
                            </span>
                            <button
                                className="button button-quiet"
                                disabled={(page + 1) * 12 >= matches.length}
                                onClick={() => setPage(page + 1)}
                            >
                                {text("Next", "Tiếp")}
                            </button>
                        </div>
                    )}
                </Surface>
            )}
            {verify && (
                <FormDialog
                    text={text}
                    title={text("Confirm new email", "Xác nhận email mới")}
                    onClose={() => setVerify(false)}
                    onSubmit={async (form) => {
                        if (db.live) {
                            await db.live.request("/auth/email/confirm", {
                                method: "POST",
                                body: JSON.stringify({
                                    code: String(
                                        new FormData(form).get("code"),
                                    ),
                                }),
                            });
                            await forgetOfflineNotes();
                            location.assign("/login");
                            return;
                        }
                        if (new FormData(form).get("code") !== "123456") {
                            setError(
                                text(
                                    "Use the sample code 123456.",
                                    "Dùng mã mẫu 123456.",
                                ),
                            );
                            return false;
                        }
                        db.setProfile((p) => ({
                            ...p,
                            email: p.pendingEmail,
                            pendingEmail: "",
                        }));
                        setVerify(false);
                        db.setMessage(
                            text(
                                "Email change preview completed.",
                                "Đã hoàn tất luồng đổi email mẫu.",
                            ),
                        );
                    }}
                >
                    <p>
                        {text(
                            db.live
                                ? "Enter the code sent to your new email address."
                                : "No email is sent. Sample code: 123456.",
                            db.live
                                ? "Nhập mã được gửi đến địa chỉ email mới."
                                : "Không gửi email. Mã mẫu: 123456.",
                        )}
                    </p>
                    <strong>{db.profile.pendingEmail}</strong>
                    <Field label={text("Verification code", "Mã xác minh")}>
                        <input
                            name="code"
                            required
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                        />
                    </Field>
                    {error && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                </FormDialog>
            )}
            {password && (
                <FormDialog
                    text={text}
                    title={text("Change password", "Đổi mật khẩu")}
                    onClose={() => setPassword(false)}
                    onSubmit={(form) => {
                        const values = new FormData(form);
                        if (values.get("new") !== values.get("confirm")) {
                            setError(
                                text(
                                    "The passwords do not match.",
                                    "Mật khẩu xác nhận chưa khớp.",
                                ),
                            );
                            return false;
                        }
                        db.setProfile((p) => ({ ...p, passwordChanged: true }));
                        setPassword(false);
                    }}
                >
                    <p className="review-caption">
                        {text(
                            "Use invented sample values in this UI preview.",
                            "Dùng thông tin giả để xem thử giao diện.",
                        )}
                    </p>
                    {[
                        ["old", "Current password", "Mật khẩu hiện tại"],
                        ["new", "New password", "Mật khẩu mới"],
                        [
                            "confirm",
                            "Confirm new password",
                            "Xác nhận mật khẩu mới",
                        ],
                    ].map(([name, en, vi]) => (
                        <Field key={name} label={text(en, vi)}>
                            <input
                                name={name}
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={name === "old" ? 1 : 8}
                                autoComplete="off"
                            />
                        </Field>
                    ))}
                    <button
                        type="button"
                        className="text-button"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? (
                            <EyeOff size={16} />
                        ) : (
                            <Eye size={16} />
                        )}{" "}
                        {text(
                            showPassword ? "Hide passwords" : "Show passwords",
                            showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu",
                        )}
                    </button>
                    {error && (
                        <p className="field-error" role="alert">
                            {error}
                        </p>
                    )}
                </FormDialog>
            )}
            {mfa && (
                <FormDialog
                    text={text}
                    title={text(
                        mfa === "off"
                            ? "Turn off two-factor authentication"
                            : mfa === "email"
                              ? "Set up email verification"
                              : "Set up authenticator",
                        mfa === "off"
                            ? "Tắt xác thực hai bước"
                            : mfa === "email"
                              ? "Thiết lập xác minh email"
                              : "Thiết lập ứng dụng xác thực",
                    )}
                    onClose={() => setMfa(null)}
                    submitLabel={
                        step === 1
                            ? text("Continue", "Tiếp tục")
                            : text("Confirm", "Xác nhận")
                    }
                    onSubmit={(form) => {
                        if (step === 1) {
                            setStep(2);
                            return;
                        }
                        if (new FormData(form).get("code") !== "123456") {
                            setError(
                                text(
                                    "Use the sample code 123456.",
                                    "Dùng mã mẫu 123456.",
                                ),
                            );
                            return false;
                        }
                        db.setProfile((p) => ({
                            ...p,
                            mfa: mfa === "off" ? "none" : mfa,
                        }));
                        setMfa(null);
                        db.setMessage(
                            text(
                                "Two-factor UI flow completed.",
                                "Đã hoàn tất luồng xác thực hai bước mẫu.",
                            ),
                        );
                    }}
                >
                    {step === 1 ? (
                        <>
                            <p>
                                {mfa === "email"
                                    ? text(
                                          "A confirmation code would be sent to your verified email.",
                                          "Mã xác nhận sẽ được gửi đến email đã xác minh.",
                                      )
                                    : text(
                                          "Add an account in your authenticator, then enter its code. This preview uses an illustrative key only.",
                                          "Thêm tài khoản vào ứng dụng xác thực rồi nhập mã. Bản xem thử chỉ dùng khóa minh họa.",
                                      )}
                            </p>
                            <div className="review-mfa-illustration">
                                <ShieldCheck size={48} />
                                <strong>
                                    {mfa === "email"
                                        ? db.profile.email
                                        : "PLANNER DEMO KEY"}
                                </strong>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>
                                {text(
                                    "Sample code: 123456. No real verification is performed.",
                                    "Mã mẫu: 123456. Không thực hiện xác minh thật.",
                                )}
                            </p>
                            <Field
                                label={text("Verification code", "Mã xác minh")}
                            >
                                <input
                                    name="code"
                                    required
                                    pattern="[0-9]{6}"
                                    inputMode="numeric"
                                    maxLength={6}
                                />
                            </Field>
                            {error && (
                                <p className="field-error" role="alert">
                                    {error}
                                </p>
                            )}
                        </>
                    )}
                </FormDialog>
            )}
            {deleting && (
                <FormDialog
                    text={text}
                    title={text(
                        "Confirm account deletion",
                        "Xác nhận xóa tài khoản",
                    )}
                    onClose={() => setDeleting(false)}
                    submitLabel={text(
                        "Confirm sample deletion",
                        "Xác nhận xóa mẫu",
                    )}
                    onSubmit={(form) => {
                        if (
                            new FormData(form).get("confirm") !== "DELETE" ||
                            !ack
                        )
                            return false;
                        db.setProfile((p) => ({ ...p, accountDeleted: true }));
                        setDeleting(false);
                    }}
                >
                    <p>
                        {text(
                            "The real flow removes your personal planning data and shares. This preview demonstrates confirmation only.",
                            "Luồng thật sẽ xóa dữ liệu kế hoạch cá nhân và chia sẻ. Bản xem thử chỉ minh họa bước xác nhận.",
                        )}
                    </p>
                    <Field
                        label={text(
                            "Type DELETE to confirm",
                            "Nhập DELETE để xác nhận",
                        )}
                    >
                        <input name="confirm" pattern="DELETE" required />
                    </Field>
                    <label className="review-checkbox">
                        <input
                            type="checkbox"
                            checked={ack}
                            required
                            onChange={(e) => setAck(e.target.checked)}
                        />
                        {text(
                            "I have reviewed what will be removed.",
                            "Tôi đã xem lại nội dung sẽ bị xóa.",
                        )}
                    </label>
                </FormDialog>
            )}
            {remove && (
                <Confirm
                    text={text}
                    title={text(
                        remove === "all"
                            ? "Empty the entire archive?"
                            : "Delete permanently?",
                        remove === "all"
                            ? "Dọn sạch toàn bộ lưu trữ?"
                            : "Xóa vĩnh viễn?",
                    )}
                    danger
                    disabled={!ack}
                    onClose={() => setRemove(null)}
                    onConfirm={async () => {
                        const deleted = await db.deleteEntities(
                            remove === "all" ? roots : [remove],
                        );
                        if (deleted === false)
                            throw new Error(
                                text(
                                    "Deletion was not saved. Retry after refreshing.",
                                    "Chưa lưu thao tác xóa. Hãy tải lại rồi thử lại.",
                                ),
                            );
                        setRemove(null);
                        setPage(0);
                        db.setMessage(
                            text(
                                db.live
                                    ? "Permanently deleted."
                                    : "Removed from this preview.",
                                db.live
                                    ? "Đã xóa vĩnh viễn."
                                    : "Đã xóa khỏi bản xem thử.",
                            ),
                        );
                    }}
                >
                    <p>
                        {remove === "all"
                            ? `${list.length} ${text("items and their child work", "mục và nội dung bên trong")}`
                            : remove.title}
                    </p>
                    <p>
                        {text(
                            "This permanently removes the selected work and its contents. References from remaining work are cleared; saved review snapshots remain.",
                            "Xóa vĩnh viễn nội dung được chọn cùng các mục bên trong. Liên kết từ nội dung còn lại được bỏ; ảnh chụp của lần nhìn lại vẫn được giữ.",
                        )}
                    </p>
                    <label className="review-checkbox">
                        <input
                            type="checkbox"
                            checked={ack}
                            onChange={(e) => setAck(e.target.checked)}
                        />
                        {text(
                            "I understand this permanent-delete action.",
                            "Tôi hiểu thao tác xóa vĩnh viễn này.",
                        )}
                    </label>
                </Confirm>
            )}
        </div>
    );
}
