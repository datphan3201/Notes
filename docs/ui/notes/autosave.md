# / — Notes autosave, recovery and conflicts

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

[Archify: Notes save lifecycle](../../diagrams/notes-autosave/index.html) and [failure/recovery outcomes](../../diagrams/notes-save-outcomes/index.html). The main Notes workspace owns autosave/recovery. Task notes, shared edits and Reviews use their explicit-save paths.

<!-- BEGIN GENERATED TRACE -->

### Dirty, saving, saved and retry state

**Trace ID:** `notes.autosave`

Valid edits debounce at 500ms and dispatch within 2s of continuous typing. One logical request is frozen/in-flight at a time. Only exact acknowledged content is Saved. IME composition never sends partial text.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-status](../../../frontend/src/views/notes/index.php#L116) |
| Browser logic | [autosave-machine.js · export class AutosaveMachine](../../../frontend/src/js/notes/autosave-machine.js#L12) |
| Controller / service / domain | [NoteService.php · public function update(](../../../backend/src/Application/Notes/NoteService.php#L111) |
| Persistence | [PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L151) |
| Relevant tests (not a pass claim) | [autosave-machine.test.js · debounces valid edits](../../../frontend/tests/js/autosave-machine.test.js#L89)<br>[autosave-machine.test.js · keeps typing](../../../frontend/tests/js/autosave-machine.test.js#L112)<br>[autosave-machine.test.js · J02 continuous](../../../frontend/tests/js/autosave-machine.test.js#L209) |
| HTTP | `POST /api/v1/notes` (`api.notes.store`) → [NoteController::store](../../../backend/src/Http/Controller/NoteController.php#L57)<br>`PATCH /api/v1/notes/{note}` (`api.notes.update`) → [NoteController::update](../../../backend/src/Http/Controller/NoteController.php#L79) |

### Recover draft, offline retry and session changes

**Trace ID:** `notes.recovery`

One account-scoped sessionStorage record preserves acknowledged/draft/frozen request state. Validate schema, user, age and size before recovery. Retry exact requests after 1/2/4s, respect Retry-After, pause offline; validation/conflicts require intervention. Clear owned recovery records on logout/account change.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-session-recovery](../../../frontend/src/views/notes/index.php#L120) |
| Browser logic | [recovery-store.js · export class RecoveryStore](../../../frontend/src/js/lib/recovery-store.js#L5)<br>[autosave-machine.js · export class AutosaveMachine](../../../frontend/src/js/notes/autosave-machine.js#L12) |
| Controller / service / domain | [NoteService.php · public function create(](../../../backend/src/Application/Notes/NoteService.php#L37) |
| Persistence | [PdoNoteRepository.php · public function findOwned(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L28)<br>[PdoNoteRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L124) |
| Relevant tests (not a pass claim) | [recovery-store.test.js · isolated by user](../../../frontend/tests/js/recovery-store.test.js#L24)<br>[recovery-store.test.js · corrupt and expired](../../../frontend/tests/js/recovery-store.test.js#L35)<br>[recovery-store.test.js · clearAll](../../../frontend/tests/js/recovery-store.test.js#L50)<br>[autosave-machine.test.js · J12 recovery](../../../frontend/tests/js/autosave-machine.test.js#L282)<br>[autosave-machine.test.js · J13 expired session](../../../frontend/tests/js/autosave-machine.test.js#L297) |
| HTTP | `GET /api/v1/session` (`api.session`) → [AccountController::session](../../../backend/src/Http/Controller/AccountController.php#L106) |

### Saved-version/draft conflict decisions

**Trace ID:** `notes.conflict`

Creates use stable client-generated UUIDs. Exact replay is a no-op; stale different updates return current owned content with 409. The editor keeps the local draft until the user chooses how to reconcile.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-conflict-dialog role="dialog"](../../../frontend/src/views/notes/index.php#L219) |
| Browser logic | [notes-page.js · openConflict(machine) {](../../../frontend/src/js/notes/notes-page.js#L700) |
| Controller / service / domain | [NoteService.php · public function update(](../../../backend/src/Application/Notes/NoteService.php#L111) |
| Persistence | [PdoNoteRepository.php · public function findOwned(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L28)<br>[PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L151) |
| Relevant tests (not a pass claim) | [NotesHttpTest.php · public function test_create_replay_update_conflict_noop_search_and_tombstone_contract(](../../../backend/tests/Plain/Http/NotesHttpTest.php#L55) |
| HTTP | `PATCH /api/v1/notes/{note}` (`api.notes.update`) → [NoteController::update](../../../backend/src/Http/Controller/NoteController.php#L79) |

<!-- END GENERATED TRACE -->
