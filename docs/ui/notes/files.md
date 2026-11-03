# / — Attachments and private Note backgrounds

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Only backend/public is a public document root. Uploaded bytes stay private and are served through authenticated owned file routes. Shared recipients do not inherit attachment access.

<!-- BEGIN GENERATED TRACE -->

### Upload, select Note background and remove attachment

**Trace ID:** `notes.files.upload`

Server MIME/signature and size validation is authoritative; attachment limit is 20MiB. Metadata transactions compensate failed writes; deferred deletion avoids mixing file I/O with SQL commits.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · &lt;select data-note-background&gt;](../../../frontend/src/views/notes/index.php#L157) |
| Browser logic | [note-editor.js · async uploadFiles(](../../../frontend/src/js/notes/note-editor.js#L663) |
| Controller / service / domain | [FileService.php · public function uploadAttachment(](../../../backend/src/Application/Files/FileService.php#L49)<br>[FileService.php · public function deleteAttachment(](../../../backend/src/Application/Files/FileService.php#L137)<br>[UploadValidator.php · public function attachment(](../../../backend/src/Application/Files/UploadValidator.php#L46)<br>[NoteService.php · public function setBackground(](../../../backend/src/Application/Notes/NoteService.php#L176) |
| Persistence | [AttachmentRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Files/AttachmentRepository.php#L97)<br>[AttachmentRepository.php · public function tombstone(](../../../backend/src/Infrastructure/Persistence/Pdo/Files/AttachmentRepository.php#L129)<br>[AttachmentRepository.php · public function findOwnedForNote(](../../../backend/src/Infrastructure/Persistence/Pdo/Files/AttachmentRepository.php#L44)<br>[PdoNoteRepository.php · public function setBackground(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L253) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_invalid_files_quota_and_unknown_fields_leave_no_orphan_bytes(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L207) |
| HTTP | `GET /api/v1/notes/{note}/attachments` (`api.attachments.index`) → [AttachmentController::index](../../../backend/src/Http/Controller/AttachmentController.php#L25)<br>`POST /api/v1/notes/{note}/attachments` (`api.attachments.store`) → [AttachmentController::store](../../../backend/src/Http/Controller/AttachmentController.php#L34)<br>`DELETE /api/v1/notes/{note}/attachments/{attachment}` (`api.attachments.destroy`) → [AttachmentController::destroy](../../../backend/src/Http/Controller/AttachmentController.php#L52)<br>`PUT /api/v1/notes/{note}/background` (`api.notes.background`) → [NoteController::background](../../../backend/src/Http/Controller/NoteController.php#L116) |

### Preview, download, HEAD and Range

**Trace ID:** `notes.files.stream`

Only allowed media types preview. Safe filenames and a single byte Range are supported; 206/416 and HEAD preserve streaming semantics. Path traversal, foreign IDs and symlinks are rejected.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-dialog role="dialog"](../../../frontend/src/views/notes/index.php#L106) |
| Browser logic | [note-editor.js · attachmentRow(attachment) {](../../../frontend/src/js/notes/note-editor.js#L786) |
| Controller / service / domain | [FileService.php · public function authorizedAttachment(](../../../backend/src/Application/Files/FileService.php#L171)<br>[FileStreamer.php · public function attachment(](../../../backend/src/Application/Files/FileStreamer.php#L14) |
| Persistence | [LocalPrivateStorage.php · public function resolve(](../../../backend/src/Infrastructure/Storage/LocalPrivateStorage.php#L114) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_attachment_replay_stream_ranges_owner_scope_and_tombstone(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L77) |
| HTTP | `GET/HEAD /files/attachments/{attachment}/preview` (`files.attachment.preview`) → [FileContentController::preview](../../../backend/src/Http/Controller/FileContentController.php#L23)<br>`GET/HEAD /files/attachments/{attachment}/download` (`files.attachment.download`) → [FileContentController::download](../../../backend/src/Http/Controller/FileContentController.php#L29) |

<!-- END GENERATED TRACE -->


