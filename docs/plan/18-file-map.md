# File-by-File Migration Map

This map names every material existing application area and its disposition. Inspect each listed file before porting; a row assigns ownership, not permission to overwrite unrelated working-tree changes.

## Root, runtime, and tooling

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/public/index.php` | M02/M05 | Initially preserve; add isolated `plain.php`; promote explicit `Http\Application` entry at M05. |
| `backend/bootstrap/app.php`, `backend/bootstrap/providers.php` | M01/M05 | Replace with `backend/bootstrap/plain.php`, then canonical plain bootstrap; remove Laravel boot files after parity. |
| `backend/routes/web.php`, `backend/routes/console.php` | M00/M02/M05 | Freeze inventory; port to explicit `routes/plain.php` and console registry; promote to canonical route files. |
| `backend/composer.json`, `backend/composer.lock` | M01/M05 | Add `Planner\\` autoload/direct focused packages, then remove Laravel/Illuminate/Boost/Pint/Collision/Mockery and regenerate lock. |
| `backend/phpunit.xml`, `backend/tests/Plain/**` | M00/M01/M05 | The temporary coexistence runner was retired at cutover; `phpunit.xml` and the plain harness are canonical. |
| `backend/artisan` | M01/M05 | Replace commands with `backend/bin/console`; remove only after target routes/migrations/maintenance commands pass. |
| `backend/.env.example` | M01/M09/M10 | Add typed target/session/storage/log/AI settings without values; remove unused Laravel settings after cutover. |
| `frontend/vite.config.js`, `frontend/package.json`, `frontend/package-lock.json` | M05 | Remove Laravel Vite plugin only; retain Vite/Node/Alpine and output `backend/public/build`. |

## Configuration and cross-cutting Laravel code

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/config/app.php`, `database.php`, `logging.php`, `session.php`, `view.php`, `auth.php`, `filesystems.php` | M01–M05 | Extract used values into typed `backend/config/*.php` consumed by `ConfigLoader`; remove Laravel-shaped files once no caller remains. |
| `backend/config/cache.php`, `cors.php`, `mail.php`, `queue.php`, `services.php` | M00/M05 | Confirm no product caller; do not recreate unused subsystems; delete at framework retirement except focused provider config required by AI. |
| `backend/app/Providers/AppServiceProvider.php` | M01–M05 | Move explicit construction to bootstrap wiring; move normalization/validation behavior to the owning class; delete provider. |
| `backend/app/Http/Middleware/PrivateResponseHeaders.php` | M02 | Port to response-policy/guard invoked by route metadata; preserve exact private/security headers. |
| `backend/app/Support/ApiError.php`, `ApiException.php` | M02 | Port stable tokens/envelope to target HTTP error mapper. |
| `backend/app/Support/OwnerMutation.php` | M01/M03 | Port lock/transaction semantics to `TransactionManager` plus owner-scoped services; do not retain a global magic mutation helper. |
| `backend/app/Support/TextNormalizer.php`, `NoteSnapshot.php` | M01/M03 | Port as pure Support/Notes value code with existing unit/contract behavior. |

## Account and HTTP boundary

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/app/Http/Controllers/Auth/RegisteredUserController.php`, `Auth/SessionController.php` | M02 | Port to target auth controllers calling Account use cases. |
| `backend/app/Http/Controllers/Api/{Session,Profile,Preference,Password}Controller.php` | M02 | Port JSON behavior to target Account controllers/serializers. |
| `backend/app/Http/Controllers/SettingsPageController.php` | M02/M05 | Port view-model construction; render escaped PHP templates at M05. |
| `backend/app/Actions/Auth/{RegisterUser,ChangePassword}.php` | M02 | Port behavior into explicit Account application services with transaction/session boundaries. |
| `backend/app/Http/Requests/{Login,Register,ProfileUpdate,PreferenceUpdate,ChangePassword,ApiFormRequest,EmptyApiRequest}.php` | M02 | Translate rules/messages/unknown-field policy into target validators; remove FormRequests after endpoint parity. |
| `backend/app/Rules/BcryptPassword.php` | M02 | Port to pure password validation; retain byte/code-point/NUL limits. |
| `backend/app/Http/Resources/{User,Preference}Resource.php` | M02 | Port exact public fields to application serializers/view models. |
| `backend/app/Models/{User,UserPreference}.php` | M02 | Replace Eloquent with Account records and owner-scoped PDO repository; preserve password/auth-version/preferences behavior. |

## Notes and Tags

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/app/Http/Controllers/NotesPageController.php`, `Api/{Note,Label}Controller.php` | M03/M05 | Port controllers/API responses; page rendering moves to PHP template at cutover. |
| `backend/app/Actions/Notes/{CreateNote,UpdateNote,DeleteNote}.php` | M03 | Port one-for-one observable contracts into `Application/Notes`; retain replay/no-op/conflict/tombstone semantics. |
| `backend/app/Actions/Labels/{CreateLabel,RenameLabel,DeleteLabel}.php` | M03/M06 | Port label compatibility first; extend the same physical `labels` table/domain into hierarchical Tags in M06. |
| `backend/app/Queries/NoteListQuery.php` | M03 | Replace Eloquent query with bounded owner-scoped PDO query and batched relations; preserve filters/order/page shape. |
| `backend/app/Http/Requests/Note*.php`, `Label*.php` | M03 | Port validation/messages/unknown-field behavior to target validators. |
| `backend/app/Rules/{ValidNoteTitle,ValidNoteBody,ValidLabelName}.php` | M03 | Port as pure validators/value objects with data-provider boundary tests. |
| `backend/app/Http/Resources/{Note,NoteSummary,Label}Resource.php` | M03 | Port exact shapes to serializers; no storage/ownership fields leak. |
| `backend/app/Models/{Note,Label}.php` | M03 | Replace Eloquent relations/scopes/casts with typed records and PDO repositories. |

## Private files

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/app/Http/Controllers/Api/AttachmentController.php`, `AttachmentContentController.php` | M04 | Port mutation and authorized GET/HEAD/range behavior to target controllers. |
| `backend/app/Http/Controllers/Api/ProfileController.php`, `AvatarContentController.php` | M02/M04 | Port metadata/profile in M02 and byte upload/serve/remove in M04. |
| `backend/app/Actions/Files/*.php` | M04 | Port upload/delete/avatar/cleanup orchestration to Application services and Storage/PDO adapters. |
| `backend/app/Http/Requests/{AttachmentUpload,AvatarUpload}.php`, `backend/app/Rules/{AllowedAttachment,ValidAvatar}.php` | M04 | Port all limits, MIME/content checks, messages and failure behavior. |
| `backend/app/Http/Resources/AttachmentResource.php` | M04 | Port safe attachment shape and named URLs to serializer. |
| `backend/app/Models/{Attachment,PendingFileDeletion}.php` | M04 | Replace with typed records and PDO repositories. |
| `backend/app/Console/Commands/PrunePrivateFiles.php` | M04 | Port to `Console/Command/PruneFilesCommand` and shared application service. |

## Schema and fixtures

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/database/migrations/0001_01_01_000000_create_users_table.php` and `2026_09_07_000001...000006` | M00/M01 | Translate exact required schema/contracts to checksum PDO migrations; do not execute Laravel migrations in target DB. |
| `backend/database/factories/UserFactory.php` | M01/M02/M05 | Replace with explicit fixture builders for target tests; retain meaningful states, not Eloquent. |
| `backend/database/seeders/DatabaseSeeder.php` | M00/M05 | Do not port stale `name` field; target seed/demo command must use `display_name` or be omitted. |
| `backend/database/plain-migrations/*` | M01–M09 | New ordered migrations; each phase owns only its tables/constraints and supplies fresh/no-op/checksum tests. |

## Frontend and templates

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| Eight files under `frontend/src/views/**/*.blade.php` | M05 | Convert to ordinary escaped PHP templates at the same frontend location; remove Blade directives/helpers only after DOM and browser parity. |
| `frontend/src/js/app.js`, `lib/{clock,http,normalization,recovery-store,read-coordinator}.js` | M03/M05 | Keep unless a documented contract requires a minimal adaptation; retain Node tests. |
| `frontend/src/js/notes/{autosave-machine,note-editor,notes-page}.js` | M03/M05 | Keep autosave/recovery/read-order behavior and DOM hooks; correct invalid UUID fallback in M03. |
| `frontend/src/js/settings/{password,preferences,profile}.js` | M02/M05 | Preserve request/validation/session behavior; change only helper/bootstrap assumptions required by PHP templates. |
| `frontend/src/css/*.css` | M05/M06–M09 | Preserve Notes/settings styling; add planning styles using existing tokens/components without a redesign. |
| `frontend/tests/js/*.test.js` | M00 onward | Keep every current scenario; add behavior-focused tests beside new modules. |

## Test ownership

| Existing path | Phase | Target/disposition |
| --- | --- | --- |
| `backend/tests/Feature/AuthenticationTest.php`, `AccountContractTest.php`, `RateLimitTest.php` | M02/M05 | Port scenarios to plain HTTP integration tests before retiring Laravel base. |
| `backend/tests/Feature/{Notes,NoteQueryContract,LabelContract}Test.php`, `Unit/TextNormalizerTest.php` | M01/M03/M05 | Port behavior to plain unit/MySQL/HTTP tests. |
| `backend/tests/Feature/{Files,FileIntegrity,SecurityContract}Test.php` | M02–M05 | Split by owning security/file behavior; preserve failure and cross-account cases. |
| `backend/tests/Plain/**` | M01 onward | Canonical target suite mirroring `src` paths; pure unit tests avoid DB, repository/concurrency tests use guarded real MySQL, endpoint tests use target HTTP harness. |

## Removal rule

No legacy file is deleted when its target file is merely created. Deletion requires the owning phase's scenario parity, full phase gate, no runtime caller, clean-install proof, and an entry in implementation status. M05 owns framework-file removal; M10 owns only residue discovered by the final scan.
