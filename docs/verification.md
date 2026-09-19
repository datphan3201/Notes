# Verification Evidence

## Current interface release — 2026-09-18

This is the newest verification record. Earlier sections preserve historical migration evidence and its original limitations.

| Check | Result | Evidence |
| --- | --- | --- |
| Backend regression | Pass | `PLANNER_DB_PORT=3307 PLANNER_DB_USERNAME=root PLANNER_DB_PASSWORD= vendor/bin/phpunit -c phpunit.xml` against a disposable loopback MySQL instance and guarded `goals_test`: 72 tests, 527 assertions. |
| Focused HTTP/templates | Pass | Account, Planning HTTP, Dashboard/Reviews, and View tests: 17 tests, 119 assertions. |
| Frontend | Pass | `npm run test:unit`: 33 tests; Prettier and `npm run build` passed. |
| PHP syntax | Pass | 149 first-party PHP files, including all 17 views, passed `php -l`. |
| Composer | Pass | `composer validate --strict` and `composer check-platform-reqs`. |
| Responsive pages | Pass | Dashboard, Goals, Tasks, Habits, Reviews, Notes, AI, Profile, Appearance, Password at widths 1440, 768, 360: all 30 HTTP 200 results and `document.documentElement.scrollWidth <= innerWidth`. |
| Navigation | Pass | Mobile open focuses Close navigation; Tab and Shift+Tab wrap; Escape restores the trigger; the background is inert while open; desktop resize removes inert/scroll-lock state. |
| Dashboard | Pass | Task and Checklist completion produced two factual contributions; selected Task rendered with its real detail link. Previous month loaded August 2026. Tooltips were inspected outside the scroll region. |
| Failure/retry | Pass | Intercepted Dashboard response with 503; error visible, Refresh enabled, and error cleared after removing the interception and retrying. This expected console network error is not a normal-flow failure. |
| Product forms | Pass for exercised paths | Goal creation and detail navigation, Task create/select/checklist/note/complete, Habit creation/check-in, Review draft/reflection save, and Notes create/autosave/color worked in a separate disposable account. |
| Notes startup regression | Pass | Delayed initial Labels response kept New note disabled; after release, a newly saved Note did not open the recovery dialog. |
| Dark Notes and English dates | Pass | Mint Note computed background `rgb(33, 61, 50)` in dark mode; card date displayed `Sep 18, 2026`. Mobile Manage tags opened its dialog. |

Screenshots were visually inspected for desktop, tablet, mobile, authentication, and light/dark states. Local artifacts are under ignored `output/playwright/redesign-*.png`; credentials and browser storage are not release artifacts. The frontend-design and Playwright skills informed the design and browser checks. This UI work did not repeat optional live Google-provider or production web-server deployment tests.

## Migration-planning baseline — 2026-09-17

This section is the historical baseline for the Laravel-to-plain-PHP migration. It
records the behavior that M00 must reproduce before target implementation
begins; it is not evidence that the migration itself has started.

| Check | Result | Evidence |
| --- | --- | --- |
| Repository audit | Pass | Backend, frontend, routes, migrations, tests, configuration, templates, JavaScript modules, and dependency manifests were inventoried in [`plan/00-repository-audit.md`](plan/00-repository-audit.md). |
| Laravel PHPUnit baseline | Pass | From `backend/`, 35 tests and 385 assertions passed on MySQL. This includes the expanded Account, File Integrity, Label, Note Query, Rate Limit, and Security contract suites currently present in the working tree. |
| JavaScript unit baseline | Pass | From `frontend/`, four Node test files passed, including autosave and read-coordinator coverage. |
| Production asset build | Pass | From `frontend/`, Vite completed and emitted the current build into `backend/public/build`. |
| Composer metadata/platform | Pass | `composer validate --strict` and `composer check-platform-reqs` completed successfully in `backend/`. |
| PHP syntax inventory | Pass | All 107 first-party PHP files discovered during the audit passed `php -l`. |
| Route inventory | Pass | The current Laravel application exposes 32 application routes; the exact M00 inventory must be captured before implementation changes it. |

The worktree contained pre-existing application changes during this audit.
Those files are user-owned and were neither reverted nor attributed to this
documentation work. M00 must rerun and date its own immutable baseline before
creating target runtime files.

## Migration execution evidence — 2026-09-17

### M00 baseline

- `backend/vendor/bin/phpunit`: 35 tests, 385 assertions passed on the guarded
  legacy MySQL test database.
- `frontend/npm run test:unit`: 27 tests passed; formatting and Vite production
  build passed.
- Composer strict validation/platform requirements, the 32-route inventory,
  and first-party PHP syntax checks passed.
- The pre-existing dirty worktree was recorded and preserved.

### M01 framework-free foundation

- Added `Planner\\` autoloading, typed configuration, UTC/native-prepare PDO,
  nested rollback-only transactions, Clock/UUID/normalization support, checksum
  migrations, guarded CLI, target schema, and a plain PHPUnit suite.
- `vendor/bin/phpunit -c phpunit.plain.xml`: 13 tests, 47 assertions passed.
- A disposable user-owned MySQL 8.4 instance on a non-system port supplied an
  isolated `goals_test`; no `notes_*` database was reused or modified.
- Fresh `php bin/console migrate`, second no-op migrate, `migrate:status`, and
  `migrate:check` all passed.
- New/changed target PHP was formatted with Pint and passed syntax validation;
  Composer strict validation passed.

### M02 HTTP, sessions, authentication, and account

- Implemented application-owned Request/Response/Router/Application/error
  lifecycle, explicit routes, validation, owner identity, rate buckets,
  CSRF/origin guard, encrypted PDO session handler, account repository/services,
  auth/profile/preferences/password controllers, and isolated target entrypoint.
- Plain suite: 24 tests, 106 assertions passed with deprecations treated as
  failures. Legacy Laravel suite remained 35 tests/385 assertions passing.
- Real HTTP on the isolated target returned 200 registration page, 302 account
  creation, 200 authenticated session JSON, and 419 `SESSION_EXPIRED` for a
  mutation without CSRF.
- Observed cookies used a regenerated 64-hex-character opaque ID with HttpOnly
  and SameSite=Lax; HTML/API responses carried request ID, private/no-store,
  nosniff and same-origin headers; HTML also carried DENY/CSP.
- Target route CLI, Composer strict/platform checks, PHP syntax, and focused
  Pint formatting passed.

### M03 Notes and Label compatibility

- Added framework-free Note/Tag records, complete-snapshot normalization,
  owner-scoped PDO repositories, transaction-owning services, validators,
  serializers, controllers, explicit routes, and bootstrap wiring. Target code
  contains no Eloquent or Illuminate calls.
- Plain MySQL suite: 29 tests and 210 assertions passed. The M03 HTTP cases
  cover stable UUID create/replay/collision/tombstone behavior, desired-state
  no-op precedence, stale conflicts with current state, microsecond UTC output,
  literal `%`/`_`/`!` and accent-insensitive search, ANY-label filtering,
  deterministic pagination/pinning, cross-owner non-disclosure, label
  collation/quotas/versioning, affected-Note version increments, attachment
  scrubbing/cleanup queueing, unknown fields, and validation boundaries.
- The list test measured the same bounded main-connection SELECT count for one
  and thirty Notes (at most eight including authentication/rate-limit reads),
  and `EXPLAIN` was inspected for the owner/pagination and label-filter plans.
- Browser UUID generation now uses native `crypto.randomUUID()` or a
  `crypto.getRandomValues()` RFC 4122 v4 implementation. It refuses creation
  when secure randomness is unavailable; no timestamp/`Math.random` fallback
  remains for Note or attachment create IDs.
- `npm run test:unit`: 30 tests passed, including native/fallback UUID shape and
  no-secure-random failure. Prettier and the Vite production build passed.
- Focused Pint formatting, first-party target PHP syntax, Composer strict
  validation/platform checks passed. The Laravel regression suite remained 35
  tests/385 assertions passing.

### M04 private files and avatars

- Added a canonical local-private-storage adapter outside the public root,
  strict generated relative paths, symlink/traversal/containment checks,
  attachment/avatar inspection, PDO metadata and pending-deletion repositories,
  write-before-transaction compensation, retry cleanup, and old-orphan pruning.
- Attachment routes preserve stable UUID replay/conflict/tombstone behavior,
  20-file/200 MiB final-state quotas, owner/active-Note authorization, Note
  version stability on file-only changes, detected MIME/kind, and private-field
  exclusion. Avatar input is capped/decoded and re-encoded as a centered
  512×512 white-background JPEG at quality 88 before its path is swapped.
- Streaming responses release the session before emission, stream in bounded
  chunks, implement GET/HEAD, full/open-ended/suffix single ranges, 206/416,
  detected preview types, octet-stream downloads, and CR/LF-safe ASCII plus RFC
  5987 Unicode filenames.
- Plain MySQL suite: 39 tests and 365 assertions passed with no deprecations.
  Coverage includes replay/collision/owner probes, spoofed/empty/corrupt files,
  quotas and compensation, two-process final-slot uploads, upload-vs-delete,
  every range shape, HEAD, image preview, avatar preservation/re-encoding,
  path/symlink rejection, retryable cleanup, referenced/recent retention, and
  idempotent orphan pruning.
- Real HTTP against the isolated target returned registration 302, Note and
  multipart upload 201, full private download 200, byte range 206 with exact
  10-byte body and `Content-Range`, and HEAD 200 with no response body. Private
  headers included no-store, nosniff, length, ranges, and Unicode disposition.
- `php bin/console files:prune` ran twice successfully. Focused Pint, target PHP
  syntax, Composer validation/platform checks passed; the Laravel suite stayed
  green at 35 tests/385 assertions.

### M05 template/Vite cutover and Laravel removal

- Promoted the framework-free public index, bootstrap, route registry, CLI, and
  PHPUnit configuration to their canonical paths. Converted all eight Blade
  views to escaped PHP templates with manifest-backed assets and non-executable
  JSON bootstrap data.
- Replaced the Laravel Vite plugin with native Vite configuration. A browser
  check exposed and then verified fixes for the Vite 8 manifest location and
  `/build/` font asset base path.
- Removed Laravel, Boost, Pint, Collision, Mockery, Faker, the Laravel Vite
  plugin, 69 transitive Composer packages, legacy framework source/config/tests,
  Artisan, Blade templates, and temporary target entry/bootstrap/route files.
- Canonical MySQL PHPUnit suite: 43 tests and 389 assertions. JavaScript suite:
  30 tests. Composer strict validation/platform checks, native Vite production
  build, 33-route inventory, PHP syntax, and framework source/dependency scans
  passed.
- Real Firefox browser smoke registered a new account, loaded built CSS/fonts
  and JavaScript without a Vite server, created a Note through autosave, and
  observed the saved card/version. Final normal-flow console: zero errors and
  zero warnings.

## Completed planning product and release acceptance — 2026-09-18

### M06 planning core

- Added configurable Areas; arbitrary-depth, single-parent Goals; separate
  contribution edges; Milestones and dependencies; Tasks, Checklists and Task
  Notes; hierarchical Tags; explicit importance/status values; and modular
  automatic Goal progress.
- `PlanningDomainTest`, `PlanningCoreTest`, and `PlanningHttpTest` cover deep
  iterative traversal, hierarchy/contribution/dependency cycles, cross-owner
  edges, one primary parent, locked Milestone completion, Tasks under locked
  Milestones, explicit unfinished-Task acknowledgement, progress exclusions,
  Checklist/status independence, Task Notes, validation, and page/API wiring.
- The Firefox critical path created a Goal with text completion criteria, a
  Milestone, a Task, an unchecked Checklist Item and a Task Note. Completing
  the Task required the explicit warning acknowledgement and left the
  Checklist Item unchecked; Goal progress changed predictably from 0% to 50%.

### M07 Habits and recurrence

- Added dedicated Habits and daily completion history, plus independent daily
  and weekly recurring Task series with interval, weekdays, end date,
  pause/resume/end and idempotent materialization.
- `RecurrenceCalculatorTest` and `HabitsRecurrenceTest` cover timezone/DST
  calculation, concurrent/idempotent materialization, ownership, check-in
  reversal, pause/resume, explicit end acknowledgement and future-occurrence
  archival.
- Firefox exercised Habit check-in/undo and a Monday/Friday weekly series. The
  preview returned the expected ordered dates; create, pause and resume worked.
  The maintenance command returned `Created occurrences: 0; failed series: 0`
  on an already-current database.

### M08 Dashboard, Activity and Reviews

- Added the deduplicated completion Activity ledger, current-week Task and
  Milestone selections, Goal-related Habit projection, Goal snapshots and
  separate daily/weekly/monthly Reviews.
- `DashboardReviewsTest` covers reversal/re-completion, Dashboard membership,
  timezone-stable periods, immutable finalized snapshots, refresh, finalize
  and reopen.
- Firefox showed one completion on 2026-09-18, the selected Task and Milestone,
  saved all four reflection fields, finalized the Review with disabled editing,
  and reopened it.

### M09 approval-gated AI

- Added `AIProviderInterface`, disabled and Google providers, explicit context
  selection/consent, strict structured proposal validation, persisted proposal
  lifecycle and atomic Apply through the same planning use cases as manual
  creation.
- `AIActionTest` covers malformed, stale, cyclic and foreign references,
  rejection, idempotent replay, version handling, transaction rollback and
  normal domain validation for AI-created structures.
- Firefox selected one Goal, Task and Review and showed the exact three-item
  disclosure summary. With AI disabled, generation returned the safe
  user-facing `The AI assistant is not enabled` response and created no proposal or
  planning data.

### M10 final acceptance

Runtime: PHP 8.5.0, Composer 2.8.12, MySQL 8.4.11, Node 22.22.2,
npm 10.9.7, Vite 8.2.2 and Firefox 155.0.

| Gate | Result and current evidence |
| --- | --- |
| Fresh and repeat migration | Pass — all five migrations applied to a new `goals_test`; the second run reported no pending migrations; `migrate:check` was healthy. The same fresh/no-op/status/check path passed on `goals_dev`. |
| Backend suite | Pass — `vendor/bin/phpunit -c phpunit.xml`: 72 tests, 527 assertions in 47.667 seconds against guarded real MySQL `goals_test`. |
| Frontend suite/build | Pass — original acceptance: 31/31; post-acceptance English UI/calendar refresh: `npm run test:unit` 33/33, formatting clean, and `npm run build` transformed 23 modules and emitted the production manifest/assets. |
| PHP/dependencies | Pass — 146 canonical first-party PHP files linted clean; `composer validate --strict` and `composer check-platform-reqs` passed. A clean temporary `composer install --no-dev --optimize-autoloader` installed 15 packages. |
| Routes and operations | Pass — 125 routes inventoried. `files:prune`, `sessions:prune`, `rate-limits:prune`, `areas:backfill`, `recurrence:materialize` and `snapshots:capture` all completed without partial failure. |
| Production startup | Pass — production configuration rejected neither debug/cookie/storage settings nor assets; `/up` and `/register` returned 200. Hashed JavaScript returned 200 as `application/javascript`; session cookies were Secure, HttpOnly and SameSite=Lax; HTML carried CSP and nosniff headers. |
| Framework retirement | Pass — active source, templates, routes, manifests and lockfiles contain no Laravel/Illuminate/Blade/Artisan dependency or file; Composer reports that `laravel/framework` is not installed. |
| Secrets/licenses | Pass — first-party scan found no Google/GitHub token or private-key signature. Composer inventoried 40 production/development dependencies under Apache-2.0, BSD-3-Clause or MIT; all 45 npm package records had license metadata under Apache-2.0, BSD-3-Clause, ISC, MIT, MPL-2.0 or OFL-1.1. |
| Backup/restore | Pass — a transaction-consistent `goals_dev` dump restored into a new database with 37/37 tables and a healthy migration checksum; the rehearsal database was removed afterwards. |
| Browser critical path | Pass for required target flows — registration, planning entities, Task warning/checklist/note, Habit/recurrence, Dashboard/Activity, Review, AI unavailable behavior, and cross-account Goal non-disclosure passed in real Firefox with zero console errors/warnings. |
| Responsive/accessibility | Pass for acceptance checks — 360×800, 768×1024 and 1440×900 had `scrollWidth == clientWidth`; 200% CSS scaling at a 720 px viewport had no document overflow; dark preference applied the persisted dark palette; keyboard Tab advanced to an actionable button. |

The acceptance pass exposed three defects before this final run: the documented
PHP development command did not set `public` as document root, async click
handlers referenced `event.currentTarget` after an `await`, and the recurring
series end path reused one named PDO placeholder while native prepares were
enabled. The startup documentation, handlers, and SQL bindings were fixed;
assets and all affected tests/flows were rerun successfully.

Known unrun environment-dependent checks:

- A live Google Gemini call was not made because no production API credential
  was supplied. This is optional by contract; deterministic fake/disabled
  provider and approval tests passed.
- Apache was not installed in the acceptance environment, so
  `backend/public/.htaccess` was reviewed but not executed by Apache. The same
  front-controller/static-file behavior passed with the PHP production smoke
  server, and the deployment contract documents Apache and Nginx rules.

### English UI and GitHub-style Activity refresh — 2026-09-18

- First-party source, PHP templates, tests, documentation, and comments were scanned and translated to English. `Résumé database` is retained as an English-language fixture that verifies accent-insensitive search.
- The Activity contract now documents a presentation-only five-level scale: 0, 1, 2–3, 4–6, and 7+ active completion facts. The underlying Activity ledger and monthly API semantics remain unchanged.
- Node tests passed 33/33, including exact intensity thresholds and Sunday-first complete-week layout. The Vite 8.2.2 production build passed with 23 transformed modules.
- PHPUnit passed 72 tests and 527 assertions against isolated MySQL `goals_test` after backend validation/error copy and fixtures were translated.
- Real Chromium rendered the Dashboard at 1440×900 and 360×800 in light and dark themes with no console errors or warnings. The calendar exposed all dates as grid cells with factual accessible names; a completed Task rendered the expected level-one cell and tooltip; previous-month navigation loaded August 2026 correctly.

## Historical Laravel R1 evidence — 2026-09-10

Verification date: 2026-09-10

## Runtime and database

- PHP 8.5.0 CLI with `pdo_mysql`, `mbstring`, `intl`, `fileinfo`, `xml`,
  `dom`, `gd`, and `zip`.
- Composer 2.8.12; Laravel 13.30.1; Node v22.22.2; npm 10.9.7; Vite 8.2.2.
- MySQL 8.4.11, databases `notes_dev` and `notes_test`, both
  `utf8mb4_0900_ai_ci`; transaction isolation `REPEATABLE-READ`.
- Database credentials remain in ignored local environment files. No password
  is stored in the repository; `phpunit.xml` only forces MySQL and
  `notes_test`.
- MySQL is installed and running on the host. The application uses its scoped
  `notes_dev`/`notes_test` accounts rather than the MySQL root account.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Fresh `notes_test` migration | Pass | `php artisan migrate:fresh --force --env=testing`; all 7 application migrations completed. |
| PHPUnit/MySQL suite | Pass | From `backend/`: 9 tests, 76 assertions after the architecture refactor. Includes registration field count, auth/session invalidation, note replay/conflict/tombstone, label ANY/ownership, private attachment replay/serving/tombstone, HTML spoof rejection, and avatar re-encoding. |
| JavaScript unit suite | Pass | From `frontend/`, `npm run test:unit`: 15 unit cases across 3 files covering debounce, max wait, immutable acknowledgements, retries, conflicts, normalization, and recovery storage. |
| Composer metadata | Pass | From `backend/`: `composer validate --strict`. |
| Composer platform | Pass | From `backend/`: `composer check-platform-reqs`; PHP 8.5 and required extensions reported successful. |
| PHP formatting | Pass | From `backend/`: `vendor/bin/pint --dirty --format agent`. |
| JS/CSS formatting | Pass | From `frontend/`: `npm run format:check`. |
| Production assets | Pass | From `frontend/`: `npm run build`; Vite emitted `backend/public/build/manifest.json` and hashed JS/CSS/font assets. |
| Configuration/routes/views | Pass | From `backend/`: config clear, 32 application routes, and Blade view cache pass while templates reside in `frontend/src/views`. |
| Real CSRF rejection | Pass | HTTP registration with a valid session/CSRF, then authenticated `PATCH /api/v1/profile` without token/origin: HTTP 419, `SESSION_EXPIRED`. |

For the extracted PHP runtime, the actual Laravel test invocation inherited a
temporary INI outside the project so `artisan test` could pass its PHP binary
and extensions to the child PHPUnit process. A normal PHP installation with
extensions enabled uses the commands in `Readme.txt` directly.

## Personal workload check

On a disposable account with 1,000 notes containing approximately 1 KiB-scale
text, 20 warm authenticated alternating list/search requests were measured
against the local built application:

| Metric | Observed |
| --- | ---: |
| Requests | 20 |
| Median | 0.017 s |
| p95 | 0.019 s |

The disposable account and its notes were deleted after measurement.

## Browser walkthroughs

The Playwright skill CLI ran the built application against real PHP/MySQL using
Firefox (the configured Chromium executable was unavailable, so the skill's
Firefox install was used). Normal-flow console checks reported zero errors.

| ID | Result | Observed evidence |
| --- | --- | --- |
| B01 | Pass for exercised path | Registration exposed four user inputs, auto-login and unverified banner worked, protected/login flow worked, and the real HTTP CSRF negative request returned 419. |
| B02 | Pass | Vietnamese/emoji/indentation/literal HTML was saved, closed, reopened, and displayed as literal text. Evidence: [B02-editor-saved.png](../output/playwright/B02-editor-saved.png). |
| B03 | Partial | Label creation/assignment, color, pin, grid/list switch and escaped card rendering passed. Full 31-note pagination and every literal search/filter variant were not walked manually. |
| B04 | Partial | Offline edit showed `Offline · retrying`; reconnect saved the latest body as the next version with no console errors. Full delayed-response and reload-recovery matrix remains unrun. |
| B05 | Partial | Two tabs produced an explicit server/local conflict chooser; choosing server worked. Deleting in one tab made a stale save show `Note is no longer available` without recreation. Evidence: [B05-conflict.png](../output/playwright/B05-conflict.png). The separate keep-local browser trial remains unrun. |
| B06 | Partial | Real UI upload of `Readme.txt` completed, card count updated, editor showed name/size/download link. Backend covers private serving/spoof/replay; browser video/Office/ZIP/byte-compare/avatar-failure cases remain unwalked. |
| B07 | Pass for exercised path | Theme/font/default-color/view persistence passed; password change logged out the other tab, new password login succeeded, and same-account recovery draft was surfaced then explicitly discarded. Evidence: [B07-preferences-dark.png](../output/playwright/B07-preferences-dark.png), [B07-password-session.png](../output/playwright/B07-password-session.png). |
| B08 | Partial | 360×800, 768×1024 and 1440×900 captures were inspected in dark/light states with no normal-flow console errors. Evidence: [B08-mobile.png](../output/playwright/B08-mobile.png), [B08-tablet.png](../output/playwright/B08-tablet.png), [B08-desktop.png](../output/playwright/B08-desktop.png), [B08-light-desktop.png](../output/playwright/B08-light-desktop.png). Full keyboard/focus-trap, 200% zoom and reduced-motion assertions remain. |
| B09 | Partial | Note deletion confirmation and label-delete cancellation were exercised; canceled label remained. Failure injection/retry coverage is backend/unit-tested but not fully walked through browser UI. |
| B10 | Partial | Built assets worked without Vite dev server; a second PHP server on port 8001 returned login 200, built manifest 200, and guest root 302. Fresh HTTP disposable accounts were used for CSRF/workload checks. A complete fresh-account search/file walkthrough on the alternate port remains unrun. |

## Security and integrity evidence

- Feature tests use an early guard that checks `APP_ENV=testing`, MySQL driver,
  configured `notes_test`, and actual `SELECT DATABASE()` before truncation.
- Owner scoping is applied to note, label, attachment, avatar and private file
  reads; resources do not expose password, private path or SHA-256 storage
  fields.
- Note create UUID replay, stale version conflict, tombstone 410, literal SQL
  wildcard search, attachment replay/delete, private download authorization,
  renamed HTML rejection and database-session invalidation are covered by
  MySQL feature tests.
- Code comments explain the non-obvious safety/lifecycle decisions in the
  owner lock, snapshot/normalization, test database guard, upload progress,
  recovery and stale-response paths.

## Remaining checks

The full matrix in [`docs/plan/08-verification.md`](plan/08-verification.md)
still has unrun exhaustive cases for label/file quotas and races, DB/storage
failure injection, cross-account browser file access, native video seeking,
all J01–J16 controlled event orders, all D/F/S/Q cases, and every B08
accessibility assertion. These are evidence gaps, not silently marked passes.

Intentional R1 exclusions are documented in
[`docs/plan/09-deferred.md`](plan/09-deferred.md): email verification/reset,
note-specific passwords, sharing/collaboration, WebSocket, email delivery,
PWA/offline service worker, AI, Docker Compose and public deployment.
