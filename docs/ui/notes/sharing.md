# / — Share and Shared with me

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Owner sharing invites one or several registered accounts by email (unknown addresses are rejected and named) and sends an invitation notification and email. Accepted recipients see owner, permission and share time; edit recipients change title/content with autosave, live together with others ([live collaboration](collaboration.md)). Attachments, tags, pin/color, passwords and deletion remain owner-only; a password-protected Note asks recipients for its password.

<!-- BEGIN GENERATED TRACE -->

### Share dialog: invite, permission and remove

**Trace ID:** `notes.sharing.owner`

Owner invites one or several registered accounts at once (comma-separated). Every address must belong to an account, otherwise nothing is written and the unknown addresses are named (422). New recipients get an in-app invitation and, when they allow it, an email. Owner can change view/edit or revoke access at any time; the list shows each recipient's email, permission and invited/accepted state. A deleted Note ends shares. Contact suggestions include only accepted Note-sharing relationships for the authenticated account, excluding locked accounts; pending/revoked shares do not provide suggestions.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-share](../../../frontend/src/views/notes/index.php#L193) |
| Browser logic | [note-sharing.js · export class NoteSharing](../../../frontend/src/js/notes/note-sharing.js#L116) |
| Controller / service / domain | [NoteShareService.php · public function shareMany(](../../../backend/src/Application/Notes/NoteShareService.php#L48)<br>[NoteShareService.php · public function changePermission(](../../../backend/src/Application/Notes/NoteShareService.php#L115)<br>[NoteShareController.php · public function contacts(](../../../backend/src/Http/Controller/NoteShareController.php#L133)<br>[NoteShareService.php · public function contacts(](../../../backend/src/Application/Notes/NoteShareService.php#L265) |
| Persistence | [PdoNoteShareRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L17)<br>[PdoNoteShareRepository.php · public function forNote(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L55)<br>[PdoNoteShareRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L90)<br>[PdoNoteShareRepository.php · public function contacts(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L125) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_owner_controls_note_sharing_permissions_and_notifications(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L54)<br>[NoteRubricHttpTest.php · registered recipients](../../../backend/tests/Plain/Http/NoteRubricHttpTest.php#L136)<br>[FullFeedbackHttpTest.php · public function test_note_sharing_contacts_remain_scoped_without_teamwork(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L172) |
| HTTP | `GET /api/v1/notes/{note}/shares` (`api.notes.shares.index`) → [NoteShareController::index](../../../backend/src/Http/Controller/NoteShareController.php#L28)<br>`POST /api/v1/notes/{note}/shares` (`api.notes.shares.store`) → [NoteShareController::store](../../../backend/src/Http/Controller/NoteShareController.php#L34)<br>`PATCH /api/v1/notes/{note}/shares/{share}` (`api.notes.shares.update`) → [NoteShareController::update](../../../backend/src/Http/Controller/NoteShareController.php#L66)<br>`DELETE /api/v1/notes/{note}/shares/{share}` (`api.notes.shares.destroy`) → [NoteShareController::destroy](../../../backend/src/Http/Controller/NoteShareController.php#L78)<br>`GET /api/v1/contacts` (`api.contacts`) → [NoteShareController::contacts](../../../backend/src/Http/Controller/NoteShareController.php#L133) |

### Shared with me, accept/decline, edit and leave

**Trace ID:** `notes.sharing.recipient`

Shared with me lists accepted Notes with owner, permission (view only / can edit), share time and lock state; invitations can be accepted or declined. Edit recipients change title/content only: live over the realtime socket when available, otherwise by debounced autosave with base_version (a 409 retries on the newer version). View-only recipients see live updates read-only. Notes owned by a locked account are hidden from recipients (list and direct links return 404) until the account is unlocked; a moderator can also withdraw a reported Note from every recipient.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-filter-shared](../../../frontend/src/views/notes/index.php#L62) |
| Browser logic | [note-sharing.js · export class NoteSharing](../../../frontend/src/js/notes/note-sharing.js#L116) |
| Controller / service / domain | [NoteShareService.php · public function updateShared(](../../../backend/src/Application/Notes/NoteShareService.php#L194)<br>[NoteShareService.php · public function respond(](../../../backend/src/Application/Notes/NoteShareService.php#L150) |
| Persistence | [PdoNoteShareRepository.php · public function findReceived(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L45)<br>[PdoNoteShareRepository.php · public function received(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L73)<br>[PdoNoteShareRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L119) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_owner_controls_note_sharing_permissions_and_notifications(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L54) |
| HTTP | `GET /api/v1/shared-notes` (`api.shared-notes.index`) → [NoteShareController::received](../../../backend/src/Http/Controller/NoteShareController.php#L83)<br>`POST /api/v1/shared-notes/invitations/{share}/{action}` (`api.shared-notes.respond`) → [NoteShareController::respond](../../../backend/src/Http/Controller/NoteShareController.php#L89)<br>`GET /api/v1/shared-notes/{note}` (`api.shared-notes.show`) → [NoteShareController::show](../../../backend/src/Http/Controller/NoteShareController.php#L106)<br>`PATCH /api/v1/shared-notes/{note}` (`api.shared-notes.update`) → [NoteShareController::edit](../../../backend/src/Http/Controller/NoteShareController.php#L112)<br>`DELETE /api/v1/shared-notes/memberships/{share}` (`api.shared-notes.leave`) → [NoteShareController::leave](../../../backend/src/Http/Controller/NoteShareController.php#L98) |

### Report shared Note

**Trace ID:** `notes.sharing.report`

A recipient reports a reason; the report stores a title/content snapshot. Admin review does not grant access to the live private Note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-filter-shared](../../../frontend/src/views/notes/index.php#L62) |
| Browser logic | [note-sharing.js · async report()](../../../frontend/src/js/notes/note-sharing.js#L736) |
| Controller / service / domain | [ReportService.php · public function report(](../../../backend/src/Application/Admin/ReportService.php#L39) |
| Persistence | [PdoReportRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L16)<br>[PdoReportRepository.php · public function hasOpenReport(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L58) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L101) |
| HTTP | `POST /api/v1/shared-notes/{note}/report` (`api.shared-notes.report`) → [NoteShareController::report](../../../backend/src/Http/Controller/NoteShareController.php#L120) |

<!-- END GENERATED TRACE -->
