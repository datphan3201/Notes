import { expect, test } from "@playwright/test";
import { signInFixture, navigate } from "./helpers";

test("capture a dated Task, find it on Dashboard, and complete it", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Công việc");
    await page.getByRole("button", { name: "Thao tác trang", exact: true }).click();
    await page
        .getByRole("button", { name: "Công việc mới", exact: true })
        .first()
        .click();
    const dialog = page.getByRole("dialog");
    await expect(
        dialog.getByLabel("Tên công việc", { exact: true }),
    ).toBeFocused();
    await dialog
        .getByLabel("Tên công việc", { exact: true })
        .fill("A small next step");
    await dialog
        .getByRole("button", { name: "Ngày và lịch", exact: true })
        .click();
    const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(new Date());
    await dialog.getByLabel("Hạn hoàn thành", { exact: true }).fill(today);
    const saved = page.waitForResponse(
        (r) =>
            r.url().endsWith("/workspace/changes") &&
            r.request().method() === "POST",
    );
    await dialog
        .getByRole("button", { name: "Tạo công việc", exact: true })
        .click();
    expect((await saved).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    await navigate(page, "Tổng quan");
    await expect(
        page.getByRole("button", { name: /^A small next step/ }),
    ).toBeVisible();
    await page
        .getByRole("button", {
            name: "Hoàn thành: A small next step",
            exact: true,
        })
        .click();
    const confirmation = page.getByRole("dialog", {
        name: "Hoàn thành công việc này?",
    });
    const completed = page.waitForResponse(
        (r) =>
            r.url().endsWith("/workspace/changes") &&
            r.request().method() === "POST",
    );
    await confirmation
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
    expect((await completed).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    await page.reload();
    const tasks = await (await page.request.get("/api/v1/tasks")).json();
    expect(
        tasks.items.find(
            (t: { title: string }) => t.title === "A small next step",
        ).status,
    ).toBe("done");
});

test("Note explicit save survives reload and a concurrent edit preserves the local draft", async ({
    page,
}) => {
    await signInFixture(page);
    await page.getByRole("button", { name: "Thao tác trang", exact: true }).click();
    await page
        .getByRole("button", { name: "Ghi chú mới", exact: true })
        .click();
    await expect.poll(async () => (await (await page.request.get("/api/v1/notes")).json()).items.length).toBe(1);
    let dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Tên ghi chú", { exact: true })
        .fill("Saved thought");
    await dialog
        .getByRole("textbox", { name: "Nội dung ghi chú", exact: true })
        .fill("The original thought.");
    let writes = 0;
    await page.route("**/api/v1/workspace/changes", async route => {
        writes++;
        await route.continue();
    });
    // Pass the former debounce interval: typing must not send a write.
    await page.waitForTimeout(1000);
    expect(writes).toBe(0);
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect
        .poll(async () => {
            const notes = await (
                await page.request.get("/api/v1/notes")
            ).json();
            return notes.items.some(
                (n: { title: string; content: string }) =>
                    n.title === "Saved thought" &&
                    n.content === "The original thought.",
            );
        })
        .toBeTruthy();
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    await dialog
        .getByRole("button", { name: "Đóng trình soạn thảo", exact: true })
        .click();
    await page.reload();
    await page
        .getByRole("heading", { name: "Saved thought", exact: true })
        .click();
    dialog = page.getByRole("dialog");
    const content = dialog.getByRole("textbox", {
        name: "Nội dung ghi chú",
        exact: true,
    });
    await expect(content).toHaveText("The original thought.");
    const identity = await (await page.request.get("/api/v1/auth/me")).json();
    const note = (await (await page.request.get("/api/v1/notes")).json())
        .items[0];
    const remote = await page.request.patch(`/api/v1/notes/${note.id}`, {
        headers: {
            origin: new URL(page.url()).origin,
            "x-csrf-token": identity.csrf,
        },
        data: {
            version: note.version,
            fields: { content: "A change from another tab." },
        },
    });
    expect(remote.status()).toBe(200);
    await content.fill("My local draft must survive.");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText(
        "Ghi chú có thay đổi",
        { timeout: 10000 },
    );
    await expect(content).toHaveText("My local draft must survive.");
    await expect(
        dialog.getByRole("button", { name: "Tải bản nháp", exact: true }),
    ).toBeVisible();
    const saved = await (
        await page.request.get(`/api/v1/notes/${note.id}`)
    ).json();
    expect(saved.content).toBe("A change from another tab.");
    await dialog.getByRole("button", { name: "Dùng bản đã lưu", exact: true }).click();
    await expect(content).toHaveText("A change from another tab.");
    await expect(page.locator(".live-save-error")).toHaveCount(0);
    const remoteAgain = await page.request.patch(`/api/v1/notes/${note.id}`, {
        headers: { origin: new URL(page.url()).origin, "x-csrf-token": identity.csrf },
        data: { version: saved.version, fields: { content: "Another remote revision." } },
    });
    expect(remoteAgain.status()).toBe(200);
    await content.fill("Explicitly keep this newer local draft.");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("Ghi chú có thay đổi");
    await dialog.getByRole("button", { name: "Giữ bản nháp của tôi", exact: true }).click();
    await expect.poll(async () => (await (await page.request.get(`/api/v1/notes/${note.id}`)).json()).content).toBe("Explicitly keep this newer local draft.");
    await expect(page.locator(".live-save-error")).toHaveCount(0);
});
