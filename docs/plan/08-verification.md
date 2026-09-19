# Migration Verification and Acceptance Gates

## Test architecture

- Pure algorithms: PHPUnit unit tests with injected Clock/provider/transport.
- Persistence, ownership, transactions, locks, collations, and migrations: real MySQL `goals_test`.
- HTTP/session/CSRF/uploads/streams: plain in-process harness plus real HTTP for cookie/stream behavior.
- Browser modules: `node:test` with fake time/order.
- Critical product flows: Playwright against built application.

Tests name the observable result and condition, use fixed expected values, and
assert response/return value plus persisted state and side effects. Each test
owns its data. Time, UUID/random generation, retry sleep, and outbound network
are injected or faked; required tests never call the live AI provider. Unit
tests own exhaustive pure-rule matrices, while one HTTP case proves each rule
is actually wired so duplicate high-layer coverage stays bounded.

Before cleanup, target tests require environment `testing`, configured database `goals_test`, and actual `SELECT DATABASE()='goals_test'`. Use independent committed connections for concurrency tests.

## Existing parity gate

Port every existing test scenario from Authentication, AccountContract, Notes, NoteQueryContract, LabelContract, Files, FileIntegrity, RateLimit, SecurityContract, and TextNormalizer. Keep all JavaScript cases. Add real HTTP CSRF, HEAD/range, Unicode disposition, template escaping/bootstrap JSON, and microsecond timestamp coverage.

## Critical new cases

1. Goal nesting works beyond 1,000 levels without recursive SQL/PHP stack failure.
2. Self/ancestor and simultaneous inverse hierarchy moves are rejected.
3. Exactly one Goal and Task primary parent is enforced.
4. One source contributes to multiple Goals without moving or changing progress.
5. Contribution/dependency graph cycles and cross-owner edges fail.
6. Milestone B cannot complete before prerequisite A.
7. A Task under B can complete while B is unavailable.
8. Completing A unlocks B; unfinished Tasks require acknowledgement only.
9. Checklist and Task status remain independent in both directions.
10. Goal progress avoids double-counting Milestone Tasks and excludes recurring work/Habits/contributions.
11. Habit check-in and reversal are idempotent and timezone-correct.
12. Daily/weekly recurrence handles interval, weekdays, end date, DST, retries, concurrency, pause/resume/end.
13. Activity replay/reversal/re-completion cannot inflate the grid.
14. Review periods remain timezone-stable; finalized snapshots remain immutable.
15. AI-created structures pass the same validations as manual creation.
16. Malformed/stale/cyclic/foreign AI proposals fail; Apply replay is idempotent; partial failure rolls back all.
17. One user cannot read, mutate, relate, select, review, or send another user's data to AI.

## Phase gates

- M00: legacy baseline and contracts reproducible.
- M01: fresh/no-op/checksum/guard migrations and PDO/bootstrap tests pass.
- M02: auth/settings/routes/session/CSRF/error parity passes.
- M03: complete Notes/Tags parity and existing JS passes.
- M04: private files, ranges, compensation, cleanup pass.
- M05: full parity/browser smoke/build passes with Laravel absent.
- M06: all core domain invariant/HTTP/UI cases pass.
- M07: Habit/recurrence algorithm, persistence, command, and UI cases pass.
- M08: Dashboard/Activity/Review cases pass.
- M09: fake-provider AI contract and approval cases pass; optional live smoke is separate.
- M10: final gates below pass.

## Final commands

Expected target commands after implementation:

```bash
cd backend
composer validate --strict
composer check-platform-reqs
php bin/console migrate:check
php bin/console routes
vendor/bin/phpunit -c phpunit.xml

cd ../frontend
npm ci
npm run test:unit
npm run format:check
npm run build
```

Also run first-party PHP syntax checks, clean Composer install, empty database migration twice, dependency/source scan, production startup, maintenance commands, secret scan, and Playwright critical paths.

## Manual critical path

Register/login/logout/password invalidation; Note autosave/recovery/two-tab conflict; private upload/preview/range/download/delete; deep Goal tree and rejected cycle; Milestone prerequisite plus allowed Task completion; Task status/Checklist independence; Task Note; multi-Goal contribution; Tag hierarchy; Habit check-in/undo; recurrence across timezone boundary; weekly selections/activity; Review finalize/reopen; AI generate/reject/apply/replay; cross-account probes; 360/768/1440 layouts, keyboard, dark mode, and 200% zoom.

## Evidence rules

Record date, runtime/database/browser versions, command and exit status, test/assertion counts, artifact path, and unrun limitations in `docs/verification.md`. Mocks do not prove SQL/HTTP behavior. A static screenshot does not prove authorization. An implementation remains incomplete when required evidence was not run.
