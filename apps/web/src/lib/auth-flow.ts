import type { GuestLocale } from "./auth-input";

export type GuestParams = Promise<{ lang?: string | string[] }>;
export async function guestLanguage(
    params: GuestParams,
): Promise<GuestLocale | null> {
    const { lang } = await params;
    return lang === "en" || lang === "vi" ? lang : null;
}
export type Capability = {
    token: string;
    expiresAt: number;
    email?: string;
    method?: "totp" | "email";
};
const key = (purpose: string) => `planner-auth-${purpose}`;
export function rememberCapability(purpose: string, value: Capability) {
    sessionStorage.setItem(key(purpose), JSON.stringify(value));
}
export function forgetCapability(purpose: string) {
    try {
        sessionStorage.removeItem(key(purpose));
    } catch {
        /* No stored capability to clear. */
    }
}
export function readCapability(purpose: string): Capability | null {
    try {
        const value = JSON.parse(
            sessionStorage.getItem(key(purpose)) || "null",
        );
        if (
            typeof value?.token === "string" &&
            value.token.length >= 20 &&
            value.expiresAt > Date.now()
        )
            return value;
    } catch {
        /* A missing or expired capability requires a fresh link or sign-in. */
    }
    forgetCapability(purpose);
    return null;
}
