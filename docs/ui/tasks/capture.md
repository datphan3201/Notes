# /tasks — New task and schedule capture

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: **New task** dialog (`new-task-dialog`). Goal and Milestone capture reuse the same capture modules; Teamwork has its own payload/permission path.

Required Task name, optional location, description, criteria, importance, dates, estimate, reminder and repeat controls are not independent entities.

<!-- BEGIN GENERATED TRACE -->

### Inbox, Goal or Milestone parent

**Trace ID:** `tasks.capture.parent`

A Task has at most one Goal or Milestone parent; no parent is Inbox. Completed finite Goal ancestors reject new finite work. The server validates owned destinations even if the select was edited in the browser.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-parent&gt;](../../../frontend/src/views/planning/tasks.php#L93) |
| Browser logic | [planning-page.js · parent.addEventListener](../../../frontend/src/js/planning/planning-page.js#L675) |
| Controller / service / domain | [PlanningService.php · private function validateParents(](../../../backend/src/Application/Planning/PlanningService.php#L951) |
| Persistence | [PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63)<br>[PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_completed_goal_rejects_new_or_moved_work_but_allows_strategy_edits(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L354) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34) |

### Task fields and estimates

**Trace ID:** `tasks.capture.fields`

The shared PHP partial renders schedule-related fields. Browser input is normalized by taskCaptureValues; server create/update validators enforce field bounds, unknown-key rejection and date ordering. Estimates represent planned minutes, not tracked time.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task-capture-fields.php · estimated_minutes](../../../frontend/src/views/planning/task-capture-fields.php#L34)<br>[importance-options.php · &lt;?php foreach (&#91;1 =&gt;](../../../frontend/src/views/planning/importance-options.php#L1) |
| Browser logic | [task-capture.js · export function taskCaptureValues](../../../frontend/src/js/planning/task-capture.js#L7) |
| Controller / service / domain | [PlanningService.php · private function validateCreate(](../../../backend/src/Application/Planning/PlanningService.php#L856)<br>[PlanningService.php · private function validateDates(](../../../backend/src/Application/Planning/PlanningService.php#L1299) |
| Persistence | [PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_estimates_are_optional_versioned_and_do_not_change_completion_facts(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L396) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54) |

### Due date, reminder and repeat picker

**Trace ID:** `tasks.capture.schedule`

The schedule toolbar supplies presets and a draggable date picker. One-off capture POSTs a Task; repeat capture POSTs a TaskSeries. seriesPayload is the exact mapping boundary: do not assume every one-off field is copied into a series.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task-capture-fields.php · data-schedule-toolbar](../../../frontend/src/views/planning/task-capture-fields.php#L6) |
| Browser logic | [schedule-picker.js · export function initScheduleToolbar](../../../frontend/src/js/planning/schedule-picker.js#L359)<br>[task-capture.js · export async function createCapturedTask](../../../frontend/src/js/planning/task-capture.js#L80)<br>[task-capture.js · export function seriesPayload](../../../frontend/src/js/planning/task-capture.js#L48) |
| Controller / service / domain | [TaskSeriesService.php · public function createAndMaterialize(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L71) |
| Persistence | [PdoTaskSeriesRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L49) |
| Relevant tests (not a pass claim) | [calendar.test.js · repeat choices](../../../frontend/tests/js/calendar.test.js#L46)<br>[calendar.test.js · reminder presets](../../../frontend/tests/js/calendar.test.js#L36) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`POST /api/v1/task-series` (`api.task-series.store`) → [TaskSeriesController::store](../../../backend/src/Http/Controller/TaskSeriesController.php#L22) |

<!-- END GENERATED TRACE -->


