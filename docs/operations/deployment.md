# Deployment

[Operations](README.md) · [Cloud runbook](cloud.md) · [Blueprint](../../render.yaml)

The recorded deployment is Vercel web → Render Singapore API/worker → Supabase PostgreSQL/pgvector and private Storage. Active source is `main`; automatic Render deployment is disabled in the committed blueprint. Hosted settings may differ and must be inspected by an authorized operator before release. This document does not perform a deployment.

## Release procedure

1. Review the intended revision and private configuration; run the [relevant isolated checks](../testing/README.md). Keep secrets out of build artifacts/logs.
2. Back up PostgreSQL and private object storage and confirm a tested recovery plan. Schema and bytes must remain consistent; the cloud COPY helper is not a backup/synchronization guarantee (ISSUE-065).
3. Build the API image from `apps/api/Dockerfile`. Review forward Alembic migrations for compatibility with current writers. The committed single-container topology runs `alembic upgrade head` before API/worker startup; multiple replicas require a controlled migration job instead.
4. Trigger the intended Render service's manual deployment for the reviewed `main` revision through the authorized dashboard/CLI/API. A Git push alone is not a deployment with `autoDeployTrigger: "off"`.
5. Build/deploy only `apps/web` to Vercel, with public HTTPS `API_ORIGIN` at build/runtime and the exact frontend origin configured in FastAPI. Origin changes require a web rebuild and matching backend configuration.
6. Check login page and proxied readiness, then authenticated ownership/CSRF, private files, mail, AI observation/Apply and background recovery. Readiness alone does not certify these flows.

The [helper](../../tools/deploy/planner_v1.py) prints a plan unless `--execute` is passed; it does not provision Render/Supabase or configure their secrets. [Topology setup](../migration/render-vercel-supabase.md) lists operator requirements. Funnel is a local fallback, not the cloud backend dependency.

## Rollback and recovery

Retain the previous compatible application image and web build. Roll back application releases only while schema/data remain compatible. Never route new PostgreSQL writes back to the retired MySQL/PHP runtime without an explicit reconciliation/restore plan; the old runtime is no longer in this checkout. Avoid destructive down migrations during incident response. Rehearse restoration into a separate environment and verify counts, owners, graph edges and private-file checksums.

Deployment is recorded in repository history/runbooks; complete historical parity, managed recovery, provider quality/cost and sustained capacity remain separate acceptance work (ISSUE-045–048). There is no claim that this documentation update checked hosted health.
