---
paths:
  - 'backend/src/**'
---

# Backend source layers

Keep the existing Config, Support, Http, Application, Domain and Infrastructure tree. Controllers parse/serialize, application services own transactions, domain functions own invariants and PDO repositories own SQL. Do not create parallel framework-style source trees or a service locator.

Use explicit dependencies, strict types, typed contracts, DateTimeImmutable/injected Clock, prepared scoped SQL and endpoint-specific validation. Trace each UI change to its source/test owners through [the route map](../../../docs/README.md).
