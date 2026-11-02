# /goals — Areas and Goal collections

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Routes: `/goals` and [Goal details](roadmap.md) at `/goals/{id}`. Milestones have an in-page Goal component, not a standalone HTML route.

<!-- BEGIN GENERATED TRACE -->

### Manage Areas

**Trace ID:** `goals.areas`

Accounts start with localized placeholder Areas. Rename/reorder uses owner/version checks; at most four active Areas and the last active Area cannot be archived. An Area containing active root Goals cannot be archived.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goals.php · data-area-list](../../../frontend/src/views/planning/goals.php#L79) |
| Browser logic | [planning-page.js · export function initGoalsPage](../../../frontend/src/js/planning/planning-page.js#L142) |
| Controller / service / domain | [PlanningService.php · public function reorder(](../../../backend/src/Application/Planning/PlanningService.php#L800)<br>[PlanningService.php · public function archive(](../../../backend/src/Application/Planning/PlanningService.php#L228) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51)<br>[PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoPlanningRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L116) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_default_area_backfill_is_idempotent_and_preserves_existing_accounts(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L219)<br>[PlanningCoreTest.php · public function test_empty_planning_objects_and_checklist_can_be_archived_with_native_prepares(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L380) |
| HTTP | `GET /api/v1/areas` (`api.areas.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/areas` (`api.areas.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`PATCH /api/v1/areas/{id}` (`api.areas.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`POST /api/v1/areas/reorder` (`api.areas.reorder`) → [PlanningController::reorder](../../../backend/src/Http/Controller/PlanningController.php#L230)<br>`DELETE /api/v1/areas/{id}` (`api.areas.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65) |

### Goal tree, timeline and main Goal

**Trace ID:** `goals.collection`

Goal hierarchy has one primary Area or parent Goal and arbitrary depth. Tree/timeline presentation does not alter it. Create/move validates ownership, active ancestors and cycles. Open a Goal name for its fishbone.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goals.php · data-goal-tree](../../../frontend/src/views/planning/goals.php#L31) |
| Browser logic | [planning-page.js · export function initGoalsPage](../../../frontend/src/js/planning/planning-page.js#L142) |
| Controller / service / domain | [PlanningService.php · public function moveGoal(](../../../backend/src/Application/Planning/PlanningService.php#L311)<br>[GraphGuard.php · public function wouldCycle(](../../../backend/src/Domain/Planning/GraphGuard.php#L14) |
| Persistence | [PdoPlanningRepository.php · public function goalHierarchyEdges(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L170)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningDomainTest.php · public function test_graph_guard_handles_deep_graphs_without_recursion(](../../../backend/tests/Plain/Unit/PlanningDomainTest.php#L14) |
| HTTP | `GET /api/v1/goals` (`api.goals.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/goals` (`api.goals.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`POST /api/v1/goals/{id}/move` (`api.goals.move`) → [PlanningController::moveGoal](../../../backend/src/Http/Controller/PlanningController.php#L76)<br>`GET /goals/{id}` (`planning.goal`) → [AccountController::planningPage](../../../backend/src/Http/Controller/AccountController.php#L185) |

<!-- END GENERATED TRACE -->


