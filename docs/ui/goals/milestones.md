# /goals/{id} — Milestone panel

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: select a fishbone branch. Milestone details, prerequisites, finite/recurring Tasks and capture remain inside the Goal page. Task links navigate to `/tasks/{id}`.

<!-- BEGIN GENERATED TRACE -->

### Prerequisites and completion lock

**Trace ID:** `milestone.dependencies`

Prerequisite edges form a separate acyclic graph and may cross owned Goals. All active prerequisites must be Completed to complete this Milestone. Reopening a prerequisite with a completed dependent is rejected; reopen dependents first.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-prerequisites](../../../frontend/src/views/planning/goal.php#L49) |
| Browser logic | [goal-roadmap.js · data-milestone-prerequisites](../../../frontend/src/js/planning/goal-roadmap.js#L572) |
| Controller / service / domain | [PlanningService.php · public function addDependency(](../../../backend/src/Application/Planning/PlanningService.php#L512)<br>[PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function prerequisites(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L266)<br>[PdoPlanningRepository.php · public function dependencyEdges(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L191)<br>[PdoPlanningRepository.php · public function completedDependents(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L281) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_milestone_dependency_blocks_milestone_but_not_its_task(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L107)<br>[PlanningCoreTest.php · public function test_failed_milestone_reopen_does_not_partially_reopen_completed_goals(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L319) |
| HTTP | `GET /api/v1/milestones/{id}/prerequisites` (`api.milestones.prerequisites.index`) → [PlanningController::prerequisites](../../../backend/src/Http/Controller/PlanningController.php#L214)<br>`POST /api/v1/milestones/{id}/prerequisites` (`api.milestones.prerequisites.store`) → [PlanningController::addDependency](../../../backend/src/Http/Controller/PlanningController.php#L104)<br>`DELETE /api/v1/milestones/{id}/prerequisites/{target}` (`api.milestones.prerequisites.destroy`) → [PlanningController::removeDependency](../../../backend/src/Http/Controller/PlanningController.php#L114) |

### Finite/recurring Tasks, weekly selection and Complete

**Trace ID:** `milestone.tasks`

Tasks under a locked Milestone are usable and completable. Completing a Milestone with unfinished Tasks requires acknowledge_open_tasks=true. Recurring occurrences do not enter finite completion denominators.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-tasks](../../../frontend/src/views/planning/goal.php#L58) |
| Browser logic | [goal-roadmap.js · data-milestone-tasks](../../../frontend/src/js/planning/goal-roadmap.js#L515)<br>[task-capture.js · export async function createCapturedTask](../../../frontend/src/js/planning/task-capture.js#L80) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function milestoneTaskProgress(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L214)<br>[PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_milestone_dependency_blocks_milestone_but_not_its_task(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L107) |
| HTTP | `POST /api/v1/milestones/{id}/complete` (`api.milestones.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/milestones/{id}/reopen` (`api.milestones.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34) |

### Edit, contributions and archive

**Trace ID:** `milestone.edit`

Milestone edits and contribution changes use aggregate versions. Archiving with include_contents is an explicit bulk action. Contributions never act as prerequisites or progress weights.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [goal.php · data-milestone-edit data-open-dialog](../../../frontend/src/views/planning/goal.php#L39) |
| Browser logic | [goal-roadmap.js · find('&#91;data-milestone-edit&#93;').addEventListener](../../../frontend/src/js/planning/goal-roadmap.js#L719) |
| Controller / service / domain | [PlanningService.php · private function archiveMilestoneContents(](../../../backend/src/Application/Planning/PlanningService.php#L302)<br>[PlanningService.php · public function addContribution(](../../../backend/src/Application/Planning/PlanningService.php#L525) |
| Persistence | [PdoPlanningRepository.php · public function archiveWhere(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L130)<br>[PdoPlanningRepository.php · public function addEdge(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L247) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_contributions_are_multi_target_and_separate_from_primary_hierarchy(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L84) |
| HTTP | `PATCH /api/v1/milestones/{id}` (`api.milestones.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`DELETE /api/v1/milestones/{id}` (`api.milestones.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65)<br>`POST /api/v1/milestones/{id}/contributions` (`api.milestones.contributions.store`) → [PlanningController::addContribution](../../../backend/src/Http/Controller/PlanningController.php#L127) |

<!-- END GENERATED TRACE -->


