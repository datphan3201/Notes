---
paths:
  - 'apps/**'
  - 'compose.yaml'
  - '.github/workflows/planner-v1.yml'
---

# Personal AI Planner migration

Read [the migration plan](../../../docs/migration/personal-ai-planner.md), the current implementation status and operations instructions under `docs/migration/`, and the [open issues](../../../docs/issues.md). `apps/api` and `apps/web` are the new runtime; `backend` and `frontend` remain the behavioral reference until a verified cutover.

Follow Karpathy Guidelines. Use maintainer-owned framework/provider documentation for implementation details. Do not install skills based on titles or popularity, remove user-wide skills, introduce microservices, or declare feature parity merely because a route renders.

Business rules and authorization live in FastAPI application services. Scope owned queries, graph edges, file reads and AI retrieval to the account. Mutations use explicit CSRF/origin checks, authoritative Pydantic validation and transactions. Password-protected Notes never enter AI indexes. External network calls must not hold database write transactions. AI mutations require the user's confirmation of the exact proposal and current permissions/versions.

Use locked dependencies and real isolated PostgreSQL/pgvector for integration tests. Before truncation/import, verify configured and actual database names. Imports normally use the explicit staging/test allowlist. An explicitly user-authorized local development transfer may use the guarded `planner_dev --merge-existing` path after a verified backup and staging rehearsal, with application writers paused; preserve existing accounts and reject collisions. Test cleanup remains restricted to `planner_test`. Keep source MySQL and Teamwork data intact. Port behavior tests; do not rewrite expectations to match regressions. Keep docs honest about unimplemented features and unexecuted cloud/live-provider checks.
