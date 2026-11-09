import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Identity } from "./api";

// Mirror the baseline guest pages without exposing the HttpOnly cookie to React.
export async function redirectSignedIn() {
    const session = (await cookies()).get("planner_session");
    if (!session) return;
    const origin = process.env.API_ORIGIN || "http://127.0.0.1:8001";
    const identity = await fetch(`${origin}/api/v1/auth/me`, {
        headers: {
            cookie: `planner_session=${encodeURIComponent(session.value)}`,
        },
        cache: "no-store",
    });
    if (!identity.ok) return;
    const account: Identity = await identity.json();
    if (account.user.email_verified) redirect("/dashboard");
}
