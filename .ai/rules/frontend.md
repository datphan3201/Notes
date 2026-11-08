---
paths:
  - 'frontend/**'
---

# Browser source and interaction boundary

Tech-stack restrictions on the frontend are lifted: you may migrate from PHP views and vanilla JS/Alpine modules to modern frontend/full-stack frameworks, component libraries, state managers, and build pipelines as directed by the user.

Use [the route/component trace](../../../docs/README.md), [interaction invariants](../../../docs/architecture/interactions.md), and [CSS ownership](../../../docs/ui/shared/shell.md#style-file-ownership) as the behavioral reference for existing user flows (such as Notes autosave versus explicit-save editors, conflict handling, and keyboard/focus behavior).
