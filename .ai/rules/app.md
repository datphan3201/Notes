---
paths:
  - 'apps/api/**'
---

# API rules

Read [runtime ownership](../../docs/architecture/runtime.md), [persistence](../../docs/architecture/persistence.md) and [HTTP/security](../../docs/architecture/http-security.md). FastAPI/SQLAlchemy/Alembic are current; framework/ORM changes remain permitted within user scope.

Keep owned operations scoped, sharing/evidence permissions explicit, inaccessible identifiers 404 and private bytes authorized. Validate graph writes atomically and preserve UTC instant versus DATE semantics. Verify configured/actual `planner_test` before destructive integration cleanup; never test destructively on development/hosted data.
