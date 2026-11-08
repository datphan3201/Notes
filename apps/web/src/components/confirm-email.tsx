"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import AuthShell, { useGuestLocale } from "./auth-shell";
import { api } from "@/lib/api";
import { forgetOfflineNotes } from "@/lib/offline-notes";
export default function ConfirmEmail() {
    const { locale } = useGuestLocale(null, false);
    const text = (en: string, vi: string) => (locale === "vi" ? vi : en);
    const [error, setError] = useState(""),
        [done, setDone] = useState(false);
    const started = useRef(false);
    useEffect(() => {
        if (started.current) return;
        started.current = true;
        const url = new URL(location.href),
            token = new URLSearchParams(url.hash.slice(1)).get("token");
        url.hash = "";
        history.replaceState(null, "", url.pathname);
        if (!token) {
            setError("This link is missing its confirmation token.");
            return;
        }
        api("/auth/confirm-email", {
            method: "POST",
            body: JSON.stringify({ token }),
        })
            .then(async () => {
                await forgetOfflineNotes();
                setDone(true);
            })
            .catch((err) => setError(err.message));
    }, []);
    return (
        <AuthShell locale={locale} path="/confirm-email">
            <h1>{text("Confirm email", "Xác nhận email")}</h1>
            {error ? (
                <p role="alert" className="field-error">
                    {error}
                </p>
            ) : (
                <p role="status">
                    {done
                        ? text(
                              "Email updated. Sign in with your new address.",
                              "Đã cập nhật email. Đăng nhập bằng địa chỉ mới.",
                          )
                        : text("Confirming…", "Đang xác nhận…")}
                </p>
            )}
            <Link className="button button-primary" href="/login">
                {text("Sign in", "Đăng nhập")}
            </Link>
        </AuthShell>
    );
}
