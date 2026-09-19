# M03 — Notes and Tag Compatibility

Status: Verified on 2026-09-17. Depends on M02.

## Objective

Port the application's central working domain before files/templates/cutover.

## Why this phase comes now

Notes and Labels are the largest current behavioral surface and depend on M02
identity/HTTP contracts; Files in M04 require stable Note ownership and
tombstone behavior.

## Required reading

HTTP, autosave, database, domain Tag rules, M00 fixtures. Inspect existing Note/Label actions, query, models, resources, validators, controllers, tests, and JS request shapes.

## Files affected

Every current Note/Label action, query, model, request, resource, controller,
their target equivalents, migrations/routes/wiring, and Notes browser modules.

## Files to create

- `backend/src/Domain/Notes/{NoteRecord,NoteSnapshot}.php`
- `backend/src/Domain/Tags/TagRecord.php`
- `backend/src/Application/Notes/{NoteService,NoteListQuery,NoteSerializer}.php`
- `backend/src/Application/Tags/{TagService,LabelSerializer}.php`
- `backend/src/Infrastructure/Persistence/Pdo/{Notes,Tags}/*Repository.php`
- Target controllers/validators under `backend/src/Http/`

Modify routes/bootstrap/migrations/tests. Remove nothing.

## Files to modify

Target routes, explicit bootstrap wiring, migration registry/schema, target
tests, `frontend/src/js/notes/notes-page.js` only for the documented UUID
fallback, and status/verification evidence.

## Files to remove

None.

## Detailed implementation steps

### M03.1 Read/serialize

Implement owner-scoped active/detail/list/tombstone lookups, batched Tags/attachment counts, literal LIKE escaping, ANY Tag filter, deterministic pin/update/ID order, 30-row pagination, UTC timestamp serialization, and private-field exclusion.

### M03.2 Note mutations

Port stable UUID create replay/collision behavior; complete-snapshot update; desired-state no-op before version conflict; Tag ownership validation; pin time behavior; scrubbed deletion tombstone; pending attachment cleanup references. Lock owner then Note/Tags in stable order.

### M03.3 Label compatibility

Port create/rename/delete, case-insensitive/accent-sensitive uniqueness, quotas, duplicate race mapping, affected-Note version increments, and no partial pivot changes. Keep `/api/v1/labels` exact. Do not add hierarchy/color until M06 migrations and `/tags` contract.

### M03.4 Browser compatibility

Run existing JavaScript without endpoint changes. Correct UUID fallback using secure valid v4 generation and add a no-secure-random error test.

## Business rules

Full-snapshot Note updates, replay/no-op/conflict/tombstone precedence, owner
scoping, literal search, deterministic ordering, quotas, and label compatibility
remain unchanged. Tag hierarchy is not introduced before M06.

## Risks

Eloquent/PDO order or collation drift, stale requests overwriting Notes,
incorrect timestamp/version increments, wildcard injection, N+1 queries,
quota races, and frontend request-shape drift.

## Validation

Compare canonical M00 fixtures field-for-field, inspect critical SQL with
`EXPLAIN`, measure bounded query counts, and run Notes in the isolated target
entry without changing production routing.

## Tests

Port every Note/Query/Label/Security contract; test HTML literal content, wildcard escaping, owner isolation, replay/no-op timestamp stability, stale conflicts, deletion races, quotas/concurrency, query count boundedness, microseconds, unknown fields, valid UUID fallback.

## Exit criteria

Current Notes/Labels API fixtures and all related JS cases pass against target; no Eloquent/Illuminate code is used in target path.
