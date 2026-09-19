# M06 — Planning Core

Status: Verified on 2026-09-18. Depends on M05.

## Objective

Add Areas, arbitrarily nested Goals, Milestones, Tasks, Checklist Items, Task Notes, hierarchical Tags, contributions, milestone dependencies, and calculated Goal progress on the verified plain-PHP runtime.

## Why this phase comes now

This phase requires the M05 framework-free runtime and precedes recurring work
because recurrence copies and validates this domain model.

## Required reading

Scope, architecture, database, HTTP, UI, domain contract, security/runtime, verification, and the completed M05 evidence. Treat those documents as the behavior contract; this file supplies execution order.

## Files affected

Target Account registration, planning schema/domain/application/PDO/HTTP/UI,
canonical Tags, navigation, routes/wiring, tests, status and verification.

## Files to create

- `backend/src/Domain/Planning/{Area,Goal,Milestone,Task,ChecklistItem,Tag}/*`
- `backend/src/Application/Planning/{Area,Goal,Milestone,Task,Checklist,Tag,Contribution,MilestoneDependency}/*`
- `backend/src/Infrastructure/Persistence/Pdo/Planning/*Repository.php`
- `backend/src/Http/Controller/Api/{Area,Goal,Milestone,Task,ChecklistItem,Tag,Contribution,MilestoneDependency}Controller.php`
- `backend/database/plain-migrations/*_create_planning_core.php`
- `backend/tests/Plain/{Unit,Integration,Http}/Planning/*Test.php`
- `frontend/src/js/planning/*` and the minimum PHP views/components defined in document 05

## Files to modify

`backend/routes/api.php`, `backend/routes/web.php`, dependency wiring, migration registry, navigation/layout, Vite entries only if a new entry is required, `docs/implementation-status.md`, and `docs/verification.md`.

## Files to remove

None.

## Detailed implementation steps

### M06.1 Schema and typed values

Create the tables, composite ownership keys, checks, unique constraints, junctions, and indexes in document 03. Represent status/importance as validated PHP enums/value objects at the HTTP boundary. Every repository write includes `user_id`; every relationship insert proves both endpoints belong to that user. Extend registration so accounts created after M06 receive `Area 1`, `Area 2`, and `Area 3` in the account transaction. Add an explicit idempotent backfill command for existing accounts with zero Areas; it locks the user, rechecks zero, creates the same three rows, and leaves accounts with any Area untouched.

### M06.2 Areas and hierarchy

Implement Area CRUD/reorder/archive and Goal CRUD/move/archive. `MoveGoal` locks the owner row, moving Goal, destination, and the affected subtree/destination chain in deterministic UUID order. Detect self/descendant moves iteratively, enforce `area_id XOR parent_goal_id`, and increment the moved aggregate version exactly once. Reads use an iterative adjacency-list assembly; never use recursive PHP calls or database recursive CTEs for required correctness.

### M06.3 Milestones, dependencies, and progress

Implement Milestone CRUD/status/reopen and dependency add/remove. Dependency graph validation loads the owner's active dependency adjacency list and performs iterative cycle detection inside the write transaction. Completing a Milestone locks it and active prerequisites, rejects incomplete prerequisites, and requires `acknowledge_open_tasks=true` when finite active Tasks remain. Task mutations are never blocked by milestone availability. Milestone progress is finite active Tasks Done / finite active Tasks, with an empty set displayed as status-derived rather than division by zero.

### M06.4 Tasks, Checklist Items, and Task Note

Implement Inbox/Goal/Milestone parent semantics, Task status transitions, fields and date validation, ordered Checklist create/update/check/uncheck/reorder/delete, and exactly one Task Note body with autosave version/conflict semantics. Completion with unchecked Checklist Items requires explicit acknowledgement; neither Task status nor Checklist mutations change the other automatically. A Task may be Done beneath a dependency-locked Milestone.

### M06.5 Tags and contributions

Implement one-owner hierarchical Tags with iterative cycle prevention and entity tag junctions. Implement Goal/Milestone/Task/Habit-source-compatible contribution services, initially exposing Goal/Milestone/Task sources. Goal-to-Goal contribution cycles are rejected; non-Goal sources may target multiple Goals. Contributions never affect hierarchy, progress, status, or scheduling. Duplicate desired-state requests are no-op responses with unchanged timestamps/version.

### M06.6 Queries, UI, and progress

Provide bounded tree/detail/list queries, optimistic concurrency responses, locked-milestone explanations, and progress calculation exactly as document 10. Use iterative postorder traversal and fail safely on stored cycles. Build the UI flows in document 05 without redesigning Notes. Preserve API error envelopes, same-origin calls, CSRF, keyboard behavior, responsive layout, escaping, and loading/empty/error states.

## Business rules

Single primary parent; arbitrary Goal depth; owner isolation; hierarchy/contribution/dependency are distinct; importance is 1–5; completion criteria are informational text; calculated 100% does not auto-complete a Goal; archived objects reject new relations; exact replay is a no-op; all mutations use current `base_version` where document 04 requires it.

## Risks

Deadlocks during inverse moves, recursive stack failures, duplicated version increments across child writes, accidental progress double-counting, cross-owner junctions, stale UI applying changes, and confusing milestone lock with Task lock.

## Validation

Inspect generated DDL/foreign keys/checks/indexes, target route inventory and
serialized examples; use `EXPLAIN` for tree/detail/list queries; run concurrent
inverse graph mutations and verify lock order; inspect planning UI at all
required widths and keyboard/zoom states.

## Tests

Add unit tests for transitions/progress/graph algorithms; MySQL tests for constraints, locking, inverse concurrent moves, ownership and transaction rollback; HTTP tests for every route/status/error; JS tests for tree state, optimistic conflicts and checklist independence; browser paths for deep navigation, cycle rejection, dependency lock, allowed Task completion, Task Note recovery, contributions and Tag hierarchy. Generate a 1,001-level Goal fixture and prove reads/moves/progress do not recurse on the call stack.

Run the M06 subset after each task, then all plain-PHP tests, frontend unit/format/build, syntax scan, and Playwright planning paths. Record exact counts and environment in verification evidence.

## Exit criteria

All M06 entities and routes work through plain PHP; required invariants are enforced in application logic and database constraints where representable; critical cases 1–10 and 17 pass; no recurring/dashboard/AI behavior is smuggled into this phase.
