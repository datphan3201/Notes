import { expect, test } from "@playwright/test";
import { signInFixture, createEntity, navigate } from "./helpers";

const editor = (page: import("@playwright/test").Page) => page.getByRole("textbox", { name: "Nội dung ghi chú", exact: true });
const save = (page: import("@playwright/test").Page) => page.getByRole("button", { name: "Lưu", exact: true });

test("Task edits the canonical Note inline and retains drafts across tabs", async ({ page }, testInfo) => {
    await signInFixture(page);
    const task = await createEntity(page, "tasks", { title: "Shared context", checklist: [{ text: "Completion item", checked: false }] });
    const row = await createEntity(page, "notes", { title: "One task note", task_id: task.id, content: "Starting text" });
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Chọn ghi chú", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Tạo ghi chú", exact: true })).toHaveCount(0);
    await expect(editor(page)).toHaveText("Starting text");
    await editor(page).fill("Shared heading");
    await page.getByLabel("Kiểu đoạn văn", { exact: true }).selectOption("2");
    await editor(page).press("End");
    await editor(page).press("Enter");
    await editor(page).pressSequentially("Phone checklist");
    await page.getByRole("button", { name: "Ô đánh dấu", exact: true }).click();
    const checkbox = editor(page).locator('input[type="checkbox"]');
    await checkbox.check();
    expect((await editor(page).locator('label[contenteditable="false"]').boundingBox())!.height).toBeLessThan(40);
    await page.getByRole("tab", { name: "Tổng quan", exact: true }).click();
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await expect(editor(page).locator("h2")).toHaveText("Shared heading");
    expect((await (await page.request.get(`/api/v1/notes/${row.id}`)).json()).content).toBe("Starting text");
    const headingSize = await editor(page).locator("h2").evaluate(node => getComputedStyle(node).fontSize);
    expect(parseFloat(headingSize)).toBeGreaterThan(20);
    await save(page).click();
    await expect(save(page)).toBeDisabled();
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
    await page.screenshot({ path: `/tmp/planner-inline-notes-${testInfo.project.name}.png`, fullPage: true });
    await navigate(page, "Ghi chú");
    await page.getByRole("heading", { name: row.title, exact: true }).click();
    await expect(editor(page).locator("h2")).toHaveText("Shared heading");
    expect(await editor(page).locator("h2").evaluate(node => getComputedStyle(node).fontSize)).toBe(headingSize);
    await expect(checkbox).toBeChecked();
    const savedTask = await (await page.request.get(`/api/v1/tasks/${task.id}`)).json();
    expect(savedTask.checklist[0].checked).toBe(false);
    expect(savedTask.status).toBe("todo");
    expect((await (await page.request.get("/api/v1/notes")).json()).items).toHaveLength(1);
});

test("creating an inline Task Note links it and locked Notes use the shared unlock flow", async ({ page }) => {
    await signInFixture(page);
    const task = await createEntity(page, "tasks", { title: "Create in context" });
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await page.getByRole("button", { name: "Tạo ghi chú", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByLabel("Tên ghi chú", { exact: true }).fill("Created together");
    await editor(page).fill("Secret task note");
    await save(page).click();
    await expect(save(page)).toBeDisabled();
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
    await expect(editor(page)).toHaveCount(0);
    await expect(page.locator(".task-notes-inline")).not.toContainText("Secret task note");
    await page.locator(".task-notes-inline").getByRole("button", { name: "Mở khóa", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Mật khẩu", { exact: true }).fill("note-password");
    await dialog.getByRole("button", { name: "Mở khóa", exact: true }).click();
    await expect(editor(page)).toHaveText("Secret task note");
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
});

test("one attached Note stays inline while multiple resource links preserve its draft", async ({ page }) => {
    await signInFixture(page);
    const task = await createEntity(page, "tasks", { title: "Primary and references" });
    const primary = await createEntity(page, "notes", { title: "Primary note", task_id: task.id, content: "Primary saved" });
    const resources = [
        await createEntity(page, "notes", { title: "Reference one", content: "Reference body one" }),
        await createEntity(page, "notes", { title: "Reference two", content: "Reference body two" }),
    ];
    await page.goto(`/tasks/${task.id}`);
    await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
    await expect(editor(page)).toHaveText("Primary saved");
    await editor(page).fill("Unsaved primary draft");
    for (const resource of resources) {
        await page.getByRole("button", { name: "Liên kết ghi chú", exact: true }).click();
        const dialog = page.getByRole("dialog", { name: "Liên kết ghi chú", exact: true });
        await dialog.getByLabel("Ghi chú tài nguyên", { exact: true }).selectOption(resource.id);
        await dialog.getByRole("button", { name: "Liên kết", exact: true }).click();
        await expect(dialog).toHaveCount(0);
    }
    const list = page.locator(".task-note-resource-list");
    await expect(list.locator("li")).toHaveCount(2);
    await list.getByRole("button", { name: "Reference one", exact: true }).click();
    const resourceDialog = page.getByRole("dialog");
    await expect(resourceDialog.getByRole("textbox", { name: "Nội dung ghi chú", exact: true })).toHaveText("Reference body one");
    await resourceDialog.getByRole("button", { name: "Đóng trình soạn thảo", exact: true }).click();
    await expect(editor(page)).toHaveText("Unsaved primary draft");
    await expect(page).toHaveURL(new RegExp(`/tasks/${task.id}$`));
    expect((await (await page.request.get(`/api/v1/notes/${primary.id}`)).json()).content).toBe("Primary saved");
    await page.locator(".task-notes-inline").getByRole("button", { name: "Bỏ bản nháp", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Bỏ thay đổi chưa lưu?", exact: true });
    await confirmation.getByRole("button", { name: "Bỏ bản nháp", exact: true }).click();
    await expect(editor(page)).toHaveText("Primary saved");
    await list.getByRole("button", { name: "Bỏ liên kết ghi chú: Reference one", exact: true }).click();
    await expect(list.locator("li")).toHaveCount(1);
    await expect.poll(async () => (await (await page.request.get(`/api/v1/tasks/${task.id}`)).json()).resource_note_ids).toEqual([resources[1].id]);
    for (const resource of resources) {
        const row = await (await page.request.get(`/api/v1/notes/${resource.id}`)).json();
        expect(row.task_id).toBeNull();
        expect(row.title).toBe(resource.title);
    }
});
