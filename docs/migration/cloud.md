# Alternative Google Cloud deployment design

[Current operations](../operations/cloud.md) · [Active topology](render-vercel-supabase.md)

This is an **alternative design**, not the recorded Render/Vercel/Supabase deployment. No Google Cloud resource state or live acceptance is asserted here. The repository retains GCS, Cloud Tasks dispatcher and private worker adapters; using them requires separately configured infrastructure/identity/secrets and an operator decision.

| Unit | Source/configuration boundary |
| --- | --- |
| Web | Vercel root `apps/web`, exact public HTTPS API_ORIGIN |
| Public API | Same Docker image, `planner.main:app`; default supervisor `python -m planner.serve` can run API without a colocated worker |
| Private worker | `uvicorn planner.worker_api:app --host 0.0.0.0 --port 8080`, authenticated service ingress |
| Queue/scheduler | Cloud Tasks named deliveries to `/internal/jobs/{job_id}`, authenticated `/internal/schedule` and `/internal/drain` |
| Persistence | PostgreSQL/pgvector and private GCS bucket, isolated per environment |

`PLANNER_WORKER_MODE=cloud_tasks` requires the configured worker audience/service-account identity in production; set the queue path and least-privilege service invocation. [worker_api.py](../../apps/api/planner/worker_api.py) validates the bearer token/audience/email as well as the intended platform ingress controls. A header claiming a task is not authentication. [dispatch.py](../../apps/api/planner/dispatch.py) publishes committed jobs with stable names; DB leases/business keys still defend retries.

Use private managed secrets/workload identity, bounded instance/pool counts, authenticated scheduling and controlled one-off migrations. Do not enable migration-on-start across competing replicas without a reviewed migration strategy. Provider calls remain outside business write transactions. Budget connections across all API/worker processes plus migration/admin headroom.

Real IAM, queue delivery, provider/mail contracts, trace collection, database/private-file restore and workload capacity are unverified for this alternative. Do not copy these settings into the active polling topology without reviewing their different operational requirements.
