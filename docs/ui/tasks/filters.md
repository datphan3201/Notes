# /tasks — Time filters, statuses and counts

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Query parameter: `?view=today|next|week|overdue|backlog|all|repeating`; unrecognized values fall back to Today. Clicking a view changes browser state within this page.

[Archify: Task classifications](../../diagrams/task-planning/index.html) distinguishes time views, stored statuses and series.

<!-- BEGIN GENERATED TRACE -->

### Today

**Trace ID:** `tasks.filter.today`

Includes explicit account-local daily selections, matching deadline/start/occurrence dates, overlapping work intervals and unfinished overdue work not yet in History. Explicit daily selection can reveal historical work deliberately. Add for today from a Task row also selects the current week and changes no Task dates/status. Task-row add/remove actions use +/check icons with native hover labels and accessible names.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="today"](../../../frontend/src/views/planning/tasks.php#L24) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'today')](../../../frontend/src/js/planning/task-views.js#L24)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L765)<br>[planning-page.js · const planToday = document.createElement(](../../../frontend/src/js/planning/planning-page.js#L700) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51)<br>[PdoDashboardRepository.php · public function dailySelections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L159) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11)<br>[task-views.test.js · unfinished tasks overdue](../../../frontend/tests/js/task-views.test.js#L50)<br>[task-views.test.js · today includes an interval](../../../frontend/tests/js/task-views.test.js#L75)<br>[dashboard-tasks.test.js · test('daily and weekly selections can explicitly reveal historical work while Overdue remains accessible'](../../../frontend/tests/js/dashboard-tasks.test.js#L69) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### Next

**Trace ID:** `tasks.filter.next`

Includes any future deadline/start/occurrence/scheduled date, including scheduled end. A Task can appear in both Today and Next.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="next"](../../../frontend/src/views/planning/tasks.php#L28) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'next')](../../../frontend/src/js/planning/task-views.js#L30)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L765) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11)<br>[task-views.test.js · today includes an interval](../../../frontend/tests/js/task-views.test.js#L75) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### This week

**Trace ID:** `tasks.filter.week`

Membership is the explicit current Monday-week selection set, including historical or completed selected work. Completion does not remove a selection. Selecting a Task for Today adds weekly membership atomically; automatic date-based Today membership alone does not select the week.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="week"](../../../frontend/src/views/planning/tasks.php#L32) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'week')](../../../frontend/src/js/planning/task-views.js#L18)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L765) |
| Controller / service / domain | [DashboardService.php · public function dashboard(](../../../backend/src/Application/Dashboard/DashboardService.php#L74) |
| Persistence | [PdoDashboardRepository.php · public function selections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L117) |
| Relevant tests (not a pass claim) | [task-views.test.js · scheduled tasks cross UTC](../../../frontend/tests/js/task-views.test.js#L11) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### Overdue

**Trace ID:** `tasks.filter.overdue`

Shows fetched active unfinished Tasks with a deadline before the account-local today, including historical overdue work hidden from automatic Today/reminders. Reopen requires a new non-past due date or explicit removal of the old date; dates/status update atomically and the Task leaves Overdue. Complete/archive also removes overdue membership.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="overdue"](../../../frontend/src/views/planning/tasks.php#L40) |
| Browser logic | [task-views.js · if (view === 'overdue')](../../../frontend/src/js/planning/task-views.js#L17)<br>[planning-page.js · if (taskView === 'overdue' &amp;&amp; !done)](../../../frontend/src/js/planning/planning-page.js#L749)<br>[reopen-task-dialog.js · export function chooseReopenDeadline(](../../../frontend/src/js/planning/reopen-task-dialog.js#L4) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L373) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_reopening_overdue_work_requires_a_new_or_removed_deadline_atomically(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L354)<br>[PlanningHttpTest.php · public function test_today_capture_creates_and_selects_atomically_and_overdue_reopen_requires_date_decision(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L189)<br>[dashboard-tasks.test.js · test('cancelling the overdue date decision never submits a mutation retry'](../../../frontend/tests/js/dashboard-tasks.test.js#L119) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92) |

### Backlog

**Trace ID:** `tasks.filter.backlog`

No deadline, start, occurrence or schedule date and not selected this week. Inbox is a parent/location concept and is independent of Backlog.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="backlog"](../../../frontend/src/views/planning/tasks.php#L36) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · if (view === 'backlog')](../../../frontend/src/js/planning/task-views.js#L32)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L765) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · backlog preserves inbox](../../../frontend/tests/js/task-views.test.js#L25) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### All

**Trace ID:** `tasks.filter.all`

Default catalogue view when no valid view query is supplied. All fetched Tasks outside History, followed by independent search/status/tag filters and sorting. Open tasks hides Done rows in the main list; its separate Completed group uses the same view membership.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="all"](../../../frontend/src/views/planning/tasks.php#L44) |
| CSS | [illustrated.css · Time-view controls](../../../frontend/src/css/illustrated.css#L322) |
| Browser logic | [task-views.js · export function taskMatchesView](../../../frontend/src/js/planning/task-views.js#L14)<br>[planning-page.js · const render = () =&gt;](../../../frontend/src/js/planning/planning-page.js#L765) |
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
| Browser logic | [collection-page.js · export function collectionPage](../../../frontend/src/js/planning/collection-page.js#L4)<br>[task-views.js · export function taskViewStatus](../../../frontend/src/js/planning/task-views.js#L38) |
| Controller / service / domain | [TaskStatus.php · enum TaskStatus](../../../backend/src/Domain/Planning/TaskStatus.php#L7) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [collection-page.test.js · task filtering](../../../frontend/tests/js/collection-page.test.js#L10)<br>[task-views.test.js · each view count](../../../frontend/tests/js/task-views.test.js#L59) |

### Completed section and History boundary

**Trace ID:** `tasks.filter.completed`

Under Open tasks, recently Done Tasks appear in a separate, independently paged section only when they match the selected Today/Next/Week/Backlog/All view. Search/tag/sort apply too. Overdue has no Done membership. History uses configurable elapsed completed-hours and local overdue-days thresholds; pruning remains a separate server job.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-completed hidden](../../../frontend/src/views/planning/tasks.php#L104) |
| CSS | [feedback.css · Completed section](../../../frontend/src/css/feedback.css#L556) |
| Browser logic | [tasks-collection.js · export function completedInView](../../../frontend/src/js/planning/tasks-collection.js#L28)<br>[task-views.js · export function taskInHistory](../../../frontend/src/js/planning/task-views.js#L68)<br>[task-views.js · export function historyThresholds](../../../frontend/src/js/planning/task-views.js#L61) |
| Controller / service / domain | [TaskHistoryService.php · public function prune(](../../../backend/src/Application/Planning/TaskHistoryService.php#L30) |
| Persistence | [PdoTaskHistoryRepository.php · public function historyTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L32)<br>[PdoTaskHistoryRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L47) |
| Relevant tests (not a pass claim) | [task-views.test.js · each view count](../../../frontend/tests/js/task-views.test.js#L59)<br>[task-views.test.js · history uses elapsed](../../../frontend/tests/js/task-views.test.js#L115)<br>[tasks-collection.test.js · test('Completed follows Today/Week/Next/All membership instead of leaking global completions'](../../../frontend/tests/js/tasks-collection.test.js#L12) |
| HTTP | `GET /settings/history` (`settings.history`) → [AccountController::settingsPage](../../../backend/src/Http/Controller/AccountController.php#L172) |

<!-- END GENERATED TRACE -->
