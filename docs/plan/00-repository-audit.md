# Repository Audit

Audit date: 2026-09-17. The working tree contained pre-existing modified and untracked application/test files; they were treated as the baseline and not altered by this documentation work.

## Analysis tools and skills used

| Tool/skill | Why it was used |
| --- | --- |
| Senior Architect skill | Structured the current/target architecture, dependency map, migration sequencing, and decision gates. |
| Testing Best Practices skill | Made tests behavior-focused, owner/security aware, deterministic around time/randomness/network, and explicit about response plus persisted side effects. |
| Laravel Boost rule recorder | Persisted the migration boundary and layer/source-placement rules for later agents. |
| `rg`, `find`, `sed`, Git status/diff | Exhaustively inventoried files/usages while preserving the pre-existing dirty worktree. |
| Composer inspection/validation | Confirmed direct PHP dependencies, platform requirements, and reusable focused packages. |
| Artisan route/config inspection | Captured the current runtime route/config behavior before framework removal. |
| PHPUnit with guarded MySQL | Established current backend behavior and assertion counts on the actual database engine. |
| Node test runner and Vite build | Established browser-module behavior and production asset viability. |
| `php -l` | Established first-party PHP syntax baseline. |

No additional plugin or dependency was installed: the available repository and
runtime tools covered the audit, and changing dependencies during a planning-
only task would have altered the application baseline.

## Technology inventory

| Technology | Version | Current responsibility | Target |
| --- | --- | --- | --- |
| PHP | 8.5.0 | Backend runtime | Keep |
| Laravel | 13.30.1 | HTTP, auth, validation, Eloquent, views, storage, migrations | Remove |
| MySQL | 8.4.11 | Persistent/test data, REPEATABLE-READ | Keep |
| Composer | 2.x | PHP packages/autoload | Keep |
| PHPUnit | 12.5.34 | Backend tests | Keep with plain bootstrap |
| Node/npm | 22.22.2 / 10.9.7 | Frontend tooling | Keep |
| Vite | 8.2.2 | Asset build | Keep; remove Laravel plugin |
| Alpine.js | 3.17.2 | Lightweight browser behavior | Keep |
| Noto Sans | 5.3.0 | Local font | Keep |
| Prettier | 3.9.6 | Frontend formatting | Keep |

Installed focused libraries that can be retained explicitly: phpdotenv 5.7, Ramsey UUID 4.9, Monolog 3.11, Egulias EmailValidator 4.0. Remove framework/transitive packages when M05 proves no callers remain.

## Current modules

- Authentication: registration, login/logout, password change and session invalidation.
- Account: profile, avatar, theme/font/color/view preferences.
- Notes: create replay, full-snapshot update, optimistic version conflict, scrubbed deletion tombstones, search, pagination, pin/color.
- Labels: owner-scoped CRUD, normalized uniqueness, many-to-many Notes, quotas.
- Files: private attachment/avatar storage, MIME/content validation, replay, quotas, streaming, retryable cleanup.
- Browser: responsive Blade shell, autosave state machine, sessionStorage recovery, stale-read coordination, settings modules.

Goals, Milestones, Tasks, Checklists, Habits, recurrence, hierarchical Tags, Reviews, Activity, Dashboard, and AI actions are missing.

## Request/data flow

`backend/public/index.php` boots Laravel. `backend/routes/web.php` maps 32 application routes. Middleware supplies sessions, CSRF, authentication, throttling, input normalization, private headers, and errors. Controllers use FormRequests, action/query classes, Eloquent, resources, and Blade. Frontend modules call same-origin `/api/v1` and use cookie sessions.

Database tables: users, sessions, user_preferences, notes, labels, label_note, attachments, pending_file_deletions, migrations. Notes/attachments use UUIDs; users/labels use BIGINT. Current schema uses MySQL checks and microsecond timestamps.

## Framework dependency map

| Mechanism | Existing paths | Target replacement | Risk |
| --- | --- | --- | --- |
| Kernel/bootstrap/errors | `backend/public/index.php`, `bootstrap/app.php` | `Http\\Application`, explicit bootstrap/error mapper | High |
| Routes/middleware | `routes/web.php`, provider/middleware | Static Router and route metadata | High |
| FormRequests/rules | `app/Http/Requests`, `app/Rules` | Explicit validators | High |
| Auth/sessions/CSRF | auth controllers/config | Auth service, encrypted PDO sessions, CsrfGuard | Critical |
| Eloquent/relations/scopes | `app/Models` | Owner-scoped PDO repositories | High |
| Transactions/locks | `OwnerMutation`, actions | TransactionManager and explicit `FOR UPDATE` | High |
| Resources/helpers | `app/Http/Resources`, `response`, `route`, `now` | Serializers, response factory, RouteUrls, Clock | Medium |
| Blade | eight templates | Escaped PHP renderer | High |
| Vite facade/plugin | layouts/vite config | Manifest reader and native Vite config | Medium |
| Storage/binary responses | file actions/controllers | LocalPrivateStorage/FileStreamer | High |
| Artisan/migrations | command/migrations | `bin/console`, PDO migration runner | High |
| Test framework/factories/fakes | `backend/tests`, factory | Plain HTTP harness, fixtures, temp storage | High |

No implemented queues, notifications, policies, mail delivery, broadcasts, or events require porting.

## Reusable code

- Browser JavaScript, CSS, DOM structure, and API paths.
- Text normalization rules and snapshot semantics.
- Existing action-level behavior and test scenarios as port specifications.
- Existing MySQL constraints/collations and private-storage rules.
- API error/resource shapes and ID serialization.

## Known defects/cleanup observations

- `DatabaseSeeder.php` uses stale `name` instead of `display_name`.
- GD is used for avatars but is not directly declared in Composer requirements.
- Autosave's non-crypto fallback is not a valid UUID.
- Existing status documentation reports an older, smaller automated suite.
- MySQL recursive CTE depth is 1,000; target hierarchy must use iterative traversal.

## Baseline evidence

- `vendor/bin/phpunit`: 35 tests, 385 assertions passed with authorized local test-DB access.
- `npm run test:unit`: four test files passed; 27 named JavaScript cases exist.
- `npm run build`: passed.
- Composer validation/platform checks: passed.
- PHP syntax scan: 107 files passed.
- Browser evidence remains historical/partial as recorded in `docs/verification.md`.
