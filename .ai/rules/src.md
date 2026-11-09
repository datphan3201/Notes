---
paths:
  - 'apps/api/planner/**'
---

# Backend source ownership

The current modular monolith groups HTTP/application orchestration, domain rules, schemas/models and adapters under `apps/api/planner`. See [runtime](../../docs/architecture/runtime.md) and [feature maps](../../docs/README.md) before modifying behavior.

Use authoritative server validation, explicit ownership, atomic graph/version checks and UTC/date separation. Preserve service transaction ownership; helpers called by workspace/AI must not commit partial domain batches. External provider/mail work belongs outside write transactions. Add forward Alembic revisions when the physical schema changes.
