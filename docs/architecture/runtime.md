# Runtime and layer ownership

[Documentation home](../README.md) · [Routes](../reference/routes.md)

The application is a modular monolith under `apps/` on `main`. The legacy PHP/JS runtime was removed in `8714dc0`; Git history preserves its implementation, not a current runnable rollback path.

## Processes and requests

| Process | Responsibility | Source |
| --- | --- | --- |
| Next.js | Page routes, React UI, same-origin `/api/v1/*` rewrite to API_ORIGIN | [app](../../apps/web/src/app/), [proxy/security configuration](../../apps/web/next.config.ts) |
| FastAPI | Sessions, authorization, Pydantic input, business orchestration and HTTP responses | [main.py](../../apps/api/planner/main.py), [accounts](../../apps/api/planner/accounts.py), [workspace](../../apps/api/planner/workspace.py) |
| Polling worker | Claim durable jobs, scheduling, provider/mail calls and retry/cleanup | [jobs.py](../../apps/api/planner/jobs.py) |
| Container supervisor | Optional migrations, API/worker children, sibling shutdown on failure | [serve.py](../../apps/api/planner/serve.py) |
| Browser service worker | Generic Notes shell and selected static assets; excludes private API/media | [planner-sw.js](../../apps/web/public/planner-sw.js) |

Vercel hosts only the web application. The recorded Render topology colocates API and polling worker in one container; PostgreSQL/pgvector and private Storage are hosted in Supabase. A private authenticated worker ASGI app remains available for the alternative Google Cloud Tasks topology; it is not mounted on the public Render API. See [operations](../operations/cloud.md).

## Code ownership

React route files mount `Workspace` → `LiveWorkspace` → reviewed feature views. Live routes reuse view code in `components/preview/` but provide real data; explicit `/preview/*` routes use synthetic providers. `live-model.ts` maps server IDs/types to UI state. Current workspace reads load an account snapshot; scalability remains ISSUE-066. The mounted feature views are `components/preview/{tasks,planning,notes,calendar,habits,reviews,settings,support,dashboard}.tsx`, coordinated by `preview/workspace.tsx`; the alternate `*-page.tsx`/`editor.tsx` tree is not mounted by this route path. File names alone are insufficient to identify the live UI.

FastAPI handlers call `planning.py`, `workspace.py`, `accounts.py`, `personal.py`, `moderation.py` and `note_features.py`. `schemas.py` owns input validation, `domain.py` pure graph/recurrence/progress/streak rules, `models.py` SQLAlchemy mappings, `db.py` engine/session lifecycle, and Alembic the physical schema. `provider.py`, `storage.py` and `dispatch.py` adapt external services. Dependencies are locked in `uv.lock` and `package-lock.json`; CI uses npm.

Application services enforce ownership and transaction boundaries. Do not infer authorization from Next.js routing or a rendered shell. Provider/mail calls must occur outside business write transactions. Note autosave, explicit-save planning/Review drafts, offline outbox and assistant approval are separate state machines. Realtime collaborative editing is excluded from V1.
