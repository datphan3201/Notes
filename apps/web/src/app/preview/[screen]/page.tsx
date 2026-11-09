import { notFound } from "next/navigation";
import Link from "next/link";
import AuthForm from "@/components/auth-form";
import AccountAction from "@/components/account-action";
import { guestLanguage, type GuestParams } from "@/lib/auth-flow";

const screens = [
    ["login", "Đăng nhập", "Sign in"],
    ["register", "Đăng ký", "Sign up"],
    ["forgot-password", "Quên mật khẩu", "Recovery"],
    ["reset-password", "Đổi mật khẩu", "Reset password"],
    ["two-factor", "Xác thực hai bước", "Two-step verification"],
    ["verify-email", "Xác minh email", "Email verification"],
] as const;
export default async function Page({
    params,
    searchParams,
}: {
    params: Promise<{ screen: string }>;
    searchParams: GuestParams;
}) {
    const { screen } = await params;
    if (!screens.some(([path]) => path === screen)) notFound();
    const locale = (await guestLanguage(searchParams)) || "vi";
    return (
        <>
            <aside
                className="auth-preview-toolbar"
                aria-label={
                    locale === "vi" ? "Duyệt giao diện" : "Review screens"
                }
            >
                <p>
                    {locale === "vi"
                        ? "Xem thử giao diện"
                        : "Interface preview"}
                </p>
                <nav>
                    <Link href={`/preview/workspace?lang=${locale}`}>
                        {locale === "vi" ? "Khung ứng dụng" : "Workspace"}
                    </Link>
                    {screens.map(([path, vi, en]) => (
                        <Link
                            key={path}
                            href={`/preview/${path}?lang=${locale}`}
                            aria-current={screen === path ? "page" : undefined}
                        >
                            {locale === "vi" ? vi : en}
                        </Link>
                    ))}
                </nav>
            </aside>
            {screen === "login" ||
            screen === "register" ||
            screen === "two-factor" ? (
                <AuthForm
                    key={screen}
                    mode={screen}
                    initialLocale={locale}
                    preview
                />
            ) : (
                <AccountAction
                    key={screen}
                    action={
                        screen === "forgot-password"
                            ? "recover"
                            : screen === "reset-password"
                              ? "reset"
                              : "verify"
                    }
                    initialLocale={locale}
                    preview
                />
            )}
        </>
    );
}
