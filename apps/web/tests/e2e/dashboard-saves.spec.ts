import { expect, test, type Page } from "@playwright/test";
import { createEntity, navigate, signInFixture } from "./helpers";

function latch() {
    let release!: () => void;
    const promise = new Promise<void>((resolve) => { release = resolve; });
    return { promise, release: () => release() };
}

async function dashboardHabits(page: Page) {
    await signInFixture(page);
    const first = await createEntity(page, "habits", { title: "First daily habit" });
    const second = await createEntity(page, "habits", { title: "Second daily habit" });
    await navigate(page, "Tổng quan");
    await expect(page.getByRole("button", { name: /^First daily habit\..*Điểm danh$/ }).and(page.locator(".is-today"))).toBeVisible();
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    return { first, second };
}

async function checkins(page: Page) {
    const response = await page.request.get("/api/v1/workspace/snapshot");
    expect(response.status()).toBe(200);
    const snapshot = await response.json();
    return snapshot.habit_days.filter((row: { state: string }) => row.state === "done")
        .map((row: { habit_id: string }) => row.habit_id).sort();
}

test("Dashboard stays interactive and coalesces edits across a slow save and refresh", async ({ page }) => {
    const { second } = await dashboardHabits(page);
    const writeHeld = latch(), releaseWrite = latch();
    const refreshHeld = latch(), releaseRefresh = latch();
    let writes = 0, active = 0, maxActive = 0;
    await page.route("**/api/v1/workspace/changes", async (route) => {
        writes++;
        active++;
        maxActive = Math.max(maxActive, active);
        const response = await route.fetch();
        if (writes === 1) {
            writeHeld.release();
            await releaseWrite.promise;
        }
        await route.fulfill({ response });
        active--;
    });
    let reports = 0;
    await page.route("**/api/v1/reports", async (route) => {
        const response = await route.fetch();
        if (++reports === 1) {
            refreshHeld.release();
            await releaseRefresh.promise;
        }
        await route.fulfill({ response });
    });
    try {
        await page.getByRole("button", { name: /^First daily habit\..*Điểm danh$/ }).and(page.locator(".is-today")).click();
        await writeHeld.promise;
        await expect(page.locator(".live-save-status")).toHaveCount(0);
        await expect(page.getByText("Đang lưu… / Saving…", { exact: true })).toHaveCount(0);
        await expect(page.locator('[data-workspace-saving="true"]')).toBeVisible();
        await page.getByRole("button", { name: /^Second daily habit\..*Điểm danh$/ }).and(page.locator(".is-today")).click({ timeout: 1500 });
        await expect(page.getByRole("button", { name: /^Second daily habit\..*Bỏ điểm danh$/ }).and(page.locator(".is-today"))).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: /^Second daily habit\..*Bỏ điểm danh$/ }).and(page.locator(".is-today")).click();
        await page.getByRole("button", { name: /^Second daily habit\..*Điểm danh$/ }).and(page.locator(".is-today")).click();
        await page.getByRole("tab", { name: "Hàng tuần", exact: true }).click();
        await page.getByRole("tab", { name: "Hàng ngày", exact: true }).click();
        expect(writes).toBe(1);
        releaseWrite.release();
        await refreshHeld.promise;
        await page.getByRole("button", { name: /^First daily habit\..*Bỏ điểm danh$/ }).and(page.locator(".is-today")).click();
        releaseRefresh.release();
        await expect.poll(() => checkins(page)).toEqual([second.id]);
        await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
        await expect(page.locator(".live-save-error")).toHaveCount(0);
        await expect(page.getByText("Đã lưu thay đổi.", { exact: true })).toHaveCount(0);
        expect(writes).toBe(2);
        expect(maxActive).toBe(1);
        await page.reload();
        await expect(page.getByRole("button", { name: /^Second daily habit\..*Bỏ điểm danh$/ }).and(page.locator(".is-today"))).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByRole("button", { name: /^First daily habit\..*Điểm danh$/ }).and(page.locator(".is-today"))).toHaveAttribute("aria-pressed", "false");
    } finally {
        releaseWrite.release();
        releaseRefresh.release();
    }
});

test("Dashboard failed save retains later edits and retries only on explicit action", async ({ page }) => {
    const { first, second } = await dashboardHabits(page);
    const held = latch(), release = latch();
    let writes = 0;
    await page.route("**/api/v1/workspace/changes", async (route) => {
        if (++writes === 1) {
            held.release();
            await release.promise;
            await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Unable to save the change." }) });
        } else await route.continue();
    });
    try {
        await page.getByRole("button", { name: /^First daily habit\..*Điểm danh$/ }).and(page.locator(".is-today")).click();
        await held.promise;
        await page.getByRole("button", { name: /^Second daily habit\..*Điểm danh$/ }).and(page.locator(".is-today")).click({ timeout: 1500 });
        release.release();
        const error = page.locator(".live-save-error");
        await expect(error).toContainText("Không thể lưu thay đổi.");
        await expect(error.getByRole("button", { name: "Thử lưu lại", exact: true })).toBeVisible();
        await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
        for (const name of ["First daily habit", "Second daily habit"])
            await expect(page.getByRole("button", { name: new RegExp(`^${name}\\..*Bỏ điểm danh$`) }).and(page.locator(".is-today"))).toHaveAttribute("aria-pressed", "true");
        expect(await checkins(page)).toEqual([]);
        expect(writes).toBe(1);
        await error.getByRole("button", { name: "Thử lưu lại", exact: true }).click();
        await expect.poll(() => checkins(page)).toEqual([first.id, second.id].sort());
        await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
        await expect(error).toHaveCount(0);
        expect(writes).toBe(2);
    } finally {
        release.release();
    }
});

test("Dashboard keeps a queued Task completion acknowledgement until its own save", async ({ page }) => {
    await signInFixture(page);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    const first = await createEntity(page, "tasks", { title: "First completion", due_date: today, plan_for: "daily" });
    const second = await createEntity(page, "tasks", { title: "Queued completion", due_date: today, plan_for: "daily", checklist: [{ text: "Intentionally unchecked", checked: false }] });
    await navigate(page, "Tổng quan");
    const held = latch(), release = latch();
    let writes = 0;
    await page.route("**/api/v1/workspace/changes", async (route) => {
        const response = await route.fetch();
        if (++writes === 1) {
            held.release();
            await release.promise;
        }
        await route.fulfill({ response });
    });
    try {
        await page.getByRole("button", { name: "Hoàn thành: First completion", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
        await held.promise;
        await page.getByRole("button", { name: "Hoàn thành: Queued completion", exact: true }).click({ timeout: 1500 });
        const confirmation = page.getByRole("dialog");
        await confirmation.getByRole("checkbox").check();
        await confirmation.getByRole("button", { name: "Xác nhận", exact: true }).click();
        release.release();
        await expect.poll(async () => (await (await page.request.get(`/api/v1/tasks/${second.id}`)).json()).status).toBe("done");
        await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
        expect((await (await page.request.get(`/api/v1/tasks/${first.id}`)).json()).status).toBe("done");
        expect((await (await page.request.get(`/api/v1/tasks/${second.id}`)).json()).checklist[0].checked).toBe(false);
        await expect(page.locator(".live-save-error")).toHaveCount(0);
        expect(writes).toBe(2);
    } finally {
        release.release();
    }
});

test("Dashboard queued edits reject an unseen concurrent Task version", async ({ page }) => {
    await signInFixture(page);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
    await createEntity(page, "tasks", { title: "Hold this completion", due_date: today, plan_for: "daily" });
    const task = await createEntity(page, "tasks", { title: "Concurrent completion", due_date: today, plan_for: "daily" });
    await navigate(page, "Tổng quan");
    const held = latch(), release = latch();
    let writes = 0;
    await page.route("**/api/v1/workspace/changes", async (route) => {
        const response = await route.fetch();
        if (++writes === 1) {
            held.release();
            await release.promise;
        }
        await route.fulfill({ response });
    });
    try {
        await page.getByRole("button", { name: "Hoàn thành: Hold this completion", exact: true }).click();
        await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
        await held.promise;
        await page.getByRole("button", { name: "Hoàn thành: Concurrent completion", exact: true }).click({ timeout: 1500 });
        await page.getByRole("dialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
        const identity = await (await page.request.get("/api/v1/auth/me")).json();
        const remote = await page.request.patch(`/api/v1/tasks/${task.id}`, {
            headers: { origin: new URL(page.url()).origin, "x-csrf-token": identity.csrf },
            data: { version: task.version, fields: { title: "Renamed on another tab" } },
        });
        expect(remote.status()).toBe(200);
        release.release();
        const error = page.locator(".live-save-error");
        await expect(error.getByRole("button", { name: "Thử lưu lại", exact: true })).toBeVisible();
        const stored = await (await page.request.get(`/api/v1/tasks/${task.id}`)).json();
        expect(stored.status).toBe("todo");
        expect(stored.title).toBe("Renamed on another tab");
        expect(writes).toBe(2);
        await error.getByRole("button", { name: "Thử lưu lại", exact: true }).click();
        await expect.poll(async () => (await (await page.request.get(`/api/v1/tasks/${task.id}`)).json()).status).toBe("done");
        await expect(error).toHaveCount(0);
    } finally {
        release.release();
    }
});
