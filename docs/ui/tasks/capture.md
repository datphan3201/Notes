# /tasks — New task and schedule capture

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: **New task** dialog (`new-task-dialog`). Goal and Milestone capture reuse the same capture modules; Teamwork has its own payload/permission path.

Required Task name, optional location, description, criteria, importance, dates, estimate, reminder and repeat controls are not independent entities. Dashboard Today also offers a minimal named Task capture that atomically selects the day and week; the full capture dialog retains its fields and now offers a separate Today/Week planning choice. Name comes first; optional descriptions/criteria and advanced fields are collapsed, with Create/Cancel available while scrolling.

<!-- BEGIN GENERATED TRACE -->

### Inbox, Goal or Milestone parent

**Trace ID:** `tasks.capture.parent`

A Task has at most one Goal or Milestone parent; no parent is Inbox. Completed finite Goal ancestors reject new finite work. The server validates owned destinations even if the select was edited in the browser.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-parent&gt;](../../../frontend/src/views/planning/tasks.php#L124) |
| Browser logic | [planning-page.js · parent.addEventListener](../../../frontend/src/js/planning/planning-page.js#L1013) |
| Controller / service / domain | [PlanningService.php · private function validateParents(](../../../backend/src/Application/Planning/PlanningService.php#L1020) |
| Persistence | [PdoPlanningRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L63)<br>[PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_completed_goal_rejects_new_or_moved_work_but_allows_strategy_edits(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L389) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34) |

### Task fields and estimates

**Trace ID:** `tasks.capture.fields`

The shared PHP partial renders schedule-related fields. Browser input is normalized by taskCaptureValues; server create/update validators enforce field bounds, unknown-key rejection and date ordering. Estimates represent planned minutes, not tracked time.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task-capture-fields.php · estimated_minutes](../../../frontend/src/views/planning/task-capture-fields.php#L34)<br>[importance-options.php · &lt;?php foreach (&#91;1 =&gt;](../../../frontend/src/views/planning/importance-options.php#L1) |
| Browser logic | [task-capture.js · export function taskCaptureValues](../../../frontend/src/js/planning/task-capture.js#L7) |
| Controller / service / domain | [PlanningService.php · private function validateCreate(](../../../backend/src/Application/Planning/PlanningService.php#L915)<br>[PlanningService.php · private function validateDates(](../../../backend/src/Application/Planning/PlanningService.php#L1368) |
| Persistence | [PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_estimates_are_optional_versioned_and_do_not_change_completion_facts(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L431) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54) |

### Due date, reminder and repeat picker

**Trace ID:** `tasks.capture.schedule`

The schedule toolbar supplies presets and a draggable date picker. Reminders offer Later today, Tomorrow and Next week, moments tied to the task (when it starts, 15 minutes or 1 hour before its scheduled start, 9:00 on or the day before its due date; only future ones), and any date with any minute of the day in the device clock format. One-off capture POSTs a Task; repeat capture POSTs a TaskSeries. seriesPayload is the exact mapping boundary: do not assume every one-off field is copied into a series.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task-capture-fields.php · data-schedule-toolbar](../../../frontend/src/views/planning/task-capture-fields.php#L6) |
| Browser logic | [schedule-picker.js · export function initScheduleToolbar](../../../frontend/src/js/planning/schedule-picker.js#L354)<br>[task-capture.js · export async function createCapturedTask](../../../frontend/src/js/planning/task-capture.js#L80)<br>[task-capture.js · export function seriesPayload](../../../frontend/src/js/planning/task-capture.js#L48)<br>[calendar.js · export function relativeReminders(](../../../frontend/src/js/lib/calendar.js#L55) |
| Controller / service / domain | [TaskSeriesService.php · public function createAndMaterialize(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L71) |
| Persistence | [PdoTaskSeriesRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L49) |
| Relevant tests (not a pass claim) | [calendar.test.js · repeat choices](../../../frontend/tests/js/calendar.test.js#L63)<br>[calendar.test.js · reminder presets](../../../frontend/tests/js/calendar.test.js#L36)<br>[calendar.test.js · test('reminders can be tied to the task start and due date, only in the future'](../../../frontend/tests/js/calendar.test.js#L44) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`POST /api/v1/task-series` (`api.task-series.store`) → [TaskSeriesController::store](../../../backend/src/Http/Controller/TaskSeriesController.php#L22) |

### Name-first capture, Today/Week plan and result

**Trace ID:** `tasks.capture.plan`

Name comes first, then parent and Plan for. Today/Week views default Plan for to that view only for a clean draft; other views default Decide later. Optional description/criteria and advanced fields use native disclosure. The sticky Create/Cancel footer stays available while scrolling. A one-off Task is created before a separate daily/weekly selection; selection does not change its dates/status. If selection fails, creation is acknowledged once, the dialog closes, and an explicit partial-result message plus Open task link allows recovery without duplicate creation. Repeat disables Plan for; occurrences are selected individually. Successful series creation opens Repeating.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-plan&gt;](../../../frontend/src/views/planning/tasks.php#L131) |
| CSS | [tasks.css · &#91;data-tasks-page&#93; .task-capture-footer {](../../../frontend/src/css/tasks.css#L94) |
| Browser logic | [planning-page.js · const plan = form.elements.plan;](../../../frontend/src/js/planning/planning-page.js#L503)<br>[task-capture.js · export async function createCapturedTask](../../../frontend/src/js/planning/task-capture.js#L80) |
| Controller / service / domain | [PlanningService.php · public function create(](../../../backend/src/Application/Planning/PlanningService.php#L103)<br>[DashboardService.php · public function addDailySelection(](../../../backend/src/Application/Dashboard/DashboardService.php#L285) |
| Persistence | [PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77)<br>[PdoDashboardRepository.php · public function addDailySelection(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L172) |
| Coverage limit | Browser smoke on an isolated local account checked Today/Week capture and simulated a failed selection after a real create. No new backend transaction or cross-request atomicity is claimed. |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34)<br>`POST /api/v1/daily-selections/task` (`api.daily-selections.store`) → [DashboardController::addDailySelection](../../../backend/src/Http/Controller/DashboardController.php#L48)<br>`POST /api/v1/weekly-selections/{type}` (`api.weekly-selections.store`) → [DashboardController::addSelection](../../../backend/src/Http/Controller/DashboardController.php#L31) |

<!-- END GENERATED TRACE -->
