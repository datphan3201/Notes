"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type Identity } from "@/lib/api";
import { authError } from "@/lib/auth-copy";
import { validateAuth, type GuestLocale } from "@/lib/auth-input";
import {
    forgetCapability,
    readCapability,
    rememberCapability,
    type Capability,
} from "@/lib/auth-flow";
import AuthShell, { useGuestLocale } from "./auth-shell";
import Dialog from "./dialog";
import {
    CodeField,
    EmailField,
    PasswordField,
    focusInvalid,
} from "./auth-fields";

export default function AuthForm({
    mode = "login",
    initialLocale = null,
    preview = false,
}: {
    mode?: "login" | "register" | "two-factor";
    initialLocale?: GuestLocale | null;
    preview?: boolean;
}) {
    const { locale, text, href } = useGuestLocale(initialLocale, preview);
    const [values, setValues] = useState({
        email: "",
        name: "",
        password: "",
        password_confirmation: "",
        code: "",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [registered, setRegistered] = useState(false);
    const [verification, setVerification] = useState<Identity | null>(null);
    const [pending, setPending] = useState(false);
    const [challenge, setChallenge] = useState<Capability | null>(null);
    const [ready, setReady] = useState(preview || mode !== "two-factor");
    const inFlight = useRef(false);
    const router = useRouter();
    const registration = mode === "register";
    const mfa = mode === "two-factor";
    useEffect(() => {
        if (mfa) {
            setChallenge(
                preview
                    ? { token: "ui-preview-only", method: "totp", expiresAt: 0 }
                    : readCapability("login"),
            );
            setReady(true);
        }
    }, [mfa, preview]);
    const update = (name: keyof typeof values) => (value: string) => {
        setValues((previous) => ({ ...previous, [name]: value }));
        setErrors((previous) => ({ ...previous, [name]: "" }));
    };
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (inFlight.current) return;
        const form = event.currentTarget;
        const invalid = validateAuth(mode, values);
        setErrors(invalid);
        setError("");
        if (Object.keys(invalid).length) {
            focusInvalid(form, invalid);
            return;
        }
        if (preview) {
            if (mode === "login") router.push(href("/two-factor"));
            else if (registration) router.push(href("/verify-email"));
            else setNotice("Preview complete. No account data was changed.");
            return;
        }
        if (mfa && !challenge) return;
        setVerification(null);
        setNotice("");
        inFlight.current = true;
        setPending(true);
        try {
            const body = mfa
                ? { challenge: challenge!.token, code: values.code }
                : {
                      email: values.email.trim(),
                      password: values.password,
                      ...(registration
                          ? {
                                name: values.name.trim(),
                                password_confirmation:
                                    values.password_confirmation,
                                locale,
                            }
                          : {}),
                  };
            const result = await api<
                Identity | { requires_2fa: boolean; challenge: string }
            >(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
            if ("requires_2fa" in result) {
                rememberCapability("login", {
                    token: result.challenge,
                    method: "totp",
                    expiresAt: Date.now() + 5 * 60_000,
                });
                setValues((previous) => ({
                    ...previous,
                    password: "",
                    password_confirmation: "",
                }));
                router.replace(href("/two-factor"));
            } else {
                forgetCapability("login");
                forgetCapability("reset");
                try { sessionStorage.setItem("planner-workspace-locale", result.user.locale); }
                catch { /* The account language still loads from the workspace. */ }
                if (registration) {
                    setValues((previous) => ({
                        ...previous,
                        password: "",
                        password_confirmation: "",
                    }));
                    setNotice("Account created successfully. Check your email for the verification link.");
                    setRegistered(true);
                } else if (!result.user.email_verified) {
                    setVerification(result);
                    setValues((previous) => ({ ...previous, password: "", code: "" }));
                } else {
                    router.replace("/dashboard");
                }
            }
        } catch (err) {
            if (err instanceof ApiError && Object.keys(err.fields).length) {
                setErrors(err.fields);
                focusInvalid(form, err.fields);
            }
            setError(authError(err));
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    async function verifyEmail(action: "resend" | "check" | "switch") {
        if (!verification || inFlight.current) return;
        inFlight.current = true;
        setPending(true);
        setError("");
        setNotice("");
        try {
            if (action === "resend") {
                await api("/auth/verification", { method: "POST" }, verification.csrf);
                setNotice("Verification email requested. Check your inbox and spam folder.");
            } else if (action === "switch") {
                await api("/auth/logout", { method: "POST" }, verification.csrf);
                setVerification(null);
                setValues((previous) => ({ ...previous, email: "", password: "", code: "" }));
                if (mfa) router.replace(href("/login"));
            } else {
                const identity = await api<Identity>("/auth/me");
                if (identity.user.email_verified) router.replace("/dashboard");
                else setNotice("Your email is not verified yet. Open the verification link in your email.");
            }
        } catch (err) {
            setError(authError(err));
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    async function emailCode() {
        if (!challenge || inFlight.current) return;
        if (preview) {
            setChallenge({ ...challenge, method: "email" });
            setNotice("Check your email for the verification code.");
            return;
        }
        inFlight.current = true;
        setPending(true);
        setError("");
        setNotice("");
        try {
            await api("/auth/two-factor/email", {
                method: "POST",
                body: JSON.stringify({ challenge: challenge.token }),
            });
            const next: Capability = { ...challenge, method: "email" };
            rememberCapability("login", next);
            setChallenge(next);
            setNotice("Check your email for the verification code.");
        } catch (err) {
            setError(authError(err));
        } finally {
            inFlight.current = false;
            setPending(false);
        }
    }
    const title = registered
        ? "Account created successfully"
        : mfa
        ? "Two-step verification"
        : registration
          ? "Create an account"
          : "Welcome back";
    return (
        <AuthShell
            locale={locale}
            path={`${preview ? "/preview" : ""}/${mode}`}
            busy={pending}
        >
            <section
                className="auth-card"
                id="main-content"
                aria-labelledby="auth-title"
            >
                {!mfa && !registered && (
                    <p className="eyebrow">
                        {text(
                            registration
                                ? "Start simply"
                                : "Your personal workspace",
                        )}
                    </p>
                )}
                <h1 id="auth-title">{text(title)}</h1>
                {!registered && <p className="auth-intro">
                    {text(
                        mfa
                            ? challenge?.method === "email"
                                ? "Enter the six-digit code we sent to your email address."
                                : "Enter the six-digit code from your authenticator app."
                            : registration
                              ? "Four details are all you need for a private planning workspace."
                              : "Sign in to continue with the things you are keeping track of.",
                    )}
                </p>}
                {verification && (
                    <Dialog className="auth-verification" title={text("Email verification")}
                        closeLabel={text("Close")}
                        onClose={() => {
                            setVerification(null);
                            setNotice("");
                            setError("");
                            if (mfa) router.replace(href("/login"));
                        }}>
                        <p role="status">
                            {text("Verify your email before using the workspace.")}
                        </p>
                        <p className="auth-verification-email">
                            {verification.user.email}
                        </p>
                        {error && <p className="field-error" role="alert">{text(error)}</p>}
                        {notice && <p className="auth-verification-feedback" role="status">{text(notice)}</p>}
                        <div className="auth-verification-actions">
                            <button type="button" className="button button-primary" disabled={pending}
                                onClick={() => void verifyEmail("resend")}>
                                {text("Resend verification email")}
                            </button>
                            <button type="button" className="button button-quiet" disabled={pending}
                                onClick={() => void verifyEmail("check")}>
                                {text("I have verified my email")}
                            </button>
                            <button type="button" className="text-button" disabled={pending}
                                onClick={() => void verifyEmail("switch")}>
                                {text("Use another account")}
                            </button>
                        </div>
                    </Dialog>
                )}
                {error && !verification && (
                    <p className="field-error" role="alert">
                        {text(error)}
                    </p>
                )}
                {notice && !verification && (
                    <p className="notice" role="status">
                        {text(notice)}
                    </p>
                )}
                {registered ? (
                    <Link className="button button-primary" href={href("/login")}>
                        {text("Continue to sign in")}
                    </Link>
                ) : verification && mfa ? null : mfa && ready && !challenge ? (
                    <p className="field-error" role="alert">
                        {text("This challenge expired. Sign in again.")}
                    </p>
                ) : (
                    <form
                        className="stack-form"
                        onSubmit={submit}
                        noValidate
                        aria-busy={pending}
                    >
                        <fieldset
                            className="auth-fields"
                            disabled={pending || !ready}
                        >
                            {mfa ? (
                                <CodeField
                                    id="code"
                                    label={text("Verification code")}
                                    value={values.code}
                                    onChange={update("code")}
                                    text={text}
                                    error={errors.code}
                                />
                            ) : (
                                <>
                                    {registration && (
                                        <div className="field">
                                            <label htmlFor="display_name">
                                                {text("Display name")}
                                            </label>
                                            <input
                                                id="display_name"
                                                name="name"
                                                autoComplete="name"
                                                maxLength={80}
                                                autoFocus
                                                required
                                                value={values.name}
                                                onChange={(event) =>
                                                    update("name")(
                                                        event.target.value,
                                                    )
                                                }
                                                aria-invalid={!!errors.name}
                                                aria-describedby={
                                                    errors.name
                                                        ? "name-error"
                                                        : undefined
                                                }
                                            />
                                            {errors.name && (
                                                <p
                                                    id="name-error"
                                                    className="field-error"
                                                    role="alert"
                                                >
                                                    {text(errors.name)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                    <EmailField
                                        id="email"
                                        value={values.email}
                                        onChange={update("email")}
                                        text={text}
                                        error={errors.email}
                                        autoFocus={!registration}
                                    />
                                    <PasswordField
                                        id="password"
                                        label={text("Password")}
                                        value={values.password}
                                        onChange={update("password")}
                                        text={text}
                                        error={errors.password}
                                        hint={
                                            registration
                                                ? text(
                                                      "Use at least 8 characters.",
                                                  )
                                                : undefined
                                        }
                                    />
                                    {registration && (
                                        <PasswordField
                                            id="password_confirmation"
                                            label={text("Confirm password")}
                                            value={values.password_confirmation}
                                            onChange={update(
                                                "password_confirmation",
                                            )}
                                            text={text}
                                            confirmation
                                            error={errors.password_confirmation}
                                        />
                                    )}
                                </>
                            )}
                            <button
                                className="button button-primary button-wide"
                                type="submit"
                            >
                                {text(
                                    pending
                                        ? mfa
                                            ? "Verifying…"
                                            : registration
                                              ? "Creating account…"
                                              : "Signing in…"
                                        : mfa
                                          ? "Verify"
                                          : registration
                                            ? "Create account"
                                            : "Sign in",
                                )}
                            </button>
                        </fieldset>
                    </form>
                )}
                {registered ? null : mfa ? (
                    <>
                        {challenge && (
                            <p>
                                <button
                                    className="text-button"
                                    type="button"
                                    disabled={pending}
                                    onClick={emailCode}
                                >
                                    {text(
                                        challenge.method === "email"
                                            ? "Send a new code"
                                            : "Email me a code instead",
                                    )}
                                </button>
                            </p>
                        )}
                        <Link
                            href={href("/login")}
                            onClick={() => {
                                if (!preview) forgetCapability("login");
                            }}
                        >
                            {text("Back to sign in")}
                        </Link>
                    </>
                ) : registration ? (
                    <p className="auth-switch">
                        {text("Already have an account?")}{" "}
                        <Link href={href("/login")}>{text("Sign in")}</Link>
                    </p>
                ) : (
                    <>
                        <p>
                            <Link href={href("/forgot-password")}>
                                {text("Forgot password?")}
                            </Link>
                        </p>
                        <p className="auth-switch">
                            {text("New here?")}{" "}
                            <Link href={href("/register")}>
                                {text("Create an account")}
                            </Link>
                        </p>
                    </>
                )}
            </section>
        </AuthShell>
    );
}
