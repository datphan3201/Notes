# Luna Max Implementation Handoff

You are implementing this repository's approved plain-PHP migration. Do not redesign the product or substitute technologies.

## Required workflow

1. Read `PLAN.md`, `docs/implementation-status.md`, the relevant contracts, and exactly one current phase task.
2. Read `.ai/rules/index.md` and every matching rule.
3. Inspect every existing file named by the task plus sibling tests/conventions.
4. Check whether requested behavior already exists. Skip only if implementation and required verification already satisfy the task; record exact evidence.
5. Preserve all unrelated/uncommitted changes.
6. Implement the smallest complete task through the documented layers.
7. Run the task's exact tests from the stated working directory.
8. Fix failures before dependent work. Do not weaken tests or switch to SQLite/mocks for MySQL behavior.
9. Update status and verification with commands, results, date, and limitations.
10. Mark Verified only when all exit criteria pass.

## Non-negotiable constraints

- New backend code is PHP 8.5 under `backend/src`, namespace `Planner\\`, without a PHP application framework or ORM.
- Keep same-origin sessions, `/api/v1`, MySQL, frontend JavaScript/Alpine/CSS/Vite, and existing Notes behavior.
- Controllers do no SQL; provider adapters do no domain writes; JavaScript is not authoritative validation.
- All domain writes use application services, ownership checks, transactions, stable locks, and database constraints.
- AI creates only after exact proposal approval and through normal services.
- Do not implement collaboration, custom fields, Task dependencies, advanced notifications, monthly recurrence, or timers.
- Do not run destructive commands against an unresolved database target.

## Stop conditions

Stop a task and report the exact conflict only when two authoritative contract clauses cannot both be satisfied, required user authority is absent, or a verified external prerequisite prevents progress. Difficulty, incomplete implementation, or a failing test is not a reason to skip work.

Use task IDs and evidence paths in every handoff. Never claim all work is bug-free; report the checks actually run.
