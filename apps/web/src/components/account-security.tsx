"use client";
import { useState } from "react";
import { api, type Identity } from "@/lib/api";

export default function AccountSecurity({
    identity,
    onSaved,
}: {
    identity: Identity;
    onSaved: () => void;
}) {
    const [password, setPassword] = useState("");
    const [nextPassword, setNextPassword] = useState("");
    const [code, setCode] = useState("");
    const [secret, setSecret] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function run(action: () => Promise<void>) {
        setBusy(true);
        setError("");
        setMessage("");
        try {
            await action();
            onSaved();
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="preferences security-settings">
            <h2>Account security</h2>
            {!identity.user.email_verified && (
                <button
                    className="secondary"
                    disabled={busy}
                    onClick={() =>
                        void run(async () => {
                            await api(
                                "/auth/verification",
                                { method: "POST" },
                                identity.csrf,
                            );
                            setMessage(
                                "Check your email for the verification link.",
                            );
                        })
                    }
                >
                    Verify email
                </button>
            )}
            <label>
                Current password
                <input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </label>
            <label>
                New password
                <input
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    value={nextPassword}
                    onChange={(e) => setNextPassword(e.target.value)}
                />
            </label>
            <button
                className="secondary"
                disabled={busy || !password || nextPassword.length < 12}
                onClick={() =>
                    void run(async () => {
                        await api(
                            "/auth/password",
                            {
                                method: "POST",
                                body: JSON.stringify({
                                    current_password: password,
                                    new_password: nextPassword,
                                }),
                            },
                            identity.csrf,
                        );
                        window.location.assign("/login");
                    })
                }
            >
                Change password and sign out
            </button>
            <h3>Two-factor authentication</h3>
            {!identity.user.two_factor_enabled && !secret && (
                <button
                    className="secondary"
                    disabled={busy || !password}
                    onClick={() =>
                        void run(async () => {
                            const result = await api<{ secret: string }>(
                                "/auth/two-factor/setup",
                                {
                                    method: "POST",
                                    body: JSON.stringify({
                                        current_password: password,
                                    }),
                                },
                                identity.csrf,
                            );
                            setSecret(result.secret);
                        })
                    }
                >
                    Set up authenticator
                </button>
            )}
            {secret && (
                <p>
                    Add this secret in your authenticator:{" "}
                    <code className="totp-secret">{secret}</code>
                </p>
            )}
            {(secret || identity.user.two_factor_enabled) && (
                <>
                    <label>
                        Authenticator code
                        <input
                            value={code}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            onChange={(e) => setCode(e.target.value)}
                        />
                    </label>
                    <button
                        className="secondary"
                        disabled={busy || code.length !== 6 || !password}
                        onClick={() =>
                            void run(async () => {
                                await api(
                                    `/auth/two-factor/${identity.user.two_factor_enabled ? "disable" : "enable"}`,
                                    {
                                        method: "POST",
                                        body: JSON.stringify({
                                            code,
                                            password,
                                        }),
                                    },
                                    identity.csrf,
                                );
                                setSecret("");
                                setCode("");
                                setMessage("Security settings saved.");
                            })
                        }
                    >
                        {identity.user.two_factor_enabled
                            ? "Disable two-factor authentication"
                            : "Confirm and enable"}
                    </button>
                </>
            )}
            {error && (
                <p role="alert" className="error">
                    {error}
                </p>
            )}
            {message && <p role="status">{message}</p>}
        </section>
    );
}
