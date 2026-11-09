# Running the current runtime

[Plan](personal-ai-planner.md) · [Implementation status](status.md) · [Documentation home](../README.md)

The active application is on `main` in `apps/api` and `apps/web`. PHP/JS runtime paths were removed in `8714dc0`; historical source/private data backups remain separate. Never run importer or test cleanup against development/hosted data outside the specifically guarded authorized transfer workflow.

## Development

Requirements: Node 22, Python 3.12, uv 0.12, Docker with Compose. Dependencies are locked in `apps/web/package-lock.json` and `apps/api/uv.lock`.

To start the full local runtime with automatic updates when code changes:

```bash
bash tools/dev/planner-v1.sh
```

This starts the development PostgreSQL service, applies forward migrations only after checking the configured and actual `planner_dev` database, and launches Next.js Fast Refresh, Uvicorn reload and a watched worker. Python and API `.env` edits restart the appropriate processes. Logs are in ignored `output/playwright/planner-v1-dev/`. The launcher creates a private Fernet key if missing, preserves an existing key, and reads AI/SMTP settings from the ignored API `.env`. Press Ctrl+C to stop its application processes; the persistent database stays available. The approved workspace is connected as described in the [integration record](ui-integration.md).

To share this Next.js/FastAPI runtime through the connected machine's Tailscale Funnel:

```bash
bash tools/dev/planner-v1.sh --funnel
```

Start one launcher per checkout. The Funnel mode discovers the connected MagicDNS hostname, checks that HTTPS 443 has no existing handlers, and publishes only the frontend at port 3000. It supplies the public HTTPS origin, an exact localhost development exception and Next.js's allowed development hostname through process environment variables. API credentials and `.env` files are preserved. Public sessions use Secure/HttpOnly cookies, localhost login remains available, and CSRF tokens are required for writes on both origins. Production rejects development origin exceptions. Email links use the public origin while this launcher runs. Ctrl+C stops its application processes and removes its root Funnel handler; PostgreSQL stays available. The machine, Docker and Tailscale must remain running for this local public URL.

The old PHP launcher/wrapper was retired; `planner-v1.sh --funnel` is the maintained local sharing command.

From the repository root:

```bash
docker compose up -d db --wait
cd apps/api
cp -n .env.example .env
uv sync --frozen --python 3.12
uv run alembic upgrade head
uv run uvicorn planner.main:app --host 127.0.0.1 --port 8001
```

In a second terminal:

```bash
cd apps/web
npm ci
npm run dev
```

Open `http://localhost:3000` consistently; it must match `PLANNER_WEB_ORIGIN`. Do not mix localhost and 127.0.0.1 in the browser. The web app forwards `/api/v1/*` to FastAPI, including session cookies. `API_ORIGIN` is server configuration, not a public provider credential.

Start the durable worker in a third terminal:

```bash
cd apps/api
uv run python -m planner.jobs
```

The worker indexes eligible personal sources, materializes recurring tasks, creates in-app reminders, archives expired History entries and sends queued account emails. It claims persisted jobs with leases, retries transient failures and records dead jobs after five attempts. Business GETs do not do this work. Local files are kept in ignored `apps/api/.private/`; production requires private object storage, with GCS or Supabase adapters supported.

Set SMTP variables to deliver verification/recovery emails. The worker never prints private email links or codes as a fallback. Development permits an unverified account to use the workspace; production requires email verification. Configure a Fernet key in the ignored API `.env` before enabling TOTP. Generate it directly into a secret manager or the private `.env`; do not commit or paste keys into logs.

For AI, set the server-only API key, model and compatible base URL. Set an embedding model that supports 1536 dimensions to enable semantic ranking; otherwise indexing and retrieval use PostgreSQL full-text search. API requests enqueue runs and return immediately. The worker streams provider output into durable run state, and the browser reads SSE snapshots. `propose_changes` stores a preview; only explicit Apply invokes business writes. No provider credentials are needed for deterministic tests.

For optional Funnel-backed development routes, use the [deployment helper and checklist](deployment-routes.md). The Vercel frontend can proxy the existing Funnel backend; Google Cloud is not required for that topology.

## Verification

```bash
cd apps/api
uv run ruff check planner tests migrations
uv run pytest -q
```

Tests require `PLANNER_ENVIRONMENT=testing`, a configured database named `planner_test`, and the actual connection reporting `planner_test`. The test fixture checks those conditions before applying migrations or truncating fixtures. The default test URL targets the ephemeral Compose test database on port 5434; development uses port 5433 and a persistent volume. The fixture uses Alembic, not ORM schema creation, so a missing migration cannot be hidden by test setup.

```bash
cd apps/web
npm run typecheck
npm test
npm run build
npm run build:e2e
npx playwright install chromium
npm run test:e2e
```

Browser tests start their own API/web servers on ports 8101/3100, use the separate `.next-e2e` build and temporary private storage, and can run while the development/Funnel runtime stays on 8001/3000. Start the isolated `db-test` service before browser verification as described in [testing](../testing/README.md). Their harness verifies the configured and actual `planner_test` database before migrating/truncating fixtures. It disables live AI/SMTP credentials, supplies an isolated synthetic MFA key, and exercises authentication plus workspace interactions on desktop and mobile. It does not reuse a development server or run a mail worker. Do not run pytest concurrently with browser tests: both own the same disposable database. CI installs Chromium with OS dependencies before running the same suite. An existing local browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

The separate `.github/workflows/planner-v1.yml` performs these checks against PostgreSQL/pgvector. Legacy PHP CI/tests were removed; current test entry points are in `apps/api/tests` and `apps/web/tests`. The API container is built with `docker build -t planner-v1-api:local apps/api` from the repository root. It runs as an unprivileged user. Use `planner.worker_api:app` as the entry point for an authenticated cloud worker deployment.

## Safe data migration

Export only from an explicitly configured read-only source. Supply its DSN through `LEGACY_MYSQL_DSN`, never a shell argument or a committed file. Choose a private output directory outside the repository and all public web roots.

```bash
cd apps/api
uv run python -m planner.migrate_legacy export --output /private/notes-snapshot --private-files /private/legacy-files
uv run python -m planner.migrate_legacy verify /private/notes-snapshot
```

Set `PLANNER_DATABASE_URL` to a disposable PostgreSQL staging database, apply Alembic there, then import:

```bash
uv run python -m planner.migrate_legacy import /private/notes-snapshot --target-database planner_staging
```

Import normally accepts only the explicitly named `planner_staging` or `planner_test`, verifies the configured and actual database names, requires an empty target, and serializes imports with a transaction advisory lock. A completed identical snapshot replays its receipt without duplicating data. Any relational failure rolls back the import and compensates copied files. It preserves every raw source row, including unsupported fields and all Team records, in private `legacy_records`; supported personal models retain stable IDs, mapped owner IDs, timestamps, dates, versions, note locks, password hashes and activity events. The full legacy activity metadata remains in the archive. Legacy sessions/tokens/vectors are not reused. Existing MFA accounts are blocked for assisted recovery instead of silently bypassing their second factor. Imports do not enqueue AI indexing or send imported content to a provider.

For an explicitly authorized transfer into the running local development database, first verify a PostgreSQL dump and private-storage backup, restore the dump into disposable staging, and rehearse the merge there with `--merge-existing`. Reconcile source counts, owners, graph edges, dates, hashes and private file checksums. Check that source business data has not changed since export. Then stop the development launcher, take a fresh target backup and run:

```bash
uv run python -m planner.migrate_legacy import /private/notes-snapshot --target-database planner_dev --merge-existing
```

This exception requires `PLANNER_ENVIRONMENT=development` and both configured and actual database names equal to `planner_dev`. It preserves existing accounts and records, rejects account ID/email collisions and refuses a different previously imported snapshot. The report distinguishes existing, imported and total counts. Keep writers stopped until reconciliation succeeds, then restart `bash tools/dev/planner-v1.sh`. PostgreSQL and the source MySQL remain separate; this command does not switch legacy ingress or restore removed Teamwork features.

The report deliberately returns `cutover_ready: false`: migration completeness, private file restoration and every preserved feature still require staging acceptance. Raw archival preservation does not make unsupported fields editable in the new product. Retain source backups and follow the [cutover gates](personal-ai-planner.md#data-migration-and-cutover).

## Load and provider checks

Use a synthetic account and provide `PLANNER_LOAD_EMAIL` and `PLANNER_LOAD_PASSWORD` through the environment. The load tool performs authenticated reads and prints throughput, p50/p95/p99 and status counts:

```bash
cd apps/api
uv run python ../../tools/performance/planner_load.py --resource tasks --requests 1000 --concurrency 100
```

Use `/dashboard` separately to assess aggregate query cost. Report fixture sizes and machine/instance limits with results. A local small-data result is not a production capacity promise. Real provider delivery, model quality, production quotas, object storage, cloud IAM, OTLP collection and backup restoration require their own evidence.

## Administrator setup

Roles are server-controlled. After an existing account is verified and the intended target database is checked, an operator can grant or revoke its role locally:

```bash
cd apps/api
uv run python -m planner.admin person@example.com admin
uv run python -m planner.admin person@example.com user
```

These commands write an audit entry. They are not HTTP endpoints; the public UI cannot grant its own role. Administrators use `/admin` to review reports/private evidence, lock or warn ordinary members, manage registration/invitations and set the History count cap (default 1000). Self/admin lock or deletion is refused. No existing development account was promoted by the integration verification.

Profile History rules configure completed/overdue thresholds and an optional retention period. The watched worker schedules hourly archive-only retention jobs; they preserve Activity and Review snapshots. Stopping the worker pauses recurrence, mail, AI and retention processing until it resumes.
