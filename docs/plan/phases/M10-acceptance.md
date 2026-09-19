# M10 — Final Acceptance and Release Readiness

Status: Verified on 2026-09-18. Depends on M09.

## Objective

Prove the complete plain-PHP product is reproducible, secure at its boundaries, operable, documented, and free of known Laravel dependencies.

## Why this phase comes now

It can only evaluate the complete product after all feature phases. This phase
adds no product scope; discovered defects return to their owning phase.

## Required reading

Every planning document, every phase's evidence, current repository rules, root/user documentation, deployment configuration, dependency manifests/lockfiles, and all implementation/status/verification records.

## Files affected

The entire first-party source, dependency/lock files, schema/migrations,
frontend build, tests, operations/deployment configuration, active docs and
shared rules are audited. Changes remain limited to evidenced defect fixes and
already-required operational/documentation artifacts.

## Files to create

Only missing operational artifacts already required by document 15, such as the production web-server example or release checklist. Do not create substitute scripts merely to mask failing standard commands.

## Files to modify

`README.md`, `Readme.txt`, `AGENTS.md`, `CLAUDE.md`, `agent.md`, `.ai/rules/**` through the repository rule-recording mechanism, `.env.example`, deployment/runbook documents, `docs/implementation-status.md`, and `docs/verification.md`. Modify source/tests only to fix an evidenced defect.

## Files to remove

Any remaining Laravel/Illuminate/Blade/Artisan files, dependencies, caches, obsolete compatibility routes, temporary migration scaffolding, dead frontend entries, and stale instructions—only after their replacement and parity evidence are present. Preserve historical verification and original assignment artifacts.

## Detailed implementation steps

### M10.1 Traceability and status audit

Walk every row in document 16 and every task in phases M00–M09. Link a requirement to implementation file, test, and evidence. Mark only Verified with exact evidence; reopen gaps. Search all active docs for conflicting commands, endpoints, product scope, framework instructions, and unresolved TODO/TBD placeholders.

### M10.2 Clean-environment reproducibility

From clean dependency installs, run fresh target database migration twice, seed/bootstrap an account, build assets, start production-mode HTTP, execute scheduled commands, and exercise the smoke path. Prove deployment with document-root `backend/public`, immutable source permissions, writable private storage only, and no development server assumptions.

### M10.3 Full automated and manual verification

Run every command in document 08, first-party PHP syntax checks, route inventory, migration checksum/status, dependency/source/license/secret scans, PHPUnit, frontend unit/format/build, Playwright critical paths, and cross-account probes. Run manual checks for all widths, keyboard, focus, dark mode, 200% zoom, error/offline/conflict states, downloads/ranges and AI unavailable behavior.

### M10.4 Security and failure audit

Verify password/session invalidation, fixation defense, cookie flags, CSRF, origin checks, upload validation, private path containment/symlinks, CSP/security headers, XSS escaping, SQL parameterization, owner scoping, production error redaction, log redaction/rotation, rate limits, AI key isolation, backup/restore and failure recovery. Use code/test/config evidence; a checklist assertion alone is insufficient.

### M10.5 Laravel retirement proof

Search Composer manifests/lock, source, runtime scripts, templates, tests, routes, docs and deployment config for framework symbols and conventions. Allowed hits are historical migration documentation only. Prove `composer install --no-dev` and production startup contain no `laravel/*`, `illuminate/*`, Blade or Artisan requirement.

### M10.6 Release record

Record exact runtime/database/Node/browser versions, command outputs/counts, dated artifacts, known limitations, rollback/restore steps, scheduler setup and release decision. Update all onboarding documents to target-only commands. Do not claim zero bugs; report concrete gates and any unrun limitation.

## Business rules

No new scope, silent waivers, framework compatibility layer, or evidence substitution. A failed required gate blocks release. Optional live AI/provider validation is not allowed to block the deterministic suite, but an unverified production provider must be listed as a release limitation.

## Risks

Environment-specific passes, stale documentation, accidental credential inclusion, clean-install drift, hidden Laravel transitive dependencies, tests using SQLite instead of MySQL semantics, unexercised scheduler/recovery, and marking incomplete work Verified.

## Validation

Independently reconcile the route/schema/dependency/source inventories with
M00 and target contracts, inspect every traceability/evidence link, review
production logs/config/artifacts, and require a named owner for each remaining
limitation.

## Tests

The definitive matrix is document 08. At minimum: strict Composer/platform/clean install; all PHP syntax; migrate fresh/no-op/checksum/wrong-DB; full PHPUnit on real MySQL; npm clean install/unit/format/build; Playwright critical paths; production HTTP and maintenance commands; dependency/framework/secret scan; backup/restore rehearsal; manual critical path. Archive reports under the repository's agreed evidence location and summarize them in `docs/verification.md`.

## Exit criteria

All traceability rows have implementation, tests and dated evidence; all required commands pass in a clean target environment; no known Laravel runtime/development dependency remains; active documentation is consistent; operational recovery is rehearsed; remaining limitations are explicit and accepted rather than hidden.
