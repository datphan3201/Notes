# M05 — Template/Vite Cutover and Laravel Removal

Status: Verified on 2026-09-17. Depends on M04.

## Objective

Promote the verified target runtime and remove Laravel without changing the existing user experience.

## Why this phase comes now

M01–M04 provide complete current-feature parity. Only now can templates,
entrypoints, dependencies, tests, and deployment commands be switched without
mixing framework removal with unported behavior.

## Required reading

Architecture, UI, autosave, security, operations, verification; inspect all eight Blade templates, layouts, Vite config/package, public/bootstrap/routes/config/Composer/PHPUnit files.

## Files affected

All runtime entry/config/route/template/build/test/dependency files and every
legacy Laravel file identified in the file map.

## Files to create

`backend/src/Http/{ViewRenderer,ViewContext,AssetManifest}.php` and PHP equivalents of eight templates.

## Files to modify

Frontend Vite/package/lock; public index/.htaccess; standard bootstrap/routes; Composer/lock; PHPUnit config; root/shared instructions/status.

## Files to remove

Blade templates; `backend/app`; Laravel bootstrap/provider/Artisan/config not used by target; Laravel migrations/factory/seeder after target schema parity; Boost/Pint/Collision/Mockery and Laravel Vite plugin; temporary plain entry/routes.

## Detailed implementation steps

### M05.1 View/asset parity

Convert directives to escaped PHP includes; controllers supply arrays only. Implement safe bootstrap JSON, active navigation, old input/errors/CSRF helpers, and manifest imports/CSS/scripts. Test missing/corrupt manifest and local Vite URL rules.

### M05.2 Promote runtime

Make target index/bootstrap/routes canonical. Preserve `/up`, all existing URLs, public root, response shapes, dev router, and built assets. Run full parity and browser smoke before dependency deletion.

### M05.3 Port tests/tooling

Replace Laravel TestCase/factories/fakes with target HTTP harness/fixtures/temp storage. Preserve scenario intent and assertions. Update Composer scripts and setup commands.

### M05.4 Retire Laravel

Run framework retirement scans, remove callers then packages/files, regenerate lockfiles from clean install, update `.ai` rules and MCP config, rerun everything. Do not remove historical docs/evidence.

## Business rules

URLs, JSON shapes, DOM hooks, cookie-session/CSRF behavior, private storage,
Notes UX, and current security contracts remain stable. No dual write, legacy
database deletion, framework compatibility facade, or alternate token API is
introduced.

## Risks

Template escaping/bootstrap JSON errors, missing manifest imports, route drift,
test scenario loss, transitive framework residue, production-only config
failure, and deleting legacy rollback before the gate passes.

## Validation

Compare target route inventory and M00 fixtures, start from clean Composer/npm
installs in production mode, inspect dependency/source scans, run browser parity,
and retain the pre-cutover Git/database rollback until acceptance is recorded.

## Tests

Template escaping/JSON; auth forms/flash; every legacy endpoint; full backend/JS/build/format; real browser Notes/settings/files; clean Composer/npm installation; first-party framework scan; target routes/migrations/startup; production debug off.

## Exit criteria

The current Notes application runs solely on target PHP, passes parity, and has no Laravel/Illuminate runtime/development dependency. M06 starts only after this gate.
