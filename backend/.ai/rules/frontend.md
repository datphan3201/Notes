---
paths:
  - '{frontend/**,backend/**}'
---

# Frontend

## Preserve the same-origin workspace boundary
Keep PHP views, browser JavaScript, CSS, Vite, and JS tests under frontend; Vite emits deployable assets to backend/public/build. Keep HTTP, authentication, persistence, private files, and PHP tests under backend. Templates are escaped PHP, not Blade. Preserve URLs, DOM hooks, JSON contracts, session cookies, and CSRF; do not introduce CORS or token auth.
