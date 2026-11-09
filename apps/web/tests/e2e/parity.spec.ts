import { expect, test, type Page } from "@playwright/test";
import { signInFixture, navigate } from "./helpers";

export async function create(
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
async function saved(page: Page, action: () => Promise<unknown>) {
    const result = page.waitForResponse(
        (r) =>
            r.url().endsWith("/workspace/changes") &&
            r.request().method() === "POST",
    );
    await action();
    expect((await result).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
}
const noteContent = (page: Page) =>
    page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Nội dung ghi chú", exact: true });
const note = (page: Page, id: string) =>
    page.request.get(`/api/v1/notes/${id}`).then((r) => r.json());

test("time filters and manual daily planning persist without changing dates", async ({
    page,
}) => {
    await signInFixture(page);
    const task = await create(page, "tasks", { title: "An inbox task" });
    await navigate(page, "Công việc");
    await page.getByRole("button", { name: /^Chưa lên lịch/ }).click();
    await expect(
        page.getByRole("button", { name: "An inbox task", exact: true }),
    ).toBeVisible();
    await saved(page, () =>
        page
            .getByRole("button", {
                name: "Thêm cho hôm nay: An inbox task",
                exact: true,
            })
            .click(),
    );
    await page.getByRole("button", { name: /^Hôm nay/ }).click();
    await expect(
        page.getByRole("button", { name: "An inbox task", exact: true }),
    ).toBeVisible();
    expect(
        (await (await page.request.get(`/api/v1/tasks/${task.id}`)).json())
            .due_date,
    ).toBeNull();
    await page.reload();
    await page.getByRole("button", { name: /^Tuần này/ }).click();
    await expect(
        page.getByRole("button", { name: "An inbox task", exact: true }),
    ).toBeVisible();
});

test("Escape offers discard for planning drafts and never silently saves", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Công việc");
    await page.getByRole("button", { name: "Thao tác trang", exact: true }).click();
    await page
        .getByRole("button", { name: "Công việc mới", exact: true })
        .first()
        .click();
    await page
        .getByRole("dialog")
        .getByLabel("Tên công việc", { exact: true })
        .fill("A draft to discard");
    await page.keyboard.press("Escape");
    const decision = page.getByRole("dialog", {
        name: "Bỏ thay đổi chưa lưu?",
    });
    await expect(decision).toBeVisible();
    await decision.getByRole("button", { name: "Tiếp tục sửa" }).click();
    await expect(
        page.getByRole("dialog").getByLabel("Tên công việc", { exact: true }),
    ).toHaveValue("A draft to discard");
    await page.keyboard.press("Escape");
    await page
        .getByRole("button", { name: "Bỏ thay đổi", exact: true })
        .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
        (await (await page.request.get("/api/v1/tasks")).json()).items,
    ).toHaveLength(0);
});

test("workspace refresh preserves an assistant opened while reports are loading", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Công việc");
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => {
        release = resolve;
    });
    const loading = new Promise<void>((resolve) => {
        reached = resolve;
    });
    await page.route("**/api/v1/reports", async (route) => {
        const response = await route.fetch();
        reached();
        await gate;
        await route.fulfill({ response });
    });
    await navigate(page, "Lịch");
    await loading;
    await page.getByRole("button", { name: "Hỏi AI", exact: true }).click();
    const message = page.getByRole("textbox", { name: "Tin nhắn", exact: true });
    await message.fill("Keep this unsent message");
    const refreshed = page.waitForResponse((response) =>
        response.url().endsWith("/notifications"),
    );
    release();
    await refreshed;
    await expect(message).toHaveValue("Keep this unsent message");
});

test("appearance theme and scenery persist across reload", async ({ page }) => {
    await signInFixture(page);
    await page.goto("/settings/preferences");
    let response = page.waitForResponse(
        (r) =>
            r.url().endsWith("/preferences") && r.request().method() === "PUT",
    );
    await page
        .getByRole("button", { name: "Lối mòn trong rừng", exact: true })
        .click();
    expect((await response).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    response = page.waitForResponse(
        (r) =>
            r.url().endsWith("/preferences") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Tối", exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(page.locator('[data-workspace-saving="true"]')).toHaveCount(0);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute(
        "data-visual-theme",
        "forest",
    );
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const prefs = (await (await page.request.get("/api/v1/auth/me")).json())
        .user.preferences;
    expect(prefs.visual_theme).toBe("forest");
});

test("goal tree opens roadmap and milestone capture preserves parent context", async ({
    page,
}) => {
    await signInFixture(page);
    const area = await create(page, "areas", { title: "Learning" });
    const goal = await create(page, "goals", {
        title: "A real roadmap",
        area_id: area.id,
    });
    const related = await create(page, "goals", {
        title: "Related outcome",
        area_id: area.id,
    });
    await navigate(page, "Mục tiêu");
    await page.getByText("Learning", { exact: true }).click();
    await page.getByRole("button", { name: /^A real roadmap/ }).click();
    await expect(page).toHaveURL(`/goals/${goal.id}`);
    await page
        .getByRole("button", { name: "Thêm cột mốc", exact: true })
        .click();
    const dialog = page.getByRole("dialog");
    await expect(
        dialog.getByRole("combobox", { name: "Mục tiêu", exact: true }),
    ).toHaveValue(goal.id);
    await dialog.getByLabel("Tên", { exact: true }).fill("First milestone");
    await dialog
        .getByRole("checkbox", { name: "Related outcome", exact: true })
        .check();
    await saved(page, () =>
        dialog
            .getByRole("button", { name: "Lưu thay đổi", exact: true })
            .click(),
    );
    const milestone = (
        await (await page.request.get("/api/v1/milestones")).json()
    ).items[0];
    expect(milestone.goal_id).toBe(goal.id);
    expect(milestone.related).toEqual([related.id]);
    await page.getByText("First milestone", { exact: true }).first().click();
    await page
        .getByRole("button", { name: "Thêm công việc", exact: true })
        .click();
    await page.locator("[data-task-picker]").getByRole("button", { name: "Công việc mới", exact: true }).click();
    const editor = page
        .getByRole("dialog")
        .filter({ has: page.getByLabel("Tên công việc", { exact: true }) });
    await expect(
        editor
            .getByRole("combobox", { name: "Thêm vào", exact: true })
            .locator("option:checked"),
    ).toContainText("First milestone");
    await editor
        .getByLabel("Tên công việc", { exact: true })
        .fill("A milestone task");
    await saved(page, () =>
        editor
            .getByRole("button", { name: "Tạo công việc", exact: true })
            .click(),
    );
    expect(
        (await (await page.request.get("/api/v1/tasks")).json()).items[0]
            .milestone_id,
    ).toBe(milestone.id);
});

test("Notes pin, tag filtering and list view remain functional after reload", async ({
    page,
}) => {
    await signInFixture(page);
    const tagged = await create(page, "notes", {
        title: "Tagged thought",
        content: "Tagged body",
        tags: ["Research"],
    });
    await create(page, "notes", { title: "Another thought" });
    await page.reload();
    await page
        .getByRole("heading", { name: "Tagged thought", exact: true })
        .click();
    await saved(page, () =>
        page
            .getByRole("dialog")
            .getByRole("button", { name: "Ghim ghi chú", exact: true })
            .click(),
    );
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Đóng trình soạn thảo", exact: true })
        .click();
    const response = page.waitForResponse(
        (r) =>
            r.url().endsWith("/preferences") && r.request().method() === "PUT",
    );
    await page.getByRole("button", { name: "Danh sách", exact: true }).click();
    expect((await response).status()).toBe(200);
    await page.reload();
    await expect(page.locator(".review-note-grid.is-list")).toHaveCount(2);
    const filterPanel = page.locator(".notes-filter-panel");
    if (!(await filterPanel.isVisible()))
        await page
            .getByRole("button", { name: "Hiện bộ lọc ghi chú", exact: true })
            .first()
            .click();
    await filterPanel.getByText("Research", { exact: true }).click();
    await expect(filterPanel.locator('input[type="checkbox"]')).toBeChecked();
    await expect(
        page.getByRole("heading", { name: "Tagged thought", exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole("heading", { name: "Another thought", exact: true }),
    ).not.toBeVisible();
    expect((await note(page, tagged.id)).pinned).toBe(true);
});

test("calendar date capture saves selected date and week navigation changes period", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Lịch");
    await page
        .locator(
            ".review-calendar-day.is-today + .review-calendar-day .review-date-number",
        )
        .click();
    await page
        .getByRole("button", { name: "Chọn công việc", exact: true })
        .click();
    await page.locator("[data-task-picker]").getByRole("button", { name: "Công việc mới", exact: true }).click();
    const editor = page.getByRole("dialog");
    await editor
        .getByLabel("Tên công việc", { exact: true })
        .fill("Calendar next step");
    await editor
        .getByRole("button", { name: "Ngày và lịch", exact: true })
        .click();
    const chosen = await editor
        .getByLabel("Hạn hoàn thành", { exact: true })
        .inputValue();
    expect(chosen).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await saved(page, () =>
        editor
            .getByRole("button", { name: "Tạo công việc", exact: true })
            .click(),
    );
    expect(
        (await (await page.request.get("/api/v1/tasks")).json()).items[0]
            .due_date,
    ).toBe(chosen);
    await page.getByRole("button", { name: "Tuần", exact: true }).click();
    const before = await page
        .locator(".review-date-number")
        .first()
        .getAttribute("aria-label");
    await page.getByRole("button", { name: "Kỳ tiếp", exact: true }).click();
    await expect(
        page.locator(".review-date-number").first(),
    ).not.toHaveAttribute("aria-label", before!);
});

test("Note checkboxes keep searchable text and undo restores their state", async ({
    page,
}) => {
    await signInFixture(page);
    const row = await create(page, "notes", {
        title: "Checklist thought",
        content: "- [ ] Read a chapter\nA plain line",
    });
    await page.reload();
    await page
        .getByRole("heading", { name: "Checklist thought", exact: true })
        .click();
    const check = page.getByRole("dialog").locator('input[type="checkbox"]');
    await check.check();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Lưu", exact: true })).toBeDisabled();
    await expect
        .poll(async () => (await note(page, row.id)).content)
        .toBe("- [x] Read a chapter\nA plain line");
    await noteContent(page).press("Control+z");
    await expect(check).not.toBeChecked();
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect
        .poll(async () => (await note(page, row.id)).content)
        .toBe("- [ ] Read a chapter\nA plain line");
});

test("a local Note draft survives reload and recovery keeps the last server version", async ({
    page,
}) => {
    await signInFixture(page);
    const row = await create(page, "notes", {
        title: "Recoverable thought",
        content: "Saved on the server",
    });
    await page.reload();
    await page
        .getByRole("heading", { name: "Recoverable thought", exact: true })
        .click();
    await page.route("**/api/v1/workspace/changes", (route) =>
        route.abort("internetdisconnected"),
    );
    await noteContent(page).fill("A newer local thought");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page.unroute("**/api/v1/workspace/changes");
    await page
        .getByRole("button", { name: "Khôi phục thành bản sao", exact: true })
        .click();
    await expect
        .poll(async () =>
            (await (await page.request.get("/api/v1/notes")).json()).items.some(
                (n: { content: string }) =>
                    n.content === "A newer local thought",
            ),
        )
        .toBeTruthy();
    expect((await note(page, row.id)).content).toBe("Saved on the server");
});
