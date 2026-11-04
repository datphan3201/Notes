# / — Share and Shared with me

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Owner sharing uses exact email and an invitation. Accepted recipients may view or explicitly save title/content with edit permission. Attachments, tags, pin/color and deletion remain owner-only.

<!-- BEGIN GENERATED TRACE -->

### Share dialog: invite, permission and remove

**Trace ID:** `notes.sharing.owner`

Unknown emails return the same success shape but create no invitation. Owner can change view/edit or revoke access. A deleted Note ends shares.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-share](../../../frontend/src/views/notes/index.php#L171) |
| Browser logic | [note-sharing.js · export class NoteSharing](../../../frontend/src/js/notes/note-sharing.js#L98) |
| Controller / service / domain | [NoteShareService.php · public function share(](../../../backend/src/Application/Notes/NoteShareService.php#L37)<br>[NoteShareService.php · public function changePermission(](../../../backend/src/Application/Notes/NoteShareService.php#L76) |
| Persistence | [PdoNoteShareRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L17)<br>[PdoNoteShareRepository.php · public function forNote(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L55)<br>[PdoNoteShareRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L90) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_owner_controls_note_sharing_permissions_and_notifications(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L54) |
| HTTP | `GET /api/v1/notes/{note}/shares` (`api.notes.shares.index`) → [NoteShareController::index](../../../backend/src/Http/Controller/NoteShareController.php#L28)<br>`POST /api/v1/notes/{note}/shares` (`api.notes.shares.store`) → [NoteShareController::store](../../../backend/src/Http/Controller/NoteShareController.php#L34)<br>`PATCH /api/v1/notes/{note}/shares/{share}` (`api.notes.shares.update`) → [NoteShareController::update](../../../backend/src/Http/Controller/NoteShareController.php#L50)<br>`DELETE /api/v1/notes/{note}/shares/{share}` (`api.notes.shares.destroy`) → [NoteShareController::destroy](../../../backend/src/Http/Controller/NoteShareController.php#L62) |

### Shared with me, accept/decline, edit and leave

**Trace ID:** `notes.sharing.recipient`

Acceptance is required before access. Edit uses the Note version and explicit Save; 409 preserves conflict handling. Shared changes notify other accepted participants, never the actor. Missing/revoked memberships return 404. Notes owned by a locked account are hidden from recipients (list and direct links return 404) until the account is unlocked; a moderator can also withdraw a reported Note from every recipient.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-filter-shared](../../../frontend/src/views/notes/index.php#L58) |
| Browser logic | [note-sharing.js · export class NoteSharing](../../../frontend/src/js/notes/note-sharing.js#L98) |
| Controller / service / domain | [NoteShareService.php · public function updateShared(](../../../backend/src/Application/Notes/NoteShareService.php#L153)<br>[NoteShareService.php · public function respond(](../../../backend/src/Application/Notes/NoteShareService.php#L111) |
| Persistence | [PdoNoteShareRepository.php · public function findReceived(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L45)<br>[PdoNoteShareRepository.php · public function received(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L73)<br>[PdoNoteShareRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php#L119) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_owner_controls_note_sharing_permissions_and_notifications(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L54) |
| HTTP | `GET /api/v1/shared-notes` (`api.shared-notes.index`) → [NoteShareController::received](../../../backend/src/Http/Controller/NoteShareController.php#L67)<br>`POST /api/v1/shared-notes/invitations/{share}/{action}` (`api.shared-notes.respond`) → [NoteShareController::respond](../../../backend/src/Http/Controller/NoteShareController.php#L73)<br>`GET /api/v1/shared-notes/{note}` (`api.shared-notes.show`) → [NoteShareController::show](../../../backend/src/Http/Controller/NoteShareController.php#L90)<br>`PATCH /api/v1/shared-notes/{note}` (`api.shared-notes.update`) → [NoteShareController::edit](../../../backend/src/Http/Controller/NoteShareController.php#L96)<br>`DELETE /api/v1/shared-notes/memberships/{share}` (`api.shared-notes.leave`) → [NoteShareController::leave](../../../backend/src/Http/Controller/NoteShareController.php#L82) |

### Report shared Note

**Trace ID:** `notes.sharing.report`

A recipient reports a reason; the report stores a title/content snapshot. Admin review does not grant access to the live private Note.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-filter-shared](../../../frontend/src/views/notes/index.php#L58) |
| Browser logic | [note-sharing.js · async report()](../../../frontend/src/js/notes/note-sharing.js#L431) |
| Controller / service / domain | [ReportService.php · public function report(](../../../backend/src/Application/Admin/ReportService.php#L39) |
| Persistence | [PdoReportRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L16)<br>[PdoReportRepository.php · public function hasOpenReport(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L58) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L98) |
| HTTP | `POST /api/v1/shared-notes/{note}/report` (`api.shared-notes.report`) → [NoteShareController::report](../../../backend/src/Http/Controller/NoteShareController.php#L104) |

<!-- END GENERATED TRACE -->
