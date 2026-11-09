import { expect, test, type Page } from "@playwright/test";
import {
    fixtureAction,
    seedFixture,
    signInFixture,
    navigate,
    createEntity as create,
    workspaceSaved as saved,
} from "./helpers";
import { fileURLToPath } from "node:url";
const photo = fileURLToPath(
    new URL("../fixtures/account.png", import.meta.url),
);
const content = (page: Page) =>
    page
        .getByRole("dialog")
        .getByRole("textbox", { name: "Nội dung ghi chú", exact: true });
const identity = (page: Page) =>
    page.request.get("/api/v1/auth/me").then((r) => r.json());
const collection = (page: Page, kind: string) =>
    page.request
        .get("/api/v1/" + kind)
        .then((r) => r.json())
        .then((r) => r.items);
const mailCode = (email: string, purpose: string) =>
    fixtureAction({ action: "mail", email, purpose }).body.match(
        /(?:Code: |code: )(\d{6})/,
    )[1] as string;
async function login(page: Page, account: { email: string; password: string }) {
    await page.goto("/login?lang=vi");
    await page.getByLabel("Email", { exact: true }).fill(account.email);
    await page.getByLabel("Mật khẩu", { exact: true }).fill(account.password);
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(page).toHaveURL("/dashboard");
}

test("Habit check-ins feed saved Review facts and finalized reflections persist", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Thói quen");
    await page.getByRole("button", { name: "Thao tác trang", exact: true }).click();
    await page
        .getByRole("button", { name: "Thói quen mới", exact: true })
        .first()
        .click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Tên", { exact: true }).fill("Daily practice");
    await saved(page, () =>
        dialog
            .getByRole("button", { name: "Lưu thay đổi", exact: true })
            .click(),
    );
    await saved(page, () =>
        page
            .getByRole("button", {
                name: /^Daily practice\..*Điểm danh$/,
            })
            .and(page.locator(".is-today"))
            .click(),
    );
    await page.reload();
    await expect(
        page.getByRole("button", {
            name: /^Daily practice\..*Bỏ điểm danh$/,
        }).and(page.locator(".is-today")),
    ).toHaveAttribute("aria-pressed", "true");
    await navigate(page, "Đánh giá");
    await page
        .getByRole("button", { name: "Đánh giá mới", exact: true })
        .first()
        .click();
    dialog = page.getByRole("dialog");
    await dialog
        .getByRole("combobox", { name: "Kỳ", exact: true })
        .selectOption("daily");
    await dialog
        .getByLabel("Tiêu đề", { exact: true })
        .fill("Daily reflection");
    await dialog
        .getByLabel("Suy ngẫm", { exact: true })
        .fill("A useful practice.");
    await saved(page, () =>
        dialog
            .getByRole("button", { name: "Lưu ảnh chụp", exact: true })
            .click(),
    );
    await page
        .getByRole("textbox", { name: "Điều đã làm tốt", exact: true })
        .fill("I showed up.");
    await saved(page, () =>
        page.getByRole("button", { name: "Hoàn tất", exact: true }).click(),
    );
    const review = (await collection(page, "reviews"))[0];
    expect(review.finalized).toBe(true);
    expect(review.went_well).toBe("I showed up.");
    expect(review.snapshot.habits).toBe(1);
    await page.reload();
    await page.getByText("Daily reflection", { exact: true }).click();
    await expect(
        page.getByRole("textbox", { name: "Điều đã làm tốt", exact: true }),
    ).toHaveValue("I showed up.");
    await expect(
        page.getByRole("textbox", { name: "Điều đã làm tốt", exact: true }),
    ).toHaveAttribute("readonly", "");
});

test("repeating templates survive reload and pause, resume and end use the real lifecycle", async ({
    page,
}) => {
    const account = await signInFixture(page);
    await navigate(page, "Công việc");
    await page.getByRole("button", { name: "Thao tác trang", exact: true }).click();
    await page
        .getByRole("button", { name: "Công việc mới", exact: true })
        .first()
        .click();
    const editor = page.getByRole("dialog");
    await editor
        .getByLabel("Tên công việc", { exact: true })
        .fill("Practice daily");
    await editor.getByRole("button", { name: "Lặp lại", exact: true }).click();
    await editor
        .getByRole("combobox")
        .filter({ has: page.locator('option[value="daily"]') })
        .selectOption("daily");
    await saved(page, () =>
        editor.getByRole("button", { name: /Tạo/ }).click(),
    );
    fixtureAction({ action: "materialize", email: account.email });
    await page.reload();
    await page.getByRole("button", { name: /^Chuỗi lặp/ }).click();
    await expect(
        page.getByRole("heading", { name: "Practice daily", exact: true }),
    ).toBeVisible();
    await saved(page, () =>
        page.getByRole("button", { name: "Tạm dừng", exact: true }).click(),
    );
    expect((await collection(page, "task-series"))[0].state).toBe("paused");
    await saved(page, () =>
        page.getByRole("button", { name: "Tiếp tục", exact: true }).click(),
    );
    await page
        .getByRole("button", { name: "Kết thúc chuỗi", exact: true })
        .click();
    await saved(page, () =>
        page
            .getByRole("dialog")
            .getByRole("button", { name: "Kết thúc chuỗi", exact: true })
            .click(),
    );
    expect((await collection(page, "task-series"))[0].state).toBe("ended");
    expect((await collection(page, "tasks")).length).toBeGreaterThan(0);
});

test("profile image and email MFA enrollment use private storage and actual verification codes", async ({
    page,
}) => {
    const account = await signInFixture(page);
    await page.goto("/settings/profile");
    await page
        .getByLabel("Tên hiển thị", { exact: true })
        .fill("Updated profile");
    await page
        .getByLabel("Giới thiệu", { exact: true })
        .fill("A real biography");
    await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await expect
        .poll(async () => (await identity(page)).user.name)
        .toBe("Updated profile");
    await page.getByLabel("Chọn ảnh").setInputFiles(photo);
    await expect
        .poll(async () => (await identity(page)).user.profile.avatar_id)
        .toBeTruthy();
    await page.reload();
    await expect(page.locator("img.review-avatar")).toHaveAttribute(
        "src",
        /^\/api\/v1\/account-files\//,
    );
    await page.goto("/settings/password");
    await page
        .getByRole("button", { name: "Thiết lập email", exact: true })
        .click();
    let dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Mật khẩu hiện tại", { exact: true })
        .fill(account.password);
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Mã xác minh", { exact: true })
        .fill(mailCode(account.email, "email-mfa"));
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await identity(page)).user.mfa_method).toBe("email");
    await page
        .getByRole("button", { name: "Tắt xác thực hai bước", exact: true })
        .click();
    dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Mật khẩu hiện tại", { exact: true })
        .fill(account.password);
    await dialog.getByRole("button", { name: "Tiếp tục", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog
        .getByLabel("Mã xác minh", { exact: true })
        .fill(mailCode(account.email, "email-mfa"));
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect((await identity(page)).user.two_factor_enabled).toBe(false);
});

test("Note invitations, private attachments and passwords stay authorized across two accounts", async ({
    page,
    browser,
}) => {
    await signInFixture(page);
    const recipient = seedFixture();
    const row = await create(page, "notes", {
        title: "A shared thought",
        content: "Private collaboration",
    });
    await page.reload();
    await page
        .getByRole("heading", { name: "A shared thought", exact: true })
        .click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Chia sẻ", exact: true })
        .click();
    let dialog = page.getByRole("dialog", { name: "Chia sẻ ghi chú" });
    await dialog.getByRole("textbox").fill(recipient.email);
    const invitation = page.waitForResponse(
        (r) =>
            r.url().endsWith("/invitations") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Chia sẻ", exact: true }).click();
    expect((await invitation).status()).toBe(201);
    await dialog
        .getByRole("button", { name: "Đóng", exact: true })
        .last()
        .click();
    const second = await browser.newContext({ viewport: page.viewportSize()! });
    const other = await second.newPage();
    try {
        await login(other, recipient);
        await navigate(other, "Ghi chú");
        await other
            .getByRole("button", { name: "Chấp nhận", exact: true })
            .click();
        await expect(
            other.getByRole("heading", {
                name: "A shared thought",
                exact: true,
            }),
        ).toBeVisible();
        await page
            .getByRole("dialog")
            .getByText("Tệp đính kèm", { exact: true })
            .click();
        await page
            .getByRole("dialog")
            .locator('input[type="file"]')
            .setInputFiles(photo);
        await expect
            .poll(
                async () =>
                    (
                        await (
                            await page.request.get(
                                `/api/v1/notes/${row.id}/attachments`,
                            )
                        ).json()
                    ).length,
            )
            .toBe(1);
        await page
            .getByRole("dialog")
            .getByRole("button", { name: "Mật khẩu ghi chú", exact: true })
            .click();
        dialog = page.getByRole("dialog", { name: "Đặt mật khẩu ghi chú" });
        await dialog.locator('input[name="password"]').fill("note-password");
        await dialog.locator('input[name="confirm"]').fill("note-password");
        await dialog
            .getByRole("button", { name: "Lưu thay đổi", exact: true })
            .click();
        await expect(dialog).not.toBeVisible();
        await other.reload();
        await expect(
            other.getByRole("heading", {
                name: "A shared thought",
                exact: true,
            }),
        ).not.toBeVisible();
        expect(
            (await other.request.get(`/api/v1/notes/${row.id}`)).status(),
        ).toBe(423);
    } finally {
        await second.close();
    }
});

test("offline Note edits survive reload and create a recovered copy instead of overwriting a concurrent save", async ({
    page,
    context,
}) => {
    await signInFixture(page);
    const row = await create(page, "notes", {
        title: "Offline thought",
        content: "Original",
    });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page
        .getByRole("heading", { name: "Offline thought", exact: true })
        .click();
    const account = await identity(page);
    await context.setOffline(true);
    await content(page).fill("An offline draft");
    await page.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(
        page.getByRole("dialog").locator(".save-status"),
    ).toContainText("Chờ đồng bộ");
    await expect
        .poll(() =>
            page.evaluate(async () => {
                const request = indexedDB.open("planner-private-notes-v1", 1);
                const db = await new Promise<IDBDatabase>((resolve, reject) => {
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
                return await new Promise<boolean>((resolve) => {
                    const q = db
                        .transaction("accounts")
                        .objectStore("accounts")
                        .get(localStorage.getItem("planner-offline-account")!);
                    q.onsuccess = () => {
                        resolve(
                            q.result.changes.some(
                                (c: { fields: { content?: string } }) =>
                                    c.fields.content === "An offline draft",
                            ),
                        );
                        db.close();
                    };
                });
            }),
        )
        .toBeTruthy();
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await page
        .getByRole("heading", { name: "Offline thought", exact: true })
        .click();
    await expect(content(page)).toHaveText("An offline draft");
    const remote = await page.request.patch(`/api/v1/notes/${row.id}`, {
        headers: {
            origin: "http://localhost:3100",
            "x-csrf-token": account.csrf,
        },
        data: {
            version: row.version,
            fields: { content: "Changed on another device" },
        },
    });
    expect(remote.status()).toBe(200);
    await context.setOffline(false);
    await expect
        .poll(async () =>
            (await collection(page, "notes")).some(
                (n: { content: string }) => n.content === "An offline draft",
            ),
        )
        .toBeTruthy();
    expect(
        (
            await page.request
                .get(`/api/v1/notes/${row.id}`)
                .then((r) => r.json())
        ).content,
    ).toBe("Changed on another device");
});

test("reports with private evidence are reviewed through the administrator UI", async ({
    page,
    browser,
}) => {
    await signInFixture(page);
    const target = seedFixture();
    await page.goto("/settings/reports");
    await page
        .getByLabel("Email cần báo cáo", { exact: true })
        .fill(target.email);
    await page
        .getByLabel("Mô tả vấn đề", { exact: true })
        .fill("A concrete concern for moderator review.");
    await page
        .getByLabel("Ảnh bằng chứng (tối đa 3)", { exact: true })
        .setInputFiles(photo);
    await expect(page.locator(".review-evidence img")).toHaveCount(1);
    const submitted = page.waitForResponse(
        (r) => r.url().endsWith("/reports") && r.request().method() === "POST",
    );
    await page
        .getByRole("button", { name: "Gửi báo cáo", exact: true })
        .click();
    expect((await submitted).status()).toBe(201);
    expect((await page.request.get("/api/v1/admin/state")).status()).toBe(404);
    const admin = seedFixture({ admin: true }),
        adminContext = await browser.newContext({
            viewport: page.viewportSize()!,
        }),
        adminPage = await adminContext.newPage();
    try {
        await login(adminPage, admin);
        await adminPage.goto("/admin");
        await adminPage
            .getByText(target.email, { exact: true })
            .first()
            .click();
        await adminPage
            .getByRole("checkbox", { name: "Cảnh báo tài khoản", exact: true })
            .check();
        await adminPage
            .getByRole("button", { name: "Xử lý báo cáo", exact: true })
            .click();
        await adminPage
            .getByRole("dialog")
            .getByRole("button", { name: "Xác nhận", exact: true })
            .click();
        await expect
            .poll(
                async () =>
                    (
                        await adminPage.request
                            .get("/api/v1/admin/state")
                            .then((r) => r.json())
                    ).reports[0].state,
            )
            .toBe("resolved");
    } finally {
        await adminContext.close();
    }
});

test("assistant failures remain explicit and the retained user guide opens", async ({
    page,
}) => {
    await signInFixture(page);
    await navigate(page, "Công việc");
    const launcher = page.locator(".review-assistant-launcher");
    await expect(launcher).toHaveCSS("position", "fixed");
    await expect(launcher).toBeInViewport();
    await expect(launcher).toHaveAccessibleName("Hỏi AI");
    await launcher.click();
    const assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    const collapse = assistant.getByRole("button", {
        name: "Thu gọn hoặc mở rộng",
        exact: true,
    });
    await collapse.click();
    await expect(
        assistant.getByRole("textbox", { name: "Tin nhắn", exact: true }),
    ).not.toBeVisible();
    await collapse.click();
    await assistant
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Help me plan a next step");
    await assistant.getByRole("button", { name: "Gửi", exact: true }).click();
    await expect(assistant.getByRole("alert")).toContainText("unavailable");
    await expect(assistant.locator(".review-proposal")).toHaveCount(0);
    await assistant
        .getByRole("button", { name: "Đóng trợ lý", exact: true })
        .click();
    await expect(launcher).toBeInViewport();
    await page.goto("/help");
    await expect(
        page.getByRole("heading", {
            name: "Hướng dẫn sử dụng",
            level: 1,
            exact: true,
        }),
    ).toBeVisible();
});

test("Archive restore and confirmed permanent deletion persist across reload", async ({
    page,
}) => {
    await signInFixture(page);
    const task = await create(page, "tasks", { title: "Archived practice" });
    const account = await identity(page);
    const archive = async (version: number) => {
        const result = await page.request.post(
            `/api/v1/tasks/${task.id}/archive`,
            {
                headers: {
                    origin: "http://localhost:3100",
                    "x-csrf-token": account.csrf,
                },
                data: { version, include_contents: false },
            },
        );
        expect(result.status()).toBe(200);
    };
    await archive(1);
    await page.goto("/settings/archive");
    await saved(page, () =>
        page.getByRole("button", { name: "Khôi phục", exact: true }).click(),
    );
    expect((await collection(page, "tasks"))[0].archived_at).toBeNull();
    const restored = (await collection(page, "tasks"))[0];
    await archive(restored.version);
    await page.reload();
    await page
        .getByRole("button", {
            name: "Xóa vĩnh viễn: Archived practice",
            exact: true,
        })
        .click();
    const dialog = page.getByRole("dialog");
    await expect(
        dialog.getByRole("button", { name: "Xác nhận", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await saved(page, () =>
        dialog.getByRole("button", { name: "Xác nhận", exact: true }).click(),
    );
    await expect(dialog).not.toBeVisible();
    expect((await page.request.get(`/api/v1/tasks/${task.id}`)).status()).toBe(
        404,
    );
    await page.reload();
    await expect(page.locator(".review-archive-row")).toHaveCount(0);
});

test("profile email change confirms a real code and revokes the old session", async ({
    page,
}) => {
    const account = await signInFixture(page);
    await page.goto("/settings/profile");
    const changed = account.email.replace("fixture-", "changed-");
    await page.getByLabel("Email mới", { exact: true }).fill(changed);
    await page
        .getByLabel("Mật khẩu hiện tại", { exact: true })
        .fill(account.password);
    await page.getByRole("button", { name: "Đổi email", exact: true }).click();
    const dialog = page.getByRole("dialog", {
        name: "Xác nhận email mới",
        exact: true,
    });
    await dialog
        .getByLabel("Mã xác minh", { exact: true })
        .fill(mailCode(account.email, "email-change"));
    await dialog
        .getByRole("button", { name: "Lưu thay đổi", exact: true })
        .click();
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/v1/auth/me")).status()).toBe(401);
    await login(page, { email: changed, password: account.password });
    expect((await identity(page)).user.email).toBe(changed);
});

test("offline Note deletions survive refresh and sync only an unchanged owned version", async ({
    page,
    context,
}) => {
    await signInFixture(page);
    const note = await create(page, "notes", {
        title: "Delete offline safely",
        content: "A saved Note",
    });
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.getByLabel("Thao tác ghi chú", { exact: true }).click();
    await page
        .getByRole("button", { name: "Xóa ghi chú", exact: true })
        .click();
    const dialog = page.getByRole("dialog", {
        name: "Xóa ghi chú này?",
        exact: true,
    });
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.reload();
    await expect(
        page.getByRole("heading", {
            name: "Delete offline safely",
            exact: true,
        }),
    ).not.toBeVisible();
    await context.setOffline(false);
    await expect
        .poll(async () =>
            (await page.request.get(`/api/v1/notes/${note.id}`)).status(),
        )
        .toBe(404);
    await page.reload();
    await expect(
        page.getByRole("heading", {
            name: "Delete offline safely",
            exact: true,
        }),
    ).not.toBeVisible();
    const manifest = await page.request.get("/manifest.webmanifest");
    expect(manifest.status()).toBe(200);
    expect((await manifest.json()).display).toBe("standalone");
});

test("assistant stop is a normal pause and completed output survives reload with SSE interrupted", async ({
    page,
}) => {
    const account = await signInFixture(page);
    let runId = "";
    await page.route("**/api/v1/assistant/runs", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const run = fixtureAction({
            action: "assistant",
            email: account.email,
            prompt: route.request().postDataJSON().prompt,
        });
        runId = run.id;
        await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify(run),
        });
    });
    await page.route("**/api/v1/assistant/runs/*/events", (route) =>
        route.abort(),
    );
    await page.locator(".review-assistant-launcher").click();
    let assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    await assistant
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Plan a learning roadmap");
    await expect(
        assistant.getByRole("button", { name: "Gửi", exact: true }),
    ).toBeEnabled();
    await assistant.getByRole("button", { name: "Gửi", exact: true }).click();
    await assistant
        .getByRole("button", { name: "Dừng chờ", exact: true })
        .click();
    await expect(assistant.getByRole("status")).toContainText("Đã dừng chờ");
    await expect(assistant.getByRole("alert")).toHaveCount(0);
    await expect(
        assistant.getByRole("button", { name: "Kết nối lại", exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.locator(".review-assistant-launcher").click();
    assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    await expect(
        assistant.getByText("Plan a learning roadmap", { exact: true }),
    ).toBeVisible();
    await expect(
        assistant.getByRole("button", { name: "Dừng chờ", exact: true }),
    ).toBeVisible();
    fixtureAction({
        action: "assistant-complete",
        email: account.email,
        id: runId,
        answer: "A saved learning roadmap",
    });
    await expect(
        assistant.getByText("A saved learning roadmap", { exact: true }),
    ).toBeVisible();
    await expect(
        assistant.getByRole("button", { name: "Dừng chờ", exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await page.locator(".review-assistant-launcher").click();
    await expect(
        page.getByText("A saved learning roadmap", { exact: true }),
    ).toBeVisible();
    await assistant
        .getByRole("button", { name: "Xóa hội thoại", exact: true })
        .click();
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
    await expect(
        assistant.getByText("A saved learning roadmap", { exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await page.locator(".review-assistant-launcher").click();
    await expect(
        page.getByText("Plan a learning roadmap", { exact: true }),
    ).toHaveCount(0);
});

test("assistant roadmap tools show readable parents and apply one complete graph only after confirmation", async ({
    page,
}) => {
    const account = await signInFixture(page);
    const area = await create(page, "areas", { title: "Learning" });
    await page.reload();
    await page.route("**/api/v1/assistant/runs", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const run = fixtureAction({
            action: "assistant-roadmap",
            email: account.email,
            area_id: area.id,
            prompt: route.request().postDataJSON().prompt,
        });
        await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify(run),
        });
    });
    await page.locator(".review-assistant-launcher").click();
    const assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    await assistant
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Create a roadmap");
    await assistant.getByRole("button", { name: "Gửi", exact: true }).click();
    const card = assistant.locator(".review-proposal");
    await expect(card).toContainText("Learn backend");
    await expect(card).toContainText("Trace a request");
    await expect(card).not.toContainText("Mục không còn khả dụng");
    await expect(card).not.toContainText(/\bc[0-9]+\b/);
    expect(await collection(page, "goals")).toHaveLength(0);
    await card
        .getByRole("button", { name: "Duyệt và xác nhận", exact: true })
        .click();
    const applied = page.waitForResponse(
        (r) => r.url().endsWith("/apply") && r.request().method() === "POST",
    );
    await page
        .getByRole("dialog")
        .getByRole("button", { name: "Xác nhận", exact: true })
        .click();
    expect((await applied).status()).toBe(200);
    await expect(card).toContainText("Đã áp dụng");
    expect(await collection(page, "goals")).toHaveLength(1);
    expect(await collection(page, "milestones")).toHaveLength(2);
    expect(await collection(page, "tasks")).toHaveLength(2);
    await page.reload();
    await page.locator(".review-assistant-launcher").click();
    await expect(page.locator(".review-proposal")).toContainText("Đã áp dụng");
});

test("assistant completion requires the user's checklist acknowledgement and Reject survives reload", async ({
    page,
}) => {
    const account = await signInFixture(page);
    const task = await create(page, "tasks", {
        title: "Keep unchecked work",
        checklist: [{ text: "Still open", checked: false }],
    });
    await page.reload();
    await page.route("**/api/v1/assistant/runs", async (route) => {
        if (route.request().method() !== "POST") return route.continue();
        const run = fixtureAction({
            action: "assistant-complete-task",
            email: account.email,
            task_id: task.id,
            prompt: route.request().postDataJSON().prompt,
        });
        await route.fulfill({
            status: 202,
            contentType: "application/json",
            body: JSON.stringify(run),
        });
    });
    await page.locator(".review-assistant-launcher").click();
    let assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    await assistant
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Complete this task");
    await assistant.getByRole("button", { name: "Gửi", exact: true }).click();
    await assistant
        .getByRole("button", { name: "Duyệt và xác nhận", exact: true })
        .click();
    let dialog = page.getByRole("dialog");
    await expect(
        dialog.getByRole("button", { name: "Xác nhận", exact: true }),
    ).toBeDisabled();
    await dialog.getByRole("checkbox").check();
    await dialog.getByRole("button", { name: "Xác nhận", exact: true }).click();
    await expect(assistant.locator(".review-proposal")).toContainText(
        "Đã áp dụng",
    );
    const savedTask = (await collection(page, "tasks"))[0];
    expect(savedTask.status).toBe("done");
    expect(savedTask.checklist[0].checked).toBe(false);
    await assistant
        .getByRole("textbox", { name: "Tin nhắn", exact: true })
        .fill("Prepare a second change");
    await assistant.getByRole("button", { name: "Gửi", exact: true }).click();
    await assistant
        .getByRole("button", { name: "Từ chối", exact: true })
        .click();
    await expect(assistant).toContainText("Đã từ chối");
    await page.reload();
    await page.locator(".review-assistant-launcher").click();
    assistant = page.getByRole("complementary", {
        name: "Trợ lý Planner",
        exact: true,
    });
    await expect(assistant).toContainText("Đã từ chối");
    await expect(
        assistant.getByRole("button", { name: "Từ chối", exact: true }),
    ).toHaveCount(0);
});
