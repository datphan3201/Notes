---
paths:
  - 'apps/**'
  - 'compose.yaml'
  - 'render.yaml'
  - '.github/workflows/planner-v1.yml'
---

# Current Next.js/FastAPI runtime

Read [scope and acceptance](../../docs/migration/personal-ai-planner.md), [status](../../docs/migration/status.md), [operations](../../docs/operations/cloud.md) and [issues](../../docs/issues.md). `apps/api` and `apps/web` on `main` are active; the retired PHP/JS reference is available only in Git history/private archival data. Historical migration handoffs do not override current deployment state.

Follow Karpathy Guidelines and maintainer-owned documentation for framework details. Do not introduce microservices or claim parity because a route renders. Read the installed Next.js guide required by `apps/web/AGENTS.md` before frontend implementation.

Business validation/authorization live in FastAPI services. Scope owned queries, edges, files and AI to the account. Mutations require the endpoint's CSRF/origin checks, authoritative Pydantic validation and atomic transactions. Password-protected Notes never enter AI indexes. Provider/mail calls must not hold business write transactions. AI applies only the exact user-confirmed proposal with current permissions/versions.

Use locked dependencies and isolated PostgreSQL/pgvector for tests. Before migrations/truncation/import verify configured and actual database names. Destructive test fixtures accept only `planner_test`. Legacy imports normally accept explicit staging/test targets; an explicitly authorized `planner_dev --merge-existing` transfer requires verified backup/staging rehearsal and paused writers. Preserve existing records and reject collisions. Never point test cleanup at cloud data. The raw Supabase COPY helper has unresolved guards (ISSUE-065).

Keep historical data/private exports intact. Do not assert live-provider quality, hosted health or managed recovery without current execution evidence. The committed deployment is `main` with manual Render trigger; source settings are not proof of hosted dashboard state.
