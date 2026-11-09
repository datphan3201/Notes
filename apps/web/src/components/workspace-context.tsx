"use client";
import {
api,
type Collection,
type Entity,
type Identity,
type Kind,
} from "@/lib/api";
import { translate, words } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "./loading-spinner";

export type PageContext = {
    identity: Identity;
    t: typeof words.en;
    text: (en: string, vi: string) => string;
    open: (
        kind: Kind,
        row?: Entity | null,
        preset?: Record<string, unknown>,
    ) => void;
    action: (work: () => Promise<unknown>) => Promise<boolean>;
    refresh: () => void;
    preferences: (values: Partial<Identity["user"]>) => Promise<void>;
};
export function useItems(kind: Kind, owner: string, archived = false) {
    return useQuery({
        queryKey: ["items", owner, kind, archived],
        queryFn: async ({ signal }) => {
            const items: Entity[] = [];
            for (let page = 1; ; page++) {
                const result = await api<Collection>(
                    `/${kind}?size=100&page=${page}&archived=${archived}`,
                    { signal },
                );
                items.push(...result.items);
                if (!result.has_more) return items;
            }
        },
    });
}
export function QueryState({
    queries,
    locale,
}: {
    locale: "en" | "vi";
    queries: {
        isPending: boolean;
        error: Error | null;
        refetch: () => unknown;
    }[];
}) {
    const failed = queries.find((query) => query.error);
    if (failed)
        return (
            <p className="field-error" role="alert">
                {translate(failed.error!.message, locale, locale === "vi"
                    ? "Không thể hoàn tất yêu cầu. Vui lòng thử lại." : failed.error!.message)}{" "}
                <button
                    type="button"
                    className="text-button"
                    onClick={() => void failed.refetch()}
                >
                    {locale === "vi" ? "Thử lại" : "Retry"}
                </button>
            </p>
        );
    if (queries.some((query) => query.isPending))
        return (
            <LoadingSpinner label={locale === "vi" ? "Đang tải…" : "Loading…"} />
        );
    return null;
}
export function Tabs({
    value,
    onChange,
    items,
    label,
}: {
    value: string;
    onChange: (value: string) => void;
    items: [string, string][];
    label: string;
}) {
    return (
        <nav
            className="workspace-section-menu"
            role="tablist"
            aria-label={label}
        >
            {items.map(([key, title], index) => (
                <button
                    key={key}
                    role="tab"
                    type="button"
                    aria-selected={value === key}
                    tabIndex={value === key ? 0 : -1}
                    onClick={() => onChange(key)}
                    onKeyDown={(event) => {
                        if (
                            ![
                                "ArrowLeft",
                                "ArrowRight",
                                "Home",
                                "End",
                            ].includes(event.key)
                        )
                            return;
                        event.preventDefault();
                        const next =
                            event.key === "Home"
                                ? 0
                                : event.key === "End"
                                  ? items.length - 1
                                  : (index +
                                        (event.key === "ArrowRight" ? 1 : -1) +
                                        items.length) %
                                    items.length;
                        onChange(items[next][0]);
                        (
                            event.currentTarget.parentElement!.children[
                                next
                            ] as HTMLButtonElement
                        ).focus();
                    }}
                >
                    {title}
                </button>
            ))}
        </nav>
    );
}
export function Empty({ children }: { children: React.ReactNode }) {
    return <p className="empty-state">{children}</p>;
}
