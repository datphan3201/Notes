# Runtime and layer ownership

[Documentation home](../README.md) · [Archify system map](../diagrams/system/index.html)

## Request entry

[public/index.php](../../backend/public/index.php) loads [HTTP bootstrap](../../backend/bootstrap/http.php), captures a [Request](../../backend/src/Http/Request.php), calls [Application](../../backend/src/Http/Application.php), then emits the [Response](../../backend/src/Http/Response.php). [The router](../../backend/src/Http/Routing/Router.php) matches [route declarations](../../backend/routes/web.php); guards establish session/auth/CSRF/rate limits before dispatch.

The configured web root is backend/public. [dev-router.php](../../backend/dev-router.php) is local-only routing for PHP's development server. API endpoints and HTML shells share the same application, not separate microservices.

## Processes

| Process | Role | Source |
| --- | --- | --- |
| PHP-FPM (or `php -S` locally) | Every HTML page and `/api/v1` request | [public/index.php](../../backend/public/index.php) |
| Realtime server | WebSocket rooms for live co-editing of shared Notes; saves through `NoteService` | [bin/realtime.php](../../backend/bin/realtime.php), [CollaborationHub](../../backend/src/Infrastructure/Realtime/CollaborationHub.php) |
| Scheduler | Reminders, retention, file cleanup and other periodic jobs (cron `schedule:run`) | [bin/console](../../backend/bin/console), [jobs](../operations/jobs.md) |
| Service worker | Browser-side asset/page cache for offline use; never caches `/api` | [sw.js](../../backend/public/sw.js) |

The realtime server is stateless across restarts: it loads a Note's text when the first participant joins and writes merged text back through the ordinary application service. It never reads browser sessions; the web app authorizes each participant and issues a 60-second HMAC ticket ([RealtimeTicket](../../backend/src/Infrastructure/Realtime/RealtimeTicket.php)).

## Ownership table

| Layer | Responsibility | Starting source |
| --- | --- | --- |
| PHP view | Escaped markup, labels, DOM hooks, bootstrap data | [views](../../frontend/src/views/) |
| Browser entry | Read bootstrap and start shared/page modules | [app.js](../../frontend/src/js/app.js) |
| Browser feature | Render state, coordinate reads/drafts, call APIs | [page traces](../README.md) |
| HTTP | Parse input, call application use case, serialize response | [controllers](../../backend/src/Http/Controller/) |
| Application | Authorization/reference validation, transactions, orchestration | [application services](../../backend/src/Application/) |
| Domain | Pure graph/progress/recurrence/streak/TOTP rules | [domain](../../backend/src/Domain/) |
| Persistence | Prepared owned SQL, locking and projections | [PDO repositories](../../backend/src/Infrastructure/Persistence/Pdo/) |
| Infrastructure | Storage, mail, sessions, provider adapters and logging | [infrastructure](../../backend/src/Infrastructure/) |
| Wiring | Explicit constructors and dependencies | [app bootstrap](../../backend/bootstrap/app.php), [HTTP bootstrap](../../backend/bootstrap/http.php) |

Use constructor dependencies rather than a service locator. New features belong in the existing layer-first module tree. [Composer](../../backend/composer.json) and [frontend/package.json](../../frontend/package.json) declare actual runtime/build dependencies.

## Browser behavior is not all server behavior

Tasks time views are a client projection; Dashboard has SQL-backed projections. Personal recurrence and Teamwork repeats have distinct services. Main Notes uses an autosave machine (or the realtime session for shared Notes, with an IndexedDB outbox when offline); Task notes and Reviews use explicit save/draft handling. A shared visual control does not imply a shared transaction or persistence contract.

## Optional infrastructure

[GoogleAIProvider](../../backend/src/Infrastructure/AI/GoogleAIProvider.php) and [DisabledAIProvider](../../backend/src/Infrastructure/AI/DisabledAIProvider.php) implement the provider boundary (chat, completion and embeddings) used by the assistant and by [Note AI](../ui/notes/ai.md). Credentials remain server-side. Mail uses configured SMTP or the runtime's environment-specific fallback. These are optional adapters, not a claim that a live provider has been tested.
