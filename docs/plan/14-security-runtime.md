# Plain-PHP Runtime and Security Contract

## HTTP primitives

Request captures method, normalized path, query, headers, cookies, files, server metadata, and lazily decoded body. JSON parser rejects invalid UTF-8, malformed JSON, non-object mutation bodies, duplicate keys where security-sensitive, and bodies over route limits. Response types cover HTML, JSON, redirect, empty, and streamed files.

## Sessions

Use PHP sessions with a PDO handler and a dedicated connection. Configure strict mode, cookies only, use_strict_mode, use_only_cookies, HttpOnly, SameSite=Lax, host-only domain, path `/`, and Secure in production.

Handler responsibilities:

- `read`: load unexpired row by opaque ID; decrypt authenticated payload; invalid/decryption failure returns empty and logs safe session ID hash.
- `write`: upsert encrypted payload, user ID, IP/user agent metadata, last activity, expiry.
- `destroy`: delete exact ID.
- `gc`: bounded indexed expiry deletion.
- `validateId`: accept only existing unexpired IDs.
- `updateTimestamp`: extend activity/expiry without replacing payload.

Encrypt using sodium XChaCha20-Poly1305 with random nonce and a dedicated 32-byte environment key; store version byte + nonce + ciphertext. Cookie contains only opaque 256-bit ID.

Regenerate ID on registration/login and destroy old ID. Protected requests compare session `auth_version` to users.auth_version. Password change increments auth_version and deletes sessions in one transaction, then invalidates the current cookie. Release session lock before streams and AI calls.

## Authentication/passwords

Preserve normalized ASCII email, display-name normalization, bcrypt, 10-code-point minimum, 72-byte maximum, no NUL, exact confirmation, and generic login failure. Use dummy bcrypt verification for unknown email. Rehash after successful login when settings change.

## CSRF and origins

Store 256-bit token in session. Require token on every POST/PATCH/PUT/DELETE via header or form field and compare with `hash_equals`. Additionally reject explicit cross-site `Origin`/`Sec-Fetch-Site`; do not use origin metadata as a token substitute. Rotate token on session regeneration/logout. API failure is 419 `SESSION_EXPIRED`.

## Rate limits

Use MySQL atomic buckets with hashed keys and expiry. Preserve registration 10/min/IP, login 5/min/email+IP and 20/min/IP, Note reads 300/min/user, mutations 240/min/user, uploads 30/min/user, password change 5/min/user. Add AI generation 10/hour/user and Apply 30/hour/user. Return 429 with integer `Retry-After`.

## Validation/authorization

Input validator distinguishes missing/null/empty and rejects unknown keys. Syntax validation precedes owned lookup; domain validation occurs inside the authoritative transaction. Client IDs, ownership, timestamps, versions, storage paths, Activity, and AI state are never mass-assignable.

## Errors/logging

Attach a random request ID to logs and `X-Request-ID`. Development shows safe stack details only when explicitly enabled and never in JSON payload by default. Production returns generic 500/503. Redact passwords, tokens, cookies, Note bodies, file paths/digests, prompts/responses, SQL bindings, and environment values.

## Templates/XSS

Central `e()` escapes HTML with UTF-8 substitution. Bootstrap JSON uses `JSON_HEX_TAG|HEX_AMP|HEX_APOS|HEX_QUOT|UNESCAPED_UNICODE` and is embedded only in a script-safe assignment. URLs are generated from named root-relative routes. User text renders as text, never raw HTML.

## Private files

Resolve a configured storage root once. Stored paths are generated relative paths. For reads/deletes, reject empty, absolute, backslash, NUL, and `..` segments; resolve parent/root canonical paths and require containment; reject symlinks anywhere in the managed path.

File GET/HEAD requires current owner and active Note/attachment. Downloads use safe ASCII fallback plus RFC 5987 UTF-8 filename. Preview only server-detected image/video types. `Range` supports a single bytes range: valid returns 206 with Content-Range/Length; unsatisfiable/multiple returns 416; HEAD returns matching headers without bytes.

## Security headers/secrets

All private responses: `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`; HTML also `X-Frame-Options: DENY` and an explicit CSP compatible with built assets/bootstrap. AI/session/database keys are environment-only and never Vite-prefixed.
