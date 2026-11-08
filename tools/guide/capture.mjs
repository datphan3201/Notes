// Captures the user-guide screenshots from a running Planner signed in as the demo accounts
// created by tools/guide/seed-demo.php.
//
//   PLAYWRIGHT=/path/to/node_modules/playwright [CHROMIUM=/path/to/chrome] \
//   node tools/guide/capture.mjs <base-url> <passwords-file> <out-dir> [vi|en] [shot-name...]
//
// Each shot is saved as <out-dir>/<lang>/<name>.png at 1280×800 (phone shots at 390×844).
// Convert and publish them with tools/guide/publish.php.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const [base, passwordFile, outDir, onlyLanguage, ...onlyShots] = process.argv.slice(2);
if (!base || !passwordFile || !outDir) {
    console.error(
        'Usage: node tools/guide/capture.mjs <base-url> <passwords-file> <out-dir> [vi|en] [shot...]',
    );
    process.exit(1);
}
const passwords = Object.fromEntries(
    readFileSync(passwordFile, 'utf8')
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length === 2 && parts[0].includes('@')),
);
const ACCOUNTS = { vi: 'guide.vi@example.test', en: 'guide.en@example.test' };

const settle = async (page) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
};
const go = async (page, path) => {
    await page.goto(base + path);
    await settle(page);
};

/** Names in the demo data, per language (see tools/guide/demo-content.php). */
const DEMO = {
    vi: {
        task: 'Làm 2 đề Listening Cambridge 15',
        milestone: 'Luyện Listening và Reading',
        plan: 'Kế hoạch ôn IELTS tuần này',
        shared: 'Ghi chú dự án được chia sẻ',
        locked: 'Thông tin tài khoản ngân hàng',
        ask: 'Tôi đã ghi những từ vựng nào về môi trường?',
        assistant:
            'Xếp công việc "Học từ vựng chủ đề Môi trường" vào 19:00–20:30 thứ Bảy tuần này và dời "Chuẩn bị slide thuyết trình" lùi 2 ngày.',
    },
    en: {
        task: 'Do two listening papers',
        milestone: 'Listening and reading practice',
        plan: 'Spanish plan for this week',
        shared: 'Shared project notes',
        locked: 'Bank account details',
        ask: 'Which environment words did I write down?',
        assistant:
            'Put "Learn environment vocabulary" at 19:00–20:30 this Saturday and push "Prepare presentation slides" back by 2 days.',
    },
};
const tab = (name) => async (page) => {
    await page.locator(`[data-workspace-tab="${name}"]`).first().click();
    await settle(page);
};
const press = (selector) => async (page) => {
    await page.locator(selector).first().click();
    await settle(page);
};
const text =
    (key) =>
    async (page, { demo }) => {
        await page.getByText(demo[key], { exact: true }).first().click();
        await settle(page);
    };
const noteCard =
    (key) =>
    async (page, { demo }) => {
        await page
            .locator('.note-card', { hasText: demo[key] })
            .locator('.note-card-open')
            .first()
            .click();
        await settle(page);
    };
const scrollTo = (selector) => async (page) => {
    await page
        .locator(selector)
        .first()
        .evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -16));
    await settle(page);
};
const waitFor =
    (selector, timeout = 90000) =>
    async (page) => {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout });
        await settle(page);
    };

/** Each shot: a page, optional steps, then an optional element to crop to. */
export const SHOTS = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'dashboard-week', path: '/dashboard', steps: [tab('week')] },
    {
        name: 'dashboard-activity',
        path: '/dashboard',
        steps: [tab('activity')],
    },
    { name: 'goals', path: '/goals' },
    { name: 'roadmap', path: '/goals/:goal1' },
    {
        name: 'goal-information',
        path: '/goals/:goal1',
        steps: [press('[data-open-dialog="goal-information-dialog"]')],
    },
    { name: 'milestone', path: '/goals/:goal1', steps: [text('milestone')] },
    { name: 'tasks', path: '/tasks' },
    {
        name: 'task-editor',
        path: '/tasks',
        steps: [text('task'), waitFor('dialog.quick-editor input')],
    },
    {
        name: 'new-task',
        path: '/tasks',
        steps: [press('[data-open-dialog="new-task-dialog"]')],
    },
    { name: 'task-detail', path: '/tasks/:task' },
    { name: 'repeating', path: '/tasks?view=repeating' },
    { name: 'calendar', path: '/calendar' },
    { name: 'calendar-week', path: '/calendar?view=week' },
    { name: 'habits', path: '/habits' },
    { name: 'notes', path: '/' },
    { name: 'note-editor', path: '/', steps: [noteCard('plan')] },
    {
        name: 'note-share',
        path: '/',
        steps: [noteCard('shared'), press('[data-editor-share]')],
    },
    { name: 'note-locked', path: '/', steps: [noteCard('locked')] },
    { name: 'notes-shared', path: '/', steps: [press('[data-filter-shared]')] },
    {
        name: 'ask-ai',
        path: '/',
        steps: [
            press('[data-open-ask-ai]'),
            async (page, { demo }) => {
                await page
                    .locator('[data-ask-form] textarea, [data-ask-form] input')
                    .first()
                    .fill(demo.ask);
                await page.locator('[data-ask-submit]').first().click();
            },
            waitFor('[data-ask-result] a, [data-ask-result] button'),
        ],
    },
    { name: 'reviews', path: '/reviews', steps: [press('[data-review-id]')] },
    {
        name: 'bell',
        path: '/dashboard',
        steps: [press('[data-notifications-toggle]')],
    },
    {
        name: 'assistant',
        path: '/dashboard',
        steps: [
            press('[data-assistant-open]'),
            async (page, { demo }) => {
                const box = page
                    .locator('[data-assistant-form] textarea, [data-assistant-form] input')
                    .first();
                await box.fill(demo.assistant);
                await box.press('Enter');
            },
            waitFor('.assistant-proposal', 120000),
        ],
    },
    { name: 'appearance', path: '/settings/preferences' },
    { name: 'security', path: '/settings/password' },
    { name: 'history', path: '/settings/history' },
    { name: 'archive', path: '/settings/archive' },
    { name: 'phone-dashboard', path: '/dashboard', phone: true },
    {
        name: 'phone-menu',
        path: '/tasks',
        phone: true,
        steps: [press('[data-open-sidebar]')],
    },
];

let failed = 0;
for (const language of onlyLanguage ? [onlyLanguage] : ['vi', 'en']) {
    // --lang makes native date inputs use the language's format.
    // CHROMIUM may point at an already-downloaded browser when it differs from the package's.
    const browser = await chromium.launch({
        args: [`--lang=${language === 'vi' ? 'vi-VN' : 'en-GB'}`],
        ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}),
    });
    const email = ACCOUNTS[language];
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: language === 'vi' ? 'vi-VN' : 'en-GB',
        timezoneId: 'Asia/Ho_Chi_Minh',
    });
    const page = await context.newPage();
    await go(page, '/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', passwords[email]);
    await Promise.all([page.waitForURL(/dashboard/), page.click('button[type="submit"]')]);
    await settle(page);
    const ids = await page
        .evaluate(async () => {
            const goals = (await (await fetch('/api/v1/goals')).json()).data;
            const tasks = (await (await fetch('/api/v1/tasks')).json()).data;
            return { goals, tasks };
        })
        .then(({ goals, tasks }) => ({
            goal1: goals.find((goal) => goal.importance === 5)?.id,
            task: tasks.find((task) => task.name === DEMO[language].task)?.id,
        }));
    mkdirSync(join(outDir, language), { recursive: true });
    for (const shot of SHOTS) {
        if (onlyShots.length && !onlyShots.includes(shot.name)) continue;
        try {
            await page.setViewportSize(
                shot.phone ? { width: 390, height: 844 } : { width: 1280, height: 800 },
            );
            // The assistant remembers an open chat per tab; start every shot without it.
            await page.evaluate(() => sessionStorage.clear()).catch(() => {});
            await go(
                page,
                shot.path.replace(/:(\w+)/g, (_, key) => ids[key]),
            );
            for (const step of shot.steps || []) await step(page, { demo: DEMO[language], ids });
            const file = join(outDir, language, `${shot.name}.png`);
            if (shot.crop) await page.locator(shot.crop).first().screenshot({ path: file });
            else
                await page.screenshot({
                    path: file,
                    fullPage: Boolean(shot.full),
                });
            console.log(`${language}/${shot.name}`);
        } catch (error) {
            failed++;
            await page
                .screenshot({ path: join(outDir, language, `${shot.name}.failed.png`) })
                .catch(() => {});
            console.error(`FAILED ${language}/${shot.name}: ${error.message.split('\n')[0]}`);
        }
    }
    await context.close();
    await browser.close();
}
process.exit(failed ? 1 : 0);
