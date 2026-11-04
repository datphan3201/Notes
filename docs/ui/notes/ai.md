# / — AI summary and questions

[Documentation home](../../README.md) · [All routes](../../reference/routes.md) · [Floating AI assistant](../shared/ai.md)

**AI summary** sits under the content of the Note editor and the shared-note dialog: **Summarize** generates 2–6 key points in the Note's language, **Regenerate** replaces them, and **Out of date** appears once the title or content changed. **Ask AI** in the Notes header answers questions from the user's unlocked Notes and Notes shared with them, and lists the source Notes; choosing a source opens it.

Both are read-only and use the configured provider (`AI_ENABLED`, `AI_MODEL`, `AI_EMBEDDING_MODEL`); with AI disabled they report 503 `AI_DISABLED`. They are rate-limited by the `ai-notes` bucket (60 per hour). Note text is passed to the model as data with instructions to ignore commands inside it. Separate from the floating assistant, which proposes changes.

<!-- BEGIN GENERATED TRACE -->

### AI summary of one Note

**Trace ID:** `notes.ai.summary`

The editor (and the shared-note dialog) shows the stored summary and generates or regenerates it with the configured LLM in the Note's own language. The summary is shared by everyone who can read the Note and is marked out of date when the title or content changed since (pin/color do not count). Locked Notes need their password first.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · class="ai-summary is-hidden" data-ai-summary](../../../frontend/src/views/notes/index.php#L144)<br>[index.php · data-shared-ai-summary](../../../frontend/src/views/notes/index.php#L342) |
| Browser logic | [note-dialogs.js · export class SummaryPanel](../../../frontend/src/js/notes/note-dialogs.js#L331) |
| Controller / service / domain | [NoteAIService.php · public function summarize(](../../../backend/src/Application/Notes/NoteAIService.php#L56) |
| Persistence | [PdoNoteAIRepository.php · public function saveSummary(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteAIRepository.php#L31) |
| Relevant tests (not a pass claim) | [NoteAIServiceTest.php · summary](../../../backend/tests/Plain/Integration/NoteAIServiceTest.php#L60) |
| HTTP | `GET /api/v1/notes/{note}/summary` (`api.notes.summary.show`) → [NoteAIController::summary](../../../backend/src/Http/Controller/NoteAIController.php#L24)<br>`POST /api/v1/notes/{note}/summary` (`api.notes.summary.generate`) → [NoteAIController::summarize](../../../backend/src/Http/Controller/NoteAIController.php#L30) |

### Ask AI about your Notes

**Trace ID:** `notes.ai.ask`

A question searches the user's unlocked Notes and accepted shared Notes by meaning (embeddings, cached per text) and keywords (accent-insensitive BM25), sends the best eight to the LLM and shows a synthesized answer with clickable source Notes. Only Notes actually given to the model can be cited; locked Notes are never read. Without embeddings it falls back to keywords.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-ask-dialog](../../../frontend/src/views/notes/index.php#L414)<br>[index.php · data-open-ask-ai](../../../frontend/src/views/notes/index.php#L45) |
| Browser logic | [note-dialogs.js · export class AskAIDialog](../../../frontend/src/js/notes/note-dialogs.js#L454) |
| Controller / service / domain | [NoteAIService.php · public function ask(](../../../backend/src/Application/Notes/NoteAIService.php#L92)<br>[NoteRetrieval.php · public static function rank(](../../../backend/src/Domain/Notes/NoteRetrieval.php#L114) |
| Persistence | [PdoNoteAIRepository.php · public function saveEmbedding(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteAIRepository.php#L77)<br>[PdoNoteRepository.php · public function retrievable(](../../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteRepository.php#L317) |
| Relevant tests (not a pass claim) | [NoteAIServiceTest.php · citations](../../../backend/tests/Plain/Integration/NoteAIServiceTest.php#L82)<br>[NoteRetrievalTest.php · retrieval](../../../backend/tests/Plain/Unit/NoteRetrievalTest.php#L33) |
| HTTP | `POST /api/v1/notes/ask` (`api.notes.ask`) → [NoteAIController::ask](../../../backend/src/Http/Controller/NoteAIController.php#L38) |

<!-- END GENERATED TRACE -->
