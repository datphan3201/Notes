# Testing and verification

[Documentation home](../README.md) · [Manual feature checklist](manual-checklist.md) · [Blank route test sheet](../reference/routes.csv)

## Choose the boundary

| Change | Relevant verification |
| --- | --- |
| Pure graph/progress/recurrence/streak | PHPUnit unit test with fixed inputs and injected time |
| SQL, ownership, transactions, concurrency | Real MySQL goals_test integration test |
| Request validation, sessions, CSRF, authorization, upload/stream | HTTP tests and real HTTP where needed |
| Pure browser state/filter/retry/editor text | Node test runner and fake time/transport |
| Critical UI navigation/drafts/keyboard/theme | Playwright against the intended built/dev app |
| Docs/source links/route coverage | Documentation checker; no business-suite certification implied |

Test observable rules and failure boundaries rather than duplicating implementation. Exact source/test pointers are on each UI component. Inspect sibling tests before naming/structuring new ones. Do not rewrite expectations to make incorrect behavior pass.

## Commands

From backend, after configuring the isolated test database:

```bash
composer validate --strict
composer check-platform-reqs
php vendor/bin/phpunit -c phpunit.xml tests/Plain/Unit
php vendor/bin/phpunit -c phpunit.xml
```

From frontend:

```bash
npm run test:unit
npm run format:check
npm run build
```

From repository root:

```bash
php tools/docs/check.php
php tools/docs/tests/run.php
node --test tools/deploy/tests/*.test.mjs
git diff --check
```

`tests/Plain/Http/RealtimeSocketTest.php` starts `bin/realtime.php` on a random loopback port against goals_test; it needs no other running server. Browser checks of offline mode need a production build (the service worker is not registered under `npm run dev`).

Commands above are procedures, not a current pass report. Run the narrowest relevant checks first. Before any destructive MySQL test cleanup, require APP_ENV=testing, configured database goals_test and actual SELECT DATABASE()=goals_test. The [integration/HTTP test setup](../../backend/tests/Plain/Integration/PlanningCoreTest.php) contains the guard. Never point integration tests at the running app's goals_dev database.

Concurrency cases need independent committed connections and owned fixtures. Inject/fake clocks, UUIDs and external providers. Required tests must not contact live SMTP/AI. Provider delivery, production config, Apache rewrites and backup restoration need separate environment-specific evidence.

## Reporting

Put verification evidence in the commit or pull-request description: revision and local-change scope, environment, exact command, result/assertion counts, selected browser flows and untested edges. A shell HTTP 200 is not a successful UI walkthrough, and historical suite totals do not certify the current worktree. Record unresolved problems in [the open-issue list](../issues.md). [Verification limits](verification-limits.md) explain what each kind of evidence establishes.
