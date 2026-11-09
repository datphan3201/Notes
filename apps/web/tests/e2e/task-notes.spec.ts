import { expect, test } from "@playwright/test";
import { signInFixture, createEntity, navigate } from "./helpers";

test("Task and Notes open one rich document, with compact mobile checkbox labels", async ({ page }) => {
    await signInFixture(page);
    const task = await createEntity(page, "tasks", { title: "Shared context", checklist: [{ text: "Completion item", checked: false }] });
    const row = await createEntity(page, "notes", { title: "One task note", task_id: task.id, content: "Starting text" });
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "Ghi chép công việc" })).toHaveCount(0);
    await page.locator(".preview-linked-note-card").filter({ hasText: row.title }).click();
    const editor = page.getByRole("textbox", { name: "Nội dung ghi chú", exact: true });
    await editor.fill("Shared heading");
    await page.getByLabel("Kiểu đoạn văn", { exact: true }).selectOption("2");
    await editor.press("End");
    await editor.press("Enter");
    await editor.pressSequentially("Phone checklist");
    await page.getByRole("button", { name: "Ô đánh dấu", exact: true }).click();
    const checkbox = editor.locator('input[type="checkbox"]');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
    const label = editor.locator('label[contenteditable="false"]');
    expect((await label.boundingBox())!.height).toBeLessThan(40);
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "Đóng trình soạn thảo", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}`));
    await expect(page.getByRole("tab", { name: "Ghi chú", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".preview-linked-note-card")).toHaveCount(1);
    await expect(page.locator('.preview-linked-note-card [data-preview-kind="headings"]')).toHaveText("Shared heading");
    await navigate(page, "Ghi chú");
    await page.getByRole("heading", { name: row.title, exact: true }).click();
    await expect(editor.locator("h2")).toHaveText("Shared heading");
    await expect(checkbox).toBeChecked();
    const savedTask = await (await page.request.get(`/api/v1/tasks/${task.id}`)).json();
    expect(savedTask.checklist[0].checked).toBe(false);
    expect(savedTask.status).toBe("todo");
    expect((await (await page.request.get("/api/v1/notes")).json()).items).toHaveLength(1);
});

test("creating a Note from Task links it and locked Notes use the shared unlock flow", async ({ page }) => {
    await signInFixture(page);
    const task = await createEntity(page, "tasks", { title: "Create in context" });
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await page.getByRole("button", { name: "Ghi chú liên kết mới", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên ghi chú", { exact: true }).fill("Created together");
    await dialog.getByRole("textbox", { name: "Nội dung ghi chú", exact: true }).fill("Secret task note");
    await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    const notes = (await (await page.request.get("/api/v1/notes")).json()).items;
    expect(notes).toHaveLength(1);
    expect(notes[0].task_id).toBe(task.id);
    const identity = await (await page.request.get("/api/v1/auth/me")).json();
    const locked = await page.request.post(`/api/v1/notes/${notes[0].id}/password`, {
        headers: { origin: new URL(page.url()).origin, "x-csrf-token": identity.csrf },
        data: { new_password: "note-password" },
    });
    expect(locked.status()).toBe(200);
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    const card = page.locator(".preview-linked-note-card");
    await expect(card).toHaveCount(1);
    await expect(card).not.toContainText("Secret task note");
    await card.click();
    await expect(page.getByRole("dialog")).toContainText("Mở khóa");
    await expect(page.getByRole("textbox", { name: "Nội dung ghi chú", exact: true })).toHaveCount(0);
});
