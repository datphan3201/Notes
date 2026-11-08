---
paths:
  - 'backend/src/**'
---

# Backend source layers

The current PHP tree organizes code under Config, Support, Http, Application, Domain and Infrastructure as a reference baseline, but architectural and tech-stack constraints are lifted for migration. You may adopt framework conventions, ORMs, containers, or a new project layout when migrating the stack.

Maintain clear separation of concerns, strict typing where supported, UTC timestamps versus user-facing dates, scoped queries, and authoritative server-side validation. See [the route map](../../../docs/README.md) for existing feature behavior.
