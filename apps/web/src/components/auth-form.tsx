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
                router.replace("/dashboard");
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
    const title = mfa
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
                {!mfa && (
                    <p className="eyebrow">
                        {text(
                            registration
                                ? "Start simply"
                                : "Your personal workspace",
                        )}
                    </p>
                )}
                <h1 id="auth-title">{text(title)}</h1>
                <p className="auth-intro">
                    {text(
                        mfa
                            ? challenge?.method === "email"
                                ? "Enter the six-digit code we sent to your email address."
                                : "Enter the six-digit code from your authenticator app."
                            : registration
                              ? "Four details are all you need for a private planning workspace."
                              : "Sign in to continue with the things you are keeping track of.",
                    )}
                </p>
                {error && (
                    <p className="field-error" role="alert">
                        {text(error)}
                    </p>
                )}
                {notice && (
                    <p className="notice" role="status">
                        {text(notice)}
                    </p>
                )}
                {mfa && ready && !challenge ? (
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
                                                      "Use at least 12 characters.",
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
                {mfa ? (
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
