# Shared — Floating AI assistant and proposal APIs

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The floating chat is the current browser entry; there is no `/ai` HTML page. Provider availability is server-configured. The chat is a tool-calling agent (AIChatService, up to 6 model rounds per message) over the owner's Areas, Goals, Tasks, Habits and Notes, with the recent conversation (`history`, last 12 messages) as real turns. Read tools (`list_areas`, `search_goals`/`get_goal`, `search_tasks`/`get_task`, `search_habits`/`get_habit`, `search_notes`/`get_note`) run immediately. Write tools (create/update/complete/reopen/delete Goal — a new Goal needs exactly one Area or parent Goal; create Tasks optionally inside a Goal and update/complete/reopen/delete Task; create/update/delete/check-in Habit, new Habits use the user's time zone; create/update/delete Note) only queue operations; `POST /api/v1/ai/chat` returns `{answer, proposal, preview}` and the chat shows the preview as a before → after confirmation card. Nothing changes until the user clicks Apply; Cancel calls Reject. Apply rechecks every targeted object's version and fails with 409 if any changed. Goal, Task and Habit delete archive the object; Note delete removes it with its attachments.

There is no separate approval page; the chat card is the only browser entry to the proposal APIs.

<!-- BEGIN GENERATED TRACE -->

### Tool-calling chat, owned reads and conversation history

**Trace ID:** `ai.chat`

The chat sends the recent conversation as real turns. AIChatService runs up to six model rounds over owner-scoped read tools and queues supported writes into a proposal instead of mutating domain data. Disabled mode reports unavailable; provider calls do not bypass normal ownership. Preview and explicit Apply/Cancel live in the floating chat.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-assistant-dialog](../../../frontend/src/views/layouts/app.php#L127) |
| Browser logic | [assistant.js · export function initAssistant](../../../frontend/src/js/planning/assistant.js#L117) |
| Controller / service / domain | [AIChatService.php · public function ask(](../../../backend/src/Application/AI/AIChatService.php#L52) |
| Persistence | [PdoAIActionRepository.php · public function assistantSummary(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L87) |
| Relevant tests (not a pass claim) | [PlanningHttpTest.php · public function test_planning_habit_dashboard_review_and_disabled_ai_http_contracts(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L45)<br>[AIActionTest.php · public function test_chat_task_request_creates_nothing_until_the_proposal_is_applied(](../../../backend/tests/Plain/Integration/AIActionTest.php#L77)<br>[AIActionTest.php · public function test_chat_agent_reads_then_queues_task_and_note_changes_applied_only_on_confirmation(](../../../backend/tests/Plain/Integration/AIActionTest.php#L101) |
| HTTP | `GET /api/v1/ai/chat` (`api.ai.chat.status`) → [AIChatController::status](../../../backend/src/Http/Controller/AIChatController.php#L19)<br>`POST /api/v1/ai/chat` (`api.ai.chat`) → [AIChatController::ask](../../../backend/src/Http/Controller/AIChatController.php#L26) |

### Chat proposal preview, Apply and Cancel

**Trace ID:** `ai.proposal`

The chat card previews queued supported create/update/transition/archive operations for Goals/Tasks/Habits and create/update/delete for Notes. Apply sends the exact version/hash; AIActionService validates ownership, context versions and expiry before ordinary services run atomically. Cancel calls Reject; replay retains stored outcomes. No queued write executes just because the model proposed it. Existing standalone structured creation APIs remain available.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-assistant-log](../../../frontend/src/views/layouts/app.php#L133) |
| CSS | [feedback.css · .assistant-proposal-actions {](../../../frontend/src/css/feedback.css#L211) |
| Browser logic | [assistant.js · const renderProposal = (message) =&gt;](../../../frontend/src/js/planning/assistant.js#L138) |
| Controller / service / domain | [AIActionService.php · public function apply(](../../../backend/src/Application/AI/AIActionService.php#L108)<br>[ProposalValidator.php · public function validate(](../../../backend/src/Application/AI/ProposalValidator.php#L24) |
| Persistence | [PdoAIActionRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L38)<br>[PdoAIActionRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L52)<br>[PdoAIActionRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L64) |
| Relevant tests (not a pass claim) | [AIActionTest.php · public function test_generation_writes_no_domain_data_and_apply_uses_normal_task_validation_idemp...](../../../backend/tests/Plain/Integration/AIActionTest.php#L50)<br>[AIActionTest.php · public function test_apply_rejects_context_changed_after_generation(](../../../backend/tests/Plain/Integration/AIActionTest.php#L293)<br>[AIActionTest.php · public function test_chat_agent_queues_goal_and_habit_changes_applied_only_on_confirmation(](../../../backend/tests/Plain/Integration/AIActionTest.php#L143)<br>[AIActionTest.php · public function test_chat_change_is_rejected_when_the_object_changed_after_the_proposal(](../../../backend/tests/Plain/Integration/AIActionTest.php#L186) |
| HTTP | `POST /api/v1/ai/actions` (`api.ai.actions.store`) → [AIActionController::store](../../../backend/src/Http/Controller/AIActionController.php#L17)<br>`GET /api/v1/ai/actions/{id}` (`api.ai.actions.show`) → [AIActionController::show](../../../backend/src/Http/Controller/AIActionController.php#L21)<br>`POST /api/v1/ai/actions/{id}/apply` (`api.ai.actions.apply`) → [AIActionController::apply](../../../backend/src/Http/Controller/AIActionController.php#L25)<br>`POST /api/v1/ai/actions/{id}/reject` (`api.ai.actions.reject`) → [AIActionController::reject](../../../backend/src/Http/Controller/AIActionController.php#L29) |

<!-- END GENERATED TRACE -->


