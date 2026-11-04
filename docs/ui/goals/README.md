# /goals — Areas and Goal collections

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Routes: `/goals` and [Goal details](roadmap.md) at `/goals/{id}`. Milestones have an in-page Goal component, not a standalone HTML route.

<!-- BEGIN GENERATED TRACE -->

### Manage Areas

**Trace ID:** `goals.areas`

Accounts start with localized placeholder Areas. Rename/reorder uses owner/version checks; at most four active Areas and the last active Area cannot be archived. An Area containing active root Goals cannot be archived. Each Area has an importance of 1–5 (default 3), set with the stars beside its name in the Goal tree. Manage areas also exposes versioned icon/importance controls, compact Rename and Archive actions, and a Cancel-first Add area footer.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goals.php · data-area-list](../../../frontend/src/views/planning/goals.php#L47) |
| Browser logic | [planning-page.js · export function initGoalsPage](../../../frontend/src/js/planning/planning-page.js#L189) |
| Controller / service / domain | [PlanningService.php · public function reorder(](../../../backend/src/Application/Planning/PlanningService.php#L801)<br>[PlanningService.php · public function archive(](../../../backend/src/Application/Planning/PlanningService.php#L229) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51)<br>[PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoPlanningRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L116) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_default_area_backfill_is_idempotent_and_preserves_existing_accounts(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L219)<br>[PlanningCoreTest.php · public function test_empty_planning_objects_and_checklist_can_be_archived_with_native_prepares(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L380) |
| HTTP | `GET /api/v1/areas` (`api.areas.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/areas` (`api.areas.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`PATCH /api/v1/areas/{id}` (`api.areas.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`POST /api/v1/areas/reorder` (`api.areas.reorder`) → [PlanningController::reorder](../../../backend/src/Http/Controller/PlanningController.php#L230)<br>`DELETE /api/v1/areas/{id}` (`api.areas.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65) |

### Goal tree, timeline and main Goal

**Trace ID:** `goals.collection`

Goal hierarchy has one primary Area or parent Goal and arbitrary depth. Tree/timeline presentation does not alter it: expand carets sit in a gutter so sibling Goals stay aligned and only sub-Goals are indented; deadlines read as localized dates. The Main goal card is the account's explicit focus Goal, the same choice as the Dashboard roadmap; its title is a picker that changes both, and with no choice it invites one instead of guessing by importance. Create/move validates ownership, active ancestors and cycles. Open a Goal name for its fishbone. New goal uses the shared floating creator with an Area preset; edit buttons on the Main goal card, tree and timeline open the same floating editor without changing roadmap navigation.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goals.php · data-goal-tree](../../../frontend/src/views/planning/goals.php#L31) |
| Browser logic | [planning-page.js · export function initGoalsPage](../../../frontend/src/js/planning/planning-page.js#L189)<br>[planning-page.js · const renderMainGoal = (goals, focusId) =&gt;](../../../frontend/src/js/planning/planning-page.js#L200)<br>[quick-editor.js · export function openQuickCreator(](../../../frontend/src/js/planning/quick-editor.js#L626) |
| Controller / service / domain | [PlanningService.php · public function moveGoal(](../../../backend/src/Application/Planning/PlanningService.php#L312)<br>[GraphGuard.php · public function wouldCycle(](../../../backend/src/Domain/Planning/GraphGuard.php#L14) |
| Persistence | [PdoPlanningRepository.php · public function goalHierarchyEdges(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L170)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningDomainTest.php · public function test_graph_guard_handles_deep_graphs_without_recursion(](../../../backend/tests/Plain/Unit/PlanningDomainTest.php#L14) |
| HTTP | `GET /api/v1/goals` (`api.goals.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/goals` (`api.goals.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`POST /api/v1/goals/{id}/move` (`api.goals.move`) → [PlanningController::moveGoal](../../../backend/src/Http/Controller/PlanningController.php#L76)<br>`GET /goals/{id}` (`planning.goal`) → [AccountController::planningPage](../../../backend/src/Http/Controller/AccountController.php#L185)<br>`GET /api/v1/dashboard/roadmap` (`api.dashboard.roadmap.show`) → [DashboardController::roadmap](../../../backend/src/Http/Controller/DashboardController.php#L58)<br>`PATCH /api/v1/dashboard/roadmap` (`api.dashboard.roadmap.update`) → [DashboardController::updateRoadmap](../../../backend/src/Http/Controller/DashboardController.php#L63) |

### Icons, colours and importance stars

**Trace ID:** `planning.icons`

Areas, Goals, Milestones and Habits each take an optional icon from a fixed 39-symbol line set and one of eight accent colours; null keeps the automatic default (Areas and Milestones cycle the accents by position). The picker opens from the icon itself, saves immediately with the entity version, closes on Escape or an outside click and offers Use default icon. Tasks have no icon. Importance reads as 1–5 stars at every planning level, including Area (default 3); stars are editable where the entity is shown as a heading and read-only in lists. The server validates icon/icon_color against its catalogue (unknown values → 422) and the browser catalogue is tested to match it.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-goal-icon](../../../frontend/src/views/planning/goal.php#L9)<br>[goal.php · data-milestone-icon](../../../frontend/src/views/planning/goal.php#L39) |
| CSS | [components.css · Icon picker](../../../frontend/src/css/components.css#L159)<br>[components.css · Star rating](../../../frontend/src/css/components.css#L232) |
| Browser logic | [entity-icons.js · export function openIconPicker(](../../../frontend/src/js/lib/entity-icons.js#L162)<br>[entity-icons.js · export function iconButton(](../../../frontend/src/js/lib/entity-icons.js#L243)<br>[star-rating.js · export function starRating(](../../../frontend/src/js/lib/star-rating.js#L27) |
| Controller / service / domain | [EntityIcon.php · final class EntityIcon](../../../backend/src/Domain/Planning/EntityIcon.php#L13)<br>[PlanningService.php · 'icon' =&gt; EntityIcon::icon($value)](../../../backend/src/Application/Planning/PlanningService.php#L973) |
| Persistence | [0029_add_entity_icons.php · 0029_add_entity_icons](../../../backend/database/plain-migrations/0029_add_entity_icons.php#L10) |
| Relevant tests (not a pass claim) | [PlanningHttpTest.php · public function test_icons_and_importance_are_chosen_at_every_planning_level(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L220)<br>[entity-icons.test.js · test('the icon and colour catalogues match what the backend accepts'](../../../frontend/tests/js/entity-icons.test.js#L16) |
| HTTP | `PATCH /api/v1/areas/{id}` (`api.areas.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`PATCH /api/v1/goals/{id}` (`api.goals.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`PATCH /api/v1/milestones/{id}` (`api.milestones.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`PATCH /api/v1/habits/{id}` (`api.habits.update`) → [HabitController::update](../../../backend/src/Http/Controller/HabitController.php#L30) |

<!-- END GENERATED TRACE -->
