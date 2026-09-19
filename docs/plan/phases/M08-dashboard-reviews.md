# M08 — Dashboard, Activity, and Reviews

Status: Verified on 2026-09-18. Depends on M07.

## Objective

Add auditable completion Activity, weekly planning selections, the v1 Dashboard, Goal snapshots, and Daily/Weekly/Monthly Reviews.

## Why this phase comes now

This follows Habits/recurrence so every v1 completion source exists before the
Activity and Review aggregation contracts stabilize.

## Required reading

Database, HTTP, UI, dashboard/reviews contract, security/runtime, operations, verification, and M07 evidence.

## Files affected

All completion use cases, Activity/selection/snapshot/Review schema and layers,
Dashboard/Review UI, scheduler, routes/wiring, tests and evidence.

## Files to create

- `backend/src/Domain/{Activity,Review}/*`
- `backend/src/Application/{Activity,Dashboard,Review,WeeklyPlanning}/*`
- `backend/src/Infrastructure/Persistence/Pdo/{Activity,Dashboard,Review,WeeklyPlanning}/*Repository.php`
- `backend/src/Http/Controller/Api/{Dashboard,Review,WeeklySelection}Controller.php`
- `backend/src/Console/Command/CaptureGoalSnapshotsCommand.php`
- `backend/database/plain-migrations/*_create_activity_dashboard_reviews.php`
- `backend/tests/Plain/{Unit,Integration,Http}/{Activity,Dashboard,Reviews}/*`
- `frontend/src/js/{dashboard,reviews,weekly-planning}/*` and corresponding PHP views/components

## Files to modify

Task/Checklist/Habit/Milestone completion services to append Activity in their existing transactions; routes; wiring; navigation; scheduler/runbook; status and verification evidence.

## Files to remove

None.

## Detailed implementation steps

### M08.1 Transactional Activity ledger

Create append-only completion/reversal storage and uniqueness from document 12. Modify completion mutations at the application-service boundary, not controllers/repositories, so manual and future AI paths share behavior. Reopen/uncheck/check-in deletion appends a reversal referencing the active event. Exact replay appends nothing. Capture source version, effective local date, and timezone at event time.

### M08.2 Weekly selections

Implement current-week Task/Milestone selection add/remove/reorder with owner/timezone-derived Monday identity, stable positions, desired-state no-ops, exact-set reorder validation, and archived-object filtering. Completion does not silently remove a selection.

### M08.3 Dashboard queries

Build one bounded query service returning requested-month binary Activity grid plus tooltip counts, Today/overdue Tasks, current-week selections, and Goal-related Habits/current-period counts. De-duplicate Tasks within sections. Use `NOT EXISTS` reversals, period-bounded SQL, deterministic ordering, and query-count tests; do not calculate a productivity score.

### M08.4 Goal snapshots

Implement per-user-local-day capture after day close, with goal/date uniqueness and checksum mismatch warning. The command is idempotent, never fabricates historical days, continues across users after isolated failure, and reports nonzero if any capture fails.

### M08.5 Reviews

Create one Review per user/kind/timezone-stable period. Draft generation stores immutable factual JSON plus editable reflection fields. Refresh replaces facts only while Draft; Finalize freezes until explicit Reopen; Reopen does not refresh. Queries never silently rewrite snapshots. Validate snapshot schema/version on read and label unavailable historical Goal snapshots.

### M08.6 UI and scheduler

Implement document 05 Dashboard/Review states, the GitHub-style monthly Activity calendar with accessible cells/tooltips and stable intensity thresholds, weekly selection controls, Review create/refresh/finalize/reopen confirmations, and timezone disclosure. Register snapshot maintenance with overlap protection and structured logs.

## Business rules

Activity is fact/reversal history, not a mutable score. A day is active when at least one unreversed completion fact remains. Notes/creation do not count. Review period identity never changes after timezone preference changes. Finalized Review facts remain stable.

## Risks

Double-counted events, missing events from alternate mutation paths, timezone/day boundary drift, unbounded history queries, mutable finalized snapshots, duplicate weekly positions, and maintenance running before local day close.

## Validation

Compare Activity facts to source records for a fixed month, inspect bounded
query plans/counts, run snapshot maintenance twice across multiple timezones,
verify finalized JSON byte stability, and manually inspect activity-grid
semantics/accessibility.

## Tests

Test replay/reversal/re-completion, transaction rollback with Activity, timezone boundaries, month grids, duplicate section suppression, Monday week identity, exact reorder set, archive filtering, snapshot idempotency/checksum/failure isolation, all Review state transitions and immutable facts. Use a query-count assertion and browser checks at mobile/desktop/keyboard/200% zoom. Re-run all completion-domain tests after adding Activity hooks.

## Exit criteria

Critical cases 13–14 and ownership case 17 pass; Dashboard uses only explainable v1 rules; Review snapshots and Activity history are auditable and idempotent; all prior phases remain green.
