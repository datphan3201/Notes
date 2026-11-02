# /habits — Habits, streaks and Rest Days

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Habits are dedicated entities with check-in history; personal repeating Tasks are managed under [Tasks / Repeating](../tasks/repeating.md). Habit check-ins do not change Goal progress.

<!-- BEGIN GENERATED TRACE -->

### Habit cards and New/Edit dialog

**Trace ID:** `habits.collection`

Daily target is one completion day; weekly target is 1–7 distinct days. Period/timezone freeze after the first check-in; archive/recreate to change them. Name, description, importance, Goal and Tags remain editable. New/edited timezone inputs normalize supported browser aliases to canonical identifiers. Equivalent input on a checked-in legacy Habit preserves its stored timezone and history; an actual timezone change remains rejected.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-create-form](../../../frontend/src/views/planning/habits.php#L40) |
| Browser logic | [habits-page.js · export function initHabitsPage](../../../frontend/src/js/planning/habits-page.js#L54) |
| Controller / service / domain | [HabitService.php · public function update(](../../../backend/src/Application/Habits/HabitService.php#L68)<br>[HabitService.php · private function timezone(](../../../backend/src/Application/Habits/HabitService.php#L419)<br>[TimeZoneNames.php · public static function canonical(](../../../backend/src/Support/TimeZoneNames.php#L17) |
| Persistence | [PdoHabitRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L40)<br>[PdoHabitRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L52)<br>[PdoHabitRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L65) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_habit_check_in_and_undo_are_idempotent_and_freeze_period_timezone(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L136)<br>[HabitsRecurrenceTest.php · public function test_habit_and_series_timezones_normalize_aliases_and_preserve_existing_offset_inputs(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L55)<br>[HabitsRecurrenceTest.php · public function test_legacy_checked_in_habit_accepts_equivalent_timezone_without_rewriting_history(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L103)<br>[PlanningHttpTest.php · public function test_timezone_aliases_are_canonicalized_for_habit_and_series_http_creation(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L104) |
| HTTP | `GET /api/v1/habits` (`api.habits.index`) → [HabitController::index](../../../backend/src/Http/Controller/HabitController.php#L18)<br>`POST /api/v1/habits` (`api.habits.store`) → [HabitController::store](../../../backend/src/Http/Controller/HabitController.php#L22)<br>`PATCH /api/v1/habits/{id}` (`api.habits.update`) → [HabitController::update](../../../backend/src/Http/Controller/HabitController.php#L30)<br>`DELETE /api/v1/habits/{id}` (`api.habits.archive`) → [HabitController::archive](../../../backend/src/Http/Controller/HabitController.php#L34) |

### Check-in, undo and streak

**Trace ID:** `habits.checkins`

At most one check-in per Habit/local date. No future check-in; repeated PUT is idempotent. Undo reverses Activity. Streaks derive from check-ins and rest history, not a stored score.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-list](../../../frontend/src/views/planning/habits.php#L30) |
| Browser logic | [habits-page.js · const checkIn = (habit, date, done) =&gt;](../../../frontend/src/js/planning/habits-page.js#L87)<br>[habit-days.js · export function habitDayState(](../../../frontend/src/js/lib/habit-days.js#L4) |
| Controller / service / domain | [HabitService.php · public function checkIn(](../../../backend/src/Application/Habits/HabitService.php#L125)<br>[HabitService.php · public function undoCheckIn(](../../../backend/src/Application/Habits/HabitService.php#L146)<br>[HabitStreak.php · public function daily(](../../../backend/src/Domain/Habits/HabitStreak.php#L24)<br>[HabitStreak.php · public function weekly(](../../../backend/src/Domain/Habits/HabitStreak.php#L47) |
| Persistence | [PdoHabitRepository.php · public function insertCheckIn(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L86)<br>[PdoHabitRepository.php · public function deleteCheckIn(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L94)<br>[PdoHabitRepository.php · public function history(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L101) |
| Relevant tests (not a pass claim) | [habit-days.test.js · checked days are checked](../../../frontend/tests/js/habit-days.test.js#L5)<br>[habit-days.test.js · past unchecked days](../../../frontend/tests/js/habit-days.test.js#L10)<br>[habit-days.test.js · rest days are protected](../../../frontend/tests/js/habit-days.test.js#L21)<br>[HabitsRecurrenceTest.php · public function test_habit_check_in_and_undo_are_idempotent_and_freeze_period_timezone(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L136) |
| HTTP | `PUT /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.store`) → [HabitController::checkIn](../../../backend/src/Http/Controller/HabitController.php#L42)<br>`DELETE /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.destroy`) → [HabitController::undoCheckIn](../../../backend/src/Http/Controller/HabitController.php#L46)<br>`GET /api/v1/habits/{id}/history` (`api.habits.history`) → [HabitController::history](../../../backend/src/Http/Controller/HabitController.php#L38) |

### Missed days and Rest Day menu

**Trace ID:** `habits.rest`

A Rest Day can be planned only for tomorrow through local today+3. Today, past and later dates are rejected. A rest cannot hide an existing check-in or create completion Activity. The backend returns the available window.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-list](../../../frontend/src/views/planning/habits.php#L30) |
| Browser logic | [habits-page.js · const toggleRest = (habit, date, rested) =&gt;](../../../frontend/src/js/planning/habits-page.js#L91) |
| Controller / service / domain | [HabitService.php · public function rest(](../../../backend/src/Application/Habits/HabitService.php#L173)<br>[HabitService.php · public function cancelRest(](../../../backend/src/Application/Habits/HabitService.php#L192) |
| Persistence | [PdoHabitRepository.php · public function insertRestDay(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L129)<br>[PdoHabitRepository.php · public function deleteRestDay(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L135) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_rest_days_use_a_three_day_sliding_window_and_only_protect_the_streak(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L162) |
| HTTP | `PUT /api/v1/habits/{id}/rest-days/{date}` (`api.habits.rest-days.store`) → [HabitController::rest](../../../backend/src/Http/Controller/HabitController.php#L51)<br>`DELETE /api/v1/habits/{id}/rest-days/{date}` (`api.habits.rest-days.destroy`) → [HabitController::cancelRest](../../../backend/src/Http/Controller/HabitController.php#L55) |

<!-- END GENERATED TRACE -->

## Timezone compatibility

Supported aliases such as `Asia/Saigon` normalize to `Asia/Ho_Chi_Minh` on new input, even when PHP directly accepts the alias. Existing accepted fixed-offset inputs retain their prior behavior. A checked-in legacy Habit receiving an equivalent alias keeps its exact stored timezone; name/content edits remain possible without rewriting check-ins or Activity. A genuinely different timezone remains forbidden after the first check-in. See [ISSUE-001](../../issues.md#issue-001--habit-timezone-alias-is-not-always-canonicalized) for implementation/test evidence.
