# / — Note passwords

[Documentation home](../../README.md) · [All routes](../../reference/routes.md) · [Notes](README.md)

Any owned Note can have its own password, unrelated to the account password or other Notes. The editor's **Password** button turns it on (password typed twice); on a locked Note the same button offers **Change password** (current + new twice) and **Remove password** (current). Locked cards show a lock icon and no preview in both grid and list views.

Before any action on a locked Note — open, edit, delete, pin, share, files, AI summary, live editing — the **Unlock** dialog asks for the password. The server enforces this (423 `NOTE_LOCKED`) from a session-scoped unlock that lasts 15 idle minutes, ends when the editor closes and stops working as soon as the password changes. Accepted recipients unlock with the same password; only the owner manages it. Wrong passwords are limited to 8 per 5 minutes per account and Note.

Locked text never appears in cards, search (title only), Goal/Task linked lists, AI answers, the AI chat tools or the offline copy.

<!-- BEGIN GENERATED TRACE -->

### Password: turn on, change, remove and unlock

**Trace ID:** `notes.locks`

Owner turns on a per-Note password by typing it twice (4+ characters, bcrypt). Changing needs the current password plus the new one twice; removing needs the current password. Opening, editing, deleting, pinning, sharing, attachments, AI summary and realtime tickets of a locked Note answer 423 until this session enters its password; the unlock is remembered for 15 idle minutes and dropped when the editor closes or the password changes. Cards, search, linked lists, AI questions and the offline copy never contain locked text. Wrong guesses are limited per account and Note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-lock](../../../frontend/src/views/notes/index.php#L189)<br>[index.php · data-unlock-dialog](../../../frontend/src/views/notes/index.php#L357)<br>[index.php · data-lock-dialog](../../../frontend/src/views/notes/index.php#L378) |
| Browser logic | [note-dialogs.js · export class NoteLockUI](../../../frontend/src/js/notes/note-dialogs.js#L34)<br>[note-editor.js · async manageLock()](../../../frontend/src/js/notes/note-editor.js#L384) |
| Controller / service / domain | [NoteLockService.php · final readonly class NoteLockService](../../../backend/src/Application/Notes/NoteLockService.php#L24)<br>[NoteLockGate.php · public function assertUnlocked(](../../../backend/src/Application/Notes/NoteLockGate.php#L50) |
| Persistence | [PdoNoteRepository.php · public function setLock(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L259)<br>[0030_add_note_locks_ai_and_sync.php · ADD COLUMN lock_hash](../../../backend/database/plain-migrations/0030_add_note_locks_ai_and_sync.php#L19) |
| Relevant tests (not a pass claim) | [NoteRubricHttpTest.php · lifecycle](../../../backend/tests/Plain/Http/NoteRubricHttpTest.php#L58)<br>[NoteRubricHttpTest.php · throttling](../../../backend/tests/Plain/Http/NoteRubricHttpTest.php#L119) |
| HTTP | `PUT /api/v1/notes/{note}/lock` (`api.notes.lock.enable`) → [NoteLockController::enable](../../../backend/src/Http/Controller/NoteLockController.php#L23)<br>`PATCH /api/v1/notes/{note}/lock` (`api.notes.lock.change`) → [NoteLockController::change](../../../backend/src/Http/Controller/NoteLockController.php#L31)<br>`DELETE /api/v1/notes/{note}/lock` (`api.notes.lock.disable`) → [NoteLockController::disable](../../../backend/src/Http/Controller/NoteLockController.php#L39)<br>`POST /api/v1/notes/{note}/unlock` (`api.notes.unlock`) → [NoteLockController::unlock](../../../backend/src/Http/Controller/NoteLockController.php#L47)<br>`POST /api/v1/notes/{note}/relock` (`api.notes.relock`) → [NoteLockController::relock](../../../backend/src/Http/Controller/NoteLockController.php#L56) |

<!-- END GENERATED TRACE -->
