# M07 — Habits and Recurring Tasks

Status: Verified on 2026-09-18. Depends on M06.

## Objective

Add dedicated Habits, idempotent completion history, and deterministic recurring Task materialization.

## Why this phase comes now

It follows Planning Core because generated occurrences reuse normal Task
validation, relationships, and persistence.

## Required reading

Database, HTTP, UI, domain contract, habits/recurrence contract, security/runtime, operations, verification, and M06 evidence.

## Files affected

Habit and recurrence schema/domain/application/PDO/HTTP/UI, Task copy support,
Tags/contributions, console scheduling, routes/wiring, tests and evidence.

## Files to create

- `backend/src/Domain/Habit/*` and `backend/src/Domain/Recurrence/*`
- `backend/src/Application/Habit/*` and `backend/src/Application/Recurrence/*`
- `backend/src/Infrastructure/Persistence/Pdo/{Habit,TaskSeries}/*Repository.php`
- `backend/src/Http/Controller/Api/{Habit,HabitCheckIn,TaskSeries}Controller.php`
- `backend/src/Console/Command/MaterializeTaskOccurrencesCommand.php`
- `backend/database/plain-migrations/*_create_habits_and_task_series.php`
- `backend/tests/Plain/{Unit,Integration,Http}/Habits/*` and `Recurrence/*`
- `frontend/src/js/{habits,recurrence}/*` and corresponding PHP views/components

## Files to modify

Routes, dependency wiring, console command registry, Task create/copy support, Tags/contributions source allowlists, navigation, scheduler/deployment docs, status and verification evidence.

## Files to remove

None.

## Detailed implementation steps

### M07.1 Habit lifecycle and check-ins

Create Habit/check-in persistence and CRUD. Interpret check-in date in the Habit's stored IANA timezone, reject future dates, and make PUT/DELETE desired-state operations idempotent. First check-in freezes period/timezone. Add primary Goal, multi-Goal contributions, Tags, importance, and dashboard-ready current-period count query without treating Habit as Task.

### M07.2 Pure recurrence calculator

Implement a side-effect-free iterator accepting a validated rule, exclusive cursor, inclusive horizon, and timezone. Support only daily/weekly rules in document 11. Use local calendar dates; explicitly resolve DST gap/overlap policy; return sorted unique dates; add exhaustive boundary tests before database work.

### M07.3 Series persistence and materialization

Create TaskSeries/template/checklist-template/tag/contribution tables and occurrence identity. Materializer selects eligible series, locks one series at a time, evaluates at most 200 attempts per transaction, inserts normal Tasks through shared domain services, and advances cursor to the last fully evaluated date. Unique `(series_id, occurrence_date)` provides retry safety. One malformed series records a safe failure and processing continues; command exits nonzero if any failed.

### M07.4 Pause/resume/end/replace

Implement lifecycle exactly as document 11. Editing is allowed only before an occurrence exists; thereafter use atomic End-and-replace. Resume skips the paused interval. End archives only confirmed future NotStarted occurrences and never alters started/Done work.

### M07.5 HTTP/UI/operations

Add Habit/check-in and TaskSeries routes from document 04, forms and previews from document 05, and CLI scheduling from document 15. Preview uses the same calculator but never writes. GET requests never materialize. The scheduler invokes the command at the documented cadence with overlap protection and structured logging.

## Business rules

Habit completion is date history, not recurring Task status. Occurrences are ordinary independent Tasks after creation, but retain immutable series/date identity. Recurring occurrences are excluded from finite Goal/Milestone progress. Replays produce no duplicate rows, version changes, or Activity.

## Risks

DST errors, cursor gaps, duplicate generation, long transactions, template edits mutating history, scheduler overlap, parent archived between evaluation and insert, and miscounting occurrences in finite progress.

## Validation

Print deterministic preview fixtures for representative rules, inspect stored
UTC instants/local dates/cursors, run materialization twice and with two
connections, inspect scheduler logs/exit codes, and verify no GET request writes.

## Tests

Unit-test daily/weekly intervals, weekday normalization, inclusive end, leap dates, DST gap/overlap and 35-day horizon. MySQL-test unique retry, two-worker competition, cursor rollback, cap continuation, archived parent, partial failure, pause/resume/end/replace, ownership, Tags/contributions/checklists copying. HTTP/browser-test check-in/undo, future rejection, preview/create/lifecycle and timezone boundaries. Test the scheduled command twice to prove no duplication.

## Exit criteria

Critical cases 11–12 and ownership case 17 pass; recurrence is deterministic and retry-safe; Habits remain a distinct entity; scheduler/runbook is documented; all M06 behavior remains green.
