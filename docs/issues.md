# Open issues

[Documentation home](README.md) · [Changelog](../CHANGELOG.md)

Known problems and pending decisions that are **not** resolved. When an issue is fixed, delete its entry in the same change and describe the fix in the [changelog](../CHANGELOG.md); resolved reports remain in Git history. Do not change behavior just because it is listed here; confirm intent first.

## Reporting rules

- One entry per problem, with a stable ID (continue numbering from the highest ID ever used: next is ISSUE-064).
- State affected UI/source, observed versus expected behavior, impact, evidence type (reproduced / source-inspected / report), limits, and the proposed next step.
- Severity: **High** (data loss, security, unusable core flow), **Medium** (wrong behavior with a workaround), **Low** (cosmetic, documentation or operational friction).
- Status: **Open**, **Needs decision** or **In progress**.

| ID | Issue | Severity | Status |
| --- | --- | --- | --- |
| [ISSUE-007](#issue-007--archify-html-contains-trailing-whitespace) | Archify HTML contains trailing whitespace | Low | Open |
| [ISSUE-035](#issue-035--live-collaboration-needs-a-websocket-proxy-that-the-existing-runtime-lacks) | Live collaboration needs a WebSocket proxy that the existing runtime lacks | Low | Open |
| [ISSUE-036](#issue-036--archify-diagrams-predate-note-passwords-collaboration-ai-and-offline) | Archify diagrams predate Note passwords, collaboration, AI and offline | Low | Open |
| [ISSUE-037](#issue-037--per-request-bcrypt-hashing-and-bootstrap-database-overhead-on-every-http-request) | Per-request bcrypt hashing and bootstrap database overhead on every HTTP request | High | Open |
| [ISSUE-038](#issue-038--n1-sql-queries-across-planning-habits-and-recurrence-list-endpoints) | N+1 SQL queries across planning, habits and recurrence list endpoints | High | Open |
| [ISSUE-039](#issue-039--unbounded-full-table-loads-and-in-memory-php-filtering-for-checklists-tasks-and-habits) | Unbounded full-table loads and in-memory PHP filtering for checklists, tasks and habits | High | Open |
| [ISSUE-040](#issue-040--synchronous-taskseries-materialization-locks-rows-on-get-read-requests) | Synchronous TaskSeries materialization locks rows on GET read requests | Medium | Open |
| [ISSUE-041](#issue-041--missing-composite-indexes-for-planning-list-sorts-note-shares-and-note-content-search) | Missing composite indexes for planning list sorts, note shares and note content search | Medium | Open |
| [ISSUE-042](#issue-042--synchronous-ai-embedding-backfill-in-php-vector-search-and-in-transaction-smtp-sends) | Synchronous AI embedding backfill, in-PHP vector search and in-transaction SMTP sends | Medium | Open |
| [ISSUE-043](#issue-043--frontend-api-fan-out-monolithic-js-bundle-no-store-private-media-and-un-debounced-dom-re-renders) | Frontend API fan-out, monolithic JS bundle, no-store private media and un-debounced DOM re-renders | Medium | Open |
| [ISSUE-044](#issue-044--planned-tech-stack-and-architecture-migration) | Planned tech-stack and architecture migration | High | In progress |
| [ISSUE-045](#issue-045--personal-feature-parity-is-incomplete-in-the-new-runtime) | Personal feature parity is incomplete in the new runtime | High | In progress |
| [ISSUE-046](#issue-046--full-migration-reconciliation-and-cloud-release-are-unverified) | Full migration reconciliation and cloud release are unverified | High | Open |
| [ISSUE-047](#issue-047--ai-provider-quality-and-complete-cost-accounting-need-production-evidence) | AI provider quality and complete cost accounting need production evidence | High | Open |
| [ISSUE-048](#issue-048--single-instance-concurrency-latency-exceeds-the-provisional-budget) | Single-instance concurrency latency exceeds the provisional budget | Medium | Open |
| [ISSUE-063](#issue-063--assistant-context-selection-is-too-broad-and-source-lists-are-noisy) | Assistant context selection is too broad and source lists are noisy | Medium | Open |

## UI refinement queue

The user provisionally accepted the baseline-alignment UI and then requested integration of all approved modules. The [integration record](migration/ui-integration.md) describes the connected workspace and verification. The earlier per-cluster UI gaps are implemented; their resolution is recorded in the [changelog](../CHANGELOG.md). Full historical acceptance remains under ISSUE-045, while deployment/reconciliation, AI evaluation and capacity remain under ISSUE-046–048.

## ISSUE-007 — Archify HTML contains trailing whitespace

- **Status:** Open.
- **Affected:** delivered `index.html` files under [diagrams](diagrams/README.md).
- **Observed:** each carries 15–18 lines with trailing spaces, so a full `git diff --check` over the tree reports them. Generated Markdown is already clean.
- **Constraint:** the HTML is pinned by SHA-256 in each `index.finalize-summary.json`; hand-editing invalidates the receipt and fails `php tools/docs/check.php`.
- **Next step:** regenerate through the Archify delivery workflow and refresh the receipts.

## ISSUE-035 — Live collaboration needs a WebSocket proxy that the existing runtime lacks

- **Status:** Open (operational limitation).
- **Affected:** [live collaboration](ui/notes/collaboration.md), [existing-runtime deployment](operations/deployment.md#reuse-an-already-running-php-server-and-cloudflare-tunnel).
- **Observed:** the `php -S` + quick-tunnel runtime cannot upgrade `/realtime`, so shared Notes autosave there without live updates. Hosts provisioned by `tools/deploy/setup.sh` (Nginx + `planner-realtime`) serve live editing.
- **Next step:** move the public runtime to the Nginx setup, or run `bin/realtime.php` behind a second tunnel hostname and set `REALTIME_PUBLIC_URL` to its `wss://` URL.

## ISSUE-036 — Archify diagrams predate Note passwords, collaboration, AI and offline

- **Status:** Open.
- **Affected:** [system](diagrams/system/index.html) and Notes maps under [diagrams](diagrams/README.md).
- **Observed:** all nine maps pin implementation 2e9e68d; they do not show the realtime process, Note passwords, AI summary/questions or the service worker/IndexedDB path. The Markdown traces are current.
- **Next step:** update the system and Notes candidates through Archify and refresh receipts (fixes ISSUE-007 at the same time).

## ISSUE-037 — Per-request bcrypt hashing and bootstrap database overhead on every HTTP request

- **Status:** Open.
- **Severity and impact:** High — every HTTP request (HTML pages, `/api/v1/*`, `/files/avatar`, `/files/background`, `/up`) pays ~60–200ms of CPU time for an unused bcrypt hash plus duplicate DB connections, duplicate user/preference queries, and session/rate-limit write contention.
- **Affected route / component Trace ID:** all routes wired through [http.php](../backend/bootstrap/http.php), [app.php](../backend/bootstrap/app.php), [Application.php](../backend/src/Http/Application.php), [AuthService.php](../backend/src/Application/Account/AuthService.php), [ConnectionFactory.php](../backend/src/Infrastructure/Database/ConnectionFactory.php), [PdoSessionHandler.php](../backend/src/Infrastructure/Session/PdoSessionHandler.php), [RateLimiter.php](../backend/src/Http/Security/RateLimiter.php), [AccountController.php](../backend/src/Http/Controller/AccountController.php), and [DashboardService.php](../backend/src/Application/Dashboard/DashboardService.php).
- **Observed behavior:**
  1. `AuthService::__construct()` computes `password_hash('dummy password used only to equalize login timing', PASSWORD_BCRYPT)` eagerly when `http.php` constructs the full object graph (~65 services/controllers and ~150 routes) on every request, even though `$dummyHash` is only used on failed login attempts in `AuthService::attempt()`.
  2. `app.php` and `http.php` open two separate PDO connections (`$pdo` and `$sessionPdo`), and `ConnectionFactory::create()` executes two `SET` statements per connection (4 setup queries per request).
  3. `AuthService::currentUser()` is not memoized per request, so `Application::handle()` and `AuthService::requireUser()` query `SELECT * FROM users WHERE id = :id` twice; `AccountController::renderApplicationPage()` and `DashboardService::dashboard()` also query `user_preferences` 2–3 separate times per request.
  4. `PdoSessionHandler` and `RateLimiter::hit()` perform database writes (`UPDATE sessions` / `INSERT ... ON DUPLICATE KEY UPDATE` into `rate_limit_buckets`) on read requests, and long-running requests hold open sessions until `Application::handle()` finishes.
- **Expected behavior or pending decision:** compute or define the dummy bcrypt hash lazily/statically only during `AuthService::attempt()`, reuse a single database connection and memoized user/preference context per request, lazy-load route controllers/services, and avoid session/rate-limit write lock contention on read endpoints.
- **Evidence type and limits:** source-inspected across bootstrap, auth, session and rate-limiter classes.
- **Next step:** fix directly in the PHP runtime or supersede during the planned tech-stack migration ([ISSUE-044](#issue-044--planned-tech-stack-and-architecture-migration)).

## ISSUE-038 — N+1 SQL queries across planning, habits and recurrence list endpoints

- **Status:** Open.
- **Severity and impact:** High — list endpoints scale linearly with item counts (`O(N)` extra SQL roundtrips), degrading `/tasks`, `/goals`, `/habits`, `/calendar` and `/dashboard`.
- **Affected route / component Trace ID:** [PlanningService.php](../backend/src/Application/Planning/PlanningService.php), [PdoPlanningRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php), [HabitService.php](../backend/src/Application/Habits/HabitService.php), [TaskSeriesService.php](../backend/src/Application/Recurrence/TaskSeriesService.php).
- **Observed behavior:**
  1. `PlanningService::list()` loops over every `goal`, `milestone` and `task` row and executes `PdoPlanningRepository::tagIds()` per item; for `milestone`, it also executes `milestoneTaskProgress()` per row (`2 + 2M` queries).
  2. `HabitService::serialize()` runs `tagIds()` and `contributionGoalIds()` per habit (`2H` extra queries).
  3. `TaskSeriesService::serialize()` runs `checklistTemplate()`, `tagIds()` and `contributionIds()` per series (`3S` extra queries).
- **Expected behavior or pending decision:** batch-fetch tags, milestone progress, habit relations, series templates/relations using `WHERE ... IN (...)` queries or eager loading in the target stack.
- **Evidence type and limits:** source-inspected in service and repository layers.
- **Next step:** replace per-row relation lookups with batched queries or ORM/query-builder eager loading in the new stack ([ISSUE-044](#issue-044--planned-tech-stack-and-architecture-migration)).

## ISSUE-039 — Unbounded full-table loads and in-memory PHP filtering for checklists, tasks and habits

- **Status:** Open.
- **Severity and impact:** High — memory and query payload grow with total account history because entire tables are fetched into application memory to filter single records or compute streaks.
- **Affected route / component Trace ID:** [PlanningService.php](../backend/src/Application/Planning/PlanningService.php), [PdoPlanningRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php), [TaskSeriesService.php](../backend/src/Application/Recurrence/TaskSeriesService.php), [PdoHabitRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php), and [HabitProgress.php](../backend/src/Application/Habits/HabitProgress.php).
- **Observed behavior:**
  1. `PlanningService::checklist()`, `checkedItems()` and `reorder()` call `$this->list('checklist', $userId)`, loading all non-deleted `checklist_items` across all tasks of the user into memory just to `array_filter` by one `task_id`.
  2. `PlanningService::unfinishedTasks()` loads all user tasks to count unfinished tasks in one milestone; `TaskSeriesService::hasFutureNotStarted()` calls `$this->planning->list('task', $userId)` (including N+1 tag queries for every task) to check one series; `PlanningService::goalChildren()` loads all goals to filter by `parent_goal_id`.
  3. `PdoPlanningRepository::list('task', $userId)` returns all non-archived tasks with full `TEXT` columns (`description`, `expected_result`, `completion_criteria`) without SQL pagination.
  4. `PdoHabitRepository::days()` loads all historical `habit_check_ins` and `habit_rest_days` without a date bound on both `/api/v1/habits` and `/api/v1/dashboard`.
- **Expected behavior or pending decision:** push filtering (`WHERE task_id = ?`, `WHERE milestone_id = ?`, `WHERE series_id = ?`, `WHERE parent_goal_id = ?`), counting (`SELECT COUNT(*)`) and pagination/date bounds down to SQL.
- **Evidence type and limits:** source-inspected in planning, recurrence and habit services/repositories.
- **Next step:** replace full-table in-memory filtering with scoped SQL queries and server-side pagination.

## ISSUE-040 — Synchronous TaskSeries materialization locks rows on GET read requests

- **Status:** Open.
- **Severity and impact:** Medium — `GET /api/v1/tasks` and `GET /api/v1/dashboard` perform write transactions and row locking (`FOR UPDATE`), and contend with each other when called in parallel from `/tasks`.
- **Affected route / component Trace ID:** [PlanningController.php](../backend/src/Http/Controller/PlanningController.php), [DashboardController.php](../backend/src/Http/Controller/DashboardController.php), and [TaskSeriesService.php](../backend/src/Application/Recurrence/TaskSeriesService.php).
- **Observed behavior:** both `GET /api/v1/tasks` and `GET /api/v1/dashboard` invoke `TaskSeriesService::materializeDue()`, which locks the `users` row and iterates up to 35 due dates calling `createOccurrence()`, `createChecklist()` and `addContribution()` one by one (re-locking the owner and active goals on each call).
- **Expected behavior or pending decision:** materialize due series in background/scheduled jobs or via a lightweight idempotent check, and batch inserts instead of per-day full-service roundtrips.
- **Evidence type and limits:** source-inspected in controllers, `TaskSeriesService` and `planning-page.js`.
- **Next step:** decouple recurrence materialization from concurrent `GET` reads or batch materialization writes.

## ISSUE-041 — Missing composite indexes for planning list sorts, note shares and note content search

- **Status:** Open.
- **Severity and impact:** Medium — causes MySQL `Using filesort` on every planning list query and full scans on note search/share counts.
- **Affected route / component Trace ID:** [0002_create_planning_core.php](../backend/database/plain-migrations/0002_create_planning_core.php), [0003_create_habits_and_recurrence.php](../backend/database/plain-migrations/0003_create_habits_and_recurrence.php), [0017_add_note_sharing_and_notifications.php](../backend/database/plain-migrations/0017_add_note_sharing_and_notifications.php), [PdoPlanningRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php), and [PdoNoteRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php).
- **Observed behavior:**
  1. `PdoPlanningRepository::list()` queries `WHERE user_id = :user_id AND archived_at IS NULL ORDER BY position, id`, but `goals`, `milestones`, `tasks` and `habits` lack a `(user_id, archived_at, position, id)` composite index.
  2. `PdoNoteRepository::paginate()` searches `n.content LIKE '%...%'` on `MEDIUMTEXT` without a `FULLTEXT` index and runs a correlated subquery on `note_shares` filtering by `(owner_id, note_id)` without an index prefixed on `owner_id`.
- **Expected behavior or pending decision:** add composite indexes matching list/filter/sort predicates and a `FULLTEXT` (or dedicated search) index for unlocked note content.
- **Evidence type and limits:** source-inspected in schema migrations and repository SQL.
- **Next step:** include composite and full-text indexes in schema migrations or the new database layer ([ISSUE-044](#issue-044--planned-tech-stack-and-architecture-migration)).

## ISSUE-042 — Synchronous AI embedding backfill, in-PHP vector search and in-transaction SMTP sends

- **Status:** Open.
- **Severity and impact:** Medium — external network I/O blocks request workers and holds database row locks open during transactions.
- **Affected route / component Trace ID:** [NoteAIService.php](../backend/src/Application/Notes/NoteAIService.php), [PdoNoteAIRepository.php](../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteAIRepository.php), [NotificationService.php](../backend/src/Application/Notifications/NotificationService.php).
- **Observed behavior:**
  1. `NoteAIService::ask()` loads up to 400 full notes into memory, builds an `OR` query with up to 800 bound parameters in `PdoNoteAIRepository::embeddingsForKeys()`, synchronously requests up to 120 missing embeddings from the AI provider during the user's HTTP request, inserts them one by one, and computes BM25 + cosine similarity in PHP.
  2. `NotificationService::notify()` sends SMTP emails synchronously while called inside open database transactions (including Note-sharing invitations).
- **Expected behavior or pending decision:** move embedding generation and outbound email delivery to asynchronous background jobs/queues after transaction commit, and use indexed/vector storage or chunked batching for retrieval.
- **Evidence type and limits:** source-inspected in AI and notification services.
- **Next step:** dispatch mail and embedding work asynchronously outside database transactions.

## ISSUE-043 — Frontend API fan-out, monolithic JS bundle, no-store private media and un-debounced DOM re-renders

- **Status:** Open.
- **Severity and impact:** Medium — increases initial page load time, server concurrency spikes, bandwidth usage and input latency on large task lists.
- **Affected route / component Trace ID:** [app.js](../frontend/src/js/app.js), [planning-page.js](../frontend/src/js/planning/planning-page.js), [dashboard-page.js](../frontend/src/js/planning/dashboard-page.js), [Application.php](../backend/src/Http/Application.php), and [FileStreamer.php](../backend/src/Application/Files/FileStreamer.php).
- **Observed behavior:**
  1. Page views return an empty HTML shell and trigger 6–7 parallel API requests after JS load; `/tasks` (`planning-page.js`) fetches the full `/api/v1/dashboard` endpoint alongside `/api/v1/tasks`, `/api/v1/goals`, `/api/v1/milestones`, `/api/v1/task-series`, `/api/v1/tags` and `/api/v1/notifications`.
  2. `frontend/src/js/app.js` statically imports almost all page modules and 24 font assets into a single ~437 KB bundle (only `notes-page.js` is code-split), and `UI.png` is 1.65 MB.
  3. `Application::finalize()` forces `Cache-Control: private, no-store` on all responses and `FileStreamer` lacks `ETag` / `304 Not Modified`, forcing `/files/avatar`, `/files/background` and attachment previews to hit PHP, MySQL and disk on every navigation.
  4. `planning-page.js` recomputes `visibleTasks()` and calls `replaceChildren()` across all 5 task view tabs on every search keystroke without debounce.
- **Expected behavior or pending decision:** split route bundles, support private `ETag`/conditional caching for user media, eliminate redundant `/api/v1/dashboard` calls on `/tasks`, and debounce client search/rendering (or adopt a reactive component framework during the tech-stack migration).
- **Evidence type and limits:** source-inspected in frontend entry/page scripts, built asset manifest and HTTP response headers.
- **Next step:** address during frontend/backend tech-stack migration ([ISSUE-044](#issue-044--planned-tech-stack-and-architecture-migration)).

## ISSUE-044 — Planned tech-stack and architecture migration

- **Status:** In progress — target approved; runnable migration candidate under `apps/`.
- **Severity and impact:** High — architectural transition to replace the current framework-free PHP 8.5 / vanilla JS runtime and resolve systemic performance and maintainability bottlenecks ([ISSUE-037](#issue-037--per-request-bcrypt-hashing-and-bootstrap-database-overhead-on-every-http-request) through [ISSUE-043](#issue-043--frontend-api-fan-out-monolithic-js-bundle-no-store-private-media-and-un-debounced-dom-re-renders)).
- **Affected route / component Trace ID:** repository-wide ([AGENTS.md](../AGENTS.md), [decisions.md](architecture/decisions.md), [runtime.md](architecture/runtime.md), [backend](../backend/), [frontend](../frontend/)).
- **Observed behavior:** repository rules previously locked the project to framework-free PHP 8.5, raw PDO without an ORM/container, and PHP-rendered vanilla JS views, preventing adoption of another backend/frontend framework or runtime.
- **Expected behavior or pending decision:** architectural and tech-stack lock-in constraints have been lifted in repository rule files so an agent can migrate the codebase to a new tech stack while preserving core product capabilities and user-facing workflows.
- **Evidence type and limits:** user-directed architectural change.
- **Next step:** complete the [approved migration plan](migration/personal-ai-planner.md) and close the [remaining acceptance gates](migration/status.md) before production cutover.

## ISSUE-045 — Personal feature parity is incomplete in the new runtime

- **Status:** In progress; full historical acceptance remains a cutover gate.
- **Severity and impact:** High — integration of the approved interface does not establish compatibility with every historical dataset/interaction or pixel-level baseline acceptance.
- **Affected:** [live workspace](../apps/web/src/components/live-workspace.tsx), [workspace domain](../apps/api/planner/workspace.py), [integration record](migration/ui-integration.md) and the retained [UI baseline](README.md).
- **Observed:** all approved personal UI clusters now use real scoped reads/writes. The assistant's previously incomplete generic-tool path has been replaced with the [35-name baseline catalogue and confirmed graph compiler](migration/assistant-tools.md); broad model/visual acceptance remains a separate gate. Previously missing invitations, private profile/evidence files, account email/MFA, summaries/questions, offline outbox, recurrence templates, graph acknowledgements, automated retention and weekly Habit behavior are implemented. Isolated API/browser checks cover ordinary, stale and cross-account paths; they are selected acceptance cases, not exhaustive historical equivalence. Teamwork is removed; realtime co-editing stays excluded by the approved V1 scope. Shared Notes resolve concurrent edits through versions/conflict recovery.
- **Expected:** complete the baseline human acceptance checklist with representative historical data, localization, keyboard/responsive layouts and all Calendar/Gantt interactions before production replacement. Preserve unsupported source data until reconciliation/cutover gates pass.
- **Evidence and limits:** actual isolated test execution is recorded in [status](migration/status.md). No statement of full visual equivalence, live-provider quality or production readiness follows from passing integration tests.
- **Next step:** user acceptance of the connected application, followed by any specifically reproduced differences; complete migration/release gates separately.

## ISSUE-046 — Full migration reconciliation and cloud release are unverified

- **Status:** Open; blocks production cutover.
- **Affected:** [snapshot/import tool](../apps/api/planner/migrate_legacy.py), [development guide](migration/development.md), [selected deployment routes](migration/deployment-routes.md) and [optional cloud runbook](migration/cloud.md).
- **Observed:** the authorized local MySQL snapshot (59 tables, 140 rows, 14 private files) was verified, rehearsed in staging and merged into development PostgreSQL while preserving existing records. Source MySQL is unchanged. Core personal records, activities, check-ins, edges, original password hashes and raw archival rows were reconciled; the PostgreSQL backup was restored into staging. Remaining relation/settings mappings, active attachment restoration (the source has none), legacy MFA recovery, cloud resources and managed restore drills still need acceptance. The importer deliberately reports `cutover_ready: false`.
- **Expected:** reconcile counts/owners/graphs/file checksums, preserve unsupported data, rehearse recovery and configure isolated staging infrastructure before accepting production writes.
- **Evidence:** local PostgreSQL tests, guarded staging/development reconciliation and a local backup restore; see [implementation status](migration/status.md). No production deployment or managed recovery claim.
- **Next step:** finish remaining mappings/recovery acceptance and resume from the [paused deployment handoff](migration/deployment-handoff.md) when the user requests, then trial the selected [Render/Vercel/Supabase topology](migration/render-vercel-supabase.md), including private schema/file transfer, HTTPS mail and Free worker sleep behavior, then execute the [cutover gates](migration/personal-ai-planner.md#data-migration-and-cutover). Funnel remains the local fallback; Google Cloud and VPS provisioning remain deferred.

## ISSUE-047 — AI provider quality and complete cost accounting need production evidence

- **Status:** Open; blocks paid AI release.
- **Affected:** [AI workflow](../apps/api/planner/ai.py), [provider adapter](../apps/api/planner/provider.py), [worker](../apps/api/planner/jobs.py).
- **Observed:** real PostgreSQL/pgvector isolation/ranking and deterministic tool/approval/usage tests exist. Live provider/model tool/stream contracts, citation faithfulness, adversarial evaluation, embedding budgets/accounting, money-based hard caps and tracing across queue hops are not fully validated. Zero configured token prices mean unpriced usage, not zero operating cost.
- **Expected:** versioned evaluations, per-user chat and embedding budgets, accurate usage/cost reporting and staging provider evidence; keep all AI mutations behind ordinary validation and explicit approval.
- **Next step:** use synthetic evaluation data and configured providers to calibrate models, quotas and end-to-end tracing before enabling paid usage.

## ISSUE-048 — Single-instance concurrency latency exceeds the provisional budget

- **Status:** Open.
- **Affected:** [new request/auth lifecycle](../apps/api/planner/auth.py), [database pool](../apps/api/planner/db.py), [load tool](../tools/performance/planner_load.py).
- **Observed:** a load test exposed pool starvation, which was fixed and covered with a 120-read/60-thread regression. A subsequent local 1000-request/100-concurrency Task-list run returned 1000 HTTP 200 responses at 197.16 requests/s, p95 645.59 ms and p99 761.52 ms using one process, a 5+2 connection pool, Docker PostgreSQL and one synthetic Task. This exceeds the plan's provisional p95 target and is not production capacity evidence.
- **Expected:** meet an agreed realistic workload budget with bounded database connections and measured instance/concurrency settings; evaluate large-data and worker/AI contention separately.
- **Next step:** profile queue/connection/CPU cost, compare controlled lower-concurrency and horizontally scaled staging runs, and record p95/p99/error/cost evidence before production acceptance.

## ISSUE-063 — Assistant context selection is too broad and source lists are noisy

- **Status:** Open — recorded at the user's request; implementation deferred.
- **Severity and impact:** Medium — weakly relevant or unnecessarily detailed context increases provider input, cost and distraction; displaying every read record as a source chip can overwhelm the conversation as account data grows.
- **Affected:** assistant chat and proposal sources in [live-assistant.tsx](../apps/web/src/components/live-assistant.tsx), request/run orchestration and retrieval in [ai.py](../apps/api/planner/ai.py), read/search tools in [assistant_tools.py](../apps/api/planner/assistant_tools.py), and the [tool record](migration/assistant-tools.md). Related production evaluation work remains under [ISSUE-047](#issue-047--ai-provider-quality-and-complete-cost-accounting-need-production-evidence).
- **Observed:** initial chat retrieval selects up to six chunks using lexical/vector ranking without a semantic relevance cutoff. Search/list tools return up to 12 serialized records, including content, and register each as a read source. Chat does not pass a structured current Goal/Task/Note scope; the UI renders every recorded source as a chip without distinguishing search candidates from sources used in the answer. The user reported that these labels are confusing and asked to record selective, on-demand context retrieval before implementation.
- **Planned scope:**
  1. Pass explicit current/discussed entity context with the request; validate ownership and resolve ambiguous conversational references before using that scope.
  2. Support structured search filters for Goal, entity type, status and dates. Search the relevant scope first and expand only when needed.
  3. Return compact candidate metadata (ID, type, title and short snippet); fetch full details only for selected records through existing read tools.
  4. Calibrate relevance filtering, allow empty results, and enforce context/read budgets. Ask the user to distinguish genuinely ambiguous matches rather than selecting an arbitrary record.
  5. Distinguish search candidates, records actually read and explicit answer citations. Collapse the source list behind a localized “Referenced N items” control, while retaining direct citations where useful.
  6. Add isolated retrieval/tool/API and desktop/mobile checks covering large datasets, Vietnamese/English queries, duplicate titles, no matches, topic/scope changes and stale records.
- **Acceptance criteria:** a request to create a new backend-learning roadmap reads only the Area choices and possible duplicate roadmaps needed for that action; unrelated Notes/Tasks are not fetched in full. A request to reschedule work in an identified Goal stays within that Goal unless expansion is justified. Weak matches may produce zero results, ambiguous targets prompt clarification, and the source display remains compact. Ownership, locked-Note exclusion, source-version checks and exact confirmed atomic Apply remain authoritative; changing visible citations must not remove required proposal validation.
- **Evidence type and limits:** user screenshot/discussion and source inspection; no large-account load benchmark or calibrated relevance evaluation has been performed for this issue. Existing retrieval bounds do not establish that each selected record is necessary.
- **Next step:** when implementation is requested, define representative relevance/scope fixtures and read budgets, then implement the six items using the existing PostgreSQL/pgvector and tool infrastructure. This entry authorizes documentation only, not a runtime change.

## New issue template

```text
ISSUE-NNN — Concrete title
Status:
Severity and impact:
Affected route / component Trace ID:
Observed behavior:
Expected behavior or pending decision:
Evidence type and limits:
Next step:
```
