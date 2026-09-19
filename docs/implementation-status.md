# Implementation Status

Updated: 2026-09-18.

## Current application baseline

The framework-free PHP application is the only active runtime. M00 through M10
are implemented and verified; account, Notes/Tags, private files, planning,
Habits/recurrence, Dashboard/Reviews, approval-gated AI, templates, assets,
routes, CLI, and tests run without Laravel or Illuminate packages.

Verified during repository audit:

- PHPUnit: 72 tests, 527 assertions passed against guarded MySQL 8.4
  `goals_test`.
- JavaScript: 33 tests passed; Prettier and the Vite 8.2.2 production build
  passed.
- Composer validation/platform checks and a clean 15-package production
  install passed.
- 146 canonical first-party PHP files passed syntax validation.
- 125 application routes and five checksum-verified migrations are active.
- Firefox 155 critical paths passed with zero console errors or warnings.

Historical browser evidence and limitations remain in `docs/verification.md`.

## Documentation work

| Work | Status | Evidence |
| --- | --- | --- |
| Repository audit | Verified | `docs/plan/00-repository-audit.md` |
| Complete migration plan | Verified | `docs/migration-plan.md` |
| Active project instructions synchronized | Verified | `PLAN.md`, `AGENTS.md`, `agent.md` |
| Target contracts and file map | Verified | `docs/plan/01`–`18` |
| Phase execution specs | Verified | `docs/plan/phases/M00`–`M10` |
| Documentation structure/link validation | Verified | 49 active Markdown/text/rule files checked; 0 missing local links, 0 unbalanced code fences, all M00–M10 phase templates complete, all 39 migration-plan sections present; `git diff --check` passed |
| Hosting and startup runbook | Updated | Added `docs/hosting.md` with first-install, subsequent-start, production PHP-FPM, scheduler, backup/restore, account bootstrap, troubleshooting, and verification procedures; linked from `README.md`, `Readme.txt`, and `docs/plan/15-operations.md`. |

## Migration ledger

| Phase | Status | Evidence/blocker |
| --- | --- | --- |
| M00 Baseline | Verified | 2026-09-17: Laravel PHPUnit 35/385, JS 27/27, Composer/platform/format/build/routes/syntax passed; dirty tree preserved |
| M01 Foundation | Verified | Plain config/PDO/transaction/migration/CLI/autoload implemented; PHPUnit 13 tests/47 assertions; disposable MySQL 8.4 fresh/no-op/status/check passed |
| M02 HTTP/Auth | Verified | Plain router/request/response/errors, encrypted PDO sessions, CSRF/origin, rate limits, auth/account implemented; plain PHPUnit 24/106, real HTTP registration/session/419 passed; legacy 35/385 still green |
| M03 Notes/Tags | Verified | Plain owner-scoped PDO Notes/Labels, snapshot replay/no-op/conflict/tombstone, literal search/filter/pagination, quotas/versioning and secure browser UUIDs implemented; plain PHPUnit 29/210, JS 30/30, legacy 35/385, format/build/syntax/Composer passed |
| M04 Files | Verified | Canonical private storage, validation/re-encoding, attachment/avatar transactions and compensation, range/HEAD streams, cleanup/prune implemented; plain PHPUnit 39/365 including concurrent quota/delete races, real HTTP 200/206/HEAD, prune twice, legacy 35/385 |
| M05 Cutover | Verified | Canonical PHP templates/entry/bootstrap/routes/PHPUnit/CLI active; PHPUnit 43/389, JS 30/30, native Vite build and real Firefox registration/Notes autosave passed with zero console errors; Laravel/Illuminate dependency and source scans clean |
| M06 Planning | Verified | 2026-09-18: Areas/Goals/Milestones/Tasks/Checklist/Task Note/Tags, graph guards, dependencies, contributions, progress, owner scoping and UI implemented; `PlanningDomainTest`, `PlanningCoreTest`, and `PlanningHttpTest` pass in the 72/527 suite; Firefox planning flow passed |
| M07 Habits/Recurrence | Verified | 2026-09-18: dedicated Habits, idempotent check-in reversal, daily/weekly calculator, series lifecycle/materializer and UI implemented; recurrence unit/integration cases pass; Firefox check-in/undo and weekly preview/create/pause/resume passed |
| M08 Dashboard/Reviews | Verified | 2026-09-18: activity ledger, weekly selections, Dashboard, Goal snapshots, daily/weekly/monthly Reviews and stable finalization implemented; `DashboardReviewsTest` passes; the refreshed GitHub-style monthly calendar has documented intensity thresholds and unit/browser coverage; Firefox activity/selection and Review finalize/reopen passed |
| M09 AI | Verified | 2026-09-18: provider interface, disabled/Google adapters, selected immutable context, proposal schema validation, approval/rejection/replay and atomic application implemented; `AIActionTest` covers malformed/stale/foreign/cyclic/rollback paths; disabled-provider browser failure was safe |
| M10 Acceptance | Verified | 2026-09-18: fresh/repeat migrations, full suites, clean install, production HTTP/assets, maintenance commands, framework/secret/license scans, backup/restore, cross-account probe, responsive/dark/keyboard/zoom browser checks passed; optional live Google call and Apache-specific runtime remain explicitly unrun |

## English interface and Activity calendar refresh

Verified on 2026-09-18 after the M10 baseline:

- All first-party PHP, JavaScript, PHP templates, tests, documentation, and developer comments were audited for Vietnamese interface text and translated to English. The one accented test fixture, `Résumé database`, remains intentional English-language coverage for accent-insensitive search.
- The monthly Activity widget now follows GitHub's contribution-calendar visual model: Sunday-first weeks as columns, Monday/Wednesday/Friday labels, the GitHub light/dark green scales, factual hover/focus tooltips, month navigation, a completion summary, and a Less/More legend.
- `npm run test:unit` passed 33 tests, including calendar layout and intensity-threshold cases; Prettier and the Vite production build passed.
- `vendor/bin/phpunit -c phpunit.xml` passed 72 tests and 527 assertions against isolated MySQL `goals_test`.
- Real Chromium checks at 1440×900 and 360×800 passed in light and dark themes with zero console errors or warnings. A completed Task produced the expected level-one day and factual tooltip, and previous-month navigation loaded the requested bounded month.

## Whole-application interface redesign

Verified on 2026-09-18 after the English-interface refresh:

- Updated the UI contract before implementation. The existing frontend stack now shares an ocean/slate palette, Noto Sans type scale, local SVG icons, a compact sidebar, and a page bar. Dashboard, Goals, Tasks, Habits, Reviews, AI, Notes, settings, and authentication adopt the same visual system.
- Dashboard prioritizes today's work, preserves the monthly GitHub-style Activity semantics, links real task/milestone rows to their detail context, and has actionable empty states. Month/refresh requests are serialized, successful retries clear errors, and tooltips are positioned outside the scrolling calendar.
- Mobile navigation is shared across all authenticated pages, with focus containment, Escape/return-focus, inert background, and desktop-resize cleanup. Notes tag management remains accessible on mobile.
- Fixed the remaining Vietnamese date locale, dark-theme colored-note selectors, and a demonstrated startup race where a new Note's recovery record could be offered as an older draft. New note creation now waits for the startup recovery check.
- Full PHPUnit: 72 tests / 527 assertions on isolated MySQL `goals_test`; focused HTTP/View/Dashboard tests also passed 17 / 119. Node tests: 33 / 33. Production build, formatting, Composer validation/platform checks, and syntax validation of 149 first-party PHP files passed.
- Real Chromium checked 10 authenticated pages at widths 1440, 768, and 360: all 30 navigations returned 200 without horizontal document overflow. Light/dark screenshots, mobile keyboard navigation, task creation/checklist/completion/weekly selection, Goal creation, Habit check-in, Review draft/save, Note autosave, and a delayed-start Note recovery regression were exercised.
- A simulated Dashboard 503 displayed an error, left Refresh usable, and cleared the error after a successful retry. The intentionally injected failed request is excluded from normal-flow console results.
- Updated `README.md`, `docs/interface-guide.md`, UI/autosave contracts, and verification evidence. Generated browser artifacts and local credentials remain untracked and ignored.

Do not mark a phase Verified without the exact gate in `docs/plan/08-verification.md`.
