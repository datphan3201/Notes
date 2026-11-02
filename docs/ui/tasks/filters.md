# /tasks — Time filters, statuses and counts

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Query parameter: `?view=today|next|week|backlog|all|repeating`; unrecognized values fall back to Today. Clicking a view changes browser state within this page.

[Archify: Task classifications](../../diagrams/task-classification/index.html) distinguishes time views, stored statuses and series.

<!-- BEGIN GENERATED TRACE -->

### Today

**Trace ID:** `tasks.filter.today`

Includes a local deadline/start/occurrence date equal to today, a scheduled interval covering today, or unfinished overdue work. History-qualified work is excluded before membership is evaluated.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="today"](../../../frontend/src/views/planning/tasks.php#L25) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'today')](../../../frontend/src/js/planning/task-views.js#L21)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L531) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11)<br>[task-views.test.js · unfinished tasks overdue](../../../frontend/tests/js/task-views.test.js#L50)<br>[task-views.test.js · today includes an interval](../../../frontend/tests/js/task-views.test.js#L75) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### Next

**Trace ID:** `tasks.filter.next`

Includes any future deadline/start/occurrence/scheduled date, including scheduled end. A Task can appear in both Today and Next.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="next"](../../../frontend/src/views/planning/tasks.php#L29) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'next')](../../../frontend/src/js/planning/task-views.js#L27)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L531) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11)<br>[task-views.test.js · today includes an interval](../../../frontend/tests/js/task-views.test.js#L75) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### This week

**Trace ID:** `tasks.filter.week`

Membership is the current Monday-week Task selection set, not a due-date query. Completion does not automatically remove a selection.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="week"](../../../frontend/src/views/planning/tasks.php#L33) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'week')](../../../frontend/src/js/planning/task-views.js#L29)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L531) |
| Controller / service / domain | [DashboardService.php · public function dashboard(](../../../backend/src/Application/Dashboard/DashboardService.php#L71) |
| Persistence | [PdoDashboardRepository.php · public function selections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L72) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### Backlog

**Trace ID:** `tasks.filter.backlog`

No deadline, start, occurrence or schedule date and not selected this week. Inbox is a parent/location concept and is independent of Backlog.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="backlog"](../../../frontend/src/views/planning/tasks.php#L37) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'backlog')](../../../frontend/src/js/planning/task-views.js#L30)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L531) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · backlog preserves inbox](../../../frontend/tests/js/task-views.test.js#L25) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### All

**Trace ID:** `tasks.filter.all`

All fetched Tasks that do not qualify for History, then the independent search/status/tag filters. The default Open tasks status still hides Done Tasks.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="all"](../../../frontend/src/views/planning/tasks.php#L41) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · export function taskMatchesView](../../../frontend/src/js/planning/task-views.js#L14)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L531) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · backlog preserves inbox](../../../frontend/tests/js/task-views.test.js#L25) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### Status and count badges

**Trace ID:** `tasks.filter.status`

Stored Task statuses are NotStarted, InProgress, Blocked and Done. Open tasks excludes Done. Count badges apply the same view membership plus active search/status/tag filters; Repeating counts non-Ended series instead.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-status](../../../frontend/src/views/planning/tasks.php#L57) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [collection-page.js · export function collectionPage](../../../frontend/src/js/planning/collection-page.js#L4)<br>[task-views.js · export function taskViewStatus](../../../frontend/src/js/planning/task-views.js#L36) |
| Controller / service / domain | [TaskStatus.php · enum TaskStatus](../../../backend/src/Domain/Planning/TaskStatus.php#L7) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [collection-page.test.js · task filtering](../../../frontend/tests/js/collection-page.test.js#L10)<br>[task-views.test.js · each view count](../../../frontend/tests/js/task-views.test.js#L59) |

### Completed section and History boundary

**Trace ID:** `tasks.filter.completed`

Under the default Open tasks filter, recently Done Tasks appear in a separate section. History uses configurable elapsed completed-hours and local overdue-days thresholds. This is a projection; pruning is a separate server job.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-completed hidden](../../../frontend/src/views/planning/tasks.php#L78) |
| CSS | [feedback.css · Completed section](../../../frontend/src/css/feedback.css#L437) |
| Browser logic | [task-views.js · export function taskInHistory](../../../frontend/src/js/planning/task-views.js#L66)<br>[task-views.js · export function historyThresholds](../../../frontend/src/js/planning/task-views.js#L59) |
| Controller / service / domain | [TaskHistoryService.php · public function prune(](../../../backend/src/Application/Planning/TaskHistoryService.php#L29) |
| Persistence | [PdoTaskHistoryRepository.php · public function historyTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L32)<br>[PdoTaskHistoryRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L47) |
| Relevant tests (not a pass claim) | [task-views.test.js · each view count](../../../frontend/tests/js/task-views.test.js#L59)<br>[task-views.test.js · history uses elapsed](../../../frontend/tests/js/task-views.test.js#L115) |
| HTTP | `GET /settings/history` (`settings.history`) → [AccountController::settingsPage](../../../backend/src/Http/Controller/AccountController.php#L170) |

<!-- END GENERATED TRACE -->


