"use client";
import { useState } from "react";
import { forgetOfflineNotes } from "@/lib/offline-notes";
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { usePreviewData } from "./preview/workspace-data";
import { Field, FormDialog } from "./preview/ui";
import type { Text } from "./preview/shared";

type Mode = "password" | "app" | "email" | "disable" | "delete";
export default function LiveSecurity({ text }: { text: Text }) {
    const db = usePreviewData(),
        live = db.live!;
    const [mode, setMode] = useState<Mode | null>(null),
        [step, setStep] = useState(1),
        [password, setPassword] = useState("");
    const [secret, setSecret] = useState<{
            secret: string;
            uri: string;
        } | null>(null),
        [visible, setVisible] = useState(false),
        [message, setMessage] = useState("");
    const open = (mode: Mode) => {
        setMode(mode);
        setPassword("");
        setSecret(null);
        setStep(1);
    };
    const close = () => {
        setMode(null);
        setPassword("");
        setSecret(null);
    };
    const emailMode =
        mode === "email" || (mode === "disable" && db.profile.mfa === "email");
    async function submit(form: HTMLFormElement) {
        const f = new FormData(form),
            current = String(f.get("password") || password);
        if (mode === "password") {
            if (f.get("new") !== f.get("confirm"))
                throw new Error(
                    text(
                        "Passwords do not match.",
                        "Mật khẩu xác nhận chưa khớp.",
                    ),
                );
            await live.request("/auth/password", {
                method: "POST",
                body: JSON.stringify({
                    current_password: current,
                    new_password: String(f.get("new")),
                }),
            });
            await forgetOfflineNotes();
            location.assign("/login");
            return;
        }
        if (mode === "delete") {
            if (f.get("ack") !== "on") return false;
            await live.request("/auth/account", {
                method: "DELETE",
                body: JSON.stringify({
                    confirm_email: String(f.get("email")),
                    current_password: current,
                }),
            });
            await forgetOfflineNotes();
            location.assign("/login");
            return;
        }
        if (step === 1 && (emailMode || mode === "app")) {
            if (emailMode)
                await live.request("/auth/two-factor/email/setup", {
                    method: "POST",
                    body: JSON.stringify({
                        current_password: current,
                        enabled: mode !== "disable",
                    }),
                });
            else
                setSecret(
                    await live.request<{ secret: string; uri: string }>(
                        "/auth/two-factor/setup",
                        {
                            method: "POST",
                            body: JSON.stringify({ current_password: current }),
                        },
                    ),
                );
            setPassword(current);
            setStep(2);
            return false;
        }
        const path = emailMode
            ? "/auth/two-factor/email/confirm"
            : `/auth/two-factor/${mode === "disable" ? "disable" : "enable"}`;
        await live.request(path, {
            method: "POST",
            body: JSON.stringify({
                password: current,
                code: String(f.get("code")),
            }),
        });
        await live.refresh();
        close();
        setMessage(
            text("Security settings saved.", "Đã lưu thiết lập bảo mật."),
        );
    }
    return (
        <>
            {message && (
                <p role="status" className="notice">
                    {message}
                </p>
            )}
            {!live.identity.user.email_verified && (
                <article className="planning-panel review-settings-card">
                    <h2>{text("Verify your email", "Xác minh email")}</h2>
                    <button
                        className="button button-quiet"
                        onClick={async () => {
                            try {
                                await live.request("/auth/verification", {
                                    method: "POST",
                                });
                                setMessage(
                                    text(
                                        "Check your email for the verification link.",
                                        "Kiểm tra email để nhận liên kết xác minh.",
                                    ),
                                );
                            } catch (err) {
                                setMessage((err as Error).message);
                            }
                        }}
                    >
                        {text("Send verification email", "Gửi email xác minh")}
                    </button>
                </article>
            )}
            <article className="planning-panel review-settings-card">
                <h2>
                    <LockKeyhole size={19} /> {text("Password", "Mật khẩu")}
                </h2>
                <p>
                    {text(
                        "Use a unique password of at least 8 characters.",
                        "Dùng mật khẩu riêng có ít nhất 8 ký tự.",
                    )}
                </p>
                <button
                    className="button button-quiet"
                    onClick={() => open("password")}
                >
                    {text("Change password", "Đổi mật khẩu")}
                </button>
            </article>
            <article className="planning-panel review-settings-card">
                <h2>
                    <ShieldCheck size={20} />{" "}
                    {text("Two-factor authentication", "Xác thực hai bước")}
                </h2>
                <p>
                    {db.profile.mfa === "none"
                        ? text(
                              "Protect your account with a second sign-in step.",
                              "Bảo vệ tài khoản bằng bước xác minh bổ sung.",
                          )
                        : text("Enabled: ", "Đang bật: ") +
                          (db.profile.mfa === "app"
                              ? text("Authenticator app", "Ứng dụng xác thực")
                              : "Email")}
                </p>
                <div className="review-form-footer">
                    {db.profile.mfa === "none" && (
                        <>
                            <button
                                className="button button-quiet"
                                onClick={() => open("email")}
                            >
                                {text("Set up email", "Thiết lập email")}
                            </button>
                            <button
                                className="button button-primary"
                                onClick={() => open("app")}
                            >
                                {text("Set up app", "Thiết lập ứng dụng")}
                            </button>
                        </>
                    )}
                    {db.profile.mfa !== "none" && (
                        <button
                            className="text-button"
                            onClick={() => open("disable")}
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
                        "This permanently removes your personal planning data, files and shares.",
                        "Thao tác này xóa vĩnh viễn dữ liệu kế hoạch cá nhân, tệp và chia sẻ.",
                    )}
                </p>
                <button
                    className="button button-danger"
                    disabled={db.admin}
                    onClick={() => open("delete")}
                >
                    {text("Delete account", "Xóa tài khoản")}
                </button>
            </article>
            {mode && (
                <FormDialog
                    text={text}
                    key={mode + step}
                    title={
                        mode === "password"
                            ? text("Change password", "Đổi mật khẩu")
                            : mode === "delete"
                              ? text(
                                    "Confirm account deletion",
                                    "Xác nhận xóa tài khoản",
                                )
                              : mode === "disable"
                                ? text(
                                      "Turn off two-factor authentication",
                                      "Tắt xác thực hai bước",
                                  )
                                : text(
                                      "Set up two-factor authentication",
                                      "Thiết lập xác thực hai bước",
                                  )
                    }
                    onClose={close}
                    onSubmit={submit}
                    submitLabel={
                        step === 1 && (emailMode || mode === "app")
                            ? text("Continue", "Tiếp tục")
                            : text("Confirm", "Xác nhận")
                    }
                >
                    {step === 1 && (
                        <Field
                            label={text(
                                "Current password",
                                "Mật khẩu hiện tại",
                            )}
                        >
                            <input
                                name="password"
                                type={visible ? "text" : "password"}
                                autoComplete="current-password"
                                required
                                maxLength={128}
                            />
                        </Field>
                    )}
                    {mode === "password" && (
                        <>
                            {["new", "confirm"].map((name) => (
                                <Field
                                    key={name}
                                    label={
                                        name === "new"
                                            ? text(
                                                  "New password",
                                                  "Mật khẩu mới",
                                              )
                                            : text(
                                                  "Confirm new password",
                                                  "Xác nhận mật khẩu mới",
                                              )
                                    }
                                >
                                    <input
                                        name={name}
                                        type={visible ? "text" : "password"}
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={128}
                                        required
                                    />
                                </Field>
                            ))}
                        </>
                    )}
                    {mode === "delete" && (
                        <>
                            <Field
                                label={text(
                                    "Type your email to confirm",
                                    "Nhập email để xác nhận",
                                )}
                            >
                                <input
                                    name="email"
                                    type="email"
                                    required
                                    placeholder={db.profile.email}
                                />
                            </Field>
                            <label className="review-checkbox">
                                <input name="ack" type="checkbox" required />
                                {text(
                                    "I understand this deletion is permanent.",
                                    "Tôi hiểu dữ liệu sẽ bị xóa vĩnh viễn.",
                                )}
                            </label>
                        </>
                    )}
                    {secret && (
                        <>
                            <p>
                                {text(
                                    "Add this key to your authenticator, then enter its current code.",
                                    "Thêm khóa này vào ứng dụng xác thực rồi nhập mã hiện tại.",
                                )}
                            </p>
                            <code className="totp-secret">{secret.secret}</code>
                            <a className="text-button" href={secret.uri}>
                                {text(
                                    "Open authenticator",
                                    "Mở ứng dụng xác thực",
                                )}
                            </a>
                        </>
                    )}
                    {step === 2 && emailMode && (
                        <p>
                            {text(
                                "Enter the latest code sent to your email.",
                                "Nhập mã mới nhất đã gửi đến email của bạn.",
                            )}
                        </p>
                    )}
                    {(step === 2 || (mode === "disable" && !emailMode)) && (
                        <Field label={text("Verification code", "Mã xác minh")}>
                            <input
                                name="code"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                pattern="[0-9]{6}"
                                maxLength={6}
                                required
                            />
                        </Field>
                    )}
                    {step === 1 && (
                        <button
                            type="button"
                            className="text-button"
                            onClick={() => setVisible(!visible)}
                        >
                            {visible ? <EyeOff size={16} /> : <Eye size={16} />}{" "}
                            {text(
                                visible ? "Hide passwords" : "Show passwords",
                                visible ? "Ẩn mật khẩu" : "Hiện mật khẩu",
                            )}
                        </button>
                    )}
                </FormDialog>
            )}
        </>
    );
}
