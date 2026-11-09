import { expect, test } from "@playwright/test";
import { signInFixture, createEntity, fixtureAction } from "./helpers";

test("Archive keeps delete confirmation open until the server acknowledges deletion", async ({ page }) => {
    await signInFixture(page);
    const row = await createEntity(page, "tasks", { title: "Pending deletion audit" });
    const identity = await (await page.request.get("/api/v1/auth/me")).json();
    const result = await page.request.post(`/api/v1/tasks/${row.id}/archive`, {
        headers: { origin: new URL(page.url()).origin, "x-csrf-token": identity.csrf }, data: { version: row.version },
    });
    expect(result.status()).toBe(200);
    await page.goto("/settings/archive");
    await page.getByRole("button", { name: "Xóa vĩnh viễn: Pending deletion audit", exact: true }).click();
    const confirmation = page.getByRole("dialog");
    await confirmation.getByRole("checkbox").check();
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/api/v1/workspace/changes", async route => {
        await gate;
        await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Audit: server rejected deletion" }) });
    });
    try {
        const request = page.waitForRequest(r => r.url().endsWith("/workspace/changes") && r.method() === "POST");
        await confirmation.getByRole("button", { name: "Xác nhận", exact: true }).click();
        await request;
        await expect(confirmation).toBeVisible({ timeout: 1500 });
    } finally { release(); }
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("Chưa lưu thao tác xóa");
    await page.unroute("**/api/v1/workspace/changes");
    await confirmation.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(page.locator(".review-archive-row").filter({ hasText: row.title })).toHaveCount(0);
});

for (const kind of ["notes", "reviews", "task-series"]) {
    test(`Archive exposes an API-archived ${kind} item for restoration`, async ({ page }) => {
        const account = await signInFixture(page);
        const fields = kind === "reviews" ? { period_date: "2026-11-01" }
            : kind === "task-series" ? { frequency: "daily", start_date: "2026-11-01", template: { title: "Recurring audit" } } : {};
        const row = await createEntity(page, kind, { title: `Archived audit ${kind}`, ...fields });
        const identity = await (await page.request.get("/api/v1/auth/me")).json();
        if (kind === "task-series") {
            const archived = await page.request.post(`/api/v1/${kind}/${row.id}/archive`, {
                headers: { origin: new URL(page.url()).origin, "x-csrf-token": identity.csrf }, data: { version: row.version },
            });
            expect(archived.status()).toBe(200);
        } else {
            fixtureAction({ email: account.email, action: "legacy-archive", kind, id: row.id });
        }
        await page.goto("/settings/archive");
        const entry = page.locator(".review-archive-row").filter({ hasText: kind === "task-series" ? "Recurring audit" : row.title });
        await expect(entry).toBeVisible();
        await entry.getByRole("button", { name: "Khôi phục", exact: true }).click();
        await expect(entry).toHaveCount(0);
        const restored = await (await page.request.get(`/api/v1/${kind}/${row.id}`)).json();
        expect(restored.archived_at).toBeNull();
    });
}

test("Repeating series can be archived, restored and permanently deleted through the UI", async ({ page }) => {
    await signInFixture(page);
    const row = await createEntity(page, "task-series", {
        title: "Series lifecycle", frequency: "daily", start_date: "2026-11-01",
        template: { title: "Series lifecycle" },
    });
    const archiveSeries = async () => {
        await page.goto("/tasks");
        await page.getByRole("button", { name: /^Lặp lại/ }).click();
        await page.locator(".preview-series-card").filter({ hasText: row.title })
            .getByRole("button", { name: "Lưu trữ chuỗi", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await page.goto("/settings/archive");
    };
    await archiveSeries();
    let entry = page.locator(".review-archive-row").filter({ hasText: row.title });
    await entry.getByRole("button", { name: "Khôi phục", exact: true }).click();
    await expect(entry).toHaveCount(0);
    await archiveSeries();
    entry = page.locator(".review-archive-row").filter({ hasText: row.title });
    await entry.getByRole("button", { name: "Xóa vĩnh viễn: " + row.title, exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await page.request.get(`/api/v1/task-series/${row.id}`)).status()).toBe(404);
});
