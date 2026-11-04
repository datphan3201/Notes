# /goals/{id} — Milestone panel

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: select a fishbone branch. Milestone details, prerequisites, finite/recurring Tasks and capture remain inside the Goal page. Plain Task-name clicks open the shared floating editor; modified clicks and Open full page retain `/tasks/{id}` navigation. New Task creation uses the shared creator; name/criteria suggestion chips and the duplicate repeat-capture form were removed. Use Tasks → Repeating for series creation.

<!-- BEGIN GENERATED TRACE -->

### Prerequisites and completion lock

**Trace ID:** `milestone.dependencies`

Prerequisite edges form a separate acyclic graph and may cross owned Goals. All active prerequisites must be Completed to complete this Milestone. Reopening a prerequisite with a completed dependent is rejected; reopen dependents first.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-prerequisites](../../../frontend/src/views/planning/goal.php#L55) |
| Browser logic | [goal-roadmap.js · data-milestone-prerequisites](../../../frontend/src/js/planning/goal-roadmap.js#L577) |
| Controller / service / domain | [PlanningService.php · public function addDependency(](../../../backend/src/Application/Planning/PlanningService.php#L513)<br>[PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L346) |
| Persistence | [PdoPlanningRepository.php · public function prerequisites(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L266)<br>[PdoPlanningRepository.php · public function dependencyEdges(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L191)<br>[PdoPlanningRepository.php · public function completedDependents(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L281) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_milestone_dependency_blocks_milestone_but_not_its_task(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L107)<br>[PlanningCoreTest.php · public function test_failed_milestone_reopen_does_not_partially_reopen_completed_goals(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L319) |
| HTTP | `GET /api/v1/milestones/{id}/prerequisites` (`api.milestones.prerequisites.index`) → [PlanningController::prerequisites](../../../backend/src/Http/Controller/PlanningController.php#L214)<br>`POST /api/v1/milestones/{id}/prerequisites` (`api.milestones.prerequisites.store`) → [PlanningController::addDependency](../../../backend/src/Http/Controller/PlanningController.php#L104)<br>`DELETE /api/v1/milestones/{id}/prerequisites/{target}` (`api.milestones.prerequisites.destroy`) → [PlanningController::removeDependency](../../../backend/src/Http/Controller/PlanningController.php#L114) |

### Finite/recurring Tasks, weekly selection and Complete

**Trace ID:** `milestone.tasks`

Tasks under a locked Milestone are usable and completable. Completing a Milestone with unfinished Tasks requires acknowledge_open_tasks=true. Recurring occurrences do not enter finite completion denominators. Task rows share taskRowShell with Tasks: round completion tick, floating-editor name, status/due/repeat facts and read-only stars. Add task opens the shared creator with Milestone/order presets, replacing the duplicate capture dialog and suggestions.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-tasks](../../../frontend/src/views/planning/goal.php#L64) |
| Browser logic | [goal-roadmap.js · function taskRows(](../../../frontend/src/js/planning/goal-roadmap.js#L435)<br>[task-row.js · export function taskRowShell(](../../../frontend/src/js/planning/task-row.js#L7) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L346) |
| Persistence | [PdoPlanningRepository.php · public function milestoneTaskProgress(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L214)<br>[PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_milestone_dependency_blocks_milestone_but_not_its_task(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L107) |
| HTTP | `POST /api/v1/milestones/{id}/complete` (`api.milestones.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/milestones/{id}/reopen` (`api.milestones.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34) |

### Edit, contributions and archive

**Trace ID:** `milestone.edit`

Milestone edits and contribution changes use aggregate versions. Archiving with include_contents is an explicit bulk action. Contributions never act as prerequisites or progress weights. Edit/Archive live in a keyboard-accessible disclosure menu; editing uses the shared floating editor. Week selection is an accessible pin toggle labelled Select for this week; Complete/Reopen is the primary panel action. Archive wording describes retained data and preserves include_contents confirmation.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-menu](../../../frontend/src/views/planning/goal.php#L47) |
| Browser logic | [goal-roadmap.js · function archiveMilestone(](../../../frontend/src/js/planning/goal-roadmap.js#L723)<br>[quick-editor.js · export function openQuickEditor(](../../../frontend/src/js/planning/quick-editor.js#L621)<br>[action-menu.js · export function actionMenu(](../../../frontend/src/js/planning/action-menu.js#L5) |
| Controller / service / domain | [PlanningService.php · private function archiveMilestoneContents(](../../../backend/src/Application/Planning/PlanningService.php#L303)<br>[PlanningService.php · public function addContribution(](../../../backend/src/Application/Planning/PlanningService.php#L526) |
| Persistence | [PdoPlanningRepository.php · public function archiveWhere(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L130)<br>[PdoPlanningRepository.php · public function addEdge(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L247) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_contributions_are_multi_target_and_separate_from_primary_hierarchy(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L84) |
| HTTP | `PATCH /api/v1/milestones/{id}` (`api.milestones.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`DELETE /api/v1/milestones/{id}` (`api.milestones.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65)<br>`POST /api/v1/milestones/{id}/contributions` (`api.milestones.contributions.store`) → [PlanningController::addContribution](../../../backend/src/Http/Controller/PlanningController.php#L127) |

<!-- END GENERATED TRACE -->
