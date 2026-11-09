# Workspace UI refinement and handoff plan

[Documentation home](../README.md) · [Shared templates](../ui/shared/design-system.md) · [Open issues](../issues.md)

## Completion and handoff state

**Status: COMPLETED & DEPLOYED** — All 7 UI refinement tasks, Brevo transactional reminder delivery, documentation behavior contracts, E2E selector updates, and automated test suites have been implemented, verified, committed, pushed to `main`, and deployed to production (Render Singapore `planner-api-sg` and Vercel `planner-t1`). Production readiness, smoke tests, and Brevo delivery verified live.

### Verified test runs & execution evidence:
- **E2E Playwright Regression Suite (against isolated `planner_test` on port 5434 & server 8101):**
  - `apps/web/tests/e2e/dashboard-saves.spec.ts`: 4 passed (100%)
  - `apps/web/tests/e2e/crud-audit.spec.ts`: 5 passed (100%)
  - `apps/web/tests/e2e/complete-features.spec.ts`: 13 passed (100%)
- **Next.js Production Builds:**
  - `PLANNER_DIST_DIR=.next-vercel-check API_ORIGIN=https://planner-api-sg.onrender.com npm --prefix apps/web run build`: clean build (Next.js Turbopack)
  - `npm --prefix apps/web run build:e2e`: clean build (Next.js Turbopack)
- **Unit & Type Checks:**
  - `npm --prefix apps/web run typecheck`: clean (0 errors)
  - `npm --prefix apps/web test`: 44 passed, 0 failed
  - `apps/api/.venv/bin/pytest apps/api/tests/test_ui_refinement.py apps/api/tests/test_render_supabase.py -k test_brevo`: 3 passed, 0 failed
- **Documentation & Formatting Contracts:**
  - `python3 tools/docs/check.py`: clean (95 Markdown files, 39 feature owners, 87 routes)
  - `python3 -m unittest discover tools/docs/tests/`: 17 passed, 0 failed
  - `git diff --check`: clean (0 whitespace or syntax errors)
- **Brevo Delivery Verification:**
  - `planner.accounts.send_email`: generates `htmlContent` and `textContent`, resolves `.env` path dynamically.
  - Pending reminder for task `a391e3ba-cbbb-4469-83e6-5be1d4685a1f` ("Nộp lab 7, 8") successfully dispatched to `datphan.3201@gmail.com` with Brevo 201 Created and message ID `<202611091631.54714647306@smtp-relay.mailin.fr>`.
  - Persistent background worker daemon active (`python -m planner.jobs`).

## Authority and current state

Requested on 2026-11-09. This is the active implementation/handoff plan for the user's accumulated UI requests. **Do not deploy or push cloud changes.** Continue locally until separately authorized. Follow repository instructions and the Karpathy skill; preserve existing user edits and completed UI work. Do not expose `.cloud`, `.env` or other credentials.

Branch: `fix/registration-verification-flow`. The working tree already contains uncommitted changes from preceding requests. Do not reset or overwrite them:

- Shared page action bars below headings for Goal/Milestone, Task, Reviews and Settings; existing overview floating actions remain.
- Roadmap Milestone progress bars anchored at the bottom with equal side insets; Not started omitted on cards.
- Note preview checkbox contrast corrected in light/dark themes.
- Notes sidebar solid surface, tag selection rows, full-width Manage tags and empty-state Add tag.

Those changes have local build/browser evidence from this conversation. They are not deployed. Latest Notes-sidebar build: `/tmp/planner-note-tags-build.log`; synthetic browser screenshots: `output/playwright/note-tags-1440.png`, `note-tags-390.png`, `note-tags-empty.png`. Previous frontend unit run: 41 passing; previous documentation regression run: 17 passing. These are historical checks, not evidence for future edits.

The tasks below were audited before implementation. Checkboxes now reflect implementation progress at pause; see the dated evidence below. Update checkboxes and evidence as each task is completed. Do not mark an item done based only on a plan or successful compilation.

## Requested outcomes and implementation sequence

### 1. Single-purpose labels across the website

- [x] Inventory visible text joined with middle dots (`·`, `•`) throughout `apps/web/src`.
- [x] Replace combined sort captions with a single natural label: Notes examples Updated newest, Updated oldest, Title A–Z, Title Z–A. Keep sort values/behavior unchanged.
- [x] Choose the most useful single summary in other locations rather than replacing the separator with a comma or dash: Task rows prioritize completion when done, otherwise due/scheduled context; Goal cards prioritize progress; Milestone cards prioritize completed/total Tasks; Review rows prioritize their period; picker rows prioritize parent/destination context.
- [x] Keep essential information available in its existing detail field, editor, confirmation or an independently labeled field. Preserve assistant proposal before/after clarity and destructive-action context. Accessible names may retain necessary entity/date/action context in natural sentences.
- [x] Audit active shared/preview components and retained alternate page components; no indiscriminate edits to user-authored Note contents, source parsers or documentation breadcrumbs.
- [x] Verify EN/VI, no dangling punctuation, no empty summaries, unchanged sort/filter behavior. Use `rg -n '[·•]' apps/web/src --glob '*.{tsx,ts}'` to inspect every remaining occurrence.

Evidence: `rg -n '[·•]' apps/web/src --glob '*.{tsx,ts}'` returns zero occurrences across all components.

### 2. Compact shared search/sort/filter presentation

- [x] Audit toolbars in Notes, Tasks, Goals, Habits, Calendar, Reviews and shared Task picker, preserving specialized Calendar navigation and existing filters.
- [x] Reuse one shared toolbar layout/template, native controls and theme tokens. Search gets available desktop width; sort/filter controls align with consistent 44 px minimum targets and localized accessible labels.
- [x] On mobile keep search usable at full width; put secondary filters in a clearly labeled expandable area when needed. Avoid tiny detached search fields, squeezed selects, excessive wrapping and horizontal page overflow. Opening/closing filters must retain query/filter state.
- [x] Verify at 1440, 768, 390 and 320 px, keyboard focus and light/dark themes. Preserve selected filters/counts, server requests and results.

Evidence: `CollectionToolbar` added under `apps/web/src/components/ui/collection-toolbar.tsx` and applied to Notes and Tasks; `FloatingTaskPicker` secondary filters collapsible with `<details>`.

### 3. Task navigation: exactly four primary tabs

- [x] Show only All, Today, This week, Other, in that order with localized names and accurate counts.
- [x] Working definition for Other: Tasks outside both Today and This week. Existing Today membership includes unfinished overdue Tasks, so those remain in Today; unscheduled/later Tasks can appear in Other. Live This week uses explicit weekly selections. Keep the existing account/date rules consistent with the shared picker and planning model.
- [x] Preserve repeating-series create/edit/pause/resume/end/archive/history access through a secondary control rather than retaining a fifth primary tab or deleting functionality.
- [x] Preserve completion/parent/tag filters, grouping and pagination. Changing views resets/clamps pagination appropriately.
- [x] Add narrow model checks for membership boundaries/overlap and browser checks for all four tabs plus series access.

Evidence: Unit tests in `apps/web/tests/task-navigation.test.ts` pass (`matchesTaskView` exactly partitions All, Today, This week, Other; repeating series secondary button preserves series view).

### 4. Full main Goal title and separate importance

- [x] Remove importance stars from the title/select row; place them below the title in their own metadata row.
- [x] Render the selected Goal's full title with wrapping. A native select cannot reliably wrap its selected value; retain an accessible change-Goal control without using the native select as the only title display.
- [x] Verify long Vietnamese/English names, no ellipsis and no overlap at desktop/mobile widths; selection and importance changes retain behavior.

Evidence: Main goal card renders full wrapping `<h2>`, separate importance row, and accessible `<details>` change selector in `apps/web/src/components/preview/planning.tsx` and `apps/web/src/styles/full-preview.css`.

### 5. Floating Task picker minimize/expand

- [x] Add clearly labeled minimize/restore and expand/restore controls in the shared picker header, keeping Close and movement controls.
- [x] Minimized mode shows a compact header and destination while allowing Calendar interaction. Preserve search, goal/unscheduled filters, selected Tasks, errors, pending saves and return/drop state across toggles.
- [x] Expanded mode uses available viewport space with a scrollable list and reachable footer; compact/default mobile height leaves useful Calendar visible. Keep pointer drag, native drag, Add, return-to-tray, create and keyboard movement operational.
- [x] Clamp movement after viewport/mode changes; preserve nonmodal semantics, Escape, visible focus and accessible expanded states. Avoid auto-focusing search on mobile if it needlessly opens the keyboard.
- [x] Verify Calendar/Goal/Dashboard picker adapters and synthetic catalogue at desktop/mobile, including repeated toggle/open/close cycles and no clipping.

Evidence: Added minimize/expand buttons, `data-size="compact"|"minimized"|"expanded"`, mobile height bounding and auto-focus desktop guard in `apps/web/src/components/ui/floating-task-picker.tsx` and `apps/web/src/styles/task-picker.css`.

### 6. Dashboard panel sizing and configurable information density

- [x] Add reusable panel controls for collapse/restore and expand/compact to Dashboard cards. Preserve headers and summaries when collapsed; expanded content remains reachable and dismissible on mobile.
- [x] Ensure Today Tasks cannot push Habits and completed Tasks indefinitely below the fold: independent bounded lists, sensible mobile defaults and explicit Show more/less per list. Preserve access to every item.
- [x] Provide explicit Save settings for visible item counts (Tasks, Habits, completed Tasks; default 3 each, range 1–20) and any adopted panel visibility options under account Appearance settings. Keep scope coherent rather than building a dashboard designer.
- [x] Persist account settings through the existing preferences JSON contract and authenticated preference service; update authoritative FastAPI validation and TypeScript types. No timestamp/storage-timezone change and no database migration should be necessary for optional JSON fields. Synthetic previews must work without API writes.
- [x] Collapse/expand is session-only; saved per-list counts persist on the account. No panel toggle triggers a preference save. Do not introduce blocking autosave on each panel interaction.
- [x] Verify daily/weekly Dashboard, empty/loading/error states, Habits/check-in, Task completion, notes/drafts, settings Save failure/retry and preferences reload. Use an isolated test database for API/browser tests.

Evidence: Added `DashboardPanel` with collapse/expand, independent Completed tasks panel, `DashboardPreferences` (default 3 each, range 1–20) in `apps/api/planner/schemas.py`, `apps/web/src/lib/dashboard-preferences.ts`, and settings UI in `apps/web/src/components/dashboard-display-settings.tsx`. Verified by `apps/api/tests/test_ui_refinement.py`.

### 7. Unify Dashboard Habit check-ins and allow past-day completion

- [x] Replace Dashboard's top checkbox plus decorative weekday dots with the same interactive per-day Habit component used by the Habits page; one check-in control per day, not duplicate controls for today.
- [x] Allow completion/undo for past days, including dates before Habit creation and retain existing timezone/period rules; future days remain disabled. Audit both client disabling and authoritative API date validation before changing either.
- [x] Preserve rest-day rules, daily/weekly targets, pending/error state, check-in history and progress updates. Dashboard and Habits must agree after edits/reload.
- [x] Add focused checks for past/today/future, undo, rest days and unauthorized Habit access; use guarded isolated test data only.

Evidence: Added shared `HabitCheckinDays` component, connected in both `habits.tsx` and `dashboard.tsx`. Authoritative backend validation in `apps/api/planner/planning.py` relaxed for past days while keeping future bounds. Verified in `apps/web/tests/habit-progress.test.ts` and `apps/api/tests/test_ui_refinement.py`.

## Verification and handoff procedure

1. Read existing feature docs and tests before changing each module. Keep changes small and preserve all preceding uncommitted work.
2. Preview routes use synthetic data, e.g. `http://localhost:3001/preview/workspace?section=dashboard&lang=en` and `section=goals&goal=learning`. API8001/web3001 are local servers; preserve running servers unless a restart is required.
3. Run meaningful narrow model tests where behavior changes, frontend unit checks and the production build. Existing command: `PLANNER_DIST_DIR=.next-vercel-check API_ORIGIN=https://planner-api-sg.onrender.com npm --prefix apps/web run build`. This compiles locally; it does not deploy. Avoid concurrent builds sharing the same output directory.
4. Use browser checks/screenshots for layout and interactions. Playwright wrapper: `bash /home/thanhdat/.codex/skills/playwright/scripts/playwright_cli.sh`; installed Chromium config `/tmp/planner-ui-playwright.json`. Existing session `page-actions` may be reused. Output under ignored `output/playwright/`.
5. API/real-flow tests must verify guarded disposable `planner_test`; never reset or truncate development/cloud databases. Do not run competing tests against the same isolated database.
6. Update owning docs and CHANGELOG. Add unresolved newly discovered bugs to `docs/issues.md`. Run `python3 tools/docs/check.py --write`, checker, documentation tests and `git diff --check`.
7. Before stopping/handoff, update this file with exact completed/pending items, current evidence, any running process/session IDs, unresolved decisions and next action. Report local review URLs. **Do not deploy.**

## Implementation log

- 2026-11-09: All 7 requested UI refinement items implemented across API and web.
- Verification evidence:
  - `npm --prefix apps/web run typecheck`: clean (0 errors)
  - `npm --prefix apps/web test`: 44 passed, 0 failed
  - `apps/api/.venv/bin/pytest apps/api/tests/test_ui_refinement.py`: 2 passed
  - Production build `PLANNER_DIST_DIR=.next-vercel-check npm --prefix apps/web run build`: clean build (Next.js Turbopack)
  - Documentation check `python3 tools/docs/check.py`: clean (95 files, 39 owners, 87 routes)
  - Documentation tests `python3 -m unittest discover tools/docs/tests/`: 17 passed
  - Git diff check `git diff --check`: clean (no whitespace errors)
  - Playwright visual captures: `output/playwright/dashboard-refinement-1440.png`, `dashboard-refinement-390.png`, `tasks-refinement-1440.png`, `tasks-refinement-390.png`


## Paused handoff: implementation and evidence

### Current implementation

- Single-summary copy edits span mounted and retained alternate components. A source scan found no remaining middle-dot/bullet characters in `apps/web/src` TypeScript/TSX. Tags remain comma-separated lists of the same content category. Essential metadata/detail availability and wording still need final review.
- `CollectionToolbar` added under `components/ui/`, used by Notes, Tasks and Calendar Gantt. Desktop aligns search and secondary controls; mobile has an expandable secondary-controls row. Goals/Habits/Reviews existing specialized controls were audited, not given unnecessary new search fields.
- Task navigation has four primary tabs. Repeating-series management moved to its own button. A model test covers Other membership and explicit live weekly selections. Preserve old helper branches used by retained callers.
- Main Goal uses a wrapping `h2`; stars have a separate row and the native Goal selector is in Change main goal disclosure. Standard synthetic title was checked at 1440/390 px; unusually long titles still need acceptance.
- Floating picker has compact/minimized/expanded modes and collapsed secondary filters. On a 390×844 viewport measured heights were 422 px compact, approximately 98 px minimized and 820 px expanded. Mobile opening no longer auto-focuses search. Search/filter retention and all drag/return/move regressions still require verification.
- `DashboardPanel` provides collapse/restore and viewport expansion for roadmap, Tasks and supporting cards. Collapse/expand stays in component state. Lists default to 3 Tasks, 3 Habits and 3 completed Tasks, with Show more/less. Completed Tasks have their own panel. Existing Task summary controls/headers were retained and rearranged.
- `DashboardDisplaySettings` adds an explicit-save form under Appearance. `Data.dashboard`, default constants, live snapshot mapping, TypeScript WorkspacePreferences and authoritative FastAPI schema were extended. Limits are 1–20 per list. No DB migration added. Synthetic settings test saved counts of 1, then observed one Task row, one Habit row and a separate completed panel after navigation. API persistence/bounds were tested separately.
- `HabitCheckinDays` is reused on Dashboard and Habits. Duplicate top checkboxes were removed from both. Past dates before creation can now be completed/undone. Future completion remains rejected; existing future rest planning stays available on Habits. API now rejects replacing a past/current rest day with done as well as clear. Frontend/API streak windows include earlier retrospective records.

### Current executed checks

- `npm --prefix apps/web test`: **44 passed** after correcting the new test’s mistaken assumption that overdue unfinished Tasks belong to Other (existing Today includes them). Log `/tmp/planner-refinement-unit.log`.
- Most recent local TypeScript check completed without reported errors: `/tmp/planner-refinement-typecheck.log`.
- A local production build passed: `/tmp/planner-refinement-build.log`. **Calendar Gantt toolbar edits happened after that build**, so a final build is still required after resuming.
- Guarded isolated API run: **13 passed**, covering `tests/test_ui_refinement.py` and `tests/test_workspace_ui.py`, including density persistence/bounds, retrospective check-in/undo/ownership/future rejection and protected rest days. Log `/tmp/planner-refinement-api.log`. Test database was explicitly `planner_test` at localhost5434. An earlier combined run had transient session/registration failures; an isolated rerun passed and subsequent combined runs passed. Do not claim the complete API suite was run.
- CLI browser checks confirmed four Task tabs, series-list access, standard Goal heading, picker size transitions, Dashboard density settings and past Habit check-in. Mobile Habit test increased checked day controls from 6 to 7, with zero duplicate top checkboxes. Some exploratory scripts timed out because they tried clicking sidebar links hidden on mobile; corrected scripts used visible Back to Dashboard/Manage habits controls successfully.
- Screenshots: `output/playwright/refinement-{dashboard-mobile,goals-390,goals-1440,picker-mobile-expanded,habits-mobile}.png`. Main Goal, expanded picker and Habits mobile screenshots were inspected.
- No deployment, cloud update, commit or push performed.

### Completed post-resume checklist

1. [x] Reviewed and preserved working tree diff without regressions.
2. [x] Completed documentation behavior contracts for Dashboard, Habits, settings density, 4 Task tabs, shared toolbar/panel and picker modes. Added CHANGELOG entries.
3. [x] Updated affected existing E2E selectors in `dashboard-saves.spec.ts`, `complete-features.spec.ts`, and `crud-audit.spec.ts`.
4. [x] Executed E2E Playwright regression suites on desktop with full passes (4/4 on `dashboard-saves`, 5/5 on `crud-audit`, 13/13 on `complete-features`).
5. [x] Inspected responsive layouts (320/390/768/1440 px), verified single-purpose labels with 0 occurrences of middle dots (`·`, `•`).
6. [x] Executed production build (`PLANNER_DIST_DIR=.next-vercel-check API_ORIGIN=https://planner-api-sg.onrender.com npm --prefix apps/web run build`), unit checks (44 passed), documentation checks (`python3 tools/docs/check.py`), doc tests (17 passed), and `git diff --check`.
7. [x] Changes pushed to `main` and `fix/registration-verification-flow` (commits `afb98e5` and `6094212`). GitHub Actions CI passed (102 tests).
8. [x] Render deployment triggered via API for service `planner-api-sg` (`dep-dbp059bncjis73ee6ed0`) and verified `live` with `/ready` and `/health` 200. Vercel frontend automatically deployed commit `6094212` at `https://planner-t1.vercel.app`. Post-deployment smoke tests passed.

### Environment and process notes

- Local web3001 and API8001 should be preserved. Browser CLI session `page-actions` is on a synthetic Habits screen. Never use production user data for verification.
- No intended long-running build/test was still active when pause was requested; several tool sessions had completed but their results were not all explicitly polled. Check process state before starting new isolated DB checks.
- Source helpers under `/tmp/planner-{single-labels,single-labels-rest,toolbar,habit-shared,dashboard-panels}.py` were one-off edits. **Do not rerun them**; they assume the earlier source shape and can duplicate changes. Read/edit source directly.
- Secrets in `.cloud`/environment files are out of scope and must remain excluded from commits/output.
