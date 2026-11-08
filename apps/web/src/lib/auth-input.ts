export type GuestLocale = "en" | "vi";
export type AuthMode =
    "login" | "register" | "recover" | "reset" | "two-factor" | "recover-code";
export type AuthFields = {
    email?: string;
    name?: string;
    password?: string;
    password_confirmation?: string;
    code?: string;
};
export const normalizeCode = (value: string) => value.replace(/\s/g, "");

export function validateAuth(mode: AuthMode, values: AuthFields) {
    const errors: Record<string, string> = {};
    if (
        ["login", "register", "recover", "recover-code", "reset"].includes(
            mode,
        ) &&
        (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email?.trim() || "") ||
            (values.email?.length || 0) > 254)
    )
        errors.email = "Enter a valid email address.";
    if (
        mode === "register" &&
        (!values.name?.trim() || values.name.trim().length > 80)
    )
        errors.name = "Enter a display name of up to 80 characters.";
    if (["login", "register", "reset"].includes(mode)) {
        if (!values.password) errors.password = "Enter your password.";
        else if (values.password.length > 128)
            errors.password = "Use no more than 128 characters.";
        else if (mode !== "login" && values.password.length < 12)
            errors.password = "Use at least 12 characters.";
    }
    if (
        ["register", "reset"].includes(mode) &&
        (!values.password_confirmation ||
            values.password !== values.password_confirmation)
    )
        errors.password_confirmation = "Passwords do not match.";
    if (
        ["two-factor", "recover-code"].includes(mode) &&
        !/^[0-9]{6}$/.test(normalizeCode(values.code || ""))
    )
        errors.code = "Enter the six-digit code.";
    return errors;
}
