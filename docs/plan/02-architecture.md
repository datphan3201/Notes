# Current and Target Architecture

## Current system

The current system is a same-origin Laravel modular application. Blade renders HTML from `frontend/src/views`, browser modules call `/api/v1`, Eloquent persists to MySQL, database sessions authenticate users, and Vite emits to `backend/public/build`.

The current request path is:

```text
public/index.php → Laravel kernel/middleware → route → controller
→ action/query → Eloquent/MySQL → resource/Blade → response
```

## Target system

Use a framework-free PHP modular monolith:

```text
public/index.php → bootstrap → Request → Router → guards → controller
→ application service → domain rules → PDO repository → MySQL
→ serializer/PHP view → Response → emitter
```

Target layout:

```text
backend/
├── public/
├── bootstrap/
├── config/
├── routes/
├── src/
│   ├── Config/
│   ├── Support/
│   ├── Domain/{Account,Notes,Tags,Planning,Habits,Recurrence,Activity,Reviews,AI}/
│   ├── Application/{Account,Notes,Tags,Files,Planning,Habits,Recurrence,Dashboard,Reviews,AI}/
│   ├── Infrastructure/{Database,Persistence,Session,Storage,Logging,AI}/
│   ├── Http/{Controller,Routing,Security,Validation,View}/
│   └── Console/
├── bin/console
├── database/plain-migrations/
├── storage/
└── tests/
frontend/
├── src/views/        # ordinary PHP templates after cutover
├── src/js/
├── src/css/
└── tests/js/
```

## Layer contracts

- `Http`: parse requests, call one use case, serialize responses. No SQL or domain decisions.
- Application services: authorize, define transaction boundaries, coordinate repositories and domain services.
- Domain services/value objects: pure invariants and state transitions.
- Repositories: parameterized SQL, hydration, and explicit locks. No HTTP knowledge.
- Bootstrap: constructs every concrete dependency. No service locator or reflection container.
- Views: receive arrays/view models only. No repository or model calls.
- Provider adapters: translate external protocols; never mutate domain tables directly.

Interfaces are justified only for Clock, private storage, AI provider, and outbound HTTP transport. Repositories may remain concrete.

This layer-first tree is mandatory. Do not create parallel roots such as
`src/Notes`, `src/Files`, or `src/Auth`. The module name is the second segment
under Domain/Application and the final segment under PDO persistence. Shared
classes belong in Support only when at least two modules actually use them.

## Coexistence and cutover

1. Add `Planner\\` → `backend/src/` while current `App\\` Laravel code remains.
2. Use separate `goals_dev`/`goals_test` databases for the target runtime. The fresh-install decision removes legacy import requirements.
3. Expose the target temporarily through `public/plain.php` and `routes/plain.php`; do not route production traffic to it.
4. Port and verify Auth, Notes, Tags, and Files.
5. Convert templates and Vite integration.
6. Promote the target to `public/index.php` and standard route/bootstrap files.
7. Remove Laravel only after parity gates pass.

The cutover rollback is the existing Laravel entrypoint and databases until M05 acceptance. After Laravel removal, rollback is Git plus database restoration; never maintain dual writes.

## Dependency disposition

Keep as explicit focused packages: `vlucas/phpdotenv`, `ramsey/uuid`, `monolog/monolog`, `egulias/email-validator`, and `phpunit/phpunit` for development. Remove Laravel, Illuminate, Laravel Boost/Pint, Collision, Mockery after callers are gone. Do not retain Symfony routing, HTTP kernel, or templating as an application framework.

## Frontend boundary

Keep same-origin cookies and `/api/v1`. Preserve existing JS modules unless an interface changes. Replace Blade syntax with escaped PHP templates and replace `laravel-vite-plugin` with Vite's manifest. Do not add token auth or CORS for application APIs.

## Failure policy

- Expected validation/domain errors become stable 4xx JSON responses.
- Unexpected failures are logged with request ID and redacted context, then return generic 500/503 responses.
- Database and provider errors do not expose SQL, bindings, prompts, paths, tokens, or credentials.
- API responses remain machine-readable; HTML requests receive safe error pages.
