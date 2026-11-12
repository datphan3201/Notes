import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fixtureAction, seedFixture } from "./helpers";

const password = "Synthetic-only-password-2026";
const screenshotRoot = resolve(
    "../../output/playwright/auth-refinement/current",
);
async function signIn(
    page: Page,
    account: { email: string; password: string },
) {
    await page.goto("/login?lang=en");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
function mail(email: string, purpose: string): { body: string } {
    return fixtureAction({ email, purpose, action: "mail" });
}
const tokenFrom = (body: string) => body.split("#token=")[1];
const codeFrom = (body: string) => body.match(/Code: ([0-9]{6})/)![1];

test("original guest layout, language navigation, keyboard and password visibility", async ({
    page,
}, info) => {
    mkdirSync(screenshotRoot, { recursive: true });
    for (const lang of ["en", "vi"]) {
        await page.goto(`/login?lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.locator("#email")).toBeFocused();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
            path: `${screenshotRoot}/${info.project.name}-login-${lang}.png`,
            fullPage: true,
        });
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
            ),
        ).toBe(true);
        await expect(page.locator(".guest-story-content")).toBeVisible({
            visible: info.project.name === "desktop",
        });
    }
    await page.getByRole("link", { name: "English", exact: true }).click();
    await page
        .getByRole("link", { name: "Create an account", exact: true })
        .click();
    await expect(page).toHaveURL(/\/register\?lang=en$/);
    await expect(page.getByLabel("Display name")).toBeFocused();
    await page.screenshot({
        path: `${screenshotRoot}/${info.project.name}-register-en.png`,
        fullPage: true,
    });
    await page.getByLabel("Password", { exact: true }).fill(password);
    const visibility = page
        .getByRole("button", { name: "Show password", exact: true })
        .first();
    await visibility.click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");
    await expect(page.locator("#password")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
        page.getByRole("button", { name: "Hide password", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#password")).toHaveAttribute("type", "password");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page
        .getByRole("link", { name: "Forgot password?", exact: true })
        .click();
    await expect(page).toHaveURL(/\/forgot-password\?lang=en$/);
    await expect(
        page.getByRole("heading", { name: "Have a code from the email?" }),
    ).toBeVisible();
});

test("registration validates confirmation, confirms success, persists language and opens Dashboard", async ({
    page,
}) => {
    const email = `signup-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
    await page.goto("/register?lang=en");
    await page.getByLabel("Display name").fill("New planner");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page
        .getByLabel("Confirm password", { exact: true })
        .fill("A different password");
    await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
    await expect(
        page.getByText("Passwords do not match.", { exact: true }),
    ).toBeVisible();
    await expect(
        page.getByLabel("Confirm password", { exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(email);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page
        .getByRole("button", { name: "Create account", exact: true })
        .click();
    await expect(page.getByRole("status")).toContainText("Account created successfully.");
    await expect(page.getByRole("heading", { name: "Account created successfully", exact: true })).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveCount(0);
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await expect(page).toHaveURL(/\/login\?lang=en$/);
    await expect(page.getByRole("dialog", { name: "Email verification" })).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/\/login\?lang=en$/);
    await expect(page.getByRole("dialog", { name: "Email verification" })).toHaveCount(0);
    await signIn(page, { email, password });
    await expect(page.getByRole("dialog", { name: "Email verification" })).toBeVisible();
    const verified = await page.request.post("/api/v1/auth/verify", {
        headers: { origin: new URL(page.url()).origin },
        data: { token: tokenFrom(mail(email, "verify").body) },
    });
    expect(verified.ok()).toBe(true);
    await page.getByRole("button", { name: "I have verified my email" }).click();
    await expect(page).toHaveURL("/dashboard");
    const identity = await (await page.request.get("/api/v1/auth/me")).json();
    expect(identity.user.locale).toBe("en");
    for (const path of ["/login", "/register"]) {
        await page.goto(path);
        await expect(page).toHaveURL("/dashboard");
    }
    const areas = await (await page.request.get("/api/v1/areas")).json();
    expect(
        areas.items.map((area: { title: string }) => area.title).sort(),
    ).toEqual(["Area 1", "Area 2", "Area 3"]);
});

test("login errors retain entries and pending requests prevent duplicate submission", async ({
    page,
}) => {
    const account = seedFixture();
    await page.goto("/login?lang=en");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#email")).toBeFocused();
    await expect(
        page.getByText("Enter a valid email address.", { exact: true }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "Email or password is incorrect",
    );
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
        account.email,
    );
    await page.getByLabel("Password", { exact: true }).fill(account.password);
    await page.route("**/api/v1/auth/login", (route) =>
        route.abort("internetdisconnected"),
    );
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "Connection lost. Your entries have been kept. Try again.",
    );
    await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
        account.password,
    );
    await page.unroute("**/api/v1/auth/login");
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
        release = resolve;
    });
    await page.route("**/api/v1/auth/login", async (route) => {
        await hold;
        await route.continue();
    });
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
        page.getByRole("button", { name: "Signing in…", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
    release();
    await expect(page).toHaveURL("/dashboard");
});

test("recovery by email code survives refresh and resets without signing in", async ({
    page,
}) => {
    const account = seedFixture();
    await page.goto("/forgot-password?lang=en");
    await page.locator("#email").fill(account.email);
    await page
        .getByRole("button", { name: "Send reset link", exact: true })
        .click();
    await expect(page.getByRole("status")).toContainText(
        "Password reset link requested successfully. If the account is eligible",
    );
    const email = mail(account.email, "reset");
    expect(email.body).toContain("http://localhost:3100/reset-password#token=");
    await page
        .getByLabel("6-digit code", { exact: true })
        .fill(codeFrom(email.body));
    await page
        .getByRole("button", { name: "Continue with code", exact: true })
        .click();
    await expect(page).toHaveURL(/\/reset-password\?lang=en$/);
    await page.reload();
    await expect(page.getByLabel("Email", { exact: true })).toHaveValue(
        account.email,
    );
    await page
        .getByLabel("New password", { exact: true })
        .fill("Replacement-password-2026");
    await page
        .getByLabel("Confirm password", { exact: true })
        .fill("Replacement-password-2026");
    await page
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
    await expect(page.getByRole("status")).toHaveText(
        "Password reset. Sign in with your new password.",
    );
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
    await signIn(page, { ...account, password: "Replacement-password-2026" });
    await expect(page).toHaveURL("/dashboard");
});

test("email reset links survive language change and reject expired or reused tokens", async ({
    page,
}) => {
    const account = seedFixture();
    fixtureAction({ action: "link", email: account.email, purpose: "reset" });
    const token = tokenFrom(mail(account.email, "reset").body);
    await page.goto(`/account/reset?lang=vi#token=${token}`);
    await expect(page).not.toHaveURL(/token=/);
    await page.getByRole("link", { name: "English", exact: true }).click();
    await expect(page).toHaveURL(/\/reset-password\?lang=en$/);
    await expect(
        page.getByRole("heading", { name: "Reset password", exact: true }),
    ).toBeVisible();
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page
        .getByLabel("New password", { exact: true })
        .fill("Replacement-password-2026");
    await page
        .getByLabel("Confirm password", { exact: true })
        .fill("Replacement-password-2026");
    await page
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
    await expect(page.getByRole("status")).toHaveText(
        "Password reset. Sign in with your new password.",
    );
    await page.goto(`/reset-password?lang=en#token=${token}`);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page
        .getByLabel("New password", { exact: true })
        .fill("Another-password-2026");
    await page
        .getByLabel("Confirm password", { exact: true })
        .fill("Another-password-2026");
    await page
        .getByRole("button", { name: "Reset password", exact: true })
        .click();
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "This link or challenge expired. Request a new one.",
    );
    fixtureAction({ action: "link", email: account.email, purpose: "reset" });
    fixtureAction({ action: "expire", email: account.email, purpose: "reset" });
    const expired = tokenFrom(mail(account.email, "reset").body);
    expect(
        (
            await page.request.post("/api/v1/auth/reset", {
                headers: { origin: new URL(page.url()).origin },
                data: { token: expired, password: "Another-password-2026" },
            })
        ).status(),
    ).toBe(422);
});

test("verification consumes the link automatically and invalid links remain actionable", async ({
    page,
}) => {
    const account = seedFixture();
    fixtureAction({ action: "link", email: account.email, purpose: "verify" });
    const token = tokenFrom(mail(account.email, "verify").body);
    await page.goto(`/verify-email?lang=en#token=${token}`);
    await expect(page.getByRole("status")).toHaveText(
        "Email verified. Your account is ready.",
    );
    await expect(page).not.toHaveURL(/token=/);
    await page.goto(`/account/verify?lang=en#token=${token}`);
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "This link or challenge expired. Request a new one.",
    );
    await page.goto("/reset-password?lang=en");
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "Open the complete link from your email, or request a new one.",
    );
    await expect(
        page.getByRole("link", { name: "Send reset link", exact: true }),
    ).toBeVisible();
    await signIn(page, account);
    await expect(page).toHaveURL("/dashboard");
    fixtureAction({ action: "link", email: account.email, purpose: "verify" });
    const freshToken = tokenFrom(mail(account.email, "verify").body);
    await page.goto(`/verify-email?lang=en#token=${freshToken}`);
    await expect(
        page.getByRole("link", { name: "Continue to Planner", exact: true }),
    ).toBeVisible();
    await page
        .getByRole("link", { name: "Continue to Planner", exact: true })
        .click();
    await expect(page).toHaveURL("/dashboard");
});

test("MFA is a separate pending page with refresh, authenticator and email fallback", async ({
    page,
}) => {
    const account = seedFixture({ mfa: true });
    await signIn(page, account);
    await expect(page).toHaveURL(/\/two-factor\?lang=en$/);
    await expect(
        page.getByRole("heading", {
            name: "Two-step verification",
            exact: true,
        }),
    ).toBeVisible();
    expect((await page.request.get("/api/v1/tasks")).status()).toBe(401);
    await page.reload();
    await page
        .getByRole("button", { name: "Email me a code instead", exact: true })
        .click();
    await expect(page.getByRole("status")).toHaveText(
        "Check your email for the verification code.",
    );
    await page
        .getByLabel("Verification code")
        .fill(codeFrom(mail(account.email, "mfa-email").body));
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
    // A second synthetic account exercises the authenticator path without SMTP.
    const authenticator = seedFixture({ mfa: true });
    await page.goto("about:blank");
    await page.context().clearCookies();
    await signIn(page, authenticator);
    await expect(page).toHaveURL(/\/two-factor\?lang=en$/);
    await page
        .getByLabel("Verification code")
        .fill(
            fixtureAction({ action: "totp", email: authenticator.email }).code,
        );
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
    await page.goto("about:blank");
    await page.context().clearCookies();
    const expired = seedFixture({ mfa: true });
    await signIn(page, expired);
    await expect(page).toHaveURL(/\/two-factor\?lang=en$/);
    fixtureAction({ action: "expire", email: expired.email, purpose: "login" });
    await page.getByLabel("Verification code").fill("000000");
    await page.getByRole("button", { name: "Verify", exact: true }).click();
    await expect(page.locator(".auth-card").getByRole("alert")).toHaveText(
        "This link or challenge expired. Request a new one.",
    );
    await page
        .getByRole("link", { name: "Back to sign in", exact: true })
        .click();
    await expect(page).toHaveURL(/\/login\?lang=en$/);
    expect(
        await page.evaluate(() => sessionStorage.getItem("planner-auth-login")),
    ).toBeNull();
});

test("unverified accounts stay actionable on sign-in and can switch accounts", async ({ page }) => {
    const account = seedFixture({ unverified: true });
    await page.goto("/login?lang=en");
    await expect(page.getByRole("dialog", { name: "Email verification" })).toHaveCount(0);
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Password", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Email verification" })).toHaveCount(0);
    await signIn(page, account);
    const panel = page.getByRole("dialog", { name: "Email verification" });
    await expect(panel).toContainText(account.email);
    await expect(page.getByRole("link", { name: "Forgot password?", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resend verification email" }).click();
    await expect(page.getByText("Verification email requested. Check your inbox and spam folder.", { exact: true })).toBeVisible();
    expect(mail(account.email, "verify").body).toContain("verify-email#token=");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
    await signIn(page, account);
    await page.getByRole("button", { name: "I have verified my email" }).click();
    await expect(page.getByText("Your email is not verified yet. Open the verification link in your email.", { exact: true })).toBeVisible();
    await page.route(/\/api\/v1\/workspace\/(?:snapshot|bootstrap)(?:\?.*)?$/, route => route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Verify your email before using the workspace" }),
    }));
    await page.goto("/dashboard");
    await expect(page).toHaveURL("/login");
    await expect(page.getByRole("dialog", { name: /Email verification|Xác minh email/ })).toHaveCount(0);
    await signIn(page, account);
    await page.getByRole("button", { name: "Use another account" }).click();
    await expect(panel).toHaveCount(0);
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
    await page.unroute(/\/api\/v1\/workspace\/(?:snapshot|bootstrap)(?:\?.*)?$/);
    const other = seedFixture();
    await signIn(page, other);
    await expect(page).toHaveURL("/dashboard");
});
