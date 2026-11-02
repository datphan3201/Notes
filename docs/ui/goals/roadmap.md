# /goals/{id} — Fishbone roadmap

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The named Goal head opens **Goal information**. Milestone branches open a focused Task panel; branch position does not create dependencies.

[Archify: planning structure](../../diagrams/planning-structure/index.html) separates containment from contribution and prerequisite relationships.

<!-- BEGIN GENERATED TRACE -->

### Fishbone, paging and Milestone focus

**Trace ID:** `goal.roadmap`

The owned roadmap projection separates finite and recurring Tasks, direct Tasks, child Goals and Habits. The browser renders six Milestone cards per page and switches layout for narrow screens.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-roadmap-map](../../../frontend/src/views/planning/goal.php#L26) |
| CSS | [illustrated.css · Illustrated roadmap base](../../../frontend/src/css/illustrated.css#L87) |
| Browser logic | [goal-roadmap.js · export function initGoalDetail](../../../frontend/src/js/planning/goal-roadmap.js#L29) |
| Controller / service / domain | [PlanningService.php · public function roadmap(](../../../backend/src/Application/Planning/PlanningService.php#L725)<br>[PlanningService.php · private function roadmapSnapshot(](../../../backend/src/Application/Planning/PlanningService.php#L733) |
| Persistence | [PdoPlanningRepository.php · public function roadmapRows(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L403) |
| Relevant tests (not a pass claim) | [goal-roadmap.test.js · refresh cannot erase](../../../frontend/tests/js/goal-roadmap.test.js#L20)<br>[PlanningCoreTest.php · public function test_roadmap_groups_only_owned_active_work_and_excludes_occurrences_from_finite_p...](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L257) |
| Coverage limit | Projection and shared draft behavior are covered here; fishbone SVG layout, paging and responsive interaction require a browser check. |
| HTTP | `GET /api/v1/goals/{id}/roadmap` (`api.goals.roadmap`) → [PlanningController::roadmap](../../../backend/src/Http/Controller/PlanningController.php#L86) |

### Goal information: Edit, Strategy and Related work

**Trace ID:** `goal.information`

Goal details and strategy have separate drafts within one dialog. Strategy is plain text up to 20,000 code points; it does not emit Activity or change progress. Saved-version/draft choices preserve concurrent edits.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-goal-strategy-form](../../../frontend/src/views/planning/goal.php#L139) |
| Browser logic | [goal-roadmap.js · data-goal-strategy-form](../../../frontend/src/js/planning/goal-roadmap.js#L36)<br>[draft-buffer.js · export class DraftBuffer](../../../frontend/src/js/planning/draft-buffer.js#L1) |
| Controller / service / domain | [PlanningService.php · public function update(](../../../backend/src/Application/Planning/PlanningService.php#L163) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_strategy_notes_are_versioned_without_affecting_progress_or_activity(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L234) |
| HTTP | `GET /api/v1/goals/{id}` (`api.goals.show`) → [PlanningController::show](../../../backend/src/Http/Controller/PlanningController.php#L44)<br>`PATCH /api/v1/goals/{id}` (`api.goals.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`GET /api/v1/goals/{id}/contributions` (`api.goals.contributions.index`) → [PlanningController::contributions](../../../backend/src/Http/Controller/PlanningController.php#L220) |

### Goal progress, completion and ancestor reopen

**Trace ID:** `goal.progress`

Progress is the mean of immediate active child Goal percentages, completed Milestones and Done direct one-off Tasks. Exclude Habits, contributions, occurrences and Tasks inside Milestones. Calculated 100% does not auto-complete the Goal.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-goal-transition](../../../frontend/src/views/planning/goal.php#L13) |
| Browser logic | [transitions.js · export async function transitionEntity](../../../frontend/src/js/planning/transitions.js#L7) |
| Controller / service / domain | [GoalProgressCalculator.php · public function calculate(](../../../backend/src/Domain/Planning/GoalProgressCalculator.php#L17)<br>[PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function progressRows(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L388) |
| Relevant tests (not a pass claim) | [PlanningDomainTest.php · public function test_progress_uses_immediate_finite_components_and_detects_cycles(](../../../backend/tests/Plain/Unit/PlanningDomainTest.php#L26) |
| HTTP | `POST /api/v1/goals/{id}/complete` (`api.goals.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/goals/{id}/reopen` (`api.goals.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92) |

### Archive Goal and contents

**Trace ID:** `goal.archive`

Empty-container archive and include_contents=true are different operations. The latter explicitly archives descendant Goals, Milestones, Tasks and series and removes relevant prerequisite links in one transaction. It is not a hard delete or automatic default cascade.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-goal-details-form](../../../frontend/src/views/planning/goal.php#L94) |
| Browser logic | [goal-roadmap.js · await remove(`/api/v1/goals/](../../../frontend/src/js/planning/goal-roadmap.js#L778) |
| Controller / service / domain | [PlanningService.php · public function archive(](../../../backend/src/Application/Planning/PlanningService.php#L228)<br>[PlanningService.php · private function archiveGoalContents(](../../../backend/src/Application/Planning/PlanningService.php#L270) |
| Persistence | [PdoPlanningRepository.php · public function archiveWhere(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L130)<br>[PdoPlanningRepository.php · public function removeMilestoneDependencies(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L146) |
| Relevant tests (not a pass claim) | [ProductCompletionTest.php · public function test_goal_and_milestone_can_be_archived_with_everything_inside(](../../../backend/tests/Plain/Integration/ProductCompletionTest.php#L123) |
| HTTP | `DELETE /api/v1/goals/{id}` (`api.goals.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65) |

<!-- END GENERATED TRACE -->


