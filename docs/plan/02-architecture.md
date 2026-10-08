# Architecture

## Canonical runtime

Use a framework-free PHP modular monolith:

```text
public/index.php → bootstrap → Request → Router → guards → controller
→ application service → domain rules → PDO repository → MySQL
→ serializer/PHP view → Response → emitter
```

Repository layout:

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
├── src/views/        # escaped PHP templates
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

## Runtime and dependency boundary

Laravel retirement is complete. `public/index.php`, `bootstrap/http.php`,
`routes/web.php`, `routes/api.php`, and `bin/console` are canonical. There are
no temporary parallel entrypoints, dual writes or legacy data/session import.
Rollback uses Git and a consistent database/private-storage backup, as described
in [Operations](15-operations.md).

Composer packages provide focused infrastructure: `vlucas/phpdotenv`,
`ramsey/uuid`, `monolog/monolog`, `egulias/email-validator`, and development
`phpunit/phpunit`. No Laravel, Illuminate, application framework, ORM or
automatic service container belongs in the runtime.

## Frontend boundary

Keep same-origin cookies and `/api/v1`. Preserve existing browser contracts
unless an approved interface change replaces them. Escaped PHP templates and
Vite's manifest serve the app; build output lives in `backend/public/build`.
Do not add token authentication or CORS for application APIs.

## Failure policy

- Expected validation/domain errors become stable 4xx JSON responses.
- Unexpected failures are logged with request ID and redacted context, then return generic 500/503 responses.
- Database and provider errors do not expose SQL, bindings, prompts, paths, tokens, or credentials.
- API responses remain machine-readable; HTML requests receive safe error pages.
