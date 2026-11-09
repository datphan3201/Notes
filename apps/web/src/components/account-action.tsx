"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { authError } from "@/lib/auth-copy";
import { validateAuth, type GuestLocale } from "@/lib/auth-input";
import {
    forgetCapability,
    readCapability,
    rememberCapability,
} from "@/lib/auth-flow";
import AuthShell, { useGuestLocale } from "./auth-shell";
import {
    CodeField,
    EmailField,
    PasswordField,
    focusInvalid,
} from "./auth-fields";

type Action = "recover" | "reset" | "verify";
const paths = {
    recover: "/forgot-password",
    reset: "/reset-password",
    verify: "/verify-email",
};
export default function AccountAction({
    action,
    initialLocale = null,
    preview = false,
}: {
    action: Action;
    initialLocale?: GuestLocale | null;
    preview?: boolean;
}) {
    const { locale, text, href } = useGuestLocale(initialLocale, preview);
    const [token, setToken] = useState(preview ? "ui-preview-only" : "");
    const [linkRevision, setLinkRevision] = useState(0);
    const [signedIn, setSignedIn] = useState(false);
    const [ready, setReady] = useState(preview || action === "recover");
    const [values, setValues] = useState({
        email: "",
        password: "",
        password_confirmation: "",
        code: "",
    });
    const [codeEmail, setCodeEmail] = useState("");
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [done, setDone] = useState(preview && action === "verify");
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const verifying = useRef(false);
    const router = useRouter();
    useEffect(() => {
        if (preview || action === "recover") return;
        const loadLink = () => {
            const url = new URL(window.location.href);
            const incoming =
                new URLSearchParams(url.hash.slice(1)).get("token") ||
                url.searchParams.get("token");
            if (incoming) {
                setDone(false);
                setError("");
                verifying.current = false;
                try {
                    rememberCapability(action, {
                        token: incoming,
                        expiresAt:
                            Date.now() +
                            (action === "verify" ? 24 * 60 : 30) * 60_000,
                    });
                } catch {
                    /* The current link can still be used without browser storage. */
                }
                setToken(incoming);
                setLinkRevision((revision) => revision + 1);
                url.hash = "";
                url.searchParams.delete("token");
                window.history.replaceState(
                    window.history.state,
                    "",
                    url.pathname + url.search,
                );
            } else {
                const saved = readCapability(action);
                setToken(saved?.token || "");
                setValues((previous) => ({
                    ...previous,
                    email: saved?.email || "",
                }));
            }
            setReady(true);
        };
        loadLink();
        window.addEventListener("hashchange", loadLink);
        return () => window.removeEventListener("hashchange", loadLink);
    }, [action, preview]);
    useEffect(() => {
        if (preview || action !== "verify" || !token || verifying.current)
            return;
        verifying.current = true;
        setBusy(true);
        api("/auth/verify", { method: "POST", body: JSON.stringify({ token }) })
            .then(() => {
                setDone(true);
                forgetCapability("verify");
            })
            .catch((err) => setError(authError(err)))
            .finally(() => setBusy(false));
    }, [action, token, linkRevision, preview]);
    useEffect(() => {
        if (!preview && action === "verify")
            api("/auth/me")
                .then(() => setSignedIn(true))
                .catch(() => setSignedIn(false));
    }, [action, preview]);
    const update = (name: keyof typeof values) => (value: string) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        setErrors((previous) => ({ ...previous, [name]: "" }));
    };
    async function submit(
        event: React.FormEvent<HTMLFormElement>,
        byCode = false,
    ) {
        event.preventDefault();
        if (inFlight.current) return;
        const form = event.currentTarget;
        const payload = byCode
            ? { email: codeEmail.trim(), code: values.code }
            : action === "reset"
              ? { ...values, email: values.email.trim() }
              : { email: values.email.trim() };
        const invalid = validateAuth(
            byCode ? "recover-code" : action === "reset" ? "reset" : "recover",
            payload,
        );
        (byCode ? setCodeErrors : setErrors)(invalid);
        setError("");
        setNotice("");
        if (Object.keys(invalid).length) {
            focusInvalid(form, invalid);
            return;
        }
        if (preview) {
            if (byCode) router.push(href("/reset-password"));
            else if (action === "reset") setDone(true);
            else {
                setNotice(
                    "Password reset link requested successfully. If the account is eligible, check your inbox and spam folder.",
                );
                setCodeEmail(values.email.trim());
            }
            return;
        }
        inFlight.current = true;
        setBusy(true);
        try {
            if (byCode) {
                const result = await api<{ token: string }>(
                    "/auth/recover/code",
                    { method: "POST", body: JSON.stringify(payload) },
                );
                rememberCapability("reset", {
                    token: result.token,
                    email: codeEmail.trim(),
                    expiresAt: Date.now() + 30 * 60_000,
                });
                router.push(href("/reset-password"));
            } else if (action === "reset") {
                await api("/auth/reset", {
                    method: "POST",
                    body: JSON.stringify({
                        token,
                        email: values.email.trim(),
                        password: values.password,
                        password_confirmation: values.password_confirmation,
                    }),
                });
                forgetCapability("reset");
                forgetCapability("login");
                setValues((previous) => ({
                    ...previous,
                    password: "",
                    password_confirmation: "",
                }));
                setDone(true);
            } else {
                await api("/auth/recover", {
                    method: "POST",
                    body: JSON.stringify(payload),
                });
                setNotice(
                    "Password reset link requested successfully. If the account is eligible, check your inbox and spam folder.",
                );
                setCodeEmail(values.email.trim());
            }
        } catch (err) {
            setError(authError(err));
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }
    const missing = ready && action !== "recover" && !token;
    const title =
        action === "verify"
            ? "Email verification"
            : action === "reset"
              ? "Reset password"
              : "Forgot password?";
    return (
        <AuthShell
            locale={locale}
            path={`${preview ? "/preview" : ""}${paths[action]}`}
            busy={busy}
        >
            <section
                className="auth-card"
                id="main-content"
                aria-labelledby="auth-title"
            >
                <h1 id="auth-title">{text(title)}</h1>
                {!done && action !== "verify" && (
                    <p>
                        {text(
                            action === "reset"
                                ? "Choose a new password. You will need to sign in again on every device."
                                : "Enter your account email to request a reset link.",
                        )}
                    </p>
                )}
                {error && (
                    <p className="field-error" role="alert">
                        {text(error)}
                    </p>
                )}
                {missing && (
                    <p className="field-error" role="alert">
                        {text(
                            "Open the complete link from your email, or request a new one.",
                        )}
                    </p>
                )}
                {notice && (
                    <p className="notice" role="status">
                        {text(notice)}
                    </p>
                )}
                {done ? (
                    <p className="notice" role="status">
                        {text(
                            action === "verify"
                                ? "Email verified. Your account is ready."
                                : "Password reset. Sign in with your new password.",
                        )}
                    </p>
                ) : action === "verify" ? (
                    busy && <p role="status">{text("Checking your link…")}</p>
                ) : (
                    !missing && (
                        <>
                            <form
                                className="stack-form"
                                onSubmit={(event) => submit(event)}
                                noValidate
                                aria-busy={busy}
                                aria-label={text(
                                    action === "reset"
                                        ? "Reset password"
                                        : "Send reset link",
                                )}
                            >
                                <fieldset
                                    className="auth-fields"
                                    disabled={busy || !ready}
                                >
                                    <EmailField
                                        id="email"
                                        value={values.email}
                                        onChange={update("email")}
                                        text={text}
                                        error={errors.email}
                                        autoFocus
                                    />
                                    {action === "reset" && (
                                        <>
                                            <PasswordField
                                                id="password"
                                                label={text("New password")}
                                                value={values.password}
                                                onChange={update("password")}
                                                text={text}
                                                error={errors.password}
                                                hint={text(
                                                    "Use at least 8 characters.",
                                                )}
                                            />
                                            <PasswordField
                                                id="password_confirmation"
                                                label={text("Confirm password")}
                                                value={
                                                    values.password_confirmation
                                                }
                                                onChange={update(
                                                    "password_confirmation",
                                                )}
                                                text={text}
                                                confirmation
                                                error={
                                                    errors.password_confirmation
                                                }
                                            />
                                        </>
                                    )}
                                    <button
                                        className="button button-primary"
                                        type="submit"
                                    >
                                        {text(
                                            busy
                                                ? action === "reset"
                                                    ? "Resetting password…"
                                                    : "Sending…"
                                                : action === "reset"
                                                  ? "Reset password"
                                                  : "Send reset link",
                                        )}
                                    </button>
                                </fieldset>
                            </form>
                            {action === "recover" && (
                                <>
                                    <div
                                        className="auth-divider"
                                        role="presentation"
                                    >
                                        <span>{text("or")}</span>
                                    </div>
                                    <form
                                        className="stack-form"
                                        onSubmit={(event) =>
                                            submit(event, true)
                                        }
                                        noValidate
                                        aria-labelledby="code-title"
                                        aria-busy={busy}
                                    >
                                        <h2
                                            id="code-title"
                                            className="auth-subtitle"
                                        >
                                            {text(
                                                "Have a code from the email?",
                                            )}
                                        </h2>
                                        <fieldset
                                            className="auth-fields"
                                            disabled={busy}
                                        >
                                            <EmailField
                                                id="code-email"
                                                value={codeEmail}
                                                onChange={(value) => {
                                                    setCodeEmail(value);
                                                    setCodeErrors(
                                                        (previous) => ({
                                                            ...previous,
                                                            email: "",
                                                        }),
                                                    );
                                                }}
                                                text={text}
                                                error={codeErrors.email}
                                            />
                                            <CodeField
                                                id="code"
                                                autoFocus={false}
                                                label={text("6-digit code")}
                                                value={values.code}
                                                onChange={(value) => {
                                                    update("code")(value);
                                                    setCodeErrors(
                                                        (previous) => ({
                                                            ...previous,
                                                            code: "",
                                                        }),
                                                    );
                                                }}
                                                text={text}
                                                error={codeErrors.code}
                                            />
                                            <button
                                                className="button button-quiet"
                                                type="submit"
                                            >
                                                {text(
                                                    busy
                                                        ? "Verifying…"
                                                        : "Continue with code",
                                                )}
                                            </button>
                                        </fieldset>
                                    </form>
                                </>
                            )}
                        </>
                    )
                )}
                {action === "reset" && (missing || error) && (
                    <p>
                        <Link href={href("/forgot-password")}>
                            {text("Send reset link")}
                        </Link>
                    </p>
                )}
                {action === "verify" ? (
                    <p>
                        <Link
                            className="button button-primary"
                            href={
                                signedIn
                                    ? done
                                        ? "/dashboard"
                                        : "/settings/profile"
                                    : href("/login")
                            }
                        >
                            {text(
                                signedIn
                                    ? done
                                        ? "Continue to Planner"
                                        : "Open your profile"
                                    : "Sign in",
                            )}
                        </Link>
                    </p>
                ) : (
                    <p className="auth-switch">
                        <Link href={href("/login")}>
                            {text("Back to sign in")}
                        </Link>
                    </p>
                )}
            </section>
        </AuthShell>
    );
}
