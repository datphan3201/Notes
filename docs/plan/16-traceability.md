# Requirements and Evidence Traceability

| Requirement family | Contract | Phase | Implementation | Tests/evidence | Status |
| --- | --- | --- | --- | --- | --- |
| Plain PHP/no Laravel | 02, 14, 15 | M01–M05 | `backend/bootstrap`, `backend/src/{Config,Http,Infrastructure}`, `backend/bin/console` | clean 15-package production install, production start, active-source and lockfile scan | Verified |
| Existing auth/settings | 04, 14 | M02 | `Application/Account`, `Http/Controller/AccountController.php`, encrypted PDO sessions | `AccountHttpTest`, real registration/session/CSRF browser and HTTP paths | Verified |
| Existing Notes/Tags | 04, 06 | M03/M06 | `Application/{Notes,Tags}`, PDO Note/Tag repositories | `NotesHttpTest`, JS autosave/read-coordinator tests, Notes browser baseline | Verified |
| Existing files | 14 | M04 | `Application/Files`, `Infrastructure/Storage`, private stream controllers | `FilesHttpTest`, storage unit tests, 200/206/HEAD and prune evidence | Verified |
| Areas/Goal hierarchy | 03, 10 | M06 | `PlanningService`, `GraphGuard`, `PdoPlanningRepository` | `PlanningDomainTest`, `PlanningCoreTest`, `PlanningHttpTest` | Verified |
| Goal roadmap/strategy and component navigation | 03, 04, 05, 10 | M06 follow-up | `0006_add_goal_strategy_notes`, owned roadmap projection, `goal-roadmap.js`, fishbone head and Goal information dialog | 2026-10-07: Planning integration/HTTP, DraftBuffer/transition unit cases, real Chromium creation/drafts/conflicts/ancestor flows; `docs/verification.md` | Verified for exercised follow-up |
| Contributions | 03, 10 | M06 | separate `goal_contributions`/`work_contributions` persistence paths | multi-target, cycle, ownership and progress-exclusion integration cases | Verified |
| Milestone dependency | 10 | M06 | separate dependency relation and completion guard in Planning application/domain | locked completion, allowed Task completion, unlock, cycle/reopen cases | Verified |
| Progress | 10 | M06 | iterative `GoalProgressCalculator` and repository projections | deep nesting, mixed children, double-count and exclusion cases | Verified |
| Task/Checklist/Note | 06, 10 | M06 | Planning service/repository plus Task detail UI | status/checklist independence and Task Note HTTP/browser paths | Verified |
| Habits | 11 | M07 | `HabitService`, `PdoHabitRepository` | `HabitsRecurrenceTest`; browser check-in and reversal | Verified |
| Recurring Tasks | 11 | M07 | `RecurrenceCalculator`, `TaskSeriesService`, series repository/materializer | calculator and MySQL concurrency/lifecycle cases; browser weekly preview/pause/resume | Verified |
| Dashboard/Activity | 12 | M08 | Dashboard service/repositories and Activity ledger | `DashboardReviewsTest`; activity grid and weekly browser selections | Verified |
| Reviews | 12 | M08 | `GoalSnapshotService`, `ReviewService`, `PdoReviewRepository` | timezone/snapshot/finalization cases; browser save/finalize/reopen | Verified |
| AI | 13 | M09 | provider interface, Google/disabled adapters, proposal validator/action service/repository | `AIActionTest` malformed/stale/replay/rollback/owner cases; selected-context disabled-provider browser path | Verified |
| Security | 14 | all | CSRF/origin/rate/session/file guards, prepared owner-scoped repositories, safe errors/logging | full PHPUnit suite plus second-account browser non-disclosure and clean secret scan | Verified |
| Operations | 15 | M10 + follow-up | nine migrations, ten CLI commands, native Vite manifest, public front controller | original M10 operations baseline; 2026-10-07 guarded test migrations through 0009; apply/check before deployment | Verified for recorded checks |

Statuses refer to the recorded implementation baseline and exercised follow-ups.
Exact current counts, scope and unresolved findings are in
`docs/verification.md` and `docs/implementation-status.md`; Verified does not
certify every later change or unrun contract edge case.
