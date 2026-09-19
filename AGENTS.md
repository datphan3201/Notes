# Repository Instructions

## Read before work

1. Read `PLAN.md`.
2. Read `.ai/rules/index.md` and every rule matching the paths in scope.
3. Read the relevant contract in `docs/plan/` and the current phase task.
4. Inspect sibling source and tests before choosing structure or names.

## Runtime

The canonical application is framework-free PHP under `backend/src` with namespace `Planner\\`. Laravel has been retired; do not add Laravel APIs, another web framework, an ORM, Blade, or Artisan.

Keep frontend sources under `frontend/`, public deployment files under `backend/public/`, private files under `backend/storage/app/private/`, and backend tests under `backend/tests/`.

## Implementation behavior

- Preserve existing HTTP and browser contracts until a documented target change replaces them.
- Use explicit constructor dependencies and bootstrap wiring. Do not introduce an automatic container or service locator.
- Use PDO repositories; do not introduce an ORM or generic query-builder framework.
- Controllers parse/serialize HTTP. Application services own transactions. Domain services own invariants. Repositories own SQL.
- Every owned query takes `user_id`. Return 404 for inaccessible object identifiers to avoid disclosure.
- Lock the owner row first, then aggregate rows in stable ID order, then relationship/activity rows.
- Use UTC `DATETIME(6)` and explicit serialization. Store user-facing dates separately as `DATE`.
- Reject unknown input fields and keep backend validation authoritative.

## PHP conventions

- PHP 8.5, strict types in new files, explicit parameter and return types.
- Constructor property promotion where it improves clarity.
- Curly braces for all control structures.
- TitleCase enum cases.
- PHPDoc for array shapes and non-obvious public contracts.
- Comments explain boundaries, invariants, security behavior, or tricky SQL.
- Use `DateTimeImmutable`; inject a Clock when time controls behavior.

## Tests and verification

- PHPUnit remains the backend test runner.
- Use real `goals_test` MySQL for integration tests and guard its actual database name before cleanup.
- Use unit tests for pure graph, progress, recurrence, and proposal logic.
- Use HTTP integration tests for request behavior, authentication, authorization, and validation.
- Use Node's test runner for pure browser modules and Playwright for critical real-browser flows.
- Run the narrowest relevant checks after a change and the phase gate before moving on.
- Do not rewrite tests merely to make incorrect behavior pass.

## Commands

Use `backend/bin/console`, `backend/phpunit.xml`, Composer, npm, and the commands documented in `docs/plan/15-operations.md`. Do not report a command as executed without current evidence.

## Documentation/status

Update contracts before implementing an approved behavior change. Update `docs/implementation-status.md` only with actual evidence. Never commit credentials, fabricated results, or generated browser artifacts unless the plan explicitly requires them.
