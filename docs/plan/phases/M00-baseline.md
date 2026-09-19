# M00 — Baseline and Contract Freeze

Status: Verified on 2026-09-17.

## Objective

Make the current behavior reproducible before target code changes.

## Why this phase comes now

This comes first because parity failures otherwise cannot be separated from legacy defects.

## Required reading

Audit, scope, architecture, HTTP, autosave, verification. Inspect all existing tests, routes, migrations, actions, resources, templates, and frontend HTTP/autosave modules.

## Files affected

All existing routes, migrations, application services, resources, templates,
browser HTTP/autosave modules, and tests are read as baseline inputs.

## Files to create

Create `backend/tests/Contract/` and
`backend/tests/Support/ContractFixtures.php` only when reusable fixtures are
needed.

## Files to modify

Modify existing backend/frontend tests only for missing observable coverage.
Update `docs/verification.md` and `docs/implementation-status.md`.

## Files to remove

None.

## Detailed implementation steps

### M00.1 Preserve repository state

Record `git status --short` and current dependency/route/schema versions. Never reset or absorb unrelated changes. Identify which untracked tests are part of the baseline.

### M00.2 Freeze HTTP/schema contracts

Capture deterministic success/failure JSON for session, Notes, Labels, profile/preferences/password, attachments, and avatar. Record status, headers, ID/timestamp formats, pagination, error codes, unknown-field rejection, no-op/replay/conflict/tombstone behavior. Redact tokens and data.

### M00.3 Close baseline gaps

Add behavior tests for microsecond timestamps, HEAD and range semantics currently expected, true real-HTTP CSRF, safe bootstrap JSON, and private response headers. If current implementation fails a new expectation, record it as a target correction; do not rewrite unrelated legacy behavior silently.

### M00.4 Re-run baseline

Run guarded PHPUnit, JS tests, format check, production build, Composer checks, route list, schema inspection, and PHP syntax. Update actual counts.

## Business rules

M00 does not change product behavior. A legacy failure against a newly written
target requirement is recorded as a target correction, not silently fixed or
redefined. No test may access an unresolved database or include secrets in a
fixture.

## Risks

Dirty-worktree loss, test database misuse, mistaking partial browser evidence for automated coverage.

## Validation

Compare route/schema/dependency inventories to the repository audit, inspect
fixture redaction, and confirm status/diff contains no unrelated rewrites.

## Tests

Run guarded Laravel PHPUnit, all Node tests, formatting checks, Vite production
build, Composer validation/platform checks, route listing, schema inspection,
and first-party PHP syntax validation. Record exact versions/counts and every
unrun browser limitation.

## Exit criteria

- Baseline commands and results are dated in verification.
- Required parity scenarios have a current test or explicit target correction.
- Working-tree changes remain intact.
- M01 can compare target behavior to a stable contract.
