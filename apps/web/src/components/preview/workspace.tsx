"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
    Bell,
    CircleHelp,
    LogOut,
    Menu,
    Moon,
    Sun,
    SlidersHorizontal,
    X,
} from "lucide-react";
import PlanningPreview from "./planning";
import NotesPreview from "./notes";
import CalendarPreview from "./calendar";
import HabitsPreview from "./habits";
import ReviewsPreview from "./reviews";
import SettingsPreview from "./settings";
import SupportPreview, { TourPreview } from "./support";
import AssistantPreview from "./assistant";
import LiveAssistant from "../live-assistant";
import SharedTaskInteraction from "./task-interaction";
import { BaselineIcon, State, Toast } from "./ui";
import { PreviewDataProvider, usePreviewData } from "./workspace-data";
import TasksPreview from "./tasks";
import PreviewDashboard from "./dashboard";
import PreviewNotifications, { type PreviewNotice } from "./notifications";
import type { PreviewLocale, Text, ViewState } from "./shared";

const navigation = [
    ["dashboard", "Dashboard", "Tổng quan", "dashboard"],
    ["goals", "Goals", "Mục tiêu", "goals"],
    ["tasks", "Tasks", "Công việc", "tasks"],
    ["calendar", "Calendar", "Lịch", "calendar"],
    ["habits", "Habits", "Thói quen", "habits"],
    ["notes", "Notes", "Ghi chú", "notes"],
    ["reviews", "Reviews", "Đánh giá", "reviews"],
] as const;
const settings = [
    ["profile", "Profile", "Hồ sơ"],
    ["appearance", "Appearance", "Giao diện"],
    ["security", "Security", "Bảo mật"],
    ["notifications", "Notifications", "Thông báo"],
    ["history", "History", "Lịch sử"],
    ["archive", "Archive", "Lưu trữ"],
    ["reports", "Report a user", "Báo cáo người dùng"],
    ["admin", "Administration", "Quản trị"],
    ["help", "User guide", "Hướng dẫn sử dụng"],
] as const;
const initialNotices: PreviewNotice[] = [
    {
        id: 1,
        read: false,
        title: ["Time for your next step", "Đến lúc bắt đầu bước tiếp theo"],
        description: [
            "Review this week's priorities",
            "Xem lại các ưu tiên trong tuần",
        ],
        time: ["10 minutes ago", "10 phút trước"],
        destination: "tasks",
    },
    {
        id: 2,
        read: false,
        title: [
            "A little progress to celebrate",
            "Một bước tiến đáng ghi nhận",
        ],
        description: [
            "Your learning goal has a new milestone.",
            "Mục tiêu học tập có một cột mốc mới.",
        ],
        time: ["1 hour ago", "1 giờ trước"],
        destination: "goals",
    },
    {
        id: 3,
        read: true,
        title: [
            "A note for your next review",
            "Ghi chú cho lần nhìn lại tiếp theo",
        ],
        description: [
            "Your weekly reflection is ready to revisit.",
            "Bạn có thể đọc lại ghi chú nhìn lại tuần.",
        ],
        time: ["Yesterday", "Hôm qua"],
        destination: "notes",
    },
];
export function WorkspaceView({
    initialLocale,
    initialSection = "tasks",
}: {
    initialLocale: PreviewLocale;
    initialSection?: string;
}) {
    const data = usePreviewData();
    const { locale, setLocale } = data;
    const text: Text = (en, vi) => (locale === "vi" ? vi : en);
    const appearance = data.appearancePreview || data.appearance;
    const { theme, scene } = appearance;
    const setTheme = (value: string) =>
        data.setAppearance((current) => ({
            ...current,
            theme: value as "light" | "dark",
        }));
    const setScene = (value: string) =>
        data.setAppearance((current) => ({ ...current, scene: value }));
    const section = data.nav.section;
    const setSection = (value: string) => data.navigate(value);
    const [mobile, setMobile] = useState(false);
    const [state, setState] = useState<ViewState>("ready");
    const [help, setHelp] = useState(false);
    const [sampleNotices, setNotices] = useState(initialNotices);
    const notices = data.live?.notices || sampleNotices;
    const [noticesOpen, setNoticesOpen] = useState(false);
    const sidebar = useRef<HTMLElement>(null);
    const menuButton = useRef<HTMLButtonElement>(null);
    const bell = useRef<HTMLButtonElement>(null);
    const noticePanel = useRef<HTMLDivElement>(null);
    const title = [...navigation, ...settings].find(([key]) => key === section);
    const isSettings = settings.some(
        ([key]) => key !== "admin" && key === section,
    );
    const heading = title
        ? text(title[1], title[2])
        : text("Tasks", "Công việc");
    const unread =
        state === "empty" ? 0 : notices.filter((item) => !item.read).length;
    useEffect(() => {
        const root = document.documentElement;
        const previous = {
            theme: root.dataset.theme,
            visualTheme: root.dataset.visualTheme,
            showBackground: root.dataset.showBackground,
            showIllustrations: root.dataset.showIllustrations,
            showQuote: root.dataset.showQuote,
            accent: root.style.getPropertyValue("--accent"),
            scene: root.style.getPropertyValue("--theme-scene"),
            lang: root.lang,
        };
        return () => {
            for (const key of [
                "theme",
                "visualTheme",
                "showBackground",
                "showIllustrations",
                "showQuote",
            ] as const) {
                if (previous[key] === undefined) delete root.dataset[key];
                else root.dataset[key] = previous[key];
            }
            if (previous.scene)
                root.style.setProperty("--theme-scene", previous.scene);
            else root.style.removeProperty("--theme-scene");
            if (previous.accent)
                root.style.setProperty("--accent", previous.accent);
            else root.style.removeProperty("--accent");
            root.lang = previous.lang;
        };
    }, []);
    useEffect(() => {
        const root = document.documentElement;
        root.dataset.theme = theme;
        root.dataset.visualTheme = scene;
        root.dataset.showBackground = String(appearance.showBackground);
        root.dataset.showIllustrations = String(appearance.showIllustrations);
        root.dataset.showQuote = String(appearance.showQuote);
        if (appearance.accent)
            root.style.setProperty("--accent", appearance.accent);
        else root.style.removeProperty("--accent");
        root.style.setProperty(
            "--theme-scene",
            appearance.background.startsWith("#")
                ? `linear-gradient(${appearance.background}, ${appearance.background})`
                : `url('${appearance.background || "/themes/" + scene + ".webp"}')`,
        );
        root.lang = locale;
    }, [theme, scene, locale, appearance]);
    useEffect(() => {
        setMobile(false);
        setNoticesOpen(false);
    }, [data.nav.stamp]);
    useEffect(() => {
        if (!mobile) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        sidebar.current?.querySelector<HTMLButtonElement>("button")?.focus();
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setMobile(false);
            }
            if (event.key !== "Tab") return;
            const controls = Array.from(
                sidebar.current!.querySelectorAll<HTMLElement>(
                    "a, button, summary",
                ),
            ).filter((item) => item.getClientRects().length);
            const first = controls[0],
                last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };
        const desktop = window.matchMedia("(min-width: 801px)");
        const resize = () => {
            if (desktop.matches) setMobile(false);
        };
        desktop.addEventListener("change", resize);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKey);
            desktop.removeEventListener("change", resize);
            menuButton.current?.focus();
        };
    }, [mobile]);
    useEffect(() => {
        if (!noticesOpen) return;
        noticePanel.current
            ?.querySelector<HTMLButtonElement>("section button")
            ?.focus();
        const closeOutside = (event: PointerEvent) => {
            if (!noticePanel.current?.contains(event.target as Node))
                setNoticesOpen(false);
        };
        const closeEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setNoticesOpen(false);
                bell.current?.focus();
            }
        };
        document.addEventListener("pointerdown", closeOutside);
        document.addEventListener("keydown", closeEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOutside);
            document.removeEventListener("keydown", closeEscape);
        };
    }, [noticesOpen]);
    useEffect(() => {
        const closeMenus = (event: MouseEvent) => {
            for (const menu of document.querySelectorAll<HTMLDetailsElement>(
                ".review-row-menu[open], .preview-tools[open]",
            ))
                if (
                    !menu.contains(event.target as Node) ||
                    (menu.matches(".review-row-menu") &&
                        (event.target as Element).closest("button"))
                )
                    menu.open = false;
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            const menus = Array.from(
                document.querySelectorAll<HTMLDetailsElement>(
                    ".review-row-menu[open], .preview-tools[open]",
                ),
            );
            const menu = menus.at(-1);
            if (menu) {
                menu.open = false;
                menu.querySelector<HTMLElement>("summary")?.focus();
            }
        };
        document.addEventListener("click", closeMenus);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("click", closeMenus);
            document.removeEventListener("keydown", escape);
        };
    }, []);
    const navigate = (destination: string) => {
        setSection(destination);
        setMobile(false);
        setNoticesOpen(false);
    };
    const closeNotices = () => {
        setNoticesOpen(false);
        bell.current?.focus();
    };

    return (
        <div
            className={`baseline-workspace preview-workspace ${isSettings ? "preview-settings-active" : ""}`}
        >
            <a className="skip-link" href="#preview-main">
                {text("Skip to content", "Đến nội dung chính")}
            </a>
            <aside
                ref={sidebar}
                className={`app-sidebar ${mobile ? "is-open" : ""}`}
                id="preview-sidebar"
                aria-label={text("Primary navigation", "Điều hướng chính")}
            >
                <button
                    className="sidebar-brand"
                    onClick={() => navigate("dashboard")}
                >
                    <span className="brand-symbol" aria-hidden="true">
                        <span />
                        <i />
                    </span>
                    <span>
                        Planner
                        <span className="brand-caption">
                            {text(
                                "Space to move forward",
                                "Không gian để tiến bước",
                            )}
                        </span>
                    </span>
                </button>
                <button
                    className="mobile-sidebar-close icon-button"
                    aria-label={text("Close navigation", "Đóng điều hướng")}
                    onClick={() => setMobile(false)}
                >
                    <X size={20} />
                </button>
                <nav
                    className="sidebar-nav"
                    aria-label={text("Planning", "Lập kế hoạch")}
                >
                    <div className="sidebar-section-label">
                        {text("Your workspace", "Không gian của bạn")}
                    </div>
                    {navigation.map(([key, en, vi, Icon]) => (
                        <a
                            key={key}
                            className={`nav-link ${section === key ? "is-active" : ""}`}
                            aria-current={section === key ? "page" : undefined}
                            href={data.live?.href(key) || `#${key}`}
                            onClick={(event) => {
                                if (
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                )
                                    return;
                                event.preventDefault();
                                navigate(key);
                            }}
                        >
                            <BaselineIcon
                                name={Icon}
                                className="ui-icon nav-icon"
                            />
                            <span>{text(en, vi)}</span>
                        </a>
                    ))}
                    {data.admin && (
                        <a
                            className={`nav-link ${section === "admin" ? "is-active" : ""}`}
                            aria-current={
                                section === "admin" ? "page" : undefined
                            }
                            href={data.live?.href("admin") || "#admin"}
                            onClick={(event) => {
                                if (
                                    event.metaKey ||
                                    event.ctrlKey ||
                                    event.shiftKey ||
                                    event.altKey
                                )
                                    return;
                                event.preventDefault();
                                navigate("admin");
                            }}
                        >
                            <BaselineIcon
                                name="lock"
                                className="ui-icon nav-icon"
                            />
                            <span>{text("Administration", "Quản trị")}</span>
                        </a>
                    )}
                </nav>
                <nav
                    className="sidebar-nav account-nav"
                    aria-label={text("Account", "Tài khoản")}
                >
                    <details
                        className="settings-navigation"
                        key={isSettings ? "settings" : "workspace"}
                        open={isSettings}
                    >
                        <summary className="nav-link">
                            <BaselineIcon
                                name="settings"
                                className="ui-icon nav-icon"
                            />
                            {text("Settings", "Cài đặt")}
                        </summary>
                        {settings
                            .filter(([key]) => key !== "admin")
                            .map(([key, en, vi]) => (
                                <a
                                    key={key}
                                    className={`nav-link ${section === key ? "is-active" : ""}`}
                                    href={data.live?.href(key) || `#${key}`}
                                    onClick={(event) => {
                                        if (
                                            event.metaKey ||
                                            event.ctrlKey ||
                                            event.shiftKey ||
                                            event.altKey
                                        )
                                            return;
                                        event.preventDefault();
                                        navigate(key);
                                    }}
                                >
                                    <BaselineIcon
                                        name={
                                            (
                                                {
                                                    profile: "profile",
                                                    appearance: "appearance",
                                                    security: "lock",
                                                    notifications: "calendar",
                                                    history: "tasks",
                                                    archive: "refresh",
                                                    help: "notes",
                                                    reports: "lock",
                                                } as Record<string, string>
                                            )[key]
                                        }
                                        className="ui-icon nav-icon"
                                    />
                                    {text(en, vi)}
                                </a>
                            ))}
                    </details>
                </nav>
                <div className="sidebar-footer">
                    <button
                        className="sidebar-user"
                        onClick={() => navigate("profile")}
                    >
                        <span className="avatar avatar-small">
                            {data.profile.avatar ? (
                                <img src={data.profile.avatar} alt="" />
                            ) : (
                                data.profile.name.slice(0, 1)
                            )}
                        </span>
                        <span className="sidebar-user-copy">
                            <strong>{data.profile.name}</strong>
                            <small>
                                {text("Personal account", "Tài khoản cá nhân")}
                            </small>
                        </span>
                    </button>
                    <button
                        className="icon-button"
                        aria-label={text("Settings", "Cài đặt")}
                        onClick={() => navigate("profile")}
                    >
                        <BaselineIcon name="settings" />
                    </button>
                    {data.live ? (
                        <button
                            className="icon-button"
                            aria-label={text("Sign out", "Đăng xuất")}
                            onClick={() => void data.live!.logout()}
                        >
                            <LogOut size={19} />
                        </button>
                    ) : (
                        <Link
                            className="icon-button"
                            href={`/preview/login?lang=${locale}`}
                            aria-label={text(
                                "Return to sign-in preview",
                                "Về bản xem thử đăng nhập",
                            )}
                        >
                            <LogOut size={19} />
                        </Link>
                    )}
                </div>
            </aside>
            <button
                className="sidebar-scrim"
                tabIndex={-1}
                aria-label={text("Close navigation", "Đóng điều hướng")}
                onClick={() => setMobile(false)}
            />
            <div className="app-body" inert={mobile}>
                <header className="app-topbar">
                    <div className="topbar-location">
                        <button
                            ref={menuButton}
                            className="mobile-menu-button icon-button"
                            aria-label={text(
                                "Open navigation",
                                "Mở điều hướng",
                            )}
                            aria-expanded={mobile}
                            aria-controls="preview-sidebar"
                            onClick={() => setMobile(true)}
                        >
                            <Menu size={21} />
                        </button>
                        <span className="topbar-space">
                            {text("Personal space", "Không gian cá nhân")}
                        </span>
                        <span className="topbar-divider">/</span>
                        <span>
                            {section === "goals" && data.nav.goal
                                ? text("Goal details", "Chi tiết mục tiêu")
                                : heading}
                        </span>
                    </div>
                    <div className="topbar-actions">
                        {!data.live && (
                            <details className="preview-tools">
                                <summary
                                    className="icon-button"
                                    aria-label={text(
                                        "Preview controls",
                                        "Điều khiển xem thử",
                                    )}
                                    title={text(
                                        "Preview · sample data",
                                        "Xem thử · dữ liệu mẫu",
                                    )}
                                >
                                    <SlidersHorizontal size={18} />
                                </summary>
                                <aside
                                    className="preview-review-bar"
                                    aria-label={text(
                                        "Preview controls",
                                        "Điều khiển xem thử",
                                    )}
                                >
                                    <div>
                                        <strong>
                                            {text(
                                                "Interface preview",
                                                "Xem thử giao diện",
                                            )}
                                        </strong>
                                        <p>
                                            {text(
                                                "Sample content. Changes reset when you reload.",
                                                "Dữ liệu minh họa. Tải lại trang để đặt lại thay đổi.",
                                            )}
                                        </p>
                                    </div>
                                    <div className="preview-review-controls">
                                        <label>
                                            {text("Role", "Vai trò")}
                                            <select
                                                value={
                                                    data.admin
                                                        ? "admin"
                                                        : "user"
                                                }
                                                onChange={(event) =>
                                                    data.setAdmin(
                                                        event.target.value ===
                                                            "admin",
                                                    )
                                                }
                                            >
                                                <option value="user">
                                                    {text(
                                                        "Personal",
                                                        "Cá nhân",
                                                    )}
                                                </option>
                                                <option value="admin">
                                                    {text(
                                                        "Administrator",
                                                        "Quản trị viên",
                                                    )}
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            {text("State", "Trạng thái")}
                                            <select
                                                value={state}
                                                onChange={(event) =>
                                                    setState(
                                                        event.target
                                                            .value as ViewState,
                                                    )
                                                }
                                            >
                                                <option value="ready">
                                                    {text(
                                                        "Populated",
                                                        "Có dữ liệu",
                                                    )}
                                                </option>
                                                <option value="empty">
                                                    {text("Empty", "Trống")}
                                                </option>
                                                <option value="loading">
                                                    {text(
                                                        "Loading",
                                                        "Đang tải",
                                                    )}
                                                </option>
                                                <option value="error">
                                                    {text("Error", "Lỗi")}
                                                </option>
                                            </select>
                                        </label>
                                        <label>
                                            {text("Scenery", "Khung cảnh")}
                                            <select
                                                value={scene}
                                                onChange={(event) =>
                                                    setScene(event.target.value)
                                                }
                                            >
                                                {[
                                                    [
                                                        "mountain",
                                                        "Summit trail",
                                                        "Đường lên đỉnh",
                                                    ],
                                                    [
                                                        "forest",
                                                        "Forest path",
                                                        "Lối mòn trong rừng",
                                                    ],
                                                    [
                                                        "ocean",
                                                        "Coastal cove",
                                                        "Vịnh ven biển",
                                                    ],
                                                    [
                                                        "pisces",
                                                        "Pisces",
                                                        "Song Ngư",
                                                    ],
                                                    [
                                                        "stars",
                                                        "Starlit lake",
                                                        "Hồ dưới trời sao",
                                                    ],
                                                ].map(([key, en, vi]) => (
                                                    <option
                                                        value={key}
                                                        key={key}
                                                    >
                                                        {text(en, vi)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            {text("Language", "Ngôn ngữ")}
                                            <select
                                                value={locale}
                                                onChange={(event) => {
                                                    const next = event.target
                                                        .value as PreviewLocale;
                                                    document.documentElement.lang =
                                                        next;
                                                    setLocale(next);
                                                }}
                                            >
                                                <option value="vi">
                                                    Tiếng Việt
                                                </option>
                                                <option value="en">
                                                    English
                                                </option>
                                            </select>
                                        </label>
                                    </div>
                                </aside>
                            </details>
                        )}
                        <div className="notification-menu" ref={noticePanel}>
                            <button
                                ref={bell}
                                className="icon-button notification-bell"
                                aria-label={
                                    text("Notifications", "Thông báo") +
                                    (unread ? ` (${unread})` : "")
                                }
                                aria-expanded={noticesOpen}
                                aria-controls="preview-notices"
                                onClick={() => setNoticesOpen(!noticesOpen)}
                            >
                                <Bell size={19} />
                                {!!unread && (
                                    <span className="notification-count">
                                        {unread}
                                    </span>
                                )}
                            </button>
                            {noticesOpen && (
                                <PreviewNotifications
                                    items={notices}
                                    state={state}
                                    text={text}
                                    onClose={closeNotices}
                                    onRead={(id) =>
                                        data.live
                                            ? void data.live
                                                  .request(
                                                      "/notifications/read",
                                                      {
                                                          method: "POST",
                                                          body: JSON.stringify({
                                                              id,
                                                          }),
                                                      },
                                                  )
                                                  .then(() =>
                                                      data.live!.refresh(),
                                                  )
                                            : setNotices((items) =>
                                                  items.map((item) =>
                                                      item.id === id
                                                          ? {
                                                                ...item,
                                                                read: true,
                                                            }
                                                          : item,
                                                  ),
                                              )
                                    }
                                    onReadAll={() =>
                                        data.live
                                            ? void data.live
                                                  .request(
                                                      "/notifications/read",
                                                      { method: "POST" },
                                                  )
                                                  .then(() =>
                                                      data.live!.refresh(),
                                                  )
                                            : setNotices((items) =>
                                                  items.map((item) => ({
                                                      ...item,
                                                      read: true,
                                                  })),
                                              )
                                    }
                                    onOpen={(section, task) => {
                                        if (data.live && task) {
                                            data.navigate(section, { task });
                                            setNoticesOpen(false);
                                        } else navigate(section);
                                    }}
                                    onRetry={() => setState("ready")}
                                />
                            )}
                        </div>
                        <button
                            className="icon-button"
                            aria-label={text("Open guide", "Mở hướng dẫn")}
                            onClick={() => setHelp(true)}
                        >
                            <CircleHelp size={20} />
                        </button>
                        <button
                            className="icon-button"
                            aria-label={
                                theme === "light"
                                    ? text(
                                          "Use dark theme",
                                          "Dùng giao diện tối",
                                      )
                                    : text(
                                          "Use light theme",
                                          "Dùng giao diện sáng",
                                      )
                            }
                            onClick={() =>
                                setTheme(theme === "light" ? "dark" : "light")
                            }
                        >
                            {theme === "light" ? (
                                <Moon size={19} />
                            ) : (
                                <Sun size={19} />
                            )}
                        </button>
                    </div>
                </header>
                <main className="app-main" id="preview-main" tabIndex={-1}>
                    <section className="planning-page">
                        <div
                            hidden={section !== "dashboard"}
                            className="dashboard-page"
                        >
                            <PreviewDashboard
                                locale={locale}
                                text={text}
                                state={state}
                                onReady={() =>
                                    data.live
                                        ? void data.live.refresh()
                                        : setState("ready")
                                }
                                onNavigate={navigate}
                            />
                        </div>
                        <div hidden={section !== "tasks"}>
                            <TasksPreview
                                locale={locale}
                                text={text}
                                state={state}
                                onReady={() =>
                                    data.live
                                        ? void data.live.refresh()
                                        : setState("ready")
                                }
                                onNavigate={navigate}
                            />
                        </div>
                        <div hidden={["tasks", "dashboard"].includes(section)}>
                            {state !== "ready" && (
                                <State
                                    state={state}
                                    text={text}
                                    onRetry={() => setState("ready")}
                                >
                                    {null}
                                </State>
                            )}
                            <div hidden={state !== "ready"}>
                                <div hidden={section !== "goals"}>
                                    <PlanningPreview text={text} />
                                </div>
                                <div hidden={section !== "notes"}>
                                    <NotesPreview text={text} />
                                </div>
                                <div hidden={section !== "calendar"}>
                                    <CalendarPreview text={text} />
                                </div>
                                <div hidden={section !== "habits"}>
                                    <HabitsPreview text={text} />
                                </div>
                                <div hidden={section !== "reviews"}>
                                    <ReviewsPreview text={text} />
                                </div>
                                <div
                                    hidden={
                                        ![
                                            "profile",
                                            "appearance",
                                            "security",
                                            "notifications",
                                            "history",
                                            "archive",
                                        ].includes(section)
                                    }
                                >
                                    <SettingsPreview
                                        section={section}
                                        text={text}
                                    />
                                </div>
                                <div
                                    hidden={
                                        !["help", "reports", "admin"].includes(
                                            section,
                                        )
                                    }
                                >
                                    <SupportPreview
                                        section={section}
                                        text={text}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
            <SharedTaskInteraction text={text} />
            {data.live ? (
                <LiveAssistant text={text} />
            ) : (
                <AssistantPreview text={text} />
            )}
            <Toast message={data.message} onClose={() => data.setMessage("")} closeLabel={text("Close", "Đóng")} />
            {help && <TourPreview text={text} onClose={() => setHelp(false)} />}
        </div>
    );
}

export default function WorkspacePreview({
    initialLocale,
    initialSection = "dashboard",
}: {
    initialLocale: PreviewLocale;
    initialSection?: string;
}) {
    return (
        <PreviewDataProvider locale={initialLocale} section={initialSection}>
            <WorkspaceView
                initialLocale={initialLocale}
                initialSection={initialSection}
            />
        </PreviewDataProvider>
    );
}
