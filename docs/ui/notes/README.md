# / — Notes

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Notes lives at `/`, not `/notes`. The workspace supports owned Notes and a separate Shared with me scope. A Note can be linked to one Goal or Task (editor **Linked to**); the card shows that link, and Goal information and the Task Notes tab list linked Notes. `/?note=<id>` opens a Note and `/?new=1&goal=<id>` (or `&task=<id>`) starts one already linked; the query is cleared after use.

- [Autosave and recovery](autosave.md)
- [Sharing and reports](sharing.md)
- [Private attachments and Note backgrounds](files.md)
- [Tags and labels](../shared/tags.md)
- [Note passwords](locks.md)
- [Live collaboration](collaboration.md)
- [AI summary and questions](ai.md)
- [Offline use and sync](offline.md)

## Layout and status

Grid is the default layout; the View button switches to list and is saved per account. Pinned Notes come first (newest pin first), then the chosen order; a *Pinned / Other notes* divider separates them. Each card shows icons for pinned, password-protected and shared Notes in both layouts. *Save and close* flushes the normal autosave path and closes the editor, like the close button and backdrop.

<!-- BEGIN GENERATED TRACE -->

### All notes, search, sort, grid/list and paging

**Trace ID:** `notes.collection`

NotesPage owns loading, selection and read coordination. Browser layout preferences and server search/paging have separate state. Search/filter changes must not let stale responses replace the selected Note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-notes-workspace](../../../frontend/src/views/notes/index.php#L1) |
| Browser logic | [notes-page.js · export class NotesPage](../../../frontend/src/js/notes/notes-page.js#L20)<br>[read-coordinator.js · export class LatestRequest](../../../frontend/src/js/lib/read-coordinator.js#L1) |
| Controller / service / domain | [NoteListQuery.php · public function paginate(](../../../backend/src/Application/Notes/NoteListQuery.php#L24) |
| Persistence | [PdoNoteRepository.php · public function paginate(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L48) |
| Relevant tests (not a pass claim) | [read-coordinator.test.js · Q01](../../../frontend/tests/js/read-coordinator.test.js#L13)<br>[read-coordinator.test.js · Q02](../../../frontend/tests/js/read-coordinator.test.js#L24)<br>[read-coordinator.test.js · Q03](../../../frontend/tests/js/read-coordinator.test.js#L50) |
| HTTP | `GET /api/v1/notes` (`api.notes.index`) → [NoteController::index](../../../backend/src/Http/Controller/NoteController.php#L40) |

### New note, title/content, color, pin and Save and close

**Trace ID:** `notes.editor`

NoteEditor and AutosaveMachine share the complete editable snapshot. Plain-text content supports inline checkable lines. Custom RGB, pin and labels remain owner-controlled; Save and close flushes the normal save path, then closes (as the close button and backdrop do). Permanent Delete sits apart, at the start of the action row. Card pin and live-collaboration color/pin/tag changes use the attribute endpoint, which never touches title/content. Cards show status icons for pinned, password-protected and shared Notes in grid and list views.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-form](../../../frontend/src/views/notes/index.php#L133) |
| CSS | [notes.css · Note editor dialog](../../../frontend/src/css/notes.css#L481) |
| Browser logic | [note-editor.js · export class NoteEditor](../../../frontend/src/js/notes/note-editor.js#L18)<br>[note-content-editor.js · export class NoteContentEditor](../../../frontend/src/js/notes/note-content-editor.js#L16) |
| Controller / service / domain | [NoteService.php · public function create(](../../../backend/src/Application/Notes/NoteService.php#L38)<br>[NoteService.php · public function update(](../../../backend/src/Application/Notes/NoteService.php#L125) |
| Persistence | [PdoNoteRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L125)<br>[PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L152) |
| Relevant tests (not a pass claim) | [autosave-machine.test.js · debounces valid edits](../../../frontend/tests/js/autosave-machine.test.js#L89)<br>[autosave-machine.test.js · J14 IME](../../../frontend/tests/js/autosave-machine.test.js#L315)<br>[autosave-machine.test.js · J01 a new note](../../../frontend/tests/js/autosave-machine.test.js#L336)<br>[note-checkbox-text.test.js · projection preserves](../../../frontend/tests/js/note-checkbox-text.test.js#L15) |
| HTTP | `POST /api/v1/notes` (`api.notes.store`) → [NoteController::store](../../../backend/src/Http/Controller/NoteController.php#L61)<br>`PATCH /api/v1/notes/{note}` (`api.notes.update`) → [NoteController::update](../../../backend/src/Http/Controller/NoteController.php#L83)<br>`PATCH /api/v1/notes/{note}/attributes` (`api.notes.attributes`) → [NoteController::attributes](../../../backend/src/Http/Controller/NoteController.php#L134) |

### Note links to a Goal or Task

**Trace ID:** `notes.links`

A Note can belong to one active Goal or Task of the same owner. The editor's Linked to picker sets or clears it outside the autosave snapshot (a new Note applies the choice after its first save); cards show the link as a chip, and Goal information and the Task Notes tab list linked Notes with a shortcut that opens a new Note already linked. Links to another account's work, or to both a Goal and a Task, are rejected; archiving or deleting the target hides or removes the link.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-note-link](../../../frontend/src/views/notes/index.php#L169)<br>[goal.php · data-linked-notes="goal"](../../../frontend/src/views/planning/goal.php#L140)<br>[task.php · data-linked-notes="task"](../../../frontend/src/views/planning/task.php#L109) |
| Browser logic | [note-editor.js · async setLink(](../../../frontend/src/js/notes/note-editor.js#L600)<br>[linked-notes.js · export async function renderLinkedNotes](../../../frontend/src/js/notes/linked-notes.js#L8)<br>[notes-page.js · openFromLocation() {](../../../frontend/src/js/notes/notes-page.js#L98) |
| Controller / service / domain | [NoteLinkService.php · public function link(](../../../backend/src/Application/Notes/NoteLinkService.php#L38)<br>[NoteController.php · public function link(](../../../backend/src/Http/Controller/NoteController.php#L96) |
| Persistence | [PdoNoteLinkRepository.php · public function save(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteLinkRepository.php#L17)<br>[0028_create_note_links.php · CREATE TABLE note_links](../../../backend/database/plain-migrations/0028_create_note_links.php#L19) |
| Relevant tests (not a pass claim) | [NotesHttpTest.php · public function test_note_links_to_one_goal_or_task_with_owner_isolation(](../../../backend/tests/Plain/Http/NotesHttpTest.php#L336) |
| HTTP | `PUT /api/v1/notes/{note}/link` (`api.notes.link`) → [NoteController::link](../../../backend/src/Http/Controller/NoteController.php#L96)<br>`GET /api/v1/goals/{id}/notes` (`api.goals.notes`) → [NoteController::goalNotes](../../../backend/src/Http/Controller/NoteController.php#L104)<br>`GET /api/v1/tasks/{id}/notes` (`api.tasks.notes`) → [NoteController::taskNotes](../../../backend/src/Http/Controller/NoteController.php#L112) |

### Delete and tombstones

**Trace ID:** `notes.delete`

Deleting an owned Note also unlinks its Task. A retried create with a tombstoned UUID returns 410 instead of resurrecting data. Pending file deletion is handled after the metadata transaction.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-delete](../../../frontend/src/views/notes/index.php#L197) |
| Browser logic | [note-editor.js · async deleteNote()](../../../frontend/src/js/notes/note-editor.js#L1218) |
| Controller / service / domain | [NoteService.php · public function delete(](../../../backend/src/Application/Notes/NoteService.php#L213) |
| Persistence | [PdoNoteRepository.php · public function tombstone(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L198) |
| Relevant tests (not a pass claim) | [NotesHttpTest.php · public function test_create_replay_update_conflict_noop_search_and_tombstone_contract(](../../../backend/tests/Plain/Http/NotesHttpTest.php#L55) |
| HTTP | `DELETE /api/v1/notes/{note}` (`api.notes.destroy`) → [NoteController::destroy](../../../backend/src/Http/Controller/NoteController.php#L155) |

<!-- END GENERATED TRACE -->
