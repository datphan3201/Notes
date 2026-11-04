# /tasks — Repeating TaskSeries

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: the **Repeating** view, or Repeat in a capture dialog. A series is a template/rule; generated occurrences are ordinary Tasks with independent versions and completion state.

[Archify: recurring work](../../diagrams/task-series-lifecycle/index.html) explains creation, materialization and lifecycle.

<!-- BEGIN GENERATED TRACE -->

### Repeating list: Pause, Resume, End

**Trace ID:** `tasks.repeating.list`

Repeating uses name search plus an independent All/Active/Paused/Ended series-state select; Task status/sort/tag controls are hidden. The badge, list and pagination use the same filtered series, including Ended in All. Rows show series state, frequency, start/end and optional reminder time. Pause retains existing Tasks. Resume skips missed paused dates; End asks to archive future NotStarted occurrences, preserving started/Done work. Ended is terminal: API Pause/Resume returns 422 after ownership/version checks; repeated End with the current version is a no-op. Start a new series for future repeating work.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-view="repeating"](../../../frontend/src/views/planning/tasks.php#L48)<br>[tasks.php · data-series-status&gt;](../../../frontend/src/views/planning/tasks.php#L82) |
| Browser logic | [tasks-collection.js · export function seriesPage](../../../frontend/src/js/planning/tasks-collection.js#L36)<br>[series-list.js · export function renderSeriesList](../../../frontend/src/js/planning/series-list.js#L6) |
| Controller / service / domain | [TaskSeriesService.php · public function transition(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L111) |
| Persistence | [PdoTaskSeriesRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L61)<br>[PdoTaskSeriesRepository.php · public function archiveFutureNotStarted(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L143) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_series_pause_resume_and_end_archives_acknowledged_future_occurrences(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L258)<br>[HabitsRecurrenceTest.php · public function test_ended_series_cannot_pause_or_resume_and_replayed_end_preserves_occurrences(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L308)<br>[PlanningHttpTest.php · public function test_ended_series_http_transitions_preserve_auth_csrf_ownership_versions_and_replay(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L122)<br>[tasks-collection.test.js · test('Repeating search/state/count/paging use the same series including terminal rows'](../../../frontend/tests/js/tasks-collection.test.js#L50) |
| HTTP | `GET /api/v1/task-series` (`api.task-series.index`) → [TaskSeriesController::index](../../../backend/src/Http/Controller/TaskSeriesController.php#L18)<br>`POST /api/v1/task-series/{id}/{action}` (`api.task-series.transition`) → [TaskSeriesController::transition](../../../backend/src/Http/Controller/TaskSeriesController.php#L35) |

### Daily, weekly, monthly and yearly rules

**Trace ID:** `tasks.repeating.rule`

Date calculation uses local calendar dates. Monthly/yearly dates clamp from the original anchor. Weekly carries weekdays. Local-time conversion resolves DST; the series/date unique key prevents duplicate occurrences. Preview calculates dates without querying or writing series/occurrence rows. Supported browser timezone aliases are canonicalized even when PHP accepts the alias directly; previously accepted fixed-offset forms keep their existing fallback behavior.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [task-capture-fields.php · data-schedule-open="repeat"](../../../frontend/src/views/planning/task-capture-fields.php#L15) |
| Browser logic | [calendar.js · export function repeatRule](../../../frontend/src/js/lib/calendar.js#L64) |
| Controller / service / domain | [TaskSeriesService.php · public function preview(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L149)<br>[RecurrenceCalculator.php · public function dates(](../../../backend/src/Domain/Recurrence/RecurrenceCalculator.php#L18)<br>[RecurrenceCalculator.php · public function localDateTimeToUtc(](../../../backend/src/Domain/Recurrence/RecurrenceCalculator.php#L80)<br>[TaskSeriesService.php · private function timezone(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L440)<br>[TimeZoneNames.php · public static function canonical(](../../../backend/src/Support/TimeZoneNames.php#L32) |
| Relevant tests (not a pass claim) | [RecurrenceCalculatorTest.php · public function test_monthly_and_yearly_recurrence_clamp_without_drifting(](../../../backend/tests/Plain/Unit/RecurrenceCalculatorTest.php#L39)<br>[RecurrenceCalculatorTest.php · public function test_dst_gap_advances_and_overlap_chooses_earlier_instant(](../../../backend/tests/Plain/Unit/RecurrenceCalculatorTest.php#L32)<br>[HabitsRecurrenceTest.php · public function test_habit_and_series_timezones_normalize_aliases_and_preserve_existing_offset_inputs(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L55)<br>[HabitsRecurrenceTest.php · public function test_invalid_timezones_do_not_create_habits_or_series(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L79) |
| HTTP | `POST /api/v1/task-series/preview` (`api.task-series.preview`) → [TaskSeriesController::preview](../../../backend/src/Http/Controller/TaskSeriesController.php#L39) |

### Initial and catch-up materialization

**Trace ID:** `tasks.repeating.materialize`

HTTP creation materializes immediately. The scheduler materializes hourly; Task listing and Dashboard reads also call materializeDue when the generated horizon is below 28 days. This read-path side effect is current code behavior. Generated work is excluded from finite Goal progress.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [tasks.php · data-task-list](../../../frontend/src/views/planning/tasks.php#L100) |
| Browser logic | [planning-page.js · get('/api/v1/task-series'](../../../frontend/src/js/planning/planning-page.js#L933) |
| Controller / service / domain | [PlanningController.php · public function index(](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>[TaskSeriesService.php · public function materializeDue(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L185)<br>[TaskSeriesService.php · public function materialize(](../../../backend/src/Application/Recurrence/TaskSeriesService.php#L160) |
| Persistence | [PdoTaskSeriesRepository.php · public function occurrence(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L84)<br>[PdoTaskSeriesRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php#L49)<br>[PdoPlanningRepository.php · public function linkOccurrence(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L443) |
| Relevant tests (not a pass claim) | [ProductCompletionTest.php · public function test_repeating_tasks_carry_a_local_reminder_and_extend_without_a_scheduler(](../../../backend/tests/Plain/Integration/ProductCompletionTest.php#L177) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/dashboard` (`api.dashboard.show`) → [DashboardController::show](../../../backend/src/Http/Controller/DashboardController.php#L18) |

<!-- END GENERATED TRACE -->

## Personal recurrence versus Teamwork

Personal Tasks use TaskSeries and a forward materialization horizon. Team Tasks use `TeamTaskRepeat` to create a next Task after completion. Use [Teamwork](../teamwork/README.md), not the personal series service, when changing that behavior.

## Terminal state and request precedence

Ended is terminal. Pause/Resume of an owned Ended series with the current version returns 422 with a `state` error and performs no write. Foreign series IDs still return 404, stale versions still return 409, and auth/CSRF checks run before the use case. Repeating End with the current version and a valid payload is a no-op; Resume while Active and Pause while Paused retain their existing no-op behavior. Future work requires a new series. Existing started/Done Tasks are preserved; only explicitly confirmed future NotStarted occurrences are archived.
