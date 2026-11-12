import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export async function register(page: Page) {
    await page.goto("/login?lang=vi");
    await page
        .getByRole("link", { name: "Tạo tài khoản", exact: true })
        .click();
    await page.getByLabel("Tên hiển thị").fill("Browser acceptance");
    await page
        .getByLabel("Email", { exact: true })
        .fill(`e2e-${randomUUID()}@example.com`);
    await page
        .getByLabel("Mật khẩu", { exact: true })
        .fill("Synthetic-only-password-2026");
    await page
        .getByLabel("Xác nhận mật khẩu")
        .fill("Synthetic-only-password-2026");
    await page
        .getByRole("button", { name: "Tạo tài khoản", exact: true })
        .click();
    await expect(page).toHaveURL("/dashboard");
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Ghi chú", exact: true }),
    ).toBeVisible();
}

export async function navigate(page: Page, name: string) {
    const menu = page.getByRole("button", {
        name: "Mở điều hướng",
        exact: true,
    });
    await expect(page.locator(".baseline-workspace")).toBeVisible();
    if (await menu.isVisible()) await menu.click();
    await page
        .getByRole("navigation")
        .getByRole("link", { name, exact: true })
        .click();
    if (name === "Tổng quan") {
        await expect(page).toHaveURL("/dashboard");
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
            "Chào bạn!",
        );
    } else {
        await expect(
            page.getByRole("heading", { name, level: 1, exact: true }),
        ).toBeVisible();
    }
}

// Fixtures bypass signup quotas; authentication still uses the normal browser UI.
export function fixtureAction(values: Record<string, unknown>) {
    const output = execFileSync(
        "uv",
        ["run", "python", "tests/browser_account.py"],
        {
            cwd: fileURLToPath(new URL("../../../api", import.meta.url)),
            input: JSON.stringify(values),
            env: {
                ...process.env,
                PLANNER_ENVIRONMENT: "testing",
                PLANNER_DATABASE_URL:
                    process.env.PLANNER_TEST_DATABASE_URL ||
                    "postgresql+psycopg://planner_test:isolated-test-only@127.0.0.1:5434/planner_test",
                PLANNER_AI_API_KEY: "",
                PLANNER_SMTP_HOST: "",
                PLANNER_RESEND_API_KEY: "",
                PLANNER_SUPABASE_URL: "",
                PLANNER_SUPABASE_SERVICE_ROLE_KEY: "",
                PLANNER_SUPABASE_STORAGE_BUCKET: "",
                PLANNER_DATABASE_SCHEMA: "public",
                PLANNER_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
            },
        },
    ).toString();
    return output.trim() ? JSON.parse(output) : null;
}
export function seedFixture(extra: Record<string, unknown> = {}) {
    const values = {
        email: `fixture-${randomUUID()}@example.com`,
        password: "Synthetic-only-password-2026",
        ...extra,
    };
    fixtureAction(values);
    return values;
}
export async function signInFixture(
    page: Page,
    extra: Record<string, unknown> = {},
) {
    const { email, password } = seedFixture(extra);
    await page.goto("/login?lang=vi");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Ghi chú", exact: true }),
    ).toBeVisible();
    return { email, password };
}

export async function createEntity(
    page: Page,
    kind: string,
    fields: Record<string, unknown>,
) {
    const identity = await (await page.request.get("/api/v1/auth/me")).json();
    const response = await page.request.post("/api/v1/" + kind, {
        headers: {
            origin: new URL(page.url()).origin,
            "x-csrf-token": identity.csrf,
        },
        data: fields,
    });
    expect(response.status()).toBe(201);
    return response.json();
}
export async function workspaceSaved(
    page: Page,
    action: () => Promise<unknown>,
) {
    const result = page.waitForResponse(
        (r) =>
            /\/workspace\/(?:changes|archived\/delete)$/.test(r.url()) &&
            r.request().method() === "POST",
    );
    await action();
    expect((await result).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
}
