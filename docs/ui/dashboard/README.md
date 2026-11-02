# /dashboard — Today, This week and Activity

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

These are workspace sections on one URL. Their facts come from server projections; browser cards/heat levels do not create a productivity score.

Today and This week are adjacent cards with one progress summary above each interactive checklist, using existing Task completion controls and the illustrated panel style. The separate weekly statistics card and Current focus are retired. Activity now has a compact 30-day calendar; its full-year tab remains available. The separate This week workspace retains weekly Tasks, Milestones and Habits. The chosen roadmap is saved per account and appears directly below the header; an unset choice invites selection. Account-local daily selections are independent of deadlines and work intervals; automatic membership alone does not select the week.

[Archify: Dashboard composition](../../diagrams/dashboard-overview/index.html) · [Archify: daily/weekly planning contract](../../diagrams/daily-weekly-planning/index.html) · [Audit entry](../../audit-history.md)

<!-- BEGIN GENERATED TRACE -->

### Today checklist and current focus

**Trace ID:** `dashboard.today`

Today combines account-local daily selections, matching due/start/occurrence dates, overlapping work intervals and recent unfinished overdue work. Explicit daily selections remain visible even when a Task otherwise qualifies for History. Both Task panels use the existing versioned Complete/Reopen flow. On progress means InProgress; Scheduled means a planned start, occurrence or work interval today; a deadline alone is Due today. Completed rows retain their check state until the applicable membership/History boundary. Focus prefers eligible weekly/Today/overdue work and excludes Blocked.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-current-focus](../../../frontend/src/views/planning/dashboard.php#L42)<br>[dashboard.php · data-today-tasks](../../../frontend/src/views/planning/dashboard.php#L71) |
| CSS | [feedback.css · .dashboard-checklist-row .task-completion-button {](../../../frontend/src/css/feedback.css#L989) |
| Browser logic | [dashboard-page.js · export function initDashboardPage](../../../frontend/src/js/planning/dashboard-page.js#L225)<br>[dashboard-tasks.js · export function renderTaskChecklist(](../../../frontend/src/js/planning/dashboard-tasks.js#L55)<br>[dashboard-tasks.js · export function taskScheduledOn(](../../../frontend/src/js/planning/dashboard-tasks.js#L6)<br>[transitions.js · export async function transitionEntity(](../../../frontend/src/js/planning/transitions.js#L7) |
| Controller / service / domain | [DashboardService.php · public function dashboard(](../../../backend/src/Application/Dashboard/DashboardService.php#L73) |
| Persistence | [PdoDashboardRepository.php · public function todayTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L48)<br>[PdoDashboardRepository.php · public function overdueTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L75) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_today_projection_includes_planned_starts_and_overlapping_schedules(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L222)<br>[DashboardReviewsTest.php · public function test_today_checklist_keeps_completed_selections_and_silences_historical_overdue_reminders(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L289)<br>[DashboardReviewsTest.php · public function test_completed_history_cutoff_uses_elapsed_hours_across_daylight_saving_change(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L349)<br>[dashboard-tasks.test.js · test('Scheduled means planned start, occurrence or overlapping work interval, not deadline or reminder'](../../../frontend/tests/js/dashboard-tasks.test.js#L39) |
| HTTP | `GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### This week and weekly summary

**Trace ID:** `dashboard.week`

The Today workspace places This week beside the Today checklist; the existing This week workspace retains its Task/Milestone/Habit views. Task rows support completion and Add for today without moving/removing weekly membership or changing Task dates/status. Two independent native selects sort by Importance (descending) or Scheduled time (earliest first, unscheduled last), and filter All/Not started/On progress/Blocked/Completed. Sorting/filtering does not rewrite stored order, membership or weekly percentage denominators. Previews still show four rows with a link to the complete Tasks view. The row action is a compact + icon with Add for today as its native hover tooltip and accessible name; already-present Tasks show a check mark. It stays inline on mobile.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-weekly-tasks](../../../frontend/src/views/planning/dashboard.php#L118)<br>[dashboard.php · data-dashboard-week-sort](../../../frontend/src/views/planning/dashboard.php#L83)<br>[dashboard.php · data-dashboard-week-status](../../../frontend/src/views/planning/dashboard.php#L90)<br>[dashboard.php · data-weekly-preview-tasks](../../../frontend/src/views/planning/dashboard.php#L99) |
| CSS | [feedback.css · .dashboard-week-filters {](../../../frontend/src/css/feedback.css#L976) |
| Browser logic | [dashboard-page.js · data-weekly-tasks](../../../frontend/src/js/planning/dashboard-page.js#L314)<br>[dashboard-tasks.js · export function weeklyTaskList(](../../../frontend/src/js/planning/dashboard-tasks.js#L35)<br>[dashboard-tasks.js · export function renderTaskChecklist(](../../../frontend/src/js/planning/dashboard-tasks.js#L55) |
| Controller / service / domain | [DashboardService.php · public function addSelection(](../../../backend/src/Application/Dashboard/DashboardService.php#L182) |
| Persistence | [PdoDashboardRepository.php · public function selections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L97)<br>[PdoDashboardRepository.php · public function addSelection(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L114)<br>[PdoDashboardRepository.php · public function reorderSelections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L129) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_weekly_selection_reorder_requires_exact_active_set(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L59)<br>[DashboardReviewsTest.php · public function test_week_and_review_completion_use_real_denominators_and_saved_snapshots(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L198)<br>[dashboard-tasks.test.js · test('weekly sort and status filter work independently without changing stored order'](../../../frontend/tests/js/dashboard-tasks.test.js#L14) |
| HTTP | `GET /api/v1/weekly-selections/{type}` (`api.weekly-selections.index`) → [DashboardController::selections](../../../backend/src/Http/Controller/DashboardController.php#L27)<br>`POST /api/v1/weekly-selections/{type}` (`api.weekly-selections.store`) → [DashboardController::addSelection](../../../backend/src/Http/Controller/DashboardController.php#L31)<br>`DELETE /api/v1/weekly-selections/{type}/{id}` (`api.weekly-selections.destroy`) → [DashboardController::removeSelection](../../../backend/src/Http/Controller/DashboardController.php#L35)<br>`POST /api/v1/weekly-selections/{type}/reorder` (`api.weekly-selections.reorder`) → [DashboardController::reorder](../../../backend/src/Http/Controller/DashboardController.php#L40) |

### Year Activity heatmap and factual tooltip

**Trace ID:** `dashboard.activity`

The current browser renders a year grid with a year picker. Activity API facts count unreversed task/checklist/habit/milestone completions. Levels 0, 1, 2–3, 4–6, 7+ are presentation; note edits do not count.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-activity-grid](../../../frontend/src/views/planning/dashboard.php#L173) |
| Browser logic | [dashboard-page.js · export function yearCalendar](../../../frontend/src/js/planning/dashboard-page.js#L82)<br>[dashboard-page.js · export function activityLevel](../../../frontend/src/js/planning/dashboard-page.js#L68) |
| Controller / service / domain | [DashboardService.php · public function yearActivity(](../../../backend/src/Application/Dashboard/DashboardService.php#L40) |
| Persistence | [PdoDashboardRepository.php · public function activity(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L16) |
| Relevant tests (not a pass claim) | [planning.test.js · activity levels](../../../frontend/tests/js/planning.test.js#L21)<br>[planning.test.js · yearly activity calendar](../../../frontend/tests/js/planning.test.js#L25)<br>[planning.test.js · year spinner](../../../frontend/tests/js/planning.test.js#L51)<br>[DashboardReviewsTest.php · public function test_activity_grid_uses_unreversed_completion_facts(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L48) |
| HTTP | `GET /api/v1/dashboard/activity` (`api.dashboard.activity`) → [DashboardController::activity](../../../backend/src/Http/Controller/DashboardController.php#L23) |

### Habit streak and quick check-in

**Trace ID:** `dashboard.habits`

Habit streaks and daily state derive from check-ins/rest days. Habit-local dates may differ from the account timezone; do not sum weekly targets into a daily denominator.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-dashboard-habits](../../../frontend/src/views/planning/dashboard.php#L141) |
| Browser logic | [dashboard-page.js · data-dashboard-habits](../../../frontend/src/js/planning/dashboard-page.js#L627)<br>[insights-ui.js · export function renderStreak](../../../frontend/src/js/planning/insights-ui.js#L59) |
| Controller / service / domain | [HabitProgress.php · public function describe(](../../../backend/src/Application/Habits/HabitProgress.php#L47) |
| Persistence | [PdoHabitRepository.php · public function history(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L101)<br>[PdoHabitRepository.php · public function days(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L146) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_dashboard_shows_every_habit_with_period_specific_counts_and_streaks(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L100)<br>[DashboardReviewsTest.php · public function test_dashboard_streak_deduplicates_habits_respects_owner_and_recalculates_after_u...](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L173) |
| HTTP | `PUT /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.store`) → [HabitController::checkIn](../../../backend/src/Http/Controller/HabitController.php#L42)<br>`DELETE /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.destroy`) → [HabitController::undoCheckIn](../../../backend/src/Http/Controller/HabitController.php#L46) |

### Add task / Add for today

**Trace ID:** `dashboard.today.capture`

Choose an owned existing Task or create a named Inbox Task in the existing workspace-dialog style. POST accepts exactly an id or a name; new Task creation, daily selection and current Monday-week selection commit atomically. Existing-id desired-state replay is idempotent and never changes Task dates/status/version/Activity. The account timezone defines the implicit current date; caller-supplied dates are rejected. Removing a daily selection keeps the Task and weekly selection, and automatic date/schedule membership can still keep it in Today. There is no automatic next-day/week carry-forward.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-dashboard-add-today](../../../frontend/src/views/planning/dashboard.php#L66)<br>[dashboard.php · id="dashboard-today-dialog"](../../../frontend/src/views/planning/dashboard.php#L196) |
| Browser logic | [dashboard-page.js · const runTaskAction = async (action) =&gt;](../../../frontend/src/js/planning/dashboard-page.js#L334)<br>[dashboard-page.js · addToday.addEventListener('click', async () =&gt;](../../../frontend/src/js/planning/dashboard-page.js#L375) |
| Controller / service / domain | [DashboardService.php · public function addDailySelection(](../../../backend/src/Application/Dashboard/DashboardService.php#L236)<br>[DashboardService.php · public function removeDailySelection(](../../../backend/src/Application/Dashboard/DashboardService.php#L266) |
| Persistence | [PdoDashboardRepository.php · public function dailySelections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L139)<br>[PdoDashboardRepository.php · public function addDailySelection(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L152)<br>[PdoDashboardRepository.php · public function removeDailySelection(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L163)<br>[0025_create_daily_task_selections.php · CREATE TABLE daily_task_selections (](../../../backend/database/plain-migrations/0025_create_daily_task_selections.php#L16) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_daily_selection_is_idempotent_and_adds_week_without_changing_task_fields(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L236)<br>[DashboardReviewsTest.php · public function test_daily_selection_uses_owner_date_and_does_not_carry_into_tomorrow(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L258)<br>[PlanningHttpTest.php · public function test_daily_selection_http_preserves_ownership_csrf_validation_and_task_version(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L160)<br>[PlanningHttpTest.php · public function test_today_capture_creates_and_selects_atomically_and_overdue_reopen_requires_date_decision(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L187) |
| HTTP | `GET /api/v1/daily-selections/task` (`api.daily-selections.index`) → [DashboardController::dailySelections](../../../backend/src/Http/Controller/DashboardController.php#L44)<br>`POST /api/v1/daily-selections/task` (`api.daily-selections.store`) → [DashboardController::addDailySelection](../../../backend/src/Http/Controller/DashboardController.php#L48)<br>`DELETE /api/v1/daily-selections/task/{id}` (`api.daily-selections.destroy`) → [DashboardController::removeDailySelection](../../../backend/src/Http/Controller/DashboardController.php#L52) |

### Overdue reminder and encouragement

**Trace ID:** `dashboard.overdue.reminder`

A compact line replaces the Needs attention panel. Only active unfinished Tasks with a past deadline that have not entered History count toward the reminder. Complete/archive removes a Task immediately; a new future deadline or clearing it removes overdue membership. When the reminder count is zero the line shows encouragement. The Overdue tasks link still exposes retained overdue work, including History-qualified Tasks, for an explicit Reopen. This is a Dashboard reminder policy, not a change to email/reminder delivery.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-overdue-reminder](../../../frontend/src/views/planning/dashboard.php#L102) |
| Browser logic | [dashboard-page.js · const renderTaskPanels = () =&gt;](../../../frontend/src/js/planning/dashboard-page.js#L284) |
| Controller / service / domain | [DashboardService.php · public function dashboard(](../../../backend/src/Application/Dashboard/DashboardService.php#L73) |
| Persistence | [PdoDashboardRepository.php · public function overdueTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L75)<br>[PdoDashboardRepository.php · public function historyThresholds(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L84) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_today_checklist_keeps_completed_selections_and_silences_historical_overdue_reminders(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L289) |
| HTTP | `GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

<!-- END GENERATED TRACE -->


