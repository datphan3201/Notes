---
paths:
  - '{frontend/**,backend/**}'
---

# Frontend

## Preserve the same-origin frontend/backend boundary
Keep Blade, JavaScript, CSS, Vite, and JS tests under frontend/. Keep Laravel, routes, persistence, private files, and PHPUnit tests under backend/. Integration is intentional: backend/config/view.php reads frontend/src/views and frontend/vite.config.js emits to backend/public/build. Do not introduce CORS/token auth unless this architecture decision changes.
