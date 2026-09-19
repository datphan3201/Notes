# M02 — HTTP, Sessions, Authentication, and Account

Status: Verified on 2026-09-17. Depends on M01.

## Objective

Implement the trusted request boundary and account workflows required by every later module.

## Why this phase comes now

Every later route requires stable parsing, routing, sessions, authentication,
CSRF, validation, errors, and ownership identity before domain behavior can be
ported safely.

## Required reading

HTTP, security/runtime, database, UI, operations; existing auth/settings controllers, requests, resources, routes, config, and tests.

## Files affected

Target bootstrap/routes/public isolation entry, HTTP and Account layers,
sessions/rate limits, Account schema, auth/settings tests, and page view models.

## Files to create

- `backend/src/Http/{Request,Response,Application,ErrorHandler}.php`
- `backend/src/Http/Routing/{Router,Route,RouteMatch,RouteUrls}.php`
- `backend/src/Http/{Security,Validation,Controller}/*`
- `backend/src/Domain/Account/*`
- `backend/src/Application/Account/*`
- `backend/src/Infrastructure/{Session,Persistence/Pdo/Account}/*`
- `backend/routes/plain.php`, `backend/public/plain.php`, and `backend/dev-router.php`

Modify bootstrap, target migrations/tests. Remove nothing.

## Files to modify

`backend/bootstrap/plain.php`, the target migration registry/schema, target
test harness, Composer extension declarations if required, status and
verification evidence.

## Files to remove

None.

## Interfaces

- Router receives immutable Route definitions and returns matched handler/params or typed 404/405.
- Controllers receive Request plus constructed use-case dependency and return Response.
- AuthService exposes register, attempt, logout, changePassword, currentUser.
- Repository methods require owner/user IDs and return typed records/arrays.

## Detailed implementation steps

### M02.1 HTTP primitives/router/errors

Implement single-decoding path matching, JSON/form/multipart parsing limits, named root-relative URLs, HEAD/405, request IDs, private headers, HTML/JSON error selection, and safe development/production behavior.

### M02.2 Session/CSRF

Implement the encrypted PDO handler exactly as document 14: dedicated connection, strict IDs, cookie flags, auth version, regeneration, lock release, expiry/GC, CSRF rotation and required validation.

### M02.3 Auth/rate limits

Port registration/login/logout/password change with normalization/password rules, generic failure/dummy verify, exact throttles, atomic user/preferences creation, session invalidation, and safe redirects. Area creation is deliberately absent until the Area schema and service exist in M06.

### M02.4 Account APIs/pages

Port session resource, profile, preferences, avatar URL placeholder behavior, and settings page view models. Avatar bytes remain M04; endpoint may return feature-unavailable only in target isolation until then and is not routed for cutover.

## Business rules

Authentication failures do not enumerate accounts. Session IDs regenerate at
privilege changes, all mutations require CSRF, password changes invalidate all
sessions, owner identity comes only from the authenticated session, and
cross-owner/missing IDs remain indistinguishable.

## Risks

Session fixation or lock starvation, cookie misconfiguration, login timing
leak, CSRF gaps, inconsistent 401/419 behavior, rate-limit races, duplicate
email races, and exposing development exception details.

## Validation

List target routes, inspect response headers/cookies, start the isolated plain
entrypoint in development and production configuration, and verify log/output
redaction. Do not promote it to the canonical index yet.

## Tests

Router decoding/404/405/HEAD; malformed JSON/content type/unknown keys; registration constraints; duplicate email race; login enumeration/throttle; fixation/regeneration; cookie settings; CSRF header/form/cross-origin; session expiry/tamper/auth-version; password invalidation across sessions; owner settings; DB failure mapping; log redaction.

## Exit criteria

All existing Account/Auth contracts pass through the target HTTP application; sessions and CSRF pass real HTTP checks; routes are still isolated behind plain entrypoint.
