# Local development

[Operations](README.md) · [Complete setup and verification](../migration/development.md)

The canonical launcher is `bash tools/dev/planner-v1.sh`. It runs Next.js Fast Refresh at `http://localhost:3000`, Uvicorn reload at `127.0.0.1:8001`, and a watched polling worker. PostgreSQL persists in Compose `db`; logs are under ignored `output/playwright/planner-v1-dev/`.

Keep one launcher per checkout and preserve private API configuration. The browser origin must match `PLANNER_WEB_ORIGIN`. `localhost` and `127.0.0.1` are different cookie/origin scopes. API rewrites keep browser requests same-origin; provider secrets never belong in browser environment variables.

## Share the local app

```bash
bash tools/dev/planner-v1.sh --funnel
```

Tailscale must already be connected with a valid MagicDNS hostname. The launcher refuses an existing HTTPS 443 handler, publishes its own frontend path and removes only that handler on shutdown. It supplies exact local/public origin exceptions in development; production rejects these exceptions. The machine, Docker and Tailscale must stay running. There is no retained PHP `planner` wrapper or `tools/dev/funnel.sh`.

[Deployment helper plans](../migration/deployment-routes.md) can point a separate Vercel frontend to this Funnel backend. That is an optional development topology; the recorded cloud deployment uses Render/Supabase.

## Debug safely

Inspect safe request IDs/status/error codes, not credentials or document content. Missing worker activity explains queued AI/mail, recurrence and retention delays. Isolated API/browser tests use `planner_test` and separate ports/build output; never run cleanup against `planner_dev` or cloud data, and never run both suites concurrently. See [testing](../testing/README.md) for exact commands and evidence limits.
