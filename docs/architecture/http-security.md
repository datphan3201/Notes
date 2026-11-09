# HTTP, sessions and authorization

[Documentation home](../README.md) · [Declared routes](../reference/routes.md)

## Requests and responses

Browser API requests use same-origin `/api/v1/*` via the Next.js rewrite. FastAPI returns endpoint-specific JSON directly; there is no universal legacy `{data: ...}` envelope. HTTPException errors normally use `detail`; Pydantic validation uses a detail list. The [web client](../../apps/web/src/lib/api.ts) maps status/detail/field errors. Inspect the handler/schema for exact payloads.

| Status | Current meaning |
| --- | --- |
| 401 | Missing/expired authentication or first-factor failure |
| 403 | Untrusted origin, invalid CSRF or production email-verification restriction |
| 404 | Missing/inaccessible entity, unsupported kind or protected administrator surface |
| 409 | Version/idempotency/proposal conflict |
| 422 | Input/domain validation or missing acknowledgement |
| 423 | Password-protected Note requires a session unlock |
| 429 | Rate limit; Retry-After where supplied |
| 503 | Unavailable dependency/configuration where explicitly handled |

These are common meanings, not an exhaustive status contract for every endpoint. Legacy 419 error codes and named PHP routes are not current API contracts.

## Sessions and owned access

[auth.py](../../apps/api/planner/auth.py) hashes opaque cookie tokens in `login_sessions`, checks expiry/locking and verifies CSRF for authenticated non-read methods. Cookies are HttpOnly/SameSite=Lax, Secure in production/HTTPS use. Authenticated writes require the exact configured Origin and `x-csrf-token`. Public account-action handlers use their own origin/rate/token checks. Production email verification gates workspace access; a pending MFA challenge is not a session.

Owned lookups scope `user_id`. Accepted shared Notes have explicit view/edit permissions; edit recipients may change title/content only. Inaccessible IDs return 404. Note passwords use a server-side session/hash-bound unlock; content is masked while locked and excluded from AI/offline whenever password-protected. Account-file evidence has narrowly scoped moderator access. Admin roles are assigned only by the audited server console. There is no realtime WebSocket ticket/session subsystem in V1.

## Rendering, storage and secrets

React renders plain text; the Note editor preserves literal checkbox syntax. [Next.js configuration](../../apps/web/next.config.ts) supplies CSP, nosniff, frame restrictions and referrer policy; local development permits the framework's additional script evaluation. [API middleware](../../apps/api/planner/main.py) sets private response policy and request IDs. Do not describe the current CSP as nonce-based or infer a complete security audit from these headers.

[Storage](../../apps/api/planner/storage.py) is private; API routes authorize access before returning bytes. Service-worker cache rules exclude API/media. [Offline storage](../../apps/web/src/lib/offline-notes.ts) excludes shared/password-protected Notes. Keep provider/database/storage/email/encryption credentials server-only; never print prompts, tokens, codes, SQL parameters or private file contents in verification reports. [Settings validation](../../apps/api/planner/config.py) enforces production requirements; it does not verify live inbox delivery, bucket policies or backup restorability.
