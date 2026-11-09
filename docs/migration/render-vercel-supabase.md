# Render, Vercel and Supabase deployment

[Routes](deployment-routes.md) · [Status](status.md) · [Open issues](../issues.md)

The user selected this cloud combination on 2026-11-08. Repository deployment records report production deployment on 2026-11-08 (not freshly checked by this document): Vercel frontend (`https://planner-t1.vercel.app`), Render Singapore backend (`https://planner-api-sg.onrender.com`), and Supabase PostgreSQL (schema `planner`). For live operations, environment variables, health checks and incident runbooks, see the [Cloud operations guide](../operations/cloud.md).

## Topology and Free limitations

```mermaid
flowchart LR
    Browser --> Web[Next.js on Vercel]
    Web -->|same-origin API rewrite| API[FastAPI on Render]
    API --> DB[(Supabase PostgreSQL / pgvector)]
    API --> Files[Private Supabase Storage]
    Worker[Python polling worker on Render] --> DB
    Worker --> Files
    Worker --> AI[Configured AI provider]
    Worker --> Mail[HTTPS email provider]
```

[render.yaml](../../render.yaml) requests one **Free web service**. The Docker entry point supervises separate API and polling-worker processes in that container. Jobs, leases and retries remain durable in PostgreSQL rather than request-local background tasks. A child failure stops its sibling and exits the container. Forward migrations run before either process starts. No paid worker, disk or Render database is requested.

[Render Free](https://render.com/docs/free) can sleep without inbound traffic, may restart and has ephemeral storage; verify current plan behavior in the provider dashboard before relying on exact limits. Both processes pause while asleep. New traffic wakes the service, but overnight reminders/recurrence/retention are not guaranteed to run on schedule. Interrupted jobs resume after lease expiry and normal retries. Do not add fake keepalive requests or describe the trial as always-on. Monthly service-hour and external service-initiated traffic limits also apply.

For continuous background processing, create a paid Render worker from the same image with command `python -m planner.jobs`, `PLANNER_WORKER_MODE=poll` and the same private settings. Set `PLANNER_RUN_WORKER=false` on the API and run migrations before releasing the worker. Start with one worker. API sleep is independent if it remains on Free. Billing changes require a separate operator decision.

## Supabase preparation

Use a dedicated project/environment. FastAPI retains account authentication, sessions, ownership and Note permissions; this route does not migrate accounts to Supabase Auth.

1. Enable the `vector` extension for the existing 1536-dimensional embeddings.
2. Use application schema **`planner`**; leave it out of Data API exposed schemas and grant no `anon`/`authenticated` access. Disable Data API if unused. See [API isolation](https://supabase.com/docs/guides/api/securing-your-api). Alembic creates its tables/version record in the selected schema; local development retains `public`.
3. Copy the actual **Connect → Session pooler** string, using port 5432 when IPv4 is needed. Use `postgresql+psycopg://` and require TLS. Do not guess the pooler hostname or role suffix. Direct connections may require IPv6; transaction mode on port 6543 has prepared-statement/session-state restrictions. See [connection modes](https://supabase.com/docs/guides/database/connecting-to-postgres).
4. Create **`planner-private` as a private bucket** with no anonymous read/write policy. API file routes authorize every request and proxy bytes; no public object URLs are returned. The adapter uses the server-only legacy `service_role` JWT, never an anon/publishable key. See [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals) and [service keys](https://supabase.com/docs/guides/storage/security/access-control).

The committed blueprint gives each API/worker process a 4+2 pool: at most twelve application connections together, plus migration/admin headroom. Check actual project limits. Never point test cleanup or the legacy importer at a managed database. Rehearse the `public` → `planner` schema mapping and file checksum transfer on isolated data before any separately authorized cutover; ISSUE-046 remains open.

## Render preparation

Review the blueprint on `main` and the intended existing Render service before a manual release. The template service name `planner-api` differs from recorded deployed `planner-api-sg`; avoid creating a duplicate unintentionally. Importing/deploying requires the intended account/repository access. Auto deploy is disabled.

Supply these `sync: false` fields through Render's secret settings:

| Setting | Value |
| --- | --- |
| `PLANNER_DATABASE_URL` | Supabase Session pooler URL with TLS (e.g. `postgresql+psycopg://...` or `postgresql://...`, automatically normalized) |
| `PLANNER_WEB_ORIGIN` | Stable Vercel/custom HTTPS origin (trailing slashes automatically trimmed) |
| `PLANNER_SUPABASE_URL` | Project HTTPS origin, e.g. `https://PROJECT.supabase.co` |
| `PLANNER_SUPABASE_SERVICE_ROLE_KEY` | Server-only legacy `service_role` JWT |
| `PLANNER_RESEND_API_KEY` | Server-only Resend API key for HTTPS delivery |
| `PLANNER_AI_BASE_URL`, `PLANNER_AI_API_KEY`, `PLANNER_AI_MODEL`, `PLANNER_EMBEDDING_MODEL` | (Optional) Compatible-provider endpoint, credentials and models |

The blueprint automatically manages:
- `PLANNER_ENCRYPTION_KEY`: Auto-generated persistently by Render via `generateValue: true` (or accepts custom 32+ character / Fernet keys).
- `PLANNER_SMTP_FROM`: Pre-configured to `Planner <onboarding@resend.dev>` (can be overridden with an approved custom domain sender).
- `PLANNER_ENVIRONMENT`: `production`.
- `PLANNER_DATABASE_SCHEMA`: `planner`.
- `PLANNER_SUPABASE_STORAGE_BUCKET`: `planner-private`.
- `PLANNER_WORKER_MODE`: `poll`, colocated worker and migration-on-start.
- Failures on startup aggregate all missing/invalid production requirements in a single clear diagnostic checklist.

The recorded topology uses HTTPS mail rather than relying on Free-tier outbound SMTP; verify current provider restrictions for the intended plan. The new HTTPS [Resend adapter](../../apps/api/planner/accounts.py) supports account/security messages and reminders, with retry idempotency bound to the durable job ID. Configure an approved sender/domain and verify actual delivery/quotas. Free hosting does not include unlimited mail or AI usage. Existing local SMTP and GCS/Cloud Tasks configurations remain supported.

The `/ready` health path checks the database. Readiness does not prove external provider/file/email access or successful jobs; the supervisor separately exits if the worker process dies.

## Vercel preparation

Link only `apps/web`. Set `API_ORIGIN` to the real Render HTTPS origin at **build and runtime**. Next rewrites keep browser API calls, cookies, CSRF, SSE and uploads on the Vercel origin. Keep every database/provider/storage/email key on Render. Use a stable production/custom alias; arbitrary preview URLs are not trusted automatically.

Inspect the command, replacing both placeholders with real origins:

```bash
python3 tools/deploy/planner_v1.py vercel \
  --origin https://your-planner.vercel.app \
  --backend https://your-planner-api.onrender.com
```

The helper prints a plan. `--execute` invokes the Vercel CLI and requires account/project access; it does not create/configure Render or Supabase. After deployment, run the read-only route check:

```bash
python3 tools/deploy/planner_v1.py check --url https://your-planner.vercel.app
```

## Hosted acceptance gates

1. Verify real config, migrations in `planner`, pgvector, readiness, login, CSRF and cross-account 404s. Confirm unauthenticated Supabase Data API requests cannot read business tables.
2. Test private attachment/avatar/background upload, authorized reads, foreign rejection, Note lock/share changes, cleanup and restart persistence. Confirm anonymous bucket reads fail.
3. Verify actual HTTPS mail delivery for verification/recovery/email MFA, using the stable Vercel origin. Retain the encryption key for imported TOTP secrets.
4. Submit a real assistant action through Vercel/Render, observe SSE/poll recovery, confirm one exact proposal and verify idempotent Apply. Test cold starts and interrupted worker recovery.
5. Demonstrate sleep-related reminder/recurrence/retention delays on Free; measure memory, connections, file/AI/email quotas and network timeouts on the chosen plans.
6. Rehearse schema/file transfer, backups, counts, owners, checksums and rollback before moving real data. Never reset `planner_dev`, MySQL or private exports for a cloud trial.

Historical local results and remaining acceptance are recorded in [status](status.md). Repository deployment records do not establish that every hosted gate above has passed; retain separate dated operational evidence.
