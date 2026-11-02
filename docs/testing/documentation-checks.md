# Executed verification scope

[Testing](README.md) · [Maintenance](../maintenance.md) · [Issue report](../issues.md)

Checked on 2026-11-02 (Asia/Saigon), against committed baseline b1b5f976a9efdba105d7de6b7dd4417a5e52f74f plus the local worktree. Evidence below covers the documentation refactor and the approved ISSUE-001/002 fixes. It is not a universal application acceptance report.

## Backend issue fixes

The runtime changes are limited to HabitService timezone/legacy-input compatibility and TaskSeriesService timezone/terminal-state validation. Tests add service/HTTP regressions and make one existing Dashboard fixture independent of the host weekday. Existing Vite/CSP/auth-template edits were preserved.

Commands below ran from backend unless a repository-root path is shown. MySQL cleanup targeted only goals_test: the testing environment, configured database and actual SELECT DATABASE() were checked before execution. The running goals_dev database was not used by the test suite.

| Check actually executed | Result |
| --- | --- |
| Original timezone alias regression before the fix | Failed as expected: expected Asia/Ho_Chi_Minh, actual Asia/Saigon |
| New focused service regressions before the fix | 4 tests, 24 assertions; alias and terminal-state failures plus legacy frozen-Habit edit error reproduced |
| `php vendor/bin/phpunit -c phpunit.xml tests/Plain/Integration/HabitsRecurrenceTest.php tests/Plain/Http/PlanningHttpTest.php` | Passed: 15 tests, 156 assertions |
| First `php vendor/bin/phpunit -c phpunit.xml` | 131 tests, 1112 assertions, one calendar-dependent Dashboard fixture error; recorded as ISSUE-006 |
| Dashboard case after fixed Clock injection | Passed: 1 test, 7 assertions; production future-date guard retained |
| Final `php vendor/bin/phpunit -c phpunit.xml` | Passed: 131 tests, 1118 assertions; 3m 47.623s |

The targeted cases exercise canonical aliases/UTC/fixed offsets, invalid input, legacy checked-in Habit edits without history rewrites, terminal Ended rejection, authentication/CSRF/ownership/version precedence, same-state replay and occurrence preservation. No historical timezone backfill or application migration was required. Test setup applies migrations only within goals_test.

## Documentation and artifacts

| Check actually executed | Result |
| --- | --- |
| `php tools/docs/check.php` | Passed: 197 route declarations / 200 method-path pairs, 30 UI documents, 83 components, 168 referenced source files, 8 diagram receipts and 195 unique manual case IDs; source references and local links/anchors valid |
| `php tools/docs/sync.php --write` and `php tools/docs/sync.php` | Refreshed generated source/test anchors; zero stale outputs |
| `php tools/docs/tests/run.php` | Passed: 17 isolated positive/negative CLI scenarios; no secrets, application bootstrap or database |
| Archify finalize for the terminal TaskSeries contract map | All four gates passed: validate, deliver, strict artifact/provenance check and browser check; exact hashes match the final receipts |
| PHP lint for the two changed services and three test files | Passed |
| Unstaged `git diff --check` before publication | Passed for tracked edits; did not include then-untracked documents |
| Full `git diff --cached --check` during publication | Reports cosmetic whitespace in generated HTML/Markdown; recorded as ISSUE-007; artifact bytes preserved to retain valid receipts |
| `GET http://localhost:8000/up` and original PHP/Vite process inspection | Health data.status=ok; existing host remains running |
| Runtime source/config SHA-256 comparison with the snapshot before these issue fixes | Only HabitService.php and TaskSeriesService.php changed; unrelated runtime edits preserved |

The documentation refactor also checked the route inventory against the runtime route command, preserved all 195 manual case IDs, validated the rewritten testing skill and finalized the other seven diagrams. Those diagrams cite their pinned committed revision. The replacement [terminal TaskSeries map](../diagrams/task-series-lifecycle/index.html) explicitly describes the approved contract without attributing uncommitted implementation bytes to that earlier revision.

Component/source indexes come from the UI registry. Named test pointers, corrected persistence owners and helper-versus-browser coverage notes address [ISSUE-003 through ISSUE-005](../issues.md). Documentation-tool fixtures reject ambiguous/missing source references, duplicate document ownership and route/link/diagram drift.

## Limits

No live account/series mutations, scheduler/prune jobs, SMTP/AI delivery checks, browser feature walkthrough or perceptual visual audit were performed for these fixes. Manual checklist items remain unchecked. The backend suite certifies its exercised paths on PHP 8.5.0 and isolated MySQL, not deployment configuration or every browser interaction. Archify browser checks validate the diagram artifacts.

Retired documentation/private local evidence was backed up outside the repository before removal; no historical archive was added to active docs. These checks were recorded before publication; subsequent commits and pushes are tracked by Git history.
