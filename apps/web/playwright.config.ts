import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

const database =
    process.env.PLANNER_TEST_DATABASE_URL ||
    "postgresql+psycopg://planner_test:isolated-test-only@127.0.0.1:5434/planner_test";
if (new URL(database).pathname !== "/planner_test")
    throw new Error("Browser tests require planner_test");

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: "http://localhost:3100",
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
            ? {
                  executablePath:
                      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              }
            : {},
    },
    projects: [
        {
            name: "desktop",
            use: {
                browserName: "chromium",
                viewport: { width: 1280, height: 800 },
            },
        },
        {
            name: "mobile",
            use: {
                browserName: "chromium",
                viewport: { width: 390, height: 844 },
                isMobile: true,
                hasTouch: true,
            },
        },
    ],
    webServer: [
        {
            command: "uv run python tests/browser_server.py",
            cwd: fileURLToPath(new URL("../api", import.meta.url)),
            url: "http://127.0.0.1:8101/ready",
            env: {
                PLANNER_ENVIRONMENT: "testing",
                PLANNER_DATABASE_URL: database,
                PLANNER_WEB_ORIGIN: "http://localhost:3100",
                PLANNER_AI_API_KEY: "",
                PLANNER_SMTP_HOST: "",
                PLANNER_RESEND_API_KEY: "",
                PLANNER_BREVO_API_KEY: "",
                PLANNER_SUPABASE_URL: "",
                PLANNER_SUPABASE_SERVICE_ROLE_KEY: "",
                PLANNER_SUPABASE_STORAGE_BUCKET: "",
                PLANNER_DATABASE_SCHEMA: "public",
                PLANNER_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
            },
            reuseExistingServer: false,
        },
        {
            command: "npm run start -- --port 3100",
            url: "http://localhost:3100/login",
            env: {
                PLANNER_DIST_DIR: ".next-e2e",
                API_ORIGIN: "http://127.0.0.1:8101",
            },
            reuseExistingServer: false,
        },
    ],
});
