# /tasks — Tasks

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Browser route: `GET /tasks` (`planning.tasks`). The shell is rendered by `AccountController::planningPage`; `app.js` starts `initTasksPage` on `[data-tasks-page]`.

| What you see | Read next |
| --- | --- |
| Today, Next, This week, Backlog, All; counts; Completed | [Time filters and status](filters.md) |
| New task; parent; due/reminder/repeat picker | [Capture](capture.md) |
| Repeating; Pause, Resume, End | [Recurring work](repeating.md) |
| Task name; Edit; checklist; working note | [Task detail](detail.md) |
| Task history | [History settings](../settings/history.md) |

`/task/` is not an application route. A view is not a stored Task type. Multiple time filters may include the same Task; the status filter is applied separately.

<!-- BEGIN GENERATED TRACE -->

### Collection, refresh, search and pagination

**Trace ID:** `tasks.collection`

The browser fetches Tasks, Dashboard selections, Goals, Milestones and series; a latest-request guard prevents old responses replacing newer reads. Page size is 8, or 4 below 600px. Tags currently have a hidden filter control.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-tasks-page](../../../frontend/src/views/planning/tasks.php#L1) |
| CSS | [feedback.css · Task row action icons](../../../frontend/src/css/feedback.css#L417) |
| Browser logic | [planning-page.js · export function initTasksPage](../../../frontend/src/js/planning/planning-page.js#L345)<br>[collection-page.js · export function collectionPage](../../../frontend/src/js/planning/collection-page.js#L4) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [collection-page.test.js · task filtering](../../../frontend/tests/js/collection-page.test.js#L10)<br>[collection-page.test.js · page shrinks](../../../frontend/tests/js/collection-page.test.js#L21) |
| HTTP | `GET /tasks` (`planning.tasks`) → [AccountController::planningPage](../../../backend/src/Http/Controller/AccountController.php#L184)<br>`GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23) |

### Task row: tick, dates, week, Edit, Remove, Important

**Trace ID:** `tasks.row`

Rows are built in JavaScript. Complete/Reopen uses shared acknowledgement handling; the week button changes selection, Important changes importance, and Remove archives. Inspect the row builder before changing icons or interaction order.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-list](../../../frontend/src/views/planning/tasks.php#L74) |
| CSS | [feedback.css · Task row action icons](../../../frontend/src/css/feedback.css#L417) |
| Browser logic | [planning-page.js · const taskRow = (task) =&gt;](../../../frontend/src/js/planning/planning-page.js#L397)<br>[transitions.js · export async function transitionEntity](../../../frontend/src/js/planning/transitions.js#L6) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94)<br>[PdoPlanningRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L116) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_checklist_state_is_independent_and_task_completion_requires_acknowledgement(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L135) |
| HTTP | `POST /api/v1/tasks/{id}/complete` (`api.tasks.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`DELETE /api/v1/tasks/{id}` (`api.tasks.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65) |

<!-- END GENERATED TRACE -->

## Editing safely

Change labels/DOM in the PHP view; keep the `data-task-*` hooks synchronized with the client. Change time membership in `task-views.js`, collection search/status/paging in `collection-page.js`, and persistence/invariants in `PlanningService`. Test the changed layer and shared consumers such as Dashboard and History. See [the trace maintenance workflow](../../maintenance.md).
