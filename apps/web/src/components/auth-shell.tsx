"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authText } from "@/lib/auth-copy";
import type { GuestLocale } from "@/lib/auth-input";
const steps = [
    {
        title: "Find your direction",
        subtitle: "Goals that matter to you.",
        icon: (
            <>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1" />
            </>
        ),
    },
    {
        title: "Take the next step",
        subtitle: "Milestones, tasks, and daily habits.",
        icon: (
            <>
                <rect x="4" y="4" width="16" height="16" rx="4" />
                <path d="m8 12 3 3 5-6" />
            </>
        ),
    },
    {
        title: "See how far you've come",
        subtitle: "Activity and space to reflect.",
        icon: (
            <path d="M4 19V5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1 0-4h13M8 7h7M8 11h5" />
        ),
    },
];

export function useGuestLocale(initial: GuestLocale | null, preview = false) {
    const [locale, setLocale] = useState<GuestLocale>(initial || "en");
    useEffect(() => {
        let chosen = initial;
        try {
            const stored = sessionStorage.getItem("planner-guest-locale");
            if (!chosen && (stored === "en" || stored === "vi"))
                chosen = stored;
            sessionStorage.setItem("planner-guest-locale", chosen || "en");
        } catch {
            /* Guest language still works when browser storage is disabled. */
        }
        setLocale(chosen || "en");
    }, [initial]);
    const text = (message: string) => authText(message, locale);
    const href = (path: string) =>
        `${preview ? "/preview" : ""}${path}?lang=${locale}`;
    return { locale, text, href };
}
export default function AuthShell({
    locale,
    path,
    busy = false,
    children,
}: {
    locale: GuestLocale;
    path: string;
    busy?: boolean;
    children: React.ReactNode;
}) {
    const text = (message: string) => authText(message, locale);
    useEffect(() => {
        document.documentElement.lang = locale;
        document.documentElement.dataset.theme = "light";
    }, [locale]);
    return (
        <div className="guest-page auth-refined">
            <a className="skip-link" href="#main-content">
                {text("Skip to content")}
            </a>
            <main className="guest-shell">
                <section
                    className="guest-story"
                    aria-labelledby="guest-heading"
                >
                    <div className="sidebar-brand">
                        <span className="brand-symbol" aria-hidden="true">
                            <span />
                            <i />
                        </span>
                        <span>Planner</span>
                    </div>
                    <div className="guest-story-content">
                        <h2 id="guest-heading">
                            {text("Big intentions.")}
                            <br />
                            {text("Small, steady steps.")}
                        </h2>
                        <p>
                            {text(
                                "Give your goals a direction, your tasks a place, and your progress a little perspective.",
                            )}
                        </p>
                        <div
                            className="guest-path"
                            aria-label={text("From goals to daily progress")}
                        >
                            {steps.map(({ title, subtitle, icon }) => (
                                <div key={title}>
                                    <svg
                                        className="ui-icon"
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                    >
                                        {icon}
                                    </svg>
                                    <span>
                                        <strong>{text(title)}</strong>
                                        <small>{text(subtitle)}</small>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <p className="guest-footnote">
                        {text("Your plans. Your pace.")}
                    </p>
                </section>
                <div className="guest-form-region">
                    {children}
                    <nav
                        className="guest-language"
                        aria-label={text("Language")}
                    >
                        {(["en", "vi"] as const).map((code) => (
                            <Link
                                key={code}
                                href={`${path}?lang=${code}`}
                                aria-current={
                                    locale === code ? "true" : undefined
                                }
                                aria-disabled={busy || undefined}
                                onClick={(event) => {
                                    if (busy) event.preventDefault();
                                }}
                            >
                                {code === "en" ? "English" : "Tiếng Việt"}
                            </Link>
                        ))}
                    </nav>
                </div>
            </main>
        </div>
    );
}
