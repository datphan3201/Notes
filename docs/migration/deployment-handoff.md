# Paused deployment preparation — 2026-11-08

[Status](status.md) · [Selected deployment guide](render-vercel-supabase.md) · [Routes](deployment-routes.md)

**Paused at the user's explicit request.** Resume only when the user asks. This handoff records local preparation for **Render + Vercel + Supabase**; nothing has been deployed to those hosted services.

## Scope and current state

- Branch: `feat/personal-ai-planner-v1`. The existing dirty workspace and mostly untracked migration files remain intact. No commit, Git push, merge to `main` or production cutover was performed.
- Target: Vercel frontend, Render API/worker, Supabase PostgreSQL/pgvector and private Storage. FastAPI retains authentication, sessions and authorization. Google Cloud provisioning is deferred.
- The prepared Render template uses one Free web service with separate supervised API/worker processes. The user has confirmed the choice of the **Free trial (colocated polling worker)**. Free is the trial template, not authorization to buy resources or a promise of continuous background processing. Sleep pauses AI job processing, reminders, recurrence and retention until the service wakes.
- Supabase/Render/Vercel projects, real public origins and credentials have not been configured here. Setup and infrastructure provisioning are deferred per user request. None of their CLIs is installed; no Vercel project is linked and no conventional cloud-auth tokens were present in the current process environment at inspection.
- No real-data upload, import, database reset or schema/file transfer to Supabase occurred. Local `planner_dev`, source MySQL, private files and backups remain preserved.
- Assistant context selection remains deferred as **ISSUE-063**; it was not implemented as part of deployment preparation.

## Implemented locally

| Artifact | Work completed |
| --- | --- |
| [Render blueprint](../../render.yaml) | Free Docker web service, feature branch, readiness, manual deploy trigger, bounded pools and secret placeholders; no paid worker/disk/database |
| [Container entry point](../../apps/api/planner/serve.py), [Dockerfile](../../apps/api/Dockerfile) | Optional forward migrations before startup; supervise API and durable polling worker, stop siblings on exit/signal; a worker crash exits the container |
| [Configuration](../../apps/api/planner/config.py), [environment example](../../apps/api/.env.example) | Supabase storage fields, polling mode, colocated worker/startup migration flags and HTTPS email key; production validation still requires private storage, HTTPS, encryption and mail |
| [Storage](../../apps/api/planner/storage.py) | Private Supabase REST upload/read/remove using a server-only legacy `service_role` JWT; no overwrite/public object links, bounded upload, safe API errors; existing local/GCS paths retained |
| [Database](../../apps/api/planner/db.py), [Alembic environment](../../apps/api/migrations/env.py) | Configurable application schema/search path and schema-local version table; drift comparison excludes Alembic's own management table. Latest revision remains `0005`; no new revision |
| [Mail](../../apps/api/planner/accounts.py), [jobs](../../apps/api/planner/jobs.py) | HTTPS Resend delivery with durable-job retry idempotency; SMTP remains supported locally. HTTPS delivery is needed for Render Free's blocked SMTP ports |
| [Legacy importer](../../apps/api/planner/migrate_legacy.py) | Rejects cloud storage for the existing local-only file import; no new cloud-data migration bypass |
| [Deployment helper](../../tools/deploy/planner_v1.py), [tests](../../tools/deploy/tests/test_planner_v1.py) | Vercel plans accept a Render HTTPS backend without incorrectly telling the operator to start Funnel |
| [Cloud adapter tests](../../apps/api/tests/test_render_supabase.py), [test fixtures](../../apps/api/tests/conftest.py), [browser configuration](../../apps/web/playwright.config.ts) | Isolated adapter/ownership, schema, mail, process lifecycle checks and disconnected test provider settings |
| [CI](../../.github/workflows/planner-v1.yml) and documentation | Render blueprint changes trigger migration CI; selected topology, setup, Free limitations and hosted gates documented |

## Executed verification

All database cleanup/rehearsals used guarded `planner_test`, never development/source data. Supabase Storage and Resend tests used mock HTTP transports; no live Supabase or Resend acceptance is claimed.

| Check | Result / ignored local evidence |
| --- | --- |
| Complete PostgreSQL backend suite | **127 passed**; `output/playwright/render-supabase-api.log` |
| Frontend unit suite | **19 passed**; `output/playwright/render-supabase-web-unit.log` |
| Focused desktop/mobile browser suite | **22 passed**; `output/playwright/render-supabase-browser.log`; covers AI, email recovery/MFA/change, private files/sharing, moderation evidence and Habit/Review. The full 62-case suite was not rerun in this deployment follow-up |
| TypeScript | Passed; `output/playwright/render-supabase-web-typecheck.log` |
| Production Next build | Passed with `VERCEL=1`, isolated `.next-vercel-check` and a **placeholder** Render HTTPS `API_ORIGIN`; `output/playwright/render-supabase-web-build.log`. This is compilation, not a hosted Render connectivity test |
| Docker image | Built `planner-api:render-trial`; `output/playwright/render-supabase-image.log` |
| Actual Docker runtime probe | Production-mode readiness, private-schema migration through `0005`, no Alembic drift, one polling worker completes a synthetic job, restart retains that job, killing the worker exits the whole container with code 1; `output/playwright/render-supabase-container.log` and `render-supabase-container-runtime.log` |
| Deployment command contracts | **4 passed**; `output/playwright/render-supabase-deploy.log`; plans never invoke cloud services |
| Render blueprint | Validated against `https://render.com/schema/render.yaml.json`; no hosted blueprint import performed |
| Static/document checks | Ruff and documentation sync/check passed; final handoff checks run with this documentation update |

The temporary Docker probe containers and generated private test schemas were cleaned up. The test image remains local. Earlier failed probe attempts were superseded by the final successful runtime probe. One attempt used the wrong expected job status (`done` instead of the existing `completed`); a subsequent check exposed and fixed Alembic's private-schema version-table reflection discrepancy without relaxing business-table drift checks. Pytest still emits the existing Starlette/httpx deprecation warning.

## Runtime left running

At pause, the local frontend/API/worker had been restarted after the old local processes were found stopped. The existing Funnel handler was preserved, and read-only checks passed for both public `/login` and `/api/v1/health` at **https://tdat.tail431746.ts.net**.

- Next.js Fast Refresh: `127.0.0.1:3000`; API reload: `127.0.0.1:8001`; watched `python -m planner.jobs` worker.
- Existing development PostgreSQL: port 5433, `planner_dev`; isolated tests: port 5434, `planner_test`. No Supabase storage switch was applied to the live development environment.
- Runtime logs: `output/playwright/render-prep-dev-web.log`, `render-prep-dev-api.log`, `render-prep-dev-worker.log`.
- Private development configuration still reported AI, embeddings and SMTP configured. No credentials were printed or copied into the blueprint/frontend.

These are observations at pause, not guarantees that long-running processes survive a later terminal/session shutdown. Check runtime state before starting replacements; preserve existing handlers and avoid duplicate workers.

## Resume from here

1. Re-read this handoff and inspect current branch/diff/runtime. Preserve unrelated dirty work; no need to redo the completed local implementation.
2. The worker operating choice is resolved: **Free trial (colocated polling worker)**.
3. Code preparation is complete and verified locally across backend, frontend, Docker container, schema validation and deployment scripts. Infrastructure provisioning/setup is deferred until explicitly requested.
4. When ready to set up Cloud services:
   - Connect the intended Render, Vercel and Supabase accounts/projects and choose real stable origins/regions. Configure secrets through platform settings/private environment files, not Git, frontend code or chat. Render needs the Supabase database URL/service-role key, stable encryption key, email sender/HTTPS email key and AI provider configuration.
   - Prepare the dedicated Supabase project: enable pgvector, keep schema `planner` outside the exposed Data API, create the private bucket `planner-private` and verify the actual Session pooler/TLS connection.
   - Review/publish the feature branch `feat/personal-ai-planner-v1`, import the Render blueprint and deploy the Vercel frontend against the real Render origin.
   - Run hosted acceptance gates in the [deployment guide](render-vercel-supabase.md).
