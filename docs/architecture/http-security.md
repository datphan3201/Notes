# HTTP, sessions and security boundaries

[Documentation home](../README.md) · [Route inventory](../reference/routes.md)

## Requests and responses

APIs use same-origin cookie sessions at `/api/v1`. Success uses `data`; errors expose code/message and optional field errors/current state. IDs serialize as strings; instants are explicit UTC timestamps. Reject unknown input fields; server validation is authoritative.

| Status | Meaning |
| --- | --- |
| 400 | Malformed request/JSON |
| 401 | API authentication required |
| 404 | Missing or inaccessible identifier; ordinary user on admin routes |
| 405 | Wrong method, with Allow |
| 409 | Version/content conflict |
| 410 | Tombstoned Note create replay |
| 419 | CSRF/session expiry or rejected origin |
| 422 | Validation/acknowledgement requirement |
| 423 | Password-protected Note not unlocked in this session (`NOTE_LOCKED`) |
| 429 | Rate limit, with Retry-After |
| 500/503 | Safe internal/service failure |

[Router](../../backend/src/Http/Routing/Router.php), [Request](../../backend/src/Http/Request.php), [ErrorHandler](../../backend/src/Http/ErrorHandler.php) and [HTTP client](../../frontend/src/js/lib/http.js) define exact behavior. HEAD suppresses bytes and preserves corresponding headers. [Route declarations](../../backend/routes/web.php) define auth, CSRF and rate buckets per endpoint; [Application](../../backend/src/Http/Application.php) defines bucket limits. Login additionally throttles in AuthService.

## Authentication, CSRF and access

[AuthService](../../backend/src/Application/Account/AuthService.php) checks passwords, auth_version, role and lock state. [SessionManager](../../backend/src/Infrastructure/Session/SessionManager.php) uses encrypted PDO sessions; opaque session cookies are HttpOnly/SameSite and Secure in production. Password changes/resets and account locking invalidate sessions. 2FA pending identity is not an authenticated session.

Every mutation requires CSRF token/header or `_token`; [CsrfGuard](../../backend/src/Http/Security/CsrfGuard.php) also validates explicit Origin/Sec-Fetch-Site. Use the APP_URL origin consistently: localhost and 127.0.0.1 are different hosts. Keep CSRF active in local mode. Email verification/change GET callbacks are deliberate single-use token consumers, not generic mutation exceptions.

Owned APIs scope lookup by user. Shared Notes and Teamwork check accepted memberships/roles before access. Per-Note passwords are enforced server-side by [NoteLockGate](../../backend/src/Application/Notes/NoteLockGate.php) on every Note read/write path, with a session unlock bound to the current password hash; wrong guesses are throttled per account and Note. The realtime WebSocket accepts only the app origin and a short-lived HMAC ticket sent as the first message, and re-checks recipients' access while connected. System admin is a separate server-assigned role. Inaccessible object IDs must not disclose whether another account owns them.

## Rendering and content policy

[ViewContext](../../backend/src/Http/View/ViewContext.php) escapes user text and safely encodes bootstrap data. Plain text is not HTML; inline checkable lines do not create executable markup. Translation operates on UI literals, not arbitrary stored content.

[ContentSecurityPolicy](../../backend/src/Http/Security/ContentSecurityPolicy.php) retains same-origin production/testing defaults. A configured realtime origin (`REALTIME_PUBLIC_URL`, else the APP_URL host as ws/wss) is the only addition to `connect-src`. Only local mode with a validated HTTP(S) loopback Vite URL adds its script/style/font/image and matching WebSocket origins. Vite-injected styles need local inline-style permission. [AssetManifest](../../backend/src/Http/View/AssetManifest.php) rejects nonlocal dev asset URLs. Do not broaden production CSP to fix a local asset URL problem.

Private responses use no-store/nosniff/same-origin referrer policy; HTML also denies framing. [File streaming](../ui/notes/files.md) validates owner, path containment, media type and ranges. No uploaded bytes are exposed through a repository-root web server. The service worker caches pages and attachment previews in the browser; logout deletes those caches and the IndexedDB copy, and locked text is never stored offline.

## Secrets and external services

Never commit environment/session keys, realtime secrets, passwords, provider credentials, mail links, OTPs or personal prompts. Note text sent to the AI provider is wrapped as data with instructions to ignore commands inside it. Logs include safe IDs/codes, not SQL bindings, tokens or content. [ConfigLoader](../../backend/src/Config/ConfigLoader.php) rejects unsafe production settings and invalid storage roots. Live SMTP/AI checks are separate from deterministic tests and need authorized non-sensitive fixtures.
