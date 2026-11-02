# /dashboard — Today, This week and Activity

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

These are workspace sections on one URL. Their facts come from server projections; browser cards/heat levels do not create a productivity score.

Task membership here is a server projection; changing `/tasks` browser filters alone does not change Dashboard queries.

<!-- BEGIN GENERATED TRACE -->

### Today, Needs attention and current focus

**Trace ID:** `dashboard.today`

The account timezone defines today. Deadline/start/occurrence and overlapping UTC schedules are considered; overdue is unfinished with deadline before today. Focus prefers eligible weekly work, then Today, then overdue; Blocked is not recommended.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-current-focus](../../../frontend/src/views/planning/dashboard.php#L42) |
| Browser logic | [dashboard-page.js · export function initDashboardPage](../../../frontend/src/js/planning/dashboard-page.js#L224) |
| Controller / service / domain | [DashboardService.php · public function dashboard(](../../../backend/src/Application/Dashboard/DashboardService.php#L71) |
| Persistence | [PdoDashboardRepository.php · public function todayTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L48)<br>[PdoDashboardRepository.php · public function overdueTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L63) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_today_projection_includes_planned_starts_and_overlapping_schedules(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L222) |
| HTTP | `GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

### This week and weekly summary

**Trace ID:** `dashboard.week`

Explicit Task/Milestone selections are scoped to the current Monday week. Duplicate selection is idempotent, reorder requires the exact active set, completion does not deselect. Percentages use active selected Tasks as denominator and only compare when a previous denominator exists.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-weekly-tasks](../../../frontend/src/views/planning/dashboard.php#L100) |
| Browser logic | [dashboard-page.js · data-weekly-tasks](../../../frontend/src/js/planning/dashboard-page.js#L476) |
| Controller / service / domain | [DashboardService.php · public function addSelection(](../../../backend/src/Application/Dashboard/DashboardService.php#L174) |
| Persistence | [PdoDashboardRepository.php · public function selections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L72)<br>[PdoDashboardRepository.php · public function addSelection(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L89)<br>[PdoDashboardRepository.php · public function reorderSelections(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L104) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_weekly_selection_reorder_requires_exact_active_set(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L59)<br>[DashboardReviewsTest.php · public function test_week_and_review_completion_use_real_denominators_and_saved_snapshots(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L198) |
| HTTP | `GET /api/v1/weekly-selections/{type}` (`api.weekly-selections.index`) → [DashboardController::selections](../../../backend/src/Http/Controller/DashboardController.php#L27)<br>`POST /api/v1/weekly-selections/{type}` (`api.weekly-selections.store`) → [DashboardController::addSelection](../../../backend/src/Http/Controller/DashboardController.php#L31)<br>`DELETE /api/v1/weekly-selections/{type}/{id}` (`api.weekly-selections.destroy`) → [DashboardController::removeSelection](../../../backend/src/Http/Controller/DashboardController.php#L35)<br>`POST /api/v1/weekly-selections/{type}/reorder` (`api.weekly-selections.reorder`) → [DashboardController::reorder](../../../backend/src/Http/Controller/DashboardController.php#L40) |

### Year Activity heatmap and factual tooltip

**Trace ID:** `dashboard.activity`

The current browser renders a year grid with a year picker. Activity API facts count unreversed task/checklist/habit/milestone completions. Levels 0, 1, 2–3, 4–6, 7+ are presentation; note edits do not count.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-activity-grid](../../../frontend/src/views/planning/dashboard.php#L155) |
| Browser logic | [dashboard-page.js · export function yearCalendar](../../../frontend/src/js/planning/dashboard-page.js#L81)<br>[dashboard-page.js · export function activityLevel](../../../frontend/src/js/planning/dashboard-page.js#L67) |
| Controller / service / domain | [DashboardService.php · public function yearActivity(](../../../backend/src/Application/Dashboard/DashboardService.php#L38) |
| Persistence | [PdoDashboardRepository.php · public function activity(](../../../backend/src/Infrastructure/Persistence/Pdo/Dashboard/PdoDashboardRepository.php#L16) |
| Relevant tests (not a pass claim) | [planning.test.js · activity levels](../../../frontend/tests/js/planning.test.js#L21)<br>[planning.test.js · yearly activity calendar](../../../frontend/tests/js/planning.test.js#L25)<br>[planning.test.js · year spinner](../../../frontend/tests/js/planning.test.js#L51)<br>[DashboardReviewsTest.php · public function test_activity_grid_uses_unreversed_completion_facts(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L48) |
| HTTP | `GET /api/v1/dashboard/activity` (`api.dashboard.activity`) → [DashboardController::activity](../../../backend/src/Http/Controller/DashboardController.php#L23) |

### Habit streak and quick check-in

**Trace ID:** `dashboard.habits`

Habit streaks and daily state derive from check-ins/rest days. Habit-local dates may differ from the account timezone; do not sum weekly targets into a daily denominator.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [dashboard.php · data-dashboard-habits](../../../frontend/src/views/planning/dashboard.php#L123) |
| Browser logic | [dashboard-page.js · data-dashboard-habits](../../../frontend/src/js/planning/dashboard-page.js#L495)<br>[insights-ui.js · export function renderStreak](../../../frontend/src/js/planning/insights-ui.js#L59) |
| Controller / service / domain | [HabitProgress.php · public function describe(](../../../backend/src/Application/Habits/HabitProgress.php#L47) |
| Persistence | [PdoHabitRepository.php · public function history(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L101)<br>[PdoHabitRepository.php · public function days(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L146) |
| Relevant tests (not a pass claim) | [DashboardReviewsTest.php · public function test_dashboard_shows_every_habit_with_period_specific_counts_and_streaks(](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L100)<br>[DashboardReviewsTest.php · public function test_dashboard_streak_deduplicates_habits_respects_owner_and_recalculates_after_u...](../../../backend/tests/Plain/Integration/DashboardReviewsTest.php#L173) |
| HTTP | `PUT /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.store`) → [HabitController::checkIn](../../../backend/src/Http/Controller/HabitController.php#L42)<br>`DELETE /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.destroy`) → [HabitController::undoCheckIn](../../../backend/src/Http/Controller/HabitController.php#L46) |

<!-- END GENERATED TRACE -->


