---
paths:
  - 'backend/**'
---

# Framework-free backend

Use PHP 8.5, explicit bootstrap, PDO and owned application services. No application framework/ORM/container. Read [runtime ownership](../../../docs/architecture/runtime.md), [persistence](../../../docs/architecture/persistence.md) and [HTTP/security](../../../docs/architecture/http-security.md) for cross-cutting rules, then the affected UI component trace.

Keep database migrations forward-only and immutable after application. Verify the actual goals_test name before destructive integration cleanup. Preserve ownership, stable lock order, version/replay rules, safe errors and private file boundaries.
