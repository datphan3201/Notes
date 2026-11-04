# / — Offline use and sync

[Documentation home](../../README.md) · [All routes](../../reference/routes.md) · [Autosave](autosave.md)

Planner is installable (web app manifest) and keeps working without a connection. The service worker (`backend/public/sw.js`) caches built assets and the last copy of main pages, and shows `offline.html` for anything else. On the Notes page an **Offline** banner appears and the list, search, tag filters and editor use the device copy (IndexedDB, one database per account), refreshed in the background from `GET /api/v1/notes/sync`.

Changes made offline are saved on the device (**Saved on this device · will sync**; cards show a clock badge) and sent when the connection returns: creates keep their client UUID, edits carry the version they were based on, and deletes are replayed. If the Note changed elsewhere meanwhile, the offline version is saved as a new Note titled “… (offline copy)”. Password-protected text, attachments, sharing and AI need a connection. Logging out deletes the caches and the device copy.

<!-- BEGIN GENERATED TRACE -->

### Offline Notes, queued changes and sync

**Trace ID:** `notes.offline`

A service worker caches built assets and recent pages; the Notes page keeps an IndexedDB copy per account filled from the cursor-based sync feed. Offline, the list (search, tags, order) and editor work from that copy; creates, edits and deletes are queued, one entry per Note, and replayed on reconnect. A version conflict saves the offline text as an “(offline copy)”. Locked text and files are not stored offline. Logout clears caches and the local copy.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-offline-banner](../../../frontend/src/views/notes/index.php#L97) |
| Browser logic | [offline-sync.js · export class OfflineSync](../../../frontend/src/js/notes/offline-sync.js#L18)<br>[offline-store.js · export class OfflineStore](../../../frontend/src/js/lib/offline-store.js#L25)<br>[offline-outbox.js · export function coalesce(](../../../frontend/src/js/lib/offline-outbox.js#L12)<br>[sw.js · self.addEventListener('fetch'](../../../backend/public/sw.js#L63) |
| Controller / service / domain | [NoteSync.php · public function changes(](../../../backend/src/Application/Notes/NoteSync.php#L27) |
| Persistence | [PdoNoteRepository.php · public function changedSince(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L283) |
| Relevant tests (not a pass claim) | [NoteRubricHttpTest.php · sync feed](../../../backend/tests/Plain/Http/NoteRubricHttpTest.php#L199)<br>[offline-outbox.test.js · outbox](../../../frontend/tests/js/offline-outbox.test.js#L14) |
| HTTP | `GET /api/v1/notes/sync` (`api.notes.sync`) → [NoteController::sync](../../../backend/src/Http/Controller/NoteController.php#L143) |

<!-- END GENERATED TRACE -->
