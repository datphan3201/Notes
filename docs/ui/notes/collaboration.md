# / — Live collaboration on shared Notes

[Documentation home](../../README.md) · [All routes](../../reference/routes.md) · [Sharing](sharing.md)

When the owner or an accepted recipient opens a shared Note, the editor joins a live session: changes from other people appear as they type, their initials show beside the save status, and the status reads **Saved · live**. View-only recipients see the updates read-only.

Runtime: `php backend/bin/realtime.php` (WebSocket, RFC 6455, no extensions). The browser asks the app for a 60-second ticket (`POST /api/v1/notes/{note}/realtime`), then connects to `REALTIME_PUBLIC_URL` or `/realtime` on the app origin, which Nginx forwards to `REALTIME_LISTEN` ([deployment](../../operations/deployment.md)). Title and content are independent operational-transformation documents measured in UTF-16 units; the server is the single sequencer per Note and saves merged text through `NoteService` (version bump, notifications) after typing pauses, at most every 3 seconds and when the last participant leaves.

Without the realtime server (for example `php -S` without a proxy) the session reports unavailable and editing continues with normal autosave; nothing is lost, there are just no live updates. Known limit: a share revoked while a socket is open stops that socket within about 5 seconds.

<!-- BEGIN GENERATED TRACE -->

### Live co-editing of shared Notes

**Trace ID:** `notes.collaboration`

Opening a shared Note (owner or accepted recipient) requests a 60-second HMAC ticket and connects to bin/realtime.php over WebSocket. Title and content are separate OT documents: the server sequences operations, transforms concurrent ones, acknowledges and broadcasts them, shows who is present and saves the merged text through NoteService after typing pauses (at most every 3 s and when the last person leaves). Reconnects rebase unsent edits; access is re-checked every few seconds. If the server cannot be reached, editing continues with normal autosave.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-editor-presence](../../../frontend/src/views/notes/index.php#L127)<br>[index.php · data-shared-presence](../../../frontend/src/views/notes/index.php#L330) |
| Browser logic | [collaboration.js · export class CollaborationSession](../../../frontend/src/js/notes/collaboration.js#L18)<br>[collab-binding.js · export class CollabBinding](../../../frontend/src/js/notes/collab-binding.js#L18)<br>[ot-client.js · export class OTClient](../../../frontend/src/js/lib/ot-client.js#L11)<br>[text-operation.js · export function transform(](../../../frontend/src/js/lib/text-operation.js#L117) |
| Controller / service / domain | [RealtimeController.php · public function ticket(](../../../backend/src/Http/Controller/RealtimeController.php#L36)<br>[CollaborationHub.php · final class CollaborationHub](../../../backend/src/Infrastructure/Realtime/CollaborationHub.php#L27)<br>[WebSocketServer.php · final class WebSocketServer](../../../backend/src/Infrastructure/Realtime/WebSocketServer.php#L18)<br>[TextOperation.php · public static function transform(](../../../backend/src/Domain/Realtime/TextOperation.php#L105)<br>[NoteService.php · public function writeCollaborativeText(](../../../backend/src/Application/Notes/NoteService.php#L298) |
| Persistence | [PdoNoteRepository.php · public function updateSnapshot(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L152) |
| Relevant tests (not a pass claim) | [CollaborationHubTest.php · hub convergence](../../../backend/tests/Plain/Integration/CollaborationHubTest.php#L86)<br>[RealtimeSocketTest.php · socket](../../../backend/tests/Plain/Http/RealtimeSocketTest.php#L86)<br>[text-operation.test.js · client convergence](../../../frontend/tests/js/text-operation.test.js#L135) |
| HTTP | `POST /api/v1/notes/{note}/realtime` (`api.notes.realtime`) → [RealtimeController::ticket](../../../backend/src/Http/Controller/RealtimeController.php#L36) |

<!-- END GENERATED TRACE -->
