# Audit history

[Documentation home](README.md) · [Issue report](issues.md)

One concise entry per completed change; owning UI traces hold the detailed contract and source links.

| Date | Change | Verification |
| --- | --- | --- |
| 2026-11-02 | [ISSUE-008](issues.md#issue-008--today-task-capture-and-membership-are-not-clear-in-the-ui): adjacent Today/Week checklists, independent Week sort/status controls, atomic daily/week selection and capture, explicit schedule labels, Overdue/History reminder and Reopen policy. Existing UI styles and four-row previews retained; no automatic carry-forward. [UI trace](ui/dashboard/README.md). | PHP 138 tests / 1190 assertions; Node 80 tests; build/format/lint passed. QA browser flows on desktop/mobile; forward migration 0025 applied without changing existing Tasks. |
| 2026-11-02 | Replaced persistent Add for today row labels with compact + icons and native hover tooltips; kept accessible names and selected-state checks, and returned the Week action inline on mobile. [UI trace](ui/dashboard/README.md). | JavaScript syntax, 5 focused Node cases, targeted formatting, frontend build and documentation checks passed. |
| 2026-11-02 | [ISSUE-009](issues.md#issue-009--dashboard-roadmap-has-no-explicit-account-level-selection): roadmap below header with saved account selection/empty invitation; merged Today/Week progress + checklists; replaced Current focus with 30-day Activity while retaining the year view and Habit streak. [Dashboard trace](ui/dashboard/README.md). | PHP 141 tests / 1222 assertions; Node 83 tests; build/format/lint; desktop/mobile and stale-refresh browser checks. Forward migration 0026 applied. |
