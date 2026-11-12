import { expect, test } from "@playwright/test";
import { signInFixture } from "./helpers";

for (const locale of ["en", "vi"] as const) {
    test(`loading spinner and startup errors use only ${locale}`, async ({ page }) => {
        await signInFixture(page);
        await page.evaluate(value => sessionStorage.setItem("planner-workspace-locale", value), locale);
        let release!: () => void;
        const held = new Promise<void>(resolve => { release = resolve; });
        await page.route(/\/api\/v1\/workspace\/(?:snapshot|bootstrap)(?:\?.*)?$/, async route => {
            await held;
            await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Failed to fetch" }) });
        });
        try {
            await page.goto("/dashboard");
            const spinner = page.getByRole("status", { name: locale === "vi" ? "Đang tải…" : "Loading…" });
            await expect(spinner).toBeVisible();
            await expect(spinner.locator("svg")).toHaveClass(/loading-spinner/);
            await expect(spinner).toHaveText("");
            await expect(page.getByText("Đang tải… / Loading…", { exact: true })).toHaveCount(0);
            release();
            await expect(page.locator("main").getByRole("alert")).toHaveText(locale === "vi" ? "Không kết nối được tới máy chủ. Vui lòng thử lại." : "Failed to fetch");
            await expect(page.getByRole("button", { name: locale === "vi" ? "Thử lại" : "Retry", exact: true })).toBeVisible();
            await expect(spinner).toHaveCount(0);
        } finally {
            release();
        }
    });
}
