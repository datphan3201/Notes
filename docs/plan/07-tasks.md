# Ordered Implementation Tasks

Every checkbox represents work not yet done. Use `docs/implementation-status.md` as the execution ledger. Keep commits coherent if Git work is requested; never manufacture contributor history. Each task should leave a reviewable result, even when the complete app is not ready.

## T00 — Verify and prepare native runtime

Dependencies: none. Read: PLAN, architecture A02–A06.

- [ ] Recheck existing files/runtime and preserve the DOCX/context/plan.
- [ ] Install/configure PHP 8.5 extensions, Composer 2, and MySQL 8.4 if absent and permitted; verify actual CLI/server settings.
- [ ] Create isolated dev/test databases and SQL users. Keep credentials local.
- [ ] Verify connectivity, charset/collation, transaction support, and upload limits.
- [ ] Record actual versions and environmental failures in the ledger. Do not install Docker or call external application services.

Gate: real PHP/PDO-to-MySQL connection succeeds for both isolated databases, required extensions are present, and Node/npm work. If privileges block setup, mark this task blocked, report the exact failed step, and continue only independent specification/UI work; do not claim downstream database tests passed.

## T01 — Scaffold and configure the application

Dependencies: T00 for executable verification. Read: architecture, HTTP conventions.

Files: `backend/composer.json`, `backend/.env.example`, Laravel bootstrap/routes,
`frontend/package.json`, `frontend/vite.config.js`, frontend source entries,
`.gitignore`, and the `Readme.txt` setup draft.

- [ ] Place Laravel under `backend/` and presentation/build source under
  `frontend/`; configure MySQL and private storage without replacing root docs.
- [ ] Install/bundle Alpine 3, Noto Sans and Prettier; retain Vite 8/Laravel plugin; remove unused default Tailwind/optional tooling.
- [ ] Create session/CSRF-aware JSON route group; configure JSON exception shapes and private-response headers.
- [ ] Set bcrypt/session/cache configuration, note/password normalization exclusions, Vietnamese validation messages, and explicit npm scripts.
- [ ] Add test environment guard described in document 08 before any destructive test migration.
- [ ] Keep secrets, vendor/node_modules, logs, private files, browser artifacts, local envs, and `.venv` out of version control. Preserve lockfiles and source assets.

Gate: backend Composer/Artisan checks and frontend npm/Vite checks pass from
their respective directories; no default welcome/SQLite/Tailwind dependency
remains. Test guard rejects the development database before any reset.

## T02 — Migrations, models, resources, and fixtures

Dependencies: T01. Read: entire database contract.

Files: migrations for all seven application tables plus standard sessions, models/casts/relations, factories, resources, TextNormalizer/NoteSnapshot helpers, validation rules.

- [ ] Implement exact types, foreign keys, indexes, CHECK constraints, and label-name collation.
- [ ] Create required preferences transaction/defaults support; model visibility hides hashes/storage paths.
- [ ] Implement active/tombstone behavior and resource serialization without exposing deleted content.
- [ ] Implement canonical snapshot normalization/comparison with Unicode-aware lengths and sorted label IDs.
- [ ] Build test factories for two isolated accounts, labels, notes, and attachment metadata; no application demo seed.

Gate: clean migration succeeds on `notes_test`; schema assertions cover constraints/relationships; serialization exposes only allowed fields; body whitespace and password bytes remain intact. Verify the app uses MySQL, not a test fallback.

## T03 — Authentication and account boundaries

Dependencies: T02. Read: scope account rules, HTTP HTML/session endpoints.

Files: Auth controllers/actions/Form Requests, auth Blade forms, `/api/v1/session`, ownership policies, auth/session middleware tests.

- [ ] Registration validates four fields only, creates user/preferences atomically, hashes bcrypt, logs in and rotates session.
- [ ] Login/logout implement session rotation/invalidation and fixed error messages.
- [ ] Unverified users get access and the factual banner; no mail notification is dispatched.
- [ ] Implement session recheck endpoint and authenticated/guest response behavior.
- [ ] Enforce login/registration throttles, no password logging/flashing, no Remember me/reset routes.

Gate: A01–A07 and S01–S03 in verification pass. Guest page access redirects; guest JSON reads return 401; a valid-session mutation with neither a valid origin signal nor valid CSRF token fails 419 in a real middleware request. No avatar or password-change completeness claim yet.

## T04 — Notes API and concurrency

Dependencies: T03. Read: database create/update/delete algorithms, HTTP note contracts, autosave server prerequisites.

Files: NoteController/requests/policy, CreateNote/UpdateNote/DeleteNote actions, NoteListQuery, note resources, feature tests.

- [ ] Implement owner-scoped CRUD, complete-snapshot updates, versions, pin times, stable ordering, scrubbed tombstones, and duplicate-create replay.
- [ ] Implement literal title/body search, ANY label EXISTS filtering, pagination/counts, and bounded list queries.
- [ ] Build transaction/owner-lock helper that later label/file actions also use. Map conflicts and unknown IDs correctly.
- [ ] Start deletion path cleanup support even before upload UI exists; use pending deletion records.
- [ ] Implement normal/no-op/stale/retry response cases using real persistence.

Gate: backend portions of N01–N12, D01/D04, and S04–S06 pass for the implemented note routes; N12's confirmation UI is verified after T08. D02's label race and D03's file race are verified after their features exist. Two sequential requests based on the same version cannot silently overwrite. Retried create yields one note; a deleted UUID cannot be recreated. No JavaScript UI workaround is accepted as a replacement for backend invariants.

## T05 — Labels API and cross-note integrity

Dependencies: T04. Read: label business rules and transaction/version rules.

Files: LabelController/requests/policy, label actions/resources, label filtering/association tests.

- [ ] Implement listing/create/rename/delete, version conflict responses, limits, normalized uniqueness.
- [ ] Validate ownership for note label assignment after note conflict detection, before writing.
- [ ] Rename updates visible names through joined label data; delete detaches and increments affected note versions once.
- [ ] Ensure ANY filtering returns one copy per note and handles deleted/missing selected labels.

Gate: backend portions of L01–L08 and D02 pass. Note bodies and attachment rows survive label deletion. `Work`/`work` cannot coexist for one owner; `hoc`/`học` can. Actual browser label displays are verified in T07/T10.

## T06 — Private attachments and avatars

Dependencies: T05. Read: file schema/lifecycle, upload allowlist, serving contract.

Files: file actions/controllers/requests/rules, private file routes, prune command, profile/avatar resources, fixtures and feature tests.

- [ ] Validate bytes/types/dimensions/quotas; randomized private paths; no storage public symlink.
- [ ] Implement upload UUID replay/digest rules, list/remove, nested parent checks, and removal tombstones.
- [ ] Implement authorized image/video preview, download, range/HEAD behavior, and safe filenames/headers.
- [ ] Implement avatar decoding/resizing/re-encoding, replace/remove lifecycle, default-avatar resource behavior.
- [ ] Implement post-commit deletion attempts plus `files:prune` pending/orphan cleanup.

Gate: F01–F11 and S07 pass, including spoofed types, cross-user download, upload replay, quota serialization, private-path inaccessibility, and failed cleanup retry. Multipart errors must use the agreed contract when PHP/framework receives them. Do not claim a simulated storage fake proves browser video seeking; verify that later in T10.

## T07 — Workspace UI and label interactions

Dependencies: T06. Read: UI specification, HTTP list/detail contract.

Files: token/base/layout/components CSS, app/guest layouts, notes sidebar/toolbar/grid/list/dialog partials, notes-page and label-manager JS, shared http helper.

- [ ] Build light/dark-capable shell, responsive navigation, honest initial loading/empty/error states.
- [ ] Wire real list/search/filter/pagination endpoints; use cancellation/sequence guards.
- [ ] Implement accessible grid/list switching, pin/card menu actions using fetched detail, and real label manager/selector.
- [ ] Implement shared editor markup and detail loading with editor-generation guard; use escaped text throughout.
- [ ] Register all shared leave intents, without yet allowing unsafe direct close shortcuts. Editor creation/edit persistence is completed in T08.

Gate: browser can register/login, load its own notes, search/filter/page, manage labels and switch view; U01's grid/list rendering, U03/U04 and Q01–Q03 pass for these flows. View-preference persistence is completed in T09 and its full U01 case is verified then. At 360/768/1440 widths there is no horizontal overflow in workspace/navigation. An unimplemented editor save flow must still be labeled incomplete in the ledger.

## T08 — Autosave, conflict handling, and draft recovery

Dependencies: T07. Read: **entire document 06** plus note HTTP/transaction contracts.

Files: autosave-machine, recovery-store, clock, normalization, note-editor, conflict/recovery/leave dialogs, JS unit tests.

- [ ] Implement explicit state/immutable request model, 500ms debounce, 2s max wait, one logical write, IME handling.
- [ ] Connect new and existing notes to the same editor; reveal later controls only after creation acknowledgment.
- [ ] Implement retry classification/budget, exact-payload replay, version conflicts, unavailable states, stale-response guards, and honest saved status.
- [ ] Add per-account per-tab recovery with schema/TTL/quota handling and current-server reconciliation.
- [ ] Add close/navigation/delete guards, beforeunload lifecycle, re-auth/session/CSRF reconciliation and cross-account handling.
- [ ] Add pure JS tests using injected fake transport/clock/storage; cover the transitions in J01–J16, not just simple setters.

Gate: all J01–J16 pass. Browser scenario B02 can type, save, reload and recover exact text; B05 proves two-tab conflict behavior. Slow or lost responses cannot overwrite newer draft input or produce duplicate notes. No Save button is introduced to evade autosave complexity.

## T09 — Account settings and file UI

Dependencies: T08. Read: profile/preferences/password HTTP and UI contracts.

Files: Profile/Preference/Password controllers/actions/requests as needed, settings pages/components, attachment-uploader, editor attachment rows/previews, preference/profile/password JS.

- [ ] Wire name/avatar editing with independent status and validation.
- [ ] Wire all preferences; serialized partial-setting queue, rollback/status on failure, persisted grid/list selection, new-note default color semantics.
- [ ] Implement change-password backend/UI, all-session invalidation, draft clearing, login redirect.
- [ ] Build sequential attachment upload queue with progress/pending/success/error states, explicit retry/removal, authorized preview/download, and leave guard.
- [ ] Prevent double submits and accidental full-page navigation from API-backed forms.

Gate: A08–A11, F12, full U01/U02/U05, B06/B07 pass. Refresh/login retains preferences; existing notes keep their own color. Password change invalidates both test browser sessions. File input rejection does not discard note text or other successfully uploaded files.

## T10 — End-to-end interaction review

Dependencies: T09. Read: full browser checklist and UI specification.

Files: integration fixes only as justified; write evidence to `docs/verification.md`, screenshots under `output/playwright/`.

- [ ] Run B01–B10 against real PHP/MySQL with Playwright CLI; record actions/expected/actual results.
- [ ] Inspect screenshots at all specified widths in both themes; inspect keyboard focus, dialogs, long Unicode content, native video seek.
- [ ] Exercise delayed reads/writes, offline toggle, logout from another tab, draft recovery, and deletion conflicts.
- [ ] Fix observed issues and rerun only affected scenarios before the final full verification gate.

Gate: B01–B10 have passing evidence, no severe console/network errors in normal flows, and actual screenshots have been inspected. Do not invent Playwright element refs; take fresh snapshots as instructed by the skill.

## T11 — Security/integrity failure review

Dependencies: T10. Read: data invariants and security scenarios.

Files: focused fixes/tests, logging/error handling/config refinements, cleanup command documentation.

- [ ] Check all routes for owner scope and CSRF; ensure serialization and logs do not leak sensitive values.
- [ ] Verify file spoofing, SQL wildcard behavior, literal HTML rendering, request limits, password byte limits, and private storage.
- [ ] Reconcile race paths across note/label/file removal, active request retries, stale revisions, and session changes.
- [ ] Simulate database/storage failures and verify no false successful save or unrecoverable metadata/file mismatch.
- [ ] Inspect that deferred services/UI/routes/tables were not accidentally introduced by scaffold packages or copied examples.

Gate: S01–S08, D01–D06 and remaining failure cases pass; any material limitation is recorded with a specific reproduction and mitigation, not hidden behind a green UI screenshot.

## T12 — Final reproducibility and R1 delivery

Dependencies: T11. Read: all R1 criteria and final verification commands.

Files: `Readme.txt`, `.env.example`, `docs/verification.md`, implementation ledger, context/plan if an approved technical decision changed.

- [ ] Run final PHP suite, JS suite, format checks, and production asset build after all fixes.
- [ ] Verify built assets without Vite dev server and with an alternate application port configured through the environment/CLI.
- [ ] Measure the personal-workload list/search behavior described in document 08; record environment and actual results.
- [ ] Validate fresh database setup using `notes_test`/a disposable test database, never by resetting personal data.
- [ ] Write exact native setup/start/test/cleanup commands, limits, credentials-creation instructions, and deferred-feature list. No default personal password or secret is committed.
- [ ] Update every task state, link evidence, and distinguish automated results from browser/manual checks and unrun checks.

Gate: all R1 requirement IDs have evidence, a fresh user can use the app locally, and README commands reproduce the result. Final response gives startup instructions, implemented scope, important remaining limitations, and test results. Do not describe this as the completed 32-criterion final assignment.
