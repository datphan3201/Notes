# M01 — Plain-PHP Foundation

Status: Verified on 2026-09-17. Depends on M00.

## Objective

Create independently bootable configuration, PDO, transactions, migrations, and test infrastructure. No target HTTP route is exposed to normal users yet.

## Why this phase comes now

Every target HTTP/domain phase depends on safe configuration, transactions,
schema migration, time/UUID services, and a non-Laravel test bootstrap.

## Required reading

Architecture, database, security/runtime, operations, verification, M00 evidence.

## Files affected

Composer/autoload, environment example, ignore rules, bootstrap, target schema,
CLI, and target test infrastructure.

## Files to create

- `backend/bootstrap/plain.php`
- `backend/src/Support/{Clock,SystemClock,TextNormalizer,UuidGenerator}.php`
- `backend/src/Infrastructure/Database/{ConnectionFactory,TransactionManager,MigrationRunner}.php`
- `backend/src/Config/{Config,ConfigLoader}.php`
- `backend/bin/console`
- `backend/database/plain-migrations/*.php`
- `backend/phpunit.plain.xml`
- `backend/tests/Plain/{TestCase,Support/*}.php`

## Files to modify

`backend/composer.json`, `backend/composer.lock`, `backend/.env.example`, and
ignore rules.

## Files to remove

None.

## Interfaces

- `Clock::now(): DateTimeImmutable`.
- `TransactionManager::run(callable): mixed`; nested calls participate in the outer transaction and never independently commit.
- Migration files expose immutable name and `up(PDO): void`.
- Config access is typed and immutable after bootstrap.

## Detailed implementation steps

### M01.1 Dependencies/autoload/config

Add `Planner\\` PSR-4 mapping. Promote focused libraries to direct dependencies. Declare ext-gd, curl, sodium, session, fileinfo, intl, mbstring, PDO MySQL, zip. Validate environment values and path containment.

### M01.2 PDO/transactions/time

Configure native prepares, exceptions, associative fetch, UTF-8, UTC, strict SQL. Implement stable nested transaction ownership without silent partial commits. Port TextNormalizer as pure code. Use Ramsey UUID v4.

### M01.3 Migration runner/schema

Implement advisory lock, exact DB guards, ledger/checksum behavior, status/check commands, and all existing fresh-target tables. Never run automatically against legacy DB. Add schema constraints/indexes defined in document 03 only when their owning phase needs them; M01 creates legacy-parity infrastructure tables.

### M01.4 Test harness

Guard environment/configured/actual DB before cleanup. Provide fixture builders and temporary private storage. Tests use committed data where multiple connections are needed.

## Business rules

The target database is always separate from the legacy database. Transactions
are owned by application services; nested calls never commit independently.
Migrations never auto-run on web requests and never continue after checksum or
database-identity failure.

## Risks

Wrong-database cleanup, partial MySQL DDL, implicit PDO conversions, nested
partial commits, non-UTC connections, config/secrets leaking into errors, and
accidentally routing user traffic to the incomplete target.

## Tests

Missing/invalid config; production insecure-cookie refusal; PDO modes/timezone; nested commit/rollback; fresh migration; second no-op; checksum mismatch; advisory lock; wrong DB refusal; timestamp/UUID/normalizer behavior.

## Validation

Run Composer validation/platform checks, `php -l` on new PHP, target PHPUnit unit/integration subsets, `php bin/console migrate:status`, and schema comparison against expected target baseline.

## Exit criteria

Plain bootstrap/CLI/tests work without Laravel kernel; fresh target schema is deterministic and guarded; no application traffic changed.
