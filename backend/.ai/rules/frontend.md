---
paths:
  - 'frontend/**'
---

# Browser source and interaction boundary

Keep PHP views, JavaScript, CSS, Vite and browser tests in frontend. Vite emits only deployment assets to backend/public/build. Preserve escaped templates, DOM hooks, bootstrap/session/CSRF and same-origin application APIs. Local Vite is the documented development exception, not application CORS/token auth.

Use [the route/component trace](../../../docs/README.md) before editing. Preserve stale-read guards, newer typing during acknowledgements, explicit conflict choices, pending-save/dirty navigation and focus. Main Notes autosave is distinct from explicit-save Task/Review/shared editors. [Interaction invariants](../../../docs/architecture/interactions.md) and [CSS ownership](../../../docs/ui/shared/shell.md#style-file-ownership) describe the shared boundaries.
