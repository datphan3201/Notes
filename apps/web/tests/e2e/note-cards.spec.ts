import { expect, test } from "@playwright/test";
import { signInFixture, createEntity } from "./helpers";

test("Note cards stay opaque and readable in both themes and preserve complete checkbox rows", async ({ page }) => {
    await signInFixture(page);
    const colors = ["neutral", "lemon", "mint", "sky", "rose", "#ffffff", "#e7f3ef", "#fff2dc", "#eeeafa", "#e9f2fc", "#fbe9ed", "#000000", "#ff0000", "#0000ff"];
    for (const color of colors) {
        await createEntity(page, "notes", {
            title: "Color " + color, color,
            content: Array.from({ length: 5 }, (_, i) => `- [ ] ${i + 1}. A long checklist item that wraps across several lines on a phone and still keeps its checkbox visible.`).join("\n"),
        });
    }
    await page.reload();
    await expect(page.locator(".review-note-card")).toHaveCount(colors.length);
    for (const theme of ["light", "dark"]) {
        const results = await page.evaluate(theme => {
            document.documentElement.dataset.theme = theme;
            document.body.style.backgroundImage = "linear-gradient(45deg, #06152c, #ffffff)";
            const canvas = document.createElement("canvas"), context = canvas.getContext("2d")!;
            canvas.width = canvas.height = 1;
            const rgba = (color: string) => {
                context.clearRect(0, 0, 1, 1);
                context.fillStyle = color;
                context.fillRect(0, 0, 1, 1);
                return Array.from(context.getImageData(0, 0, 1, 1).data);
            };
            const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => {
                const c = value / 255;
                return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
            }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
            return Array.from(document.querySelectorAll<HTMLElement>(".review-note-card")).map(card => {
                const background = rgba(getComputedStyle(card).backgroundColor);
                const text = card.querySelector<HTMLElement>(".note-preview-text")!;
                const a = luminance(background), b = luminance(rgba(getComputedStyle(text).color));
                const preview = card.querySelector<HTMLElement>("[data-preview-kind]")!;
                const rows = Array.from(preview.querySelectorAll<HTMLElement>(".note-preview-line"));
                const bounds = preview.getBoundingClientRect();
                return {
                    alpha: background[3], contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05),
                    rowCount: rows.length, more: !!preview.querySelector(".note-preview-more"),
                    rowsInside: rows.every(row => row.getBoundingClientRect().bottom <= bounds.bottom + 1),
                    boxesInside: rows.every(row => row.querySelector(".note-preview-box")!.getBoundingClientRect().bottom <= row.getBoundingClientRect().bottom + 1),
                    heightLimit: getComputedStyle(preview).maxHeight,
                };
            });
        }, theme);
        for (const row of results) {
            expect(row.alpha).toBe(255);
            expect(row.contrast).toBeGreaterThanOrEqual(4.5);
            expect(row.rowCount).toBe(3);
            expect(row.more && row.rowsInside && row.boxesInside).toBeTruthy();
            expect(row.heightLimit).toBe("none");
        }
    }
});
