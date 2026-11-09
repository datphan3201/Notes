# Deployment routes

[Development](development.md) · [Integration](ui-integration.md) · [Status](status.md)

The recorded cloud topology is [Render API/worker + Vercel frontend + Supabase database/private files](render-vercel-supabase.md), selected and recorded as deployed on 2026-11-08. This supersedes the earlier Vercel-with-Funnel-only trial. Funnel remains the working local development/test route. VPS and Google Cloud provisioning remain deferred; the [older cloud runbook](cloud.md) is a historical alternative. The helper defaults to printing a plan; `--execute` runs the printed command. Preparation does not create projects or publish a deployment.

The [preparation handoff](deployment-handoff.md) is historical and superseded by deployment/merge. Current release configuration is `main` with manual Render deployment; see [cloud operations](../operations/cloud.md).

## Topology

| Route | Browser frontend | API / worker / database / private files |
| --- | --- | --- |
| Render + Vercel + Supabase | Next.js deployed on Vercel | Render Docker API/polling worker, Supabase PostgreSQL/pgvector and private Storage; [setup and Free limitations](render-vercel-supabase.md) |
| Funnel | Watched local Next.js through the existing HTTPS Tailscale hostname | Local FastAPI, watched durable worker, existing PostgreSQL and private storage |
| Vercel | Next.js deployed on Vercel | `/api/v1/*` proxies through the existing Funnel to the same FastAPI, worker and data |

Vercel uses [external rewrites](https://vercel.com/docs/routing/rewrites), so cookies, CSRF requests, uploads and SSE stay on the browser's own frontend origin. `API_ORIGIN` is server-only configuration, set at both build and runtime. Browser code receives no provider, database or SMTP credentials. The browser uses separate host-only sessions on Funnel and Vercel; it signs in normally on each hostname. The local machine, Docker, worker and Tailscale must remain running for the two Funnel-backed routes. Vercel alone does not host this FastAPI worker or PostgreSQL database.

Google Cloud Run is Google's managed container execution service; the older design used it for the API/worker behind a Vercel frontend. It is a separate provider from Vercel and is not required for the selected trial topology. See [Google's overview](https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run).

## 1. Funnel

From the repository root, inspect the command:

```bash
python3 tools/deploy/planner_v1.py funnel
```

Start it when ports 3000/8001 and the Funnel root handler are available:

```bash
python3 tools/deploy/planner_v1.py funnel --execute
```

This reuses the guarded development launcher: persistent `planner_dev`, forward migrations, private existing `.env`, Next.js Fast Refresh, API reload and watched worker. An existing launcher/handler is preserved and causes a refusal rather than being replaced. Stop the old owner-managed launcher/processes deliberately before trying a new launch. Ctrl+C stops only the launcher's application processes and its own Funnel handler; the database stays available.

When WSL's Linux Docker shim is unavailable, select the working Docker Desktop CLI without changing project configuration:

```bash
export PLANNER_DOCKER_BIN='/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe'
```

Check the existing public route without changing data:

```bash
python3 tools/deploy/planner_v1.py check --url https://tdat.tail431746.ts.net
```

The check requires the real login page and proxied `/api/v1/health` to respond successfully. The health body contains only readiness, no account or provider data.

## 2. Vercel frontend with the existing Funnel backend

Install/authenticate the [Vercel CLI](https://vercel.com/docs/cli), link **only `apps/web`** to the intended project, and determine its stable production/custom hostname. The project configuration is [apps/web/vercel.json](../../apps/web/vercel.json). Do not deploy the repository root or include API `.env`/private files in the frontend project.

```bash
vercel login
vercel link --cwd apps/web
```

Use the actual stable frontend origin in place of `https://your-project.vercel.app`. First inspect and then start the Funnel backend configuration with that primary origin:

```bash
python3 tools/deploy/planner_v1.py funnel --vercel-origin https://your-project.vercel.app
python3 tools/deploy/planner_v1.py funnel --vercel-origin https://your-project.vercel.app --execute
```

The launcher sets that exact origin as `PLANNER_WEB_ORIGIN`, so email verification/recovery/change links return to Vercel. It also allows the exact Funnel origin and localhost for the retained frontend. Wildcards are refused. Arbitrary generated preview deployment URLs are not trusted automatically; use the configured stable alias for testing. These are development-origin exceptions and cannot be enabled in production mode.

In a separate terminal, inspect the deployment command. It supplies the backend origin at both build and runtime because Next rewrites are built with their destination:

```bash
python3 tools/deploy/planner_v1.py vercel --origin https://your-project.vercel.app --backend https://tdat.tail431746.ts.net
```

When ready to perform the requested trial:

```bash
python3 tools/deploy/planner_v1.py vercel --origin https://your-project.vercel.app --backend https://tdat.tail431746.ts.net --execute
python3 tools/deploy/planner_v1.py check --url https://your-project.vercel.app
```

`--execute` invokes the official CLI with argument arrays, retaining its project/account prompts. It does not create billing resources silently or copy API secrets. Vercel builds refuse a missing/local/non-HTTPS upstream, and the helper refuses a frontend/backend self-proxy loop. An origin change requires a new web build and an API/worker restart with the matching explicit origin; the helper does not silently change a running server.

## Trial checklist

1. Verify readiness, normal login, Secure/HttpOnly host-only cookies, Task create/edit/reload and private Note/file access through each stable hostname.
2. Exercise invitations, password/MFA/email links and check that they return to the configured primary origin. Confirm an unlisted preview origin receives 403 for writes.
3. Confirm a durable assistant run streams/reconnects through the actual Vercel proxy; test a real private upload. Provider/network timeout limits are deployment-specific and still need this hosted trial.
4. Stop/restart the watched worker and verify queued work resumes without duplicate reminders/occurrences. Keep database and private-file backups aligned.
5. Test offline recovery separately on each hostname: IndexedDB/service workers are origin-scoped. Sessions and local drafts are not automatically shared across domains.

The local proxy contract, exact-origin/CSRF rules, command plans and production web build are verifiable before account linking. Public proxy streaming/upload limits and provider behavior require explicit hosted acceptance, independent of the recorded deployment. A Vercel production alias does not convert the attached development backend into a production-certified service; migration/recovery, quality/cost and capacity gates remain in the open issues.
