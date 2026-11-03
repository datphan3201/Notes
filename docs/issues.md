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
| [ISSUE-008](#issue-008--today-task-capture-and-membership-are-not-clear-in-the-ui) | Today task capture and membership are not clear in the UI | Low | Resolved | Approved daily/weekly checklist, selection and overdue policies implemented; PHP/Node/browser checks pass |
| [ISSUE-009](#issue-009--dashboard-roadmap-has-no-explicit-account-level-selection) | Dashboard roadmap has no explicit account-level selection | Low | Resolved | Explicit saved selection and header placement implemented; service/HTTP/browser checks pass |
| [ISSUE-010](#issue-010--dashboard-today-mixes-week-content-habits-are-not-actionable-and-week-lacks-the-today-template) | Dashboard Today mixes week content, Habits are not actionable and Week lacks the Today template | Low | In progress | Implemented; Node/build/lint pass; MySQL and browser verification pending |
| [ISSUE-011](#issue-011--tasks-completed-section-does-not-follow-the-selected-time-view) | Tasks Completed section does not follow the selected time view | Low | Resolved | View-scoped helper regression and browser scope/paging pass |
| [ISSUE-012](#issue-012--repeating-exposes-inapplicable-task-filters-and-a-different-count-scope) | Repeating exposes inapplicable Task filters and a different count scope | Low | Resolved | Applicable series filters/count/paging verified with Node and browser fixtures |
| [ISSUE-013](#issue-013--tasks-planning-and-retrieval-affordances-are-inconsistent-across-screens) | Tasks planning and retrieval affordances are inconsistent across screens | Low | Resolved | Approved layout implemented; local browser, Node, lint/build checks pass |
| [ISSUE-014](#issue-014--archify-update-receipts-and-docs-checker-use-different-default-paths) | Archify update receipts and docs checker use different default paths | Low | Resolved | Explicit canonical receipt plus fresh browser directory; maintenance command documented |
| [ISSUE-015](#issue-015--habit-actions-have-unclear-hierarchy-and-inconsistent-check-in-behavior) | Habit actions have unclear hierarchy and inconsistent check-in behavior | Low | Resolved | Direct check-in, secondary Rest day/Archive, responsive and keyboard browser smoke |
| [ISSUE-016](#issue-016--habit-archive-fails-with-native-pdo-prepares) | Habit archive fails with native PDO prepares | Medium | Resolved | Reproduced HY093; distinct SQL bindings; integration regression and live browser archive pass |
| [ISSUE-017](#issue-017--notes-controls-have-redundant-placement-and-unclear-save-wording) | Notes controls have redundant placement and unclear Save wording | Low | Needs decision | Screenshot/template review; Save invokes the close workflow |
| [ISSUE-018](#issue-018--notes-pagination-omits-the-current-middle-page-and-localized-labels) | Notes pagination omits the current middle page and localized labels | Low | In progress | Fix implemented with unit tests; browser verification pending |
| [ISSUE-019](#issue-019--notes-layout-preferences-do-not-refresh-the-visible-layout) | Notes layout preferences do not refresh the visible layout | Low | In progress | Fix implemented; browser verification pending |
| [ISSUE-020](#issue-020--ai-branch-generated-traces-still-describe-pre-agent-capabilities) | AI branch generated traces still describe pre-agent capabilities | Low | Resolved | Reconciled trace registry/manual cases with imported chat proposal implementation; source checks pass |
| [ISSUE-021](#issue-021--demo-review-snapshots-do-not-match-the-runtime-schema) | Demo Review snapshots do not match the runtime schema | Medium | Resolved | Reproduced serializer failure; corrected demo builder, guarded data repair and regression/UI checks pass |
| [ISSUE-022](#issue-022--dashboard-activity-and-weekly-charts-are-hard-to-read) | Dashboard Activity and Weekly charts are hard to read | Low | Resolved | Shared heatmap palette, balanced card layout and readable weekly columns; responsive browser checks |
| [ISSUE-026](#issue-026--ai-assistant-cannot-build-a-goal-roadmap-and-restructures-by-deleting-tasks) | AI assistant cannot build a Goal roadmap and restructures by deleting Tasks | High | Resolved | Integration tests cover roadmap, refs, moves and guards; scripted provider only |

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

## ISSUE-008 — Today task capture and membership are not clear in the UI

- **Status:** Resolved.
- **Severity:** Low; missing direct planning actions and inconsistent/discoverability behavior, without demonstrated Task loss.
- **Recorded:** 2026-11-02, from the user's report and Dashboard screenshot.
- **Affected UI:** [Dashboard Today/This week](ui/dashboard/README.md), [Task time views](ui/tasks/filters.md), [Task history](ui/settings/history.md).
- **Original behavior:** Today/Needs attention used different date/overdue projections; Today/Week rows looked like checklists but navigated to detail instead of completing work. There was no direct day selection, task capture reset navigation to All, and Reopen could leave the same overdue deadline in place. All old overdue Tasks stayed in the Dashboard reminder despite History thresholds.
- **Approved policy:** On progress means InProgress. Add for today preserves dates/status and also selects the week. Scheduled is a planned start/occurrence or overlapping work interval; a deadline today is Due today. Overdue reminders stop at History boundaries and become encouragement at zero. Reopen requires a non-past replacement deadline or explicit removal of an old overdue date. No automatic carry-forward or preview-size increase.
- **Resolution:** Added owner-scoped daily selection/capture with atomic week membership and migration 0025; adjacent interactive checklists, two independent Week selects, factual labels and a compact reminder; retained overdue work is reachable through Tasks → Overdue. Reopen uses the existing workspace-dialog style and version/ancestor acknowledgement rules, updates dates/status atomically and does not fabricate completion reversals for unfinished work. Help, translations and source traces were updated.
- **Verification:** Full PHPUnit: 138 tests, 1190 assertions on guarded goals_test; Node: 80 tests; frontend build/format and touched-PHP lint pass. Browser QA verified capture, Week → Today, removal without unpinning Week, synchronized completion/reopen, independent filters, schedule/due/overdue labels, canceled/replanned Reopen and mobile layout. [Executed scope](testing/documentation-checks.md) and [brief audit entry](audit-history.md) retain evidence boundaries.
- **Operational evidence:** Forward migration 0025 was applied only after checking goals_dev and the exact pending migration; the existing Task count stayed unchanged. Browser mutations used a separate QA account; existing roadmap/demo Tasks were not modified by these checks.
- **Limits:** Browser tests are focused flows, not all feature acceptance. Live SMTP/AI, deployment and broad concurrency were not certified. Existing History retention/archival remains separate from reminder suppression.

## ISSUE-009 — Dashboard roadmap has no explicit account-level selection

- **Status:** Resolved.
- **Severity:** Low; users cannot deliberately choose displayed context, without demonstrated data loss or cross-account access.
- **Recorded:** 2026-11-02 (Asia/Saigon), from the user's report.
- **Affected UI:** [Dashboard roadmap](ui/dashboard/README.md#roadmap-below-the-header-and-account-selection).
- **Original behavior:** The browser filtered root/non-completed Goals and implicitly showed the highest-importance Goal; it offered no saved roadmap selection and the strip sat between summary cards and checklists.
- **Approved behavior:** Place the strip directly below the header, save the choice per account, and invite selection when unset rather than auto-selecting. Consolidate Today/Week percentages into their checklists; replace Current focus with existing-style 30-day Activity, retaining the yearly view and Habit streak.
- **Resolution:** Added owner-scoped roadmap preference/PATCH and forward migration 0026, native Goal selection, explicit empty/clear/archived behavior and stale-request/revision guards. Moved the strip, consolidated progress cards and added a factual 30-day calendar; removed obsolete Current focus behavior and its mobile grid placement from the new layout.
- **Verification:** Full backend: 141 tests, 1222 assertions; Node: 83 tests. HTTP covers auth/CSRF, owned persistence, invalid fields, foreign/archived 404 and clearing archived preferences. Browser QA covers saved selection after reload, a deliberately delayed stale Dashboard response, 33% progress at 1/3 despite status filtering, day details/year navigation, header placement and responsive layout. [Executed scope](testing/documentation-checks.md) · [Audit entry](audit-history.md).
- **Operational scope:** Migration 0026 was applied after checking the live goals_dev database and exact pending migration; no existing Goal or Task was rewritten and no roadmap was automatically selected. Test cleanup used goals_test; browser mutations used a separate QA account.
- **Limits:** Focused browser flows are not full product/deployment acceptance. The live SMTP/AI and broad concurrency boundaries remain outside this evidence.

## ISSUE-010 — Dashboard Today mixes week content, Habits are not actionable and Week lacks the Today template

- **Status:** In progress — implemented; browser verification is pending (see Limits).
- **Severity:** Low; information-architecture and discoverability problems without demonstrated data loss.
- **Recorded:** 2026-11-02, from the user's report and Dashboard screenshots.
- **Affected UI:** [Dashboard Today, This week, Habits and Roadmap](ui/dashboard/README.md).
- **Original behavior:** The Today tab also contained the This week card; its Habit streak card showed only a number and seven dots with no Habit names or check-in, while the actual Habit list sat at the bottom of the This week tab; the This week tab had none of Today's progress ring, bars or Sort/Status controls. The roadmap connectors did not show progress.
- **Approved behavior:** Daily shows only today's work (Activity with Today's progress ring, actionable Habits check-in card, and Daily tasks with Sort/Status comboboxes). Habits can be checked in or undone from Daily for each Habit's own local date. Weekly reuses the same template: progress card beside Milestones plus weekly Habit targets, then a full-width Weekly tasks checklist with Sort/Status controls. Each roadmap connector fills green in proportion to the preceding Milestone's progress.
- **Resolution (implemented):** Reorganized the Dashboard view and browser modules, added `dashboard-habits.js`, exposed the Habit-local `today` date on each Dashboard Habit row (additive field), added Daily tasks Sort/Status comboboxes matching Weekly, and added connector fill via a `--segment-progress` CSS variable. No migration, route or write-path change; Habit check-in reuses the existing PUT/DELETE routes.
- **Verification so far:** Backend integration tests (`DashboardReviewsTest.php` on goals_test): 15 tests, 93 assertions pass; Node: 86 tests pass (including Habit summary/targets, Milestone progress, and Daily/Weekly sort/status filtering); frontend format check and build pass; PHP lint passes.
- **Limits:** Live browser flows (layout on desktop/mobile, Habit check-in click, connector fill, empty states) have not been run through Playwright for this change. The daily/weekly Archify diagram describes selection/completion contracts and was not regenerated.

## ISSUE-011 — Tasks Completed section does not follow the selected time view

- **Status:** Resolved.
- **Severity:** Low; ambiguous scope and list/count expectations, without demonstrated data loss or incorrect completion writes.
- **Recorded:** 2026-11-02 (Asia/Saigon), during the Tasks design review.
- **Affected UI:** [Task time views](ui/tasks/filters.md), Completed group.
- **Observed:** The Completed pipeline in [planning-page.js](../frontend/src/js/planning/planning-page.js) calls taskMatchesView with completed, independently of the selected Today/Week/Next view. Its badge/list can therefore include recently completed work outside the current view.
- **Evidence:** Source inspection and an isolated Node exercise using the actual membership helper reproduced globally completed IDs today/elsewhere, while only today matched the Today view. No browser reproduction or live-data mutation was performed.
- **Approved decision:** Completed follows the selected time view. Implemented in completedInView, retaining History thresholds and adding independent paging.
- **Resolution evidence:** Node regression covers Today/Week/Next/All and History exclusion; browser read fixtures verified scope/count and both Completed pages. See [design review](ui/tasks/design-review.md).

## ISSUE-012 — Repeating exposes inapplicable Task filters and a different count scope

- **Status:** Resolved.
- **Severity:** Low based on inspected impact: misleading controls/counts in a limited view; no mutation failure or data loss established.
- **Recorded:** 2026-11-02 (Asia/Saigon), during the Tasks design review.
- **Affected UI:** [Tasks Repeating](ui/tasks/repeating.md), shared search/status controls and view badge.
- **Observed:** The Repeating branch in [planning-page.js](../frontend/src/js/planning/planning-page.js) passes the raw series array to renderSeriesList without applying the visible Task name/status controls. The badge counts non-Ended rows, while [series-list.js](../frontend/src/js/planning/series-list.js) renders Ended rows too.
- **Evidence:** Source-inspected control/render mismatch; not a claimed browser reproduction. State transitions and terminal Ended behavior were not changed by this review.
- **Expected:** Visible controls apply to the displayed entity type, and counts identify their scope. Series states differ from Task statuses.
- **Resolution evidence:** Applicable All/Active/Paused/Ended and name search now share one seriesPage pipeline with count and paging. Task-only controls are hidden. Node tests and browser read fixtures verified Ended, empty search and matching counts. Lifecycle APIs are unchanged.

## ISSUE-013 — Tasks planning and retrieval affordances are inconsistent across screens

- **Status:** Resolved.
- **Severity:** Low; layout/discoverability and workflow friction; all inspected core operations remain reachable elsewhere.
- **Recorded:** 2026-11-02 (Asia/Saigon), from supplied screenshots and source inspection.
- **Affected UI:** [Tasks design review](ui/tasks/design-review.md), covering collection, capture, details and History.
- **Observed:** Task rows omit the schedule/membership facts visible in Dashboard and have many competing inline actions; Tasks has hidden search and no sort control. Full capture offers no day/week planning choice and returns to All after creation. Detail offers Week but no Today action, moves the Notes card between views and nests the completion checklist inside the note editor. History places rules before retrieval and renders all matches without dedicated recent-first ordering/paging.
- **Evidence:** PHP templates and the planning/history browser modules linked in the design review. Screenshot scaling is not treated as a verified font-size defect. No browser walkthrough or application change was performed for this review.
- **Approved decisions:** All by default; retain capture context with explicit Today/Week planning; dedicated Notes; checklist in Overview. Secondary actions use native disclosure. All proposed layout/retrieval improvements were approved.
- **Resolution evidence:** Implemented the approved catalogue/capture/detail/History layout and added Tasks-scoped CSS. 90 Node tests pass; real-browser smoke covers isolated owned records and simulated/read fixtures, including partial planning failure, Notes drafts/save and responsive/keyboard controls. Theme and existing invariants remain; no Dashboard module or shared feature stylesheet was edited. See [verification scope](testing/documentation-checks.md).

## ISSUE-014 — Archify update receipts and docs checker use different default paths

- **Status:** Resolved.
- **Severity:** Low; documentation verification fails despite a valid new diagram. No application behavior or data is affected.
- **Recorded:** 2026-11-02 (Asia/Saigon), while updating the Tasks classification diagram.
- **Observed / evidence:** Archify with a fresh --out-dir writes finalize receipts there, while [check.php](../tools/docs/check.php) reads the canonical index.finalize-summary.json beside the artifact. The real checker reported Diagram changed after final receipt after successful Archify gates.
- **Expected:** Preserve prior browser evidence while supplying a current canonical receipt for the project checker.
- **Resolution:** Use --out-dir for fresh browser evidence and --receipt for the canonical full receipt; the CLI generates its canonical summary unchanged. Updated [maintenance instructions](maintenance.md#archify). No hand-edited receipt or relaxed checker is used.
- **Verification:** Archify finalize and the repository docs checker both pass with the canonical receipt. Receipts retain the exact candidate/artifact hashes and their browser evidence paths.

## ISSUE-015 — Habit actions have unclear hierarchy and inconsistent check-in behavior

- **Status:** Resolved.
- **Severity:** Low; confusing action hierarchy and an extra step for daily use, without established data loss.
- **Recorded:** 2026-11-02 (Asia/Saigon), from supplied screenshots and Habits source inspection.
- **Affected UI:** [Habits](ui/habits/README.md), row actions, Refresh and Edit footer.
- **Observed:** A check-looking button opened a check-in/rest menu while Dashboard checked in directly; Edit/Delete competed with the daily action. Delete actually archived data.
- **Approved target / resolution:** Direct today check-in before the name; calendar beside/below content; Edit at the end; Rest day and Archive in the existing More options popover. Refresh uses its existing icon; Edit retains Cancel/Save with a sticky footer. Existing visual theme and date/streak contracts remain.
- **Verification:** Real-browser QA on an isolated account checked direct check-in/undo, calendar rest state, rest cancellation, menu Escape/focus, Edit/save, archive cancellation and refresh. Screenshots inspected; widths 320/390/768/1440 had no page overflow. Eight focused Node cases and the full 90-test frontend runner pass. [Scope](testing/documentation-checks.md).

## ISSUE-016 — Habit archive fails with native PDO prepares

- **Status:** Resolved.
- **Severity:** Medium; an ordinary owned Habit cannot be archived, blocking one management operation. The failed transaction preserved data; no unauthorized access or history loss was observed.
- **Recorded:** 2026-11-02 (Asia/Saigon), during real-browser Habits QA.
- **Affected source:** [PdoHabitRepository::archive](../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php), existing DELETE /api/v1/habits/{id}.
- **Observed / evidence:** Archive confirmation led to HTTP 503. A guarded real-MySQL regression reproduced SQLSTATE HY093 Invalid parameter number at the archive UPDATE: the same named timestamp placeholder appeared twice with native prepares.
- **Expected / resolution:** Use separate archived_at/updated_at placeholder names with identical timestamp values. Owner filtering, service transaction/locking, version check and archive semantics are unchanged.
- **Verification:** [Regression](../backend/tests/Plain/Integration/HabitsRecurrenceTest.php) first failed against the original query, then the full HabitsRecurrenceTest passed (12 tests / 103 assertions). It checks version/timestamps, active-list exclusion, other-Habit preservation, and unchanged check-in/rest/Activity rows. Browser confirmation then archived the isolated QA Habit without an error and returned focus to Refresh.

## ISSUE-017 — Notes controls have redundant placement and unclear Save wording

- **Status:** Needs decision.
- **Severity:** Low; hierarchy/discoverability and wording, with no demonstrated lost content.
- **Recorded:** 2026-11-02 (Asia/Saigon), Notes design review.
- **Affected UI/source:** [Notes template](../frontend/src/views/notes/index.php), collection toolbar and editor actions; [NoteEditor](../frontend/src/js/notes/note-editor.js).
- **Observed:** Collapsed Note preferences still occupies a large panel. Grid/List appears in preferences and the main toolbar; Manage/Add tag open the same manager. Color, Pin, Tags, Share, permanent Delete and Save share the editor action area. Save calls requestClose, as do the close button and backdrop.
- **Proposal:** Keep the current theme and writing area; make preferences a compact header action, retain one Grid/List entry, group editor metadata/attachments separately from its primary footer, and move permanent Delete to secondary actions. Keep autosave/recovery/conflict behavior. Prefer Save and close wording to preserve current behavior.
- **Pending decision:** Preserve save-and-close with clearer wording, or deliberately change Save to save without closing. Do not remove explicit Save or rename permanent Note deletion to Archive without a separate requirement.
- **Evidence limits:** Desktop/mobile screenshots of the collection and empty New note editor were inspected; persisted/shared action layouts were inspected in source. No Note content was changed, shared or deleted. This review is not a full save/recovery/sharing acceptance test.

## ISSUE-018 — Notes pagination omits the current middle page and localized labels

- **Status:** In progress — implemented; browser verification is pending.
- **Severity:** Low; navigation/orientation and screen-reader wording; no demonstrated data corruption.
- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected source:** [NotesPage::renderPagination/pageButton](../frontend/src/js/notes/notes-page.js).
- **Observed:** Only numbered pages 1–5 and the last page render; intermediate current pages have no active numbered button or gap indicator. Previous/Next and numbered controls use hardcoded Trang plus a page number, including on English UI.
- **Evidence:** Intercepted GET list responses with last_page=12; navigating 5 to 6 produced no active page button. Returned accessible labels included Trang 1–5/12 and Trang 5/7 for navigation. This fixture tests browser rendering, not SQL pagination.
- **Expected / next step:** Keep a visible current-page window and clear gaps/position, with localized Previous/Next/Page labels. Verify first/middle/last pages, search/page reset and both locales before resolving.
- **Resolution (implemented):** [pageWindow](../frontend/src/js/lib/pagination.js) always shows the first and last page plus two pages on each side of the current one, with an ellipsis for skipped pages (a single skipped page is shown instead). The current page is marked with `aria-current="page"`; numbered buttons are labelled "Page N of M" and the arrows "Previous page"/"Next page" through the Vietnamese dictionary.
- **Verification so far:** 5 new [pagination tests](../frontend/tests/js/pagination.test.js) cover short ranges, first/middle/last pages, single-page skips and clamping; 96 Node tests, Prettier and the Vite build pass. Browser checks of both locales and search/page reset are still pending.

## ISSUE-019 — Notes layout preferences do not refresh the visible layout

- **Status:** In progress — implemented; browser verification is pending.
- **Severity:** Low; visible layout disagrees with the chosen preference until a later layout refresh; no content loss established.
- **Recorded:** 2026-11-02 (Asia/Saigon).
- **Affected source:** [initNotePreferences](../frontend/src/js/settings/delivery-preferences.js), [NotesPage](../frontend/src/js/notes/notes-page.js) and [template](../frontend/src/views/notes/index.php).
- **Observed:** Preference success updates state and dispatches notes:preferences-changed, but NotesPage only copies preferences. The follow-up selector targets data-view, while the actual toolbar uses data-view-toggle; applyView is not called.
- **Evidence:** Intercepted PATCH preference response returned notes_view=list; the UI reported Saved while the Grid remained visible. No stored account preference was changed for this review.
- **Expected / next step:** Consolidate the layout entry or apply the authoritative preference through the same view-rendering path and synchronize controls. Verify immediate switching and reload persistence with saved/draft state intact.
- **Resolution (implemented):** NotesPage now applies `notes_view` from `notes:preferences-changed` through `applyView` (without saving again), and the dead `[data-view]` click in initNotePreferences was removed.
- **Verification so far:** 96 Node tests, Prettier and the Vite build pass. Browser switching and reload persistence are still pending.

## ISSUE-020 — AI branch generated traces still describe pre-agent capabilities

- **Status:** Resolved.
- **Severity:** Low; contradictory documentation could send an agent to the wrong behavior boundary. No runtime data failure was established by this finding.
- **Recorded:** 2026-11-02 (Asia/Saigon), integrating origin/feature/ai-assistant at fd2030c with local UI work based on c21b4ec.
- **Observed:** The imported AI page introduction described chat confirmation cards and supported updates/deletes, but the existing trace registry regenerated API-only/create-only descriptions. Manual AI cases repeated that old exclusion. Imported assistant.js also failed the existing formatting gate.
- **Resolution:** Updated AI chat/proposal traces, source/test/DOM/style references and manual cases to the imported confirmation-first implementation; formatted only the assistant module. Existing ownership/version/normal-service boundaries remain explicit.
- **Verification:** Regenerated documentation/source checks and frontend formatting pass. Integration and browser verification scope is recorded with the branch integration audit.

## ISSUE-021 — Demo Review snapshots do not match the runtime schema

- **Status:** Resolved.
- **Severity:** Medium; malformed demo snapshots make ReviewService reject the owner's entire Review list, blocking Reviews for that account. No loss of reflection text was established.
- **Recorded:** 2026-11-02 (Asia/Saigon), following the Reviews error report on roadmap-demo@example.test.
- **Affected source:** [Demo seeder](../backend/bin/seed_roadmap_demo.php), [ReviewService::serialize](../backend/src/Application/Reviews/ReviewService.php) and [Reviews UI](ui/reviews/README.md).
- **Observed / evidence:** Two seeded Finalized Weekly/Monthly rows had snapshot_schema_version=1 in SQL but their JSON contained only ad hoc completed-task/streak counters, without schema_version or required UI facts. Reading the account's list threw Unsupported Review snapshot schema. A guarded goals_test test of the original seeder reproduced that exception.
- **Resolution:** The demo builder now emits the schema-one period/timezone/generated_at envelope and actual PdoReviewRepository facts. Strict runtime validation was not weakened. The existing development database was not reseeded.
- **Bounded data repair:** Locked the demo owner and Review rows in stable ID order. Repaired only the two known malformed seed payloads after matching their exact legacy summaries; retained a private backup outside Git. Reflection fields, identities/periods, Finalized status and original finalization/creation timestamps were preserved. Version/updated_at advanced. Repair metadata retains the legacy summary and explicitly identifies the new capture time; reconstructed facts use currently retained records rather than pretending to recover the original historical snapshot. No other user's Reviews or newly added roadmap work was rewritten.
- **Verification:** Runtime service lists both repaired Reviews; the English Goal still has 6 Milestones and 24 Tasks. Full DashboardReviewsTest passed: 16 tests / 124 assertions, including the seed-schema regression that failed before the fix. Browser intercepted-read fixtures using the actual repaired payloads rendered Weekly/Monthly as read-only Finalized Reviews without JavaScript errors. PHP lint and docs checks pass. Browser fixtures are not a logged-in end-to-end test of the demo account; no broad Finalized-history migration was performed.

## ISSUE-022 — Dashboard Activity and Weekly charts are hard to read

- **Status:** Resolved.
- **Severity:** Low; misleading visual emphasis and poor readability, without demonstrated incorrect stored counts.
- **Recorded:** 2026-11-02; user screenshots and source/browser inspection of [Dashboard](ui/dashboard/README.md).
- **Affected traces:** dashboard.activity and dashboard.week; [chart styles](../frontend/src/css/feedback.css), [activity palette](../frontend/src/css/planning.css), [recent calendar](../frontend/src/js/planning/recent-activity.js) and [day bars](../frontend/src/js/planning/insights-ui.js).
- **Observed:** Recent Activity did not inherit the year calendar's heat-level variables, leaving its cells effectively uncoloured; right-aligned content wasted the card's left side. Weekly columns were only 9px wide inside a short chart, and minimum fill height made zero-count dates look active.
- **Resolution:** Shared existing light/dark palette variables; balanced total/calendar layout, legend and selected-date outline; larger weekly columns with per-day counts, distinct weekday labels, current-date emphasis and a factual total. Zero values have zero fill. The shared Reviews renderer retains its default markup; Dashboard opts into counts/tracks.
- **Verification:** 91 Node tests and Vite build passed. Authenticated browser read fixtures using the demo projection (71 recent contributions, five on Monday) verified 30 coloured date buttons, selected-day details, seven columns, totals, zero fills, and no JavaScript errors. Light/dark screenshots and widths 320/390/768/1440 were inspected/checked. Empty activity was checked separately. These are chart presentation checks with intercepted reads and theme attributes, not a new backend, theme-preference persistence or all-feature acceptance test; existing demo records were not changed.

## ISSUE-023 — Deployment automation could not provision or safely release production

- **Status:** Resolved.
- **Severity:** High; CI could not start, the host did not match the required MySQL version or serve the app, and releases migrated without a backup.
- **Recorded:** 2026-11-03; review of the unmerged chore/deploy-automation branch.
- **Affected source:** [CI/CD workflow](../.github/workflows/ci-cd.yml), host setup (then tools/deploy/oracle-ubuntu-setup.sh, now [setup.sh](../tools/deploy/setup.sh)), [release helper](../tools/deploy/release.sh); [production guide](operations/deployment.md).
- **Observed:** mysqld arguments were passed as `docker create` options for the CI MySQL service; Ubuntu 24.04's apt `mysql-server` is 8.0, not 8.4, and MySQL's APT repository has no arm64 packages; no Nginx site or certificate was configured; the deploy job reported success when skipped for missing secrets; migrations ran without the backup the release procedure requires; no scheduler cron was installed; private storage and logs were not writable by PHP-FPM; `ssh-keyscan` trusted whatever host key it received; the iptables insert position assumed Oracle's rule layout.
- **Resolution:** CI keeps only Docker options and pins the test database collation. Setup runs MySQL 8.4 from the official multi-arch image on loopback, creates the database, user and production .env, installs the Nginx site, Certbot TLS, scheduler and backup cron, PHP upload limits, writable-directory ACLs and minimal sudo rules, and runs the first release. Releases take a mandatory verified backup before migrating. Deployment is opt-in through `DEPLOY_ENABLED`, fails on missing secrets, pins the host key through `ORACLE_KNOWN_HOSTS`, deploys the verified commit and runs one at a time.
- **Verification:** `bash -n` on all deploy scripts; a sandboxed release.sh run with stub composer/php checked the argument, .env, manifest and missing-backup guards, `--skip-backup`, relative/absolute path resolution and setgid directories; the setup script's generated production .env loaded through ConfigLoader; workflow YAML parsed. Not verified: shellcheck/actionlint (not available locally; CI now runs shellcheck), ACL behaviour (setfacl absent locally), and a real provisioning, certificate or GitHub deployment run on an Oracle instance.
- **Follow-up:** On 2026-11-03 the SSH deploy job, `DEPLOY_ENABLED` and the `ORACLE_*` secrets were replaced by pull-based deployment, and oracle-ubuntu-setup.sh by the shared hosting module; see [ISSUE-024](#issue-024--hosting-behind-cloudflare-tunnel-breaks-client-addresses-and-csrf-origin) and the [production guide](operations/deployment.md#continuous-integration-and-deployment).

## ISSUE-024 — Hosting behind Cloudflare Tunnel breaks client addresses and CSRF origin

- **Status:** Resolved (deployment configuration; application code unchanged).
- **Severity:** High for tunnel ingress; sign-in and every form would fail, and throttling would be shared by all visitors.
- **Recorded:** 2026-11-03; source inspection while adding Cloudflare Tunnel ingress to [the hosting module](../tools/deploy/setup.sh).
- **Affected source:** [Request::clientIp](../backend/src/Http/Request.php) uses REMOTE_ADDR for sessions, login and password-reset throttling and guest rate limits; [CsrfGuard](../backend/src/Http/Security/CsrfGuard.php) requires the Origin scheme/host/port to equal APP_URL.
- **Observed:** Behind cloudflared every request reaches Nginx from 127.0.0.1, so all visitors would share one client identity. A quick tunnel's random trycloudflare.com hostname changes on each restart, so a fixed APP_URL would reject every state-changing request with 419.
- **Resolution:** In tunnel ingresses Nginx trusts `CF-Connecting-IP` only from loopback peers (realip), and the local app server listens on 127.0.0.1 only. The quick-tunnel helper rewrites APP_URL and /etc/planner/public-url from cloudflared's metrics server on every tunnel start; named tunnels and direct ingress pin APP_URL to `https://<domain>`. Config is reloaded per request, so no PHP-FPM reload is needed. Mail links sent before a quick tunnel restart still break; this is documented as a quick-tunnel limitation.
- **Verification:** Rendered Nginx site for quick-tunnel and direct ingress inspected; `env_set` behaviour checked against .env.example. Not verified: a live cloudflared quick or named tunnel, its `/quicktunnel` metrics response, or realip on a real host.

## ISSUE-025 — Retired AI model is reported as a temporary provider outage

- **Status:** Open (local configuration fixed; code unchanged).
- **Severity:** Medium; the AI assistant stops working while the message suggests waiting, hiding a configuration fix.
- **Recorded:** 2026-11-03; local AI chat reported "The AI provider is temporarily unavailable."
- **Affected source:** [GoogleAIProvider::post](../backend/src/Infrastructure/AI/GoogleAIProvider.php); local backend/.env.
- **Observed:** generateContent for `gemini-2.5-flash-lite` returned HTTP 404 NOT_FOUND ("no longer available to new users… use models/gemini-3.5-flash-lite"), while the model metadata endpoint still answered 200. post() maps every unlisted status, 404 included, to AI_PROVIDER_ERROR and the generic 503 "temporarily unavailable" message. Separately, the same method calls curl_close(), deprecated since PHP 8.5 (no effect since 8.0); it emits E_DEPRECATED on every attempt.
- **Expected / next step:** Treat 404 like 400/403 (AI_CONFIGURATION, "cannot be used with the current configuration") and log the provider status and model; drop the curl_close() call. Confirm the intended message before changing behavior.
- **Evidence:** One 5-token generateContent request per model with the configured key: gemini-2.5-flash-lite 404, gemini-3.5-flash-lite 200. Local AI_MODEL was changed to gemini-3.5-flash-lite (the .env.example default); no code was changed. The in-app chat after the change was not re-tested.

## ISSUE-026 — AI assistant cannot build a Goal roadmap and restructures by deleting Tasks

- **Status:** Resolved.
- **Severity:** High for the AI flow; accepted plans were applied partially and existing Tasks were archived to restructure.
- **Recorded:** 2026-11-03; user test of the floating AI chat ("create a Docker learning roadmap").
- **Affected source:** [AIChatService](../backend/src/Application/AI/AIChatService.php), [ProposalValidator](../backend/src/Application/AI/ProposalValidator.php), [AIActionService](../backend/src/Application/AI/AIActionService.php), [assistantSummary](../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php).
- **Observed:** The chat had no Milestone tools, and create tools returned no reference, so Tasks could only attach to Goals that already existed: an accepted "Goal with Tasks" plan created only the Goal, follow-up Tasks landed in the Inbox, and a request for Milestones produced prefixed sub-Goals while the old Tasks were deleted. The summary showed no Milestones or Task locations. Separately, Milestones and Tasks created by Apply all received position 0, so roadmap order followed random ids.
- **Resolution:** Create tools return refs usable as parents in the same message; new `get_roadmap`, `create_roadmap`, `create_milestones`, `update/complete/reopen/delete_milestone` and `move_tasks` tools; `move_task` and Milestone change operations in ProposalValidator and Apply; multi-step tools queue all or nothing; sub-Goals are refused when the message asks for Milestones and delete-and-recreate of a Task is refused (withdrawing the queued delete); Apply appends Milestones/Tasks in proposal order; the summary includes Milestones and Task locations; the system prompt states the data model and the roadmap, acceptance, focus, restructure and deletion rules. [AI assistant guide](ui/shared/ai.md).
- **Verification:** 4 new integration tests (roadmap in one proposal with order and prerequisites; refs, moves and the recreate guard; structural guards queue nothing; validator rejects an invalid move parent) plus the 11 existing AIActionTest cases; full PHPUnit 153 tests / 1358 assertions; 91 Node tests; Prettier; Vite build; documentation checks. Model compliance with the prompt was exercised with a scripted provider only, not with live Gemini.

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
