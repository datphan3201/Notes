# Shared — Floating AI assistant and proposal APIs

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The floating chat is the current browser entry; there is no `/ai` HTML page. Provider availability is server-configured. Chat reads owned Planner context; the separate structured proposal APIs can create only after explicit Apply.

Do not document the proposal API as a currently visible approval editor: this repo has no such browser page.

<!-- BEGIN GENERATED TRACE -->

### Open assistant, status and question/answer

**Trace ID:** `ai.chat`

The chat dialog queries availability and submits a question. Server-owned context selection and provider calls must not leak secrets or bypass normal ownership rules. Disabled mode reports unavailable honestly.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-assistant-dialog](../../../frontend/src/views/layouts/app.php#L127) |
| Browser logic | [assistant.js · export function initAssistant](../../../frontend/src/js/planning/assistant.js#L29) |
| Controller / service / domain | [AIChatService.php · public function ask(](../../../backend/src/Application/AI/AIChatService.php#L28) |
| Persistence | [PdoAIActionRepository.php · public function assistantSummary(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L87) |
| Relevant tests (not a pass claim) | [PlanningHttpTest.php · public function test_planning_habit_dashboard_review_and_disabled_ai_http_contracts(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L45) |
| HTTP | `GET /api/v1/ai/chat` (`api.ai.chat.status`) → [AIChatController::status](../../../backend/src/Http/Controller/AIChatController.php#L19)<br>`POST /api/v1/ai/chat` (`api.ai.chat`) → [AIChatController::ask](../../../backend/src/Http/Controller/AIChatController.php#L26) |

### API-only proposal generation, Apply and Reject

**Trace ID:** `ai.proposal`

AIActionService freezes proposal/hash/context versions; Apply revalidates owner, versions, hash and expiry and calls ordinary services atomically. Replaying an applied proposal returns the stored ID mapping. Modify/Delete are not allowed proposal operations.

| Layer | Entry point |
| --- | --- |
| Controller / service / domain | [AIActionService.php · public function apply(](../../../backend/src/Application/AI/AIActionService.php#L78)<br>[ProposalValidator.php · public function validate(](../../../backend/src/Application/AI/ProposalValidator.php#L12) |
| Persistence | [PdoAIActionRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L38)<br>[PdoAIActionRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L52)<br>[PdoAIActionRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/AI/PdoAIActionRepository.php#L64) |
| Relevant tests (not a pass claim) | [AIActionTest.php · public function test_generation_writes_no_domain_data_and_apply_uses_normal_task_validation_idemp...](../../../backend/tests/Plain/Integration/AIActionTest.php#L47)<br>[AIActionTest.php · public function test_apply_rejects_context_changed_after_generation(](../../../backend/tests/Plain/Integration/AIActionTest.php#L119) |
| HTTP | `POST /api/v1/ai/actions` (`api.ai.actions.store`) → [AIActionController::store](../../../backend/src/Http/Controller/AIActionController.php#L17)<br>`GET /api/v1/ai/actions/{id}` (`api.ai.actions.show`) → [AIActionController::show](../../../backend/src/Http/Controller/AIActionController.php#L21)<br>`POST /api/v1/ai/actions/{id}/apply` (`api.ai.actions.apply`) → [AIActionController::apply](../../../backend/src/Http/Controller/AIActionController.php#L25)<br>`POST /api/v1/ai/actions/{id}/reject` (`api.ai.actions.reject`) → [AIActionController::reject](../../../backend/src/Http/Controller/AIActionController.php#L29) |

<!-- END GENERATED TRACE -->


