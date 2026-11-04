# Executed verification scope

[Testing](README.md) · [Audit history](../audit-history.md) · [Issue report](../issues.md)

## Goals UI unification — 2026-11-04

Branch feat/goals-ui-unification from main 52cb745. Frontend/views only, plus the HTTP shell marker and one meaningful sub-Goal payload regression; no backend runtime, API, route or schema change. Full required checks were run against the candidate; source traces were regenerated after dead duplicate form hooks were removed.

- `php vendor/bin/phpunit -c phpunit.xml` from backend: **159 tests / 1414 assertions passed**, PHP 8.5.0, 6m 17.761s. Integration/HTTP setup verifies actual goals_test before cleanup; the app database was not a cleanup target. Providers use fakes.
- `npm run test:unit`: **112 passed**. Full `npm run format:check`, production Vite build and changed PHP lint passed. An initial translation completeness failure exposed missing new Archive wording; added the Vietnamese keys and reran successfully.
- Documentation sync/check and `php tools/docs/tests/run.php`: all **17 isolated scenarios passed**. Generated source links include the new shared task-row/action-menu modules and floating editor ownership.
- Real browser on a dedicated 8002 server (8001 already occupied; 8000/8001 preserved), using the supplied demo account: created a throwaway Goal/Milestone/Task hierarchy; exercised Task tick/editor, Goal/Milestone Complete/Reopen, new sub-Goal parent and Milestone append context, Milestone Edit/Archive/pin, Area Rename/icon/stars and Escape inside its picker. Restored the original Area values. Strategy edits survived an intentionally induced 409 and explicit Keep my draft. Archived only the QA hierarchy.
- Captured 12 route/dialog states at 1440 and 390 widths in light and dark, with no horizontal page overflow. Representative desktop/mobile images were inspected and remain ignored local screenshots. No JavaScript errors; the only failing HTTP response was the intentional Strategy 409.

Limits: local supported-flow/browser evidence, not exhaustive lost-response/concurrency testing, every visual theme/browser, live SMTP/AI or production deployment. Archive tests use retained data through the ordinary APIs, not hard deletion. Diagram provenance and automation are separately recorded in the canonical receipts/index.

## Archify source refresh — 2026-11-04

Refreshed all nine maintained candidates against committed 45ed89671e5dcfb04cbebfd805c63219428c202e. Reviewed changed cited paths from b1b5f976 and inspected the committed snapshot independently of current quick-edit worktree changes. The former contract-only Task classification, daily/weekly and TaskSeries maps now include committed source citations. The diagram index declares current coverage and the pending quick-edit boundary; ISSUE-027/028 are resolved.

- All nine Archify finalize runs passed validate, deliver, strict provenance check and real-browser check. Canonical index.finalize-summary.json files bind current candidate/HTML hashes and point to fresh review-refresh-20261104-2 browser receipts.
- Initial browser discovery failed until ARCHIFY_CHROME explicitly selected the installed Playwright Chromium. Failed-run discovery directories were removed; earlier pre-refresh evidence was preserved.
- Documentation sync/check and all 17 isolated documentation-tool scenarios passed. No documentation-tool implementation changed.
- No app/database bootstrap, live AI/SMTP, application backend/frontend suite or perceptual screenshot review was performed. Artifact/browser checks do not establish application acceptance. Generated HTML/receipts were written only by Archify; cosmetic whitespace is tracked separately in ISSUE-007.

## Branch documentation audit — 2026-11-04

Inspected feat/quick-edit at 45ed896 (initially clean, same commit as local feat/calendar). Checked the documentation indexes, maintained decisions and sampled Calendar and AI source contracts. Recorded semantic drift as ISSUE-027; no runtime changes or exhaustive route-by-route acceptance review.

- `php tools/docs/check.php`: passed, 213 routes / 216 method-path pairs, 32 UI documents, 100 components, 206 source files, 9 diagram receipts and 218 unique manual cases.
- `php tools/docs/tests/run.php`: 17 passed, 0 failed, using isolated fixtures without application/database bootstrap.
- Documentation generation and the final checker were rerun after recording findings. No application PHPUnit/Node suite, browser, live provider, database or deployment verification was performed; earlier results below retain their original scope.

## AI branch integration — 2026-11-02

Integrated the local UI/documentation snapshot based on c21b4ec onto origin/feature/ai-assistant at fd2030c in an isolated worktree. The only Git conflict was the duplicate Habit archive fix; retained the remote implementation/comment and the local native-prepares regression. Kept local Dashboard/Tasks/Habits/Notes changes, reconciled the AI trace registry/manual contracts, and formatted assistant.js to the existing gate.

- Full PHPUnit on guarded real goals_test: **146 tests / 1265 assertions passed**, PHP 8.5.0, 4m 37.295s. Reflection verified classes loaded from the integration worktree, not the original checkout. Providers in deterministic tests use fakes; no live model acceptance is claimed.
- Full frontend Node runner: **91 passed**. Production Vite build, full frontend Prettier check, documentation sync/check and diff whitespace checks passed.
- Browser smoke used the candidate's built assets on a temporary local server with a separate QA account. Dashboard/Tasks/Habits/Notes rendered, the real disabled-provider state disabled chat submission, and intercepted AI responses exercised preview rendering, safe inline bold, exact version/hash on explicit Apply, and Cancel/Reject. Two fixture questions produced one explicit Apply and one Reject; zero live model calls. Mobile page overflow was absent.
- Limits: read/AI browser fixtures are not a live-provider end-to-end test or exhaustive regression of every local UI change. The original development checkout and its running server were preserved during preparation; its tracked/untracked snapshot was checked before checkout transition. No new migration was introduced by the AI branch.

## Habits actions and archive — 2026-11-02

Baseline c21b4ec plus the local Habits action layout and narrow archive-query correction. Theme, streak rules, date windows and other page implementations remain unchanged.

- HabitsRecurrenceTest on guarded real goals_test: **12 tests, 103 assertions passed**. The new native-prepares archive regression first reproduced HY093, then verified retained check-ins/rest/Activity, other Habits, version and timestamps after the fix. No full backend-suite claim is made.
- Focused habit-day/translation Node checks: **8 passed**; full frontend runner: **90 passed**. Touched PHP lint, scoped Prettier, production Vite build, documentation sync/check and diff whitespace checks passed.
- Real-browser isolated-account smoke: create, direct today check-in/undo and focus, Rest Day add/cancel, secondary Archive/cancel, Edit/save, Refresh, menu Escape and focus restoration. After the SQL fix, confirmation removed the QA Habit without an error and focused Refresh. Existing demo/roadmap data was untouched.
- Layout checked at 320/390/768/1440 widths, with no horizontal page overflow; compact calendars can scroll internally on very narrow screens. Mobile Edit kept Save visible. Desktop/mobile/Edit screenshots were inspected and remain ignored local artifacts. This is not an exhaustive theme/device/browser matrix.
- No existing diagram's topology or business-state contract changes for this action placement and SQL binding fix; diagram receipts remain checked by the documentation checker.

## Tasks UI implementation — 2026-11-02

Approved Tasks review implemented alongside the concurrent local Dashboard worktree; final verification uses baseline c21b4ec plus the uncommitted Tasks changes. No Dashboard browser module/template or backend runtime change was made for this Tasks work. A Tasks-only stylesheet is imported by the common CSS entry; existing shared feature styles were preserved.

- Full frontend Node runner: **90 tests passed**, including four new cases for Completed scope, stable account-timezone sorting, series search/state/count/paging, and chronological History/search/page clamping. PHP lint passed for the three touched templates. Scoped Prettier and production Vite build passed.
- Real-browser smoke on a separate local QA account: Today/Week capture defaults, preserved view/status, manual-selection facts, row/detail Today add/remove, Complete/Reopen, checklist creation, dedicated Notes with draft preservation across tabs and persisted explicit save. A simulated 503 on selection after a real creation verified acknowledgement without duplicate creation and an enabled next capture. Existing roadmap/demo records were untouched.
- Intercepted read fixtures (not backend acceptance): Completed Today scope and both pages; series All/Ended/search/count with terminal action visibility; History newest-first results, 12-row pagination, description search/page reset and expandable rules.
- Tasks inspected at 320/390/768/1440 widths without horizontal page overflow; native secondary-action disclosure worked by keyboard. Expanded mobile capture kept Create visible. Task detail and History were checked at mobile width; desktop/mobile screenshots were inspected and remain ignored local artifacts.
- Documentation sync/check passed: **201 routes / 204 method-path pairs, 30 UI documents, 89 components, 182 source files, 9 diagram receipts**. Task classification Archify finalize passed validation, delivery, strict artifact check and browser check; the passing receipts are in the [canonical receipt](../diagrams/task-planning/index.finalize-summary.json). Automated diagram checks are distinct from application browser smoke.

Limits: no backend test suite was rerun for this frontend-only change. Browser fixtures do not certify SQL/lifecycle transitions. No exhaustive theme/localization/device matrix, lost-create-response retry, series materialization or History pruning acceptance is claimed. Full Task capture uses a create request followed by a separate selection request; only the existing selection endpoint makes day/week membership atomic. Earlier backend evidence below belongs to its recorded scope.

## Earlier planning and Dashboard verification

Checked on 2026-11-02 (Asia/Saigon), against committed baseline 31947eb plus the local daily/weekly planning and Dashboard overview worktree. This is scoped execution evidence, not universal application acceptance.

| Check actually executed | Result |
| --- | --- |
| `php vendor/bin/phpunit -c phpunit.xml` from backend | Passed: 141 tests, 1222 assertions; 4m 28.683s on PHP 8.5.0 and guarded real goals_test |
| `npm run test:unit` from frontend | Passed: 83 tests |
| `npm run format:check` / `npm run build` | Passed |
| PHP lint for touched PHP runtime/routes/bootstrap/tests/migrations/views | Final scoped result below |
| Documentation checker / isolated CLI fixtures | Final regenerated results below |
| Archify Dashboard composition contract | Final automated receipt under the linked diagram folder |
| Migration 0026 on the live local app | Verified goals_dev and exact pending migration before applying; migration check passes; no Goal/Task rewrite or automatic roadmap selection |

Backend coverage includes the daily-selection/overdue policies from ISSUE-008 and the new Today denominator, 30-day window across year boundaries, zero/reversed facts and persisted owner-scoped roadmap choice. The new PATCH checks authentication/CSRF, malformed/unknown fields, foreign/archived IDs, unchanged Goal versions and explicit preference clearing. Integration cleanup verified the testing environment, configured goals_test and actual SELECT DATABASE()=goals_test; live goals_dev was never a cleanup target.

Browser QA used an isolated account. It verified empty invitations despite available Goals, selection/reload persistence, correct owned preview links and preservation of a newer choice when a deliberately held old Dashboard response arrives. Completing one of three Tasks produced 33% in both checklist summaries and one recent Activity contribution; filtering Week to Done left both summaries at 33%. Day details and View activity opened the full-year tab. Header → roadmap placement and responsive desktop/mobile layouts were inspected; global horizontal overflow was absent. Existing demo/roadmap records were not modified by these checks. Screenshots remain ignored local artifacts.

The existing illustrated panels, progress rings, native selects, activity colours and checklist/dialog controls were reused. Four-row previews and no automatic daily carry-forward remain. Live SMTP/AI, deployment, full concurrency/failure injection and all-feature browser acceptance are outside this scope. The source-trace checker certifies registered links/routes/receipts, not business correctness.

[ISSUE-007](../issues.md#issue-007--staged-generated-documents-contain-cosmetic-whitespace) remains open for cosmetic whitespace in generated diagram HTML. Preserve delivered bytes and valid receipts rather than hand-editing generated HTML. Prior executed totals belong to their audit/issue scopes; they do not independently certify this worktree.
