# Issue report

[Documentation home](README.md) · [Verification limits](testing/verification-limits.md)

This is the shared issue register for the repository. Record newly discovered bugs, UI/API inconsistencies, documentation defects, operational problems and unresolved requirement ambiguities here during the work that reveals them. Recording an issue does not authorize an implementation change.

## Reporting rules

- Search for an existing entry before adding one. Use a stable `ISSUE-NNN` ID and update its status in place.
- Record the discovery date, affected route/component, observed behavior, expected behavior or pending decision, impact, source/test links and verification evidence.
- Distinguish reproduced failures, source-inspected findings and unverified reports. Missing test coverage alone is an evidence gap, not proof of a defect.
- State the proposed next step and resolution criteria. Ask the user when product intent is unclear; do not silently choose behavior.
- Record issues even when fixed in the same task. Mark Resolved only with the actual change and verification evidence; do not remove the entry or call a recommendation an implemented fix.
- Keep passwords, OTPs, tokens, personal content and other secrets out of reports. Link to the affected UI trace so discovery can start from the interface.
- Keep issue details here. UI docs and verification guides link to the entry instead of maintaining duplicate reports.

Statuses: **Open**, **Needs decision**, **In progress**, **Resolved**, **Closed without change**. Evidence and implementation status are separate fields.

## Severity

Severity describes impact, not implementation status or proof of reproduction. **Critical** means demonstrated widespread outage, serious data loss or exposure; **High** means a core workflow is unusable or materially corrupts data; **Medium** means a limited workflow/state inconsistency with meaningful impact; **Low** means a limited consistency, documentation or tooling defect without demonstrated direct product damage. Reassess when reproduction or impact evidence changes.

The severity assessments below describe observed impact, not a completed security or production audit. No open entry currently has evidence warranting High or Critical severity.

## Current issues

| ID | Issue | Severity | Status | Evidence |
| --- | --- | --- | --- | --- |
| [ISSUE-001](#issue-001--habit-timezone-alias-is-not-always-canonicalized) | Habit timezone alias is not always canonicalized | Low | Resolved | Canonicalization and legacy compatibility verified; full backend suite passes |
| [ISSUE-002](#issue-002--ended-taskseries-has-inconsistent-uiapi-transition-rules) | Ended TaskSeries has inconsistent UI/API transition rules | Medium | Resolved | Terminal guard, ownership/version, replay and preservation verified; full backend suite passes |
| [ISSUE-003](#issue-003--component-traces-can-target-ambiguous-or-overly-broad-source-references) | Component traces can target ambiguous or overly broad source references | Low | Resolved | Registered source references are unique; relevant methods/tests selected; regression checks pass |
| [ISSUE-004](#issue-004--duplicate-document-owners-can-overwrite-generated-trace-blocks) | Duplicate document owners can overwrite generated trace blocks | Low | Resolved | Generator/checker reject duplicate ownership in isolated regression cases |
| [ISSUE-005](#issue-005--residual-known-issues-page-mixes-reporting-with-retired-contract-history) | Residual known-issues page mixes reporting with retired contract history | Low | Resolved | Central issue register and focused verification-limits guide; caller/link checks pass |
| [ISSUE-006](#issue-006--dashboard-habit-fixture-assumes-tuesday-is-not-in-the-future) | Dashboard Habit fixture assumes Tuesday is not in the future | Low | Resolved | Fixed-time fixture and full backend suite pass; production date guard unchanged |
| [ISSUE-007](#issue-007--staged-generated-documents-contain-cosmetic-whitespace) | Staged generated documents contain cosmetic whitespace | Low | Open | Full staged diff check reports trailing whitespace and blank lines at EOF; artifact receipts remain valid |

## ISSUE-001 — Habit timezone alias is not always canonicalized

- **Status:** Resolved.
- **Severity:** Low. The recorded failure concerns canonical identifier consistency and a regression-test expectation. No incorrect check-in date, loss of data or unauthorized access is established by the current evidence. A failing required test may still block a release gate.
- **Recorded:** 2026-11-02 (Asia/Saigon); migrated from the existing known-issues document.
- **Affected UI:** [Habits](ui/habits/README.md), including browser timezone input such as `Asia/Saigon`.
- **Observed:** A prior full backend run on PHP 8.5.0 failed `HabitsRecurrenceTest::test_habit_accepts_browser_time_zone_alias_as_canonical_identifier`: expected `Asia/Ho_Chi_Minh`, actual `Asia/Saigon`.
- **Original cause:** [HabitService::timezone](../backend/src/Application/Habits/HabitService.php) and [TaskSeriesService::timezone](../backend/src/Application/Recurrence/TaskSeriesService.php) returned directly accepted aliases before reaching [TimeZoneNames](../backend/src/Support/TimeZoneNames.php) canonicalization.
- **Expected:** Accept supported browser aliases and serialize the canonical identifier required by the existing test.
- **Impact:** Stored/returned identifiers can depend on the PHP/tzdb environment and differ from the canonical API expectation.
- **Reproduction:** The original alias test failed on PHP 8.5.0 before the fix: expected Asia/Ho_Chi_Minh, actual Asia/Saigon. New pre-fix regressions also exposed the legacy checked-in Habit edit incompatibility.
- **Resolution:** Canonicalize both successfully accepted inputs and fallback aliases. Preserve accepted fixed offsets. Equivalent timezone input for a checked-in legacy Habit retains the exact stored timezone, history and Activity; a genuinely different timezone remains forbidden. No historical data backfill is included.
- **Verification:** The focused Habit/recurrence integration and Planning HTTP files pass: 15 tests, 156 assertions on guarded goals_test. They cover aliases/canonical names/UTC/fixed offsets, invalid input, legacy edits and unchanged history. The full backend suite also passes: 131 tests, 1118 assertions. See [executed checks](testing/documentation-checks.md) for scope.
- **Approved scope:** Apply the same canonicalization boundary to Habit and TaskSeries inputs, preserve accepted-input fallback and existing timezone-freeze rules, and test alias/canonical/UTC/invalid inputs. Historical check-in dates, generated UTC occurrences and account data are outside this fix; any backfill requires a separate reviewed procedure.
- **Resolution criteria:** The [existing alias regression test](../backend/tests/Plain/Integration/HabitsRecurrenceTest.php) and relevant timezone checks pass after a verified implementation change. Preserve the failing expectation until that evidence exists.

## ISSUE-002 — Ended TaskSeries has inconsistent UI/API transition rules

- **Status:** Resolved.
- **Severity:** Medium. An authenticated owner with a current version can request a transition hidden by the UI, violating the apparent lifecycle rule. No cross-account access or data-loss impact has been established; an Active label alone does not prove new occurrences will be generated because the existing end date still applies.
- **Recorded:** 2026-11-02 (Asia/Saigon); migrated from the existing known-issues document.
- **Affected UI:** [Tasks → Repeating](ui/tasks/repeating.md), Pause/Resume/End controls.
- **Original discrepancy:** [The series list](../frontend/src/js/planning/series-list.js) hides Pause/Resume for Ended series, but [TaskSeriesService::transition](../backend/src/Application/Recurrence/TaskSeriesService.php) previously accepted those actions.
- **Approved behavior:** Ended is terminal. The user authorized implementation of the proposed fix on 2026-11-02; future repeating work requires a new series. Preserve current ownership/version checks and valid same-state no-ops.
- **Impact:** A direct API call can follow a transition that the UI does not offer. The UI lifecycle diagram is not evidence of backend terminality enforcement.
- **Reproduction:** A new service regression failed before the fix because an Ended series accepted Pause. Only isolated test fixtures were mutated; the live demo series was untouched.
- **Resolution:** Added a terminal-state guard after owned row locking and version validation, before writes. Ended Pause/Resume returns 422; ownership 404 and stale-version 409 retain precedence. Valid current-version End replay and existing same-state transitions remain no-ops. Updated the [UI trace](ui/tasks/repeating.md), manual checklist and [Archify contract map](diagrams/task-series-lifecycle/index.html).
- **Verification:** The focused 15-test/156-assertion run covers service/HTTP transitions, authentication/CSRF, ownership/version precedence, unchanged rows/versions/Activity after rejection, End replay and preservation of started/Done occurrences. The full backend suite passes: 131 tests, 1118 assertions; see [executed checks](testing/documentation-checks.md). No live-series mutation or full browser walkthrough was performed.
- **Resolution criteria:** Approved transition behavior is enforced by the backend, tested for the relevant starting states and ownership/version boundaries, and reflected in the UI and lifecycle documentation.

## ISSUE-003 — Component traces can target ambiguous or overly broad source references

- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected UI:** Cross-route source traces, especially [Task filters](ui/tasks/filters.md) and Task/Review editing.
- **Observed:** The registry uses ambiguous strings such as `test(`, `attachment` and repeated DOM-attribute prefixes. The generator chooses the first matching line, and the checker previously verified only presence. Some persistence references target class headers; the reminder trace names the Planning repository rather than the dedicated Reminder repository, and the logout trace names the Account repository rather than the session deletion path.
- **Expected:** Each reference identifies a unique useful location. Tests point to relevant named cases; persistence traces follow the actual reader/writer. Pure client calculations or pure previews do not imply an unrelated SQL query.
- **Impact:** A link can exist and pass checks while taking a person/agent to the wrong implementation or test.
- **Evidence:** A source audit counted 40 distinct ambiguous `(path, symbol)` patterns. [The trace registry](traceability.json), [generator](../tools/docs/sync.php) and [checker](../tools/docs/check.php) provide the inspected evidence.
- **Resolution:** Refined all 83 components to unique useful references; selected named regression cases, corrected reminder/logout persistence owners, removed implied persistence from pure preview, added targeted CSS and helper-versus-browser coverage notes, and generated component/source lookup indexes. Both generator and checker reject ambiguous references.
- **Verification:** All registered references have exactly one match; no bare `test(` or persistence class-header targets remain. `php tools/docs/check.php` and all 17 isolated documentation-tool scenarios pass. This documentation-only evidence does not certify the linked business behavior; later backend checks are separately scoped in [executed checks](testing/documentation-checks.md).
- **Resolution criteria:** No ambiguous references remain, relevant source/test targets are selected, generated docs are refreshed, and negative fixtures demonstrate rejection of missing/ambiguous references and route/diagram drift.
- **Prevention:** Keep exact unique symbols and named cases in the registry, regenerate links after source moves, and require the documentation checker in the review workflow. Review semantic ownership as well as uniqueness: a unique link can still name an unrelated function. CI integration is a proposed follow-up, not an installed gate.

## ISSUE-004 — Duplicate document owners can overwrite generated trace blocks

- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected component:** Documentation trace generation and page ownership in [traceability.json](traceability.json).
- **Observed:** [The generator](../tools/docs/sync.php) previously keyed output by document path without rejecting two page records owning the same path. The last generated block could silently replace the earlier one; the checker also lacked a duplicate-document guard.
- **Expected:** One owning page record per UI document. Both generation and checking must reject duplicate ownership before accepting or writing generated results.
- **Impact:** A registry edit could remove valid component traces from a generated page while source references still existed.
- **Evidence:** Source-inspected overwrite behavior; the isolated documentation fixture exercises duplicate owners without changing the live registry or app.
- **Resolution:** Added duplicate-page ownership guards to generation and checking. Generation builds results before writing, so duplicate owners fail before output replacement.
- **Verification:** Both commands reject the duplicate-owner fixture with the intended diagnostic; healthy regeneration and label/anchor/index refresh pass within the 17-case runner.
- **Resolution criteria:** Both commands reject duplicate ownership and healthy regeneration still refreshes component/index links successfully.
- **Prevention:** Keep page ownership validation before output writes and retain both checker/generator duplicate-owner fixtures plus the healthy regeneration case. Review future schema/generator changes against those cases.

## ISSUE-005 — Residual known-issues page mixes reporting with retired contract history

- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected area:** Documentation navigation and issue-reporting ownership.
- **Observed:** The former testing known-issues page still combines links to the new issue register, verification limits and a comparison with retired plans. This leaves two apparent starting points for reporting problems and retains historical contract comparisons in the active docs.
- **Expected:** [Issue report](issues.md) is the single issue register. A separate testing guide describes verification limits without duplicating issue reports or retired contract history.
- **Impact:** People/agents may report into the wrong page or treat retired statements as active requirements.
- **Evidence:** Documentation/source-link audit; no application behavior is involved.
- **Resolution:** Removed the residual page and retired-contract comparison, added [verification limits](testing/verification-limits.md), and redirected feature/agent/skill links to the central issue or the focused limits guide. The checker prevents accidental reintroduction of the retired duplicate page.
- **Verification:** All current Markdown links pass; the retired-page negative fixture fails as intended. The updated testing skill validator passes.
- **Resolution criteria:** No live links target the retired page, issue details remain centralized, and documentation/skill checks pass.
- **Prevention:** Keep issue details in this register, behavior in the owning UI document and evidence boundaries in the verification-limits guide. Update callers and run link/retired-page checks whenever a document is moved or removed.

## ISSUE-006 — Dashboard Habit fixture assumes Tuesday is not in the future

- **Status:** Resolved.
- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected test:** [DashboardReviewsTest::test_dashboard_shows_every_habit_with_period_specific_counts_and_streaks](../backend/tests/Plain/Integration/DashboardReviewsTest.php).
- **Observed:** The fixture uses SystemClock and checks in on Tuesday of the current week. On Monday 2026-11-02, Tuesday is future, so the valid future-date guard raises ValidationException before the Dashboard assertions run.
- **Severity:** Low product impact; calendar-dependent test failure can block verification/release gates. No incorrect application rejection is established.
- **Evidence:** Full backend run reported 131 tests, 1112 assertions and this one error at the future weekly check-in. The targeted issue-fix tests had passed separately.
- **Expected:** The same factual Habit/weekly/streak assertions run deterministically on every weekday while future check-ins remain forbidden.
- **Resolution:** Injected a fixed Wednesday Clock into the Habit/progress/Dashboard services used by this fixture. The assertions retain the original facts: all active Habits, daily count/streak and two distinct weekly check-ins. Production clocks, bootstrap and future-date validation are unchanged.
- **Verification:** The formerly failing case passes: 1 test, 7 assertions. The final full backend run passes: 131 tests, 1118 assertions. See [executed checks](testing/documentation-checks.md) for the exact scope.
- **Resolution criteria:** The failing case and full backend suite pass with deterministic fixture time; no production clock/bootstrap or validation behavior changes are needed.

## ISSUE-007 — Staged generated documents contain cosmetic whitespace

- **Status:** Open.
- **Severity:** Low; formatting-only finding without demonstrated runtime or navigation impact.
- **Recorded:** 2026-11-02, during pre-push staging review.
- **Affected area:** Archify HTML under [diagrams](diagrams/README.md), generated UI Markdown and [documentation generation](../tools/docs/sync.php).
- **Observed:** `git diff --cached --check` reports trailing whitespace in delivered Archify HTML and additional blank lines at EOF in generated Markdown. Earlier unstaged `git diff --check` did not inspect untracked new files, so its pass was narrower than a full publication check.
- **Expected:** Authored/generated documentation should have clean whitespace, with final artifact hashes matching Archify receipts.
- **Evidence:** Full staged diff inspection; documentation checker still passes and diagram candidate/artifact hashes match receipts. No application defect is established.
- **Next step:** Normalize Markdown output in the generator and address HTML whitespace through the Archify delivery workflow, regenerating final receipts after any artifact change. Do not silently edit delivered HTML and invalidate receipts.
- **Resolution criteria:** A full staged whitespace check passes, healthy/negative documentation-tool tests pass and all final diagram receipts remain valid.

## New issue template

```text
ISSUE-NNN — Concrete title
Status:
Severity and impact rationale:
Recorded date / environment / revision:
Affected route / component Trace ID:
Observed behavior:
Expected behavior or pending decision:
Impact:
Evidence type: reproduced / source-inspected / unverified report
Reproduction steps or inspected source/test links:
Evidence limits:
Proposed next step:
Resolution criteria:
Resolution and verification evidence (when resolved):
```
