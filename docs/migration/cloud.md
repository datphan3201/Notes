# Cloud deployment and operations

[Migration plan](personal-ai-planner.md) · [Development](development.md) · [Release status](status.md)

The application no longer needs a personal machine or a tunnel for its target deployment. This runbook prepares Vercel, Cloud Run, PostgreSQL/pgvector, private object storage, Cloud Tasks and a scheduler. No cloud resources have been created or verified by writing this document. Deployment needs actual project access, region/domain choices, secret values and a billing budget.

The user's current cloud selection is [Render + Vercel + Supabase](render-vercel-supabase.md), with Funnel retained for local testing. Google Cloud provisioning is deferred. The instructions below describe the earlier optional managed-cloud design, not the active trial route.

## Deployment units

| Unit | Configuration |
| --- | --- |
| Next.js | Vercel root directory `apps/web`; Node 22; `npm ci` / `npm run build`; set `API_ORIGIN` to API Cloud Run URL |
| API | Build `apps/api/Dockerfile`; default command runs `planner.main:app`; bounded CPU/concurrency/instance count |
| Worker | Same image, command `uvicorn planner.worker_api:app --host 0.0.0.0 --port 8080`; require Cloud Run IAM; 600-second request timeout |
| Migration | Same image, one-off job `alembic upgrade head`, before serving a schema-dependent release |
| PostgreSQL | Managed PostgreSQL 17 with pgvector enabled and TLS or Cloud SQL connector/socket; isolated per environment |
| Files | Private GCS bucket, uniform bucket access, public access prevention; runtime service account receives only required object permissions |
| Queue | Cloud Tasks HTTP queue; delivery service account can invoke worker; cap dispatch concurrency and retry budget to provider/DB capacity |
| Scheduler | Authenticated POST `/internal/schedule` each minute, which persists recurring/reminder jobs and dispatches committed queued work |

API and worker use shared PostgreSQL state rather than replica-local sessions, rate buckets, AI runs or job state. Provision at least two independently deployable services from the same Python package; this is process isolation within a modular monolith.

## Secrets and identity

Use Secret Manager for the database URL, AI API key, SMTP password and Fernet encryption key. Bind secrets to Cloud Run through secret references. Do not put secret values in image build arguments, GitHub workflow YAML, Terraform state committed to Git or logs. Use workload identity federation for CI rather than downloaded service-account JSON keys.

Set API/worker environment variables from the [example](../../apps/api/.env.example): `PLANNER_ENVIRONMENT=production`, the exact HTTPS browser origin, private bucket, provider models and prices, SMTP configuration and bounded database pools. The production configuration refuses missing HTTPS/storage/email/encryption/worker identity settings. Account emails use the browser origin and tokens in URL fragments, not query strings.

Set `PLANNER_WORKER_AUDIENCE` to the worker's HTTPS service URL and `PLANNER_WORKER_SERVICE_ACCOUNT` to the Cloud Tasks/Scheduler caller identity. Set `PLANNER_CLOUD_TASKS_QUEUE` to `projects/PROJECT/locations/REGION/queues/QUEUE`. Cloud Tasks uses that exact URL as OIDC audience and posts to `/internal/jobs/{id}`. The worker verifies the token signature, issuer/audience and caller email, in addition to Cloud Run IAM. A request header naming a task is not authentication. Do not expose the worker as a public unauthenticated service.

The API never calls a provider or task queue during a normal CRUD transaction. Committed `jobs` rows are the outbox. The scheduler dispatcher publishes named Cloud Tasks and marks delivery after publication; retries after a crash reuse the same name. Database leases and unique business keys defend duplicate delivery. Expired leases can be redelivered. The scheduler interval currently contributes up to about one minute to queue delay; benchmark and shorten through a dedicated dispatcher when required.

## Resource budget

Begin with `PLANNER_POOL_SIZE=5`, `PLANNER_POOL_OVERFLOW=2` and one Python process per instance. Count API and worker instances together: total maximum connections = sum of maximum instances × 7, plus migration/admin headroom. Configure Cloud Run maximum instances to fit the actual managed database limit. A larger application concurrency value does not increase the pool. Add a provider-supported pooler if measurement requires one; test prepared statement/transaction-pooling compatibility first.

Keep API request timeouts short; separate AI deadlines and queue wait from ordinary request latency. Bound Cloud Tasks dispatch concurrency and model context/tool steps. Configure edge request limits and a trusted proxy policy so rate-limit client addresses reflect real clients behind Vercel/Cloud Run; do not blindly trust user-supplied forwarding headers. Establish explicit storage, chat and embedding budgets before a paid release. Chat token reservations and storage quotas exist; complete embedding/provider billing calibration is a release gate.

## Monitoring and recovery

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to a collector and `OTEL_SERVICE_NAME` per service to enable HTTP/SQL spans. The code does not attach prompts, Note content, cookies or SQL bindings. Enable cloud log ingestion/error alerts for HTTP errors, p95/p99, pool waits, queue age/dead jobs, run failures, tokens and estimated cost. Prices are operator settings: a zero configured price means unpriced, not free. Verify real trace collection and redact headers before enabling any additional auto-instrumentation.

Enable managed PostgreSQL automated backups/PITR and bucket versioning/retention appropriate to the data policy. Rehearse restoration into a separate environment, check row/file checksums, and run two-account authorization and migration acceptance there. Record recovery time and recovery point objectives from the drill; configuration alone is not evidence of recoverability.

For schema changes, use forward Alembic revisions and expand/contract releases. Run migrations once as a controlled job, never from every API replica at startup. Deploy the worker and API against compatible schemas, then the web build. Keep the previous image/release available. Roll back ingress only while data compatibility permits it; do not route back to old MySQL after new PostgreSQL writes without reconciling those writes.

Cloud rollout, live AI/SMTP, database/file restore and sustained load acceptance remain unverified until run against configured staging resources. See the [implementation status](status.md) and [open issues](../issues.md).
