# /tasks — Tasks

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Browser route: `GET /tasks` (`planning.tasks`). The shell is rendered by `AccountController::planningPage`; `app.js` starts `initTasksPage` on `[data-tasks-page]`.

[Approved design decisions and verification](design-review.md). Tasks is the full catalogue; Dashboard remains the daily/weekly execution overview. The current format, theme and controls are retained. Today controls show “Added for today” on hover once included; manual selections retain their remove action.

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

Tasks defaults to All unless a valid view query is supplied. Visible search, Status and Sort are independent; sorting is stable by importance or account-local scheduled time (undated last). Reads use a latest-request guard. Active and Completed lists page independently at 8 rows, or 4 below 600px. Tags appear under More filters when available. Creating retains the current view/search/status/page and offers an Open task result link.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-tasks-page](../../../frontend/src/views/planning/tasks.php#L1)<br>[tasks.php · data-task-sort](../../../frontend/src/views/planning/tasks.php#L70)<br>[tasks.php · data-task-create-status](../../../frontend/src/views/planning/tasks.php#L94) |
| CSS | [tasks.css · &#91;data-tasks-page&#93; .collection-controls {](../../../frontend/src/css/tasks.css#L38) |
| Browser logic | [planning-page.js · export function initTasksPage](../../../frontend/src/js/planning/planning-page.js#L368)<br>[collection-page.js · export function collectionPage](../../../frontend/src/js/planning/collection-page.js#L4)<br>[tasks-collection.js · export function sortTasks](../../../frontend/src/js/planning/tasks-collection.js#L5) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [collection-page.test.js · task filtering](../../../frontend/tests/js/collection-page.test.js#L10)<br>[collection-page.test.js · page shrinks](../../../frontend/tests/js/collection-page.test.js#L21)<br>[tasks-collection.test.js · test('sorting uses account-local scheduled time, keeps undated work last and is independent of filtering'](../../../frontend/tests/js/tasks-collection.test.js#L25) |
| HTTP | `GET /tasks` (`planning.tasks`) → [AccountController::planningPage](../../../backend/src/Http/Controller/AccountController.php#L185)<br>`GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23) |

### Task row: completion, Today, week, Edit, Important and More options

**Trace ID:** `tasks.row`

Aligned checkbox/content/actions keep the task name primary and parent chips sized to content. Facts distinguish status, due date/Due today, manual Today selection and scheduled interval/start/occurrence in the account timezone. Week/Today, Edit and Important stay inline; native More options reveals due/reminder/repeat and Archive. Archive retains data. Today uses + or a check with native hover labels and accessible names; automatic membership cannot be removed through a manual-selection action. Important retains its existing 3/5 toggle.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-list](../../../frontend/src/views/planning/tasks.php#L95) |
| CSS | [tasks.css · Aligned task row grid](../../../frontend/src/css/tasks.css#L4) |
| Browser logic | [planning-page.js · const taskRow = (task) =&gt;](../../../frontend/src/js/planning/planning-page.js#L442)<br>[transitions.js · export async function transitionEntity](../../../frontend/src/js/planning/transitions.js#L7) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94)<br>[PdoPlanningRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L116) |
| Relevant tests (not a pass claim) | [PlanningCoreTest.php · public function test_checklist_state_is_independent_and_task_completion_requires_acknowledgement(](../../../backend/tests/Plain/Integration/PlanningCoreTest.php#L135) |
| HTTP | `POST /api/v1/tasks/{id}/complete` (`api.tasks.complete`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92)<br>`PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`DELETE /api/v1/tasks/{id}` (`api.tasks.archive`) → [PlanningController::archive](../../../backend/src/Http/Controller/PlanningController.php#L65) |

<!-- END GENERATED TRACE -->

## Editing safely

Change labels/DOM in the PHP view; keep the `data-task-*` hooks synchronized with the client. Change time membership in `task-views.js`, collection search/status/paging in `collection-page.js`, and persistence/invariants in `PlanningService`. Test the changed layer and shared consumers such as Dashboard and History. See [the trace maintenance workflow](../../maintenance.md).
