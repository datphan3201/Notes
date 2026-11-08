---
paths:
  - 'backend/**'
---

# Backend rules

Tech-stack and framework restrictions are lifted: you may introduce frameworks, ORMs, dependency injection containers, query builders, or migrate to a new backend runtime/language as directed by the user. Read [runtime ownership](../../../docs/architecture/runtime.md), [persistence](../../../docs/architecture/persistence.md) and [HTTP/security](../../../docs/architecture/http-security.md) for current baseline behavior and domain/security invariants.

Verify the isolated test database (`goals_test` or equivalent test DB) before destructive integration cleanup. Preserve user ownership scoping, authorization checks, safe error handling, and private file boundaries across stack changes.
