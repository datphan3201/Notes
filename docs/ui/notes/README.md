# / — Notes

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Notes lives at `/`, not `/notes`. The workspace supports owned Notes and a separate Shared with me scope.

- [Autosave and recovery](autosave.md)
- [Sharing and reports](sharing.md)
- [Private attachments and Note backgrounds](files.md)
- [Tags and labels](../shared/tags.md)

## Pending interface review

[ISSUE-017](../../issues.md#issue-017--notes-controls-have-redundant-placement-and-unclear-save-wording) proposes compact preferences and clearer action hierarchy while preserving the current visual system. Save currently invokes save-and-close; its wording/behavior needs confirmation before implementation. [ISSUE-018](../../issues.md#issue-018--notes-pagination-omits-the-current-middle-page-and-localized-labels) and [ISSUE-019](../../issues.md#issue-019--notes-layout-preferences-do-not-refresh-the-visible-layout) track reproduced browser rendering discrepancies. No application change was made by this review.

<!-- BEGIN GENERATED TRACE -->

### All notes, search, sort, grid/list and paging

**Trace ID:** `notes.collection`

NotesPage owns loading, selection and read coordination. Browser layout preferences and server search/paging have separate state. Search/filter changes must not let stale responses replace the selected Note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-notes-workspace](../../../frontend/src/views/notes/index.php#L1) |
| Browser logic | [notes-page.js · export class NotesPage](../../../frontend/src/js/notes/notes-page.js#L8)<br>[read-coordinator.js · export class LatestRequest](../../../frontend/src/js/lib/read-coordinator.js#L1) |
| Controller / service / domain | [NoteListQuery.php · public function paginate(](../../../backend/src/Application/Notes/NoteListQuery.php#L24) |
| Persistence | [PdoNoteRepository.php · public function paginate(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L48) |
| Relevant tests (not a pass claim) | [read-coordinator.test.js · Q01](../../../frontend/tests/js/read-coordinator.test.js#L13)<br>[read-coordinator.test.js · Q02](../../../frontend/tests/js/read-coordinator.test.js#L24)<br>[read-coordinator.test.js · Q03](../../../frontend/tests/js/read-coordinator.test.js#L50) |
| HTTP | `GET /api/v1/notes` (`api.notes.index`) → [NoteController::index](../../../backend/src/Http/Controller/NoteController.php#L29) |

### New note, title/content, color, pin and Save

**Trace ID:** `notes.editor`

NoteEditor and AutosaveMachine share the complete editable snapshot. Plain-text content supports inline checkable lines. Custom RGB, pin and labels remain owner-controlled; explicit Save flushes the normal save path.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-form](../../../frontend/src/views/notes/index.php#L133) |
| CSS | [notes.css · Note editor dialog](../../../frontend/src/css/notes.css#L420) |
| Browser logic | [note-editor.js · export class NoteEditor](../../../frontend/src/js/notes/note-editor.js#L15)<br>[note-content-editor.js · export class NoteContentEditor](../../../frontend/src/js/notes/note-content-editor.js#L15) |
| Controller / service / domain | [NoteService.php · public function create(](../../../backend/src/Application/Notes/NoteService.php#L37)<br>[NoteService.php · public function update(](../../../backend/src/Application/Notes/NoteService.php#L111) |
| Persistence | [PdoNoteRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L124)<br>[PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L151) |
| Relevant tests (not a pass claim) | [autosave-machine.test.js · debounces valid edits](../../../frontend/tests/js/autosave-machine.test.js#L89)<br>[autosave-machine.test.js · J14 IME](../../../frontend/tests/js/autosave-machine.test.js#L315)<br>[autosave-machine.test.js · J01 a new note](../../../frontend/tests/js/autosave-machine.test.js#L336)<br>[note-checkbox-text.test.js · projection preserves](../../../frontend/tests/js/note-checkbox-text.test.js#L15) |
| HTTP | `POST /api/v1/notes` (`api.notes.store`) → [NoteController::store](../../../backend/src/Http/Controller/NoteController.php#L47)<br>`PATCH /api/v1/notes/{note}` (`api.notes.update`) → [NoteController::update](../../../backend/src/Http/Controller/NoteController.php#L69) |

### Delete and tombstones

**Trace ID:** `notes.delete`

Deleting an owned Note also unlinks its Task. A retried create with a tombstoned UUID returns 410 instead of resurrecting data. Pending file deletion is handled after the metadata transaction.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-delete](../../../frontend/src/views/notes/index.php#L178) |
| Browser logic | [note-editor.js · async deleteNote()](../../../frontend/src/js/notes/note-editor.js#L805) |
| Controller / service / domain | [NoteService.php · public function delete(](../../../backend/src/Application/Notes/NoteService.php#L197) |
| Persistence | [PdoNoteRepository.php · public function tombstone(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L197) |
| Relevant tests (not a pass claim) | [NotesHttpTest.php · public function test_create_replay_update_conflict_noop_search_and_tombstone_contract(](../../../backend/tests/Plain/Http/NotesHttpTest.php#L55) |
| HTTP | `DELETE /api/v1/notes/{note}` (`api.notes.destroy`) → [NoteController::destroy](../../../backend/src/Http/Controller/NoteController.php#L96) |

<!-- END GENERATED TRACE -->


