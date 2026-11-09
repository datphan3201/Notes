import { expect, test } from "@playwright/test";

const pages = [
    ["dashboard", ["New task"]],
    ["goals", ["Manage areas", "New goal"]],
    ["tasks", ["Task history", "New task"]],
    ["calendar", ["New task"]],
    ["habits", ["New Habit"]],
    ["notes", ["Ask AI", "New note"]],
] as const;

test("six pages expose their actions through the floating panel", async ({ page }) => {
    for (const [section, actions] of pages) {
        await page.goto(`/preview/workspace?section=${section}&lang=en`);
        const trigger = page.getByRole("button", { name: "Page actions", exact: true });
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(page.locator("header").getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
        await trigger.click();
        const panel = page.getByRole("group", { name: "Page actions", exact: true });
        await expect(panel).toBeVisible();
        for (const action of actions) await expect(panel.getByRole("button", { name: action, exact: true })).toBeVisible();
        const launcherBox = await page.locator(".assistant-launcher:visible, .review-assistant-launcher:visible").boundingBox();
        const triggerBox = await page.locator(".floating-actions-trigger:visible").boundingBox();
        expect(triggerBox!.x + triggerBox!.width).toBeLessThanOrEqual(launcherBox!.x);
        expect(triggerBox!.x).toBeCloseTo(page.viewportSize()!.width > 800 ? 212 : 16, 0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        await page.keyboard.press("Escape");
        await expect(panel).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.getByRole("heading", { level: 1 }).first().click();
        await expect(panel).toHaveCount(0);
    }
});

test("floating actions open editors and support embedded preference controls", async ({ page }) => {
    await page.goto("/preview/workspace?section=goals&lang=en");
    await page.getByRole("button", { name: "Page actions", exact: true }).click();
    await page.getByRole("button", { name: "New goal", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.locator(".floating-actions-panel:popover-open")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.goto("/preview/workspace?section=notes&lang=en");
    await page.getByRole("button", { name: "Page actions", exact: true }).click();
    await page.getByText("Preferences", { exact: true }).click();
    await page.getByLabel("Note text size").selectOption("18px");
    await expect(page.getByLabel("Note text size")).toHaveValue("18px");
    await expect(page.getByRole("group", { name: "Page actions", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close actions", exact: true }).click();
    await expect(page.locator(".floating-actions-panel:popover-open")).toHaveCount(0);
});
