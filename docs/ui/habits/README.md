# /habits — Habits, streaks and Rest Days

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Habits are dedicated entities with check-in history; personal repeating Tasks are managed under [Tasks / Repeating](../tasks/repeating.md). Habit check-ins do not change Goal progress.

The approved action layout keeps the existing visuals: direct today check-in before the name, Edit at the end, and Rest day/Archive inside More options. The calendar retains dated interactions.

<!-- BEGIN GENERATED TRACE -->

### Habit cards and New/Edit dialog

**Trace ID:** `habits.collection`

The existing theme/cards and Edit fields are retained. Check-in sits before the name, which carries the Habit icon (click to change) and read-only importance stars; the calendar follows the text and moves below on narrower screens. Edit remains at the end; More options opens the existing secondary popover. Parent chips fit their text. Refresh is an icon with a native tooltip. Edit keeps Cancel then Save changes in a sticky footer on mobile. Daily target is one completion day; weekly target is 1–7 distinct days. Period/timezone freeze after the first check-in; archive/recreate to change them. Name, description, importance, Goal and Tags remain editable. New/edited timezone inputs normalize supported browser aliases to canonical identifiers. Equivalent input on a checked-in legacy Habit preserves its stored timezone and history; an actual timezone change remains rejected.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-create-form](../../../frontend/src/views/planning/habits.php#L42)<br>[habits.php · habit-dialog-footer](../../../frontend/src/views/planning/habits.php#L106) |
| CSS | [habits.css · Habit action layout](../../../frontend/src/css/habits.css#L3) |
| Browser logic | [habits-page.js · export function initHabitsPage](../../../frontend/src/js/planning/habits-page.js#L64) |
| Controller / service / domain | [HabitService.php · public function update(](../../../backend/src/Application/Habits/HabitService.php#L68)<br>[HabitService.php · private function timezone(](../../../backend/src/Application/Habits/HabitService.php#L421)<br>[TimeZoneNames.php · public static function canonical(](../../../backend/src/Support/TimeZoneNames.php#L32) |
| Persistence | [PdoHabitRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L40)<br>[PdoHabitRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L52)<br>[PdoHabitRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L65) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_habit_check_in_and_undo_are_idempotent_and_freeze_period_timezone(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L136)<br>[HabitsRecurrenceTest.php · public function test_habit_and_series_timezones_normalize_aliases_and_preserve_existing_offset_inputs(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L55)<br>[HabitsRecurrenceTest.php · public function test_legacy_checked_in_habit_accepts_equivalent_timezone_without_rewriting_history(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L103)<br>[PlanningHttpTest.php · public function test_timezone_aliases_are_canonicalized_for_habit_and_series_http_creation(](../../../backend/tests/Plain/Http/PlanningHttpTest.php#L106) |
| HTTP | `GET /api/v1/habits` (`api.habits.index`) → [HabitController::index](../../../backend/src/Http/Controller/HabitController.php#L18)<br>`POST /api/v1/habits` (`api.habits.store`) → [HabitController::store](../../../backend/src/Http/Controller/HabitController.php#L22)<br>`PATCH /api/v1/habits/{id}` (`api.habits.update`) → [HabitController::update](../../../backend/src/Http/Controller/HabitController.php#L30)<br>`DELETE /api/v1/habits/{id}` (`api.habits.archive`) → [HabitController::archive](../../../backend/src/Http/Controller/HabitController.php#L34) |

### Check-in, undo and streak

**Trace ID:** `habits.checkins`

The left-hand checkbox immediately checks in or undoes today, consistently with Dashboard; it no longer opens a menu. It exposes checkbox state and an action-specific accessible name. Calendar buttons retain dated check-in/undo. Controls disable during their request and restore focus after refresh. At most one check-in per Habit/local date. No future check-in; repeated PUT is idempotent. Undo reverses Activity. Streaks derive from check-ins and rest history, not a stored score.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-list](../../../frontend/src/views/planning/habits.php#L32) |
| Browser logic | [habits-page.js · const checkIn = (habit, date, done) =&gt;](../../../frontend/src/js/planning/habits-page.js#L104)<br>[habit-days.js · export function habitDayState(](../../../frontend/src/js/lib/habit-days.js#L4)<br>[habits-page.js · tick.setAttribute('role', 'checkbox');](../../../frontend/src/js/planning/habits-page.js#L278) |
| Controller / service / domain | [HabitService.php · public function checkIn(](../../../backend/src/Application/Habits/HabitService.php#L125)<br>[HabitService.php · public function undoCheckIn(](../../../backend/src/Application/Habits/HabitService.php#L146)<br>[HabitStreak.php · public function daily(](../../../backend/src/Domain/Habits/HabitStreak.php#L24)<br>[HabitStreak.php · public function weekly(](../../../backend/src/Domain/Habits/HabitStreak.php#L47) |
| Persistence | [PdoHabitRepository.php · public function insertCheckIn(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L87)<br>[PdoHabitRepository.php · public function deleteCheckIn(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L95)<br>[PdoHabitRepository.php · public function history(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L102) |
| Relevant tests (not a pass claim) | [habit-days.test.js · checked days are checked](../../../frontend/tests/js/habit-days.test.js#L5)<br>[habit-days.test.js · past unchecked days](../../../frontend/tests/js/habit-days.test.js#L10)<br>[habit-days.test.js · rest days are protected](../../../frontend/tests/js/habit-days.test.js#L21)<br>[HabitsRecurrenceTest.php · public function test_habit_check_in_and_undo_are_idempotent_and_freeze_period_timezone(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L136) |
| HTTP | `PUT /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.store`) → [HabitController::checkIn](../../../backend/src/Http/Controller/HabitController.php#L42)<br>`DELETE /api/v1/habits/{id}/check-ins/{date}` (`api.habits.check-ins.destroy`) → [HabitController::undoCheckIn](../../../backend/src/Http/Controller/HabitController.php#L46)<br>`GET /api/v1/habits/{id}/history` (`api.habits.history`) → [HabitController::history](../../../backend/src/Http/Controller/HabitController.php#L38) |

### More options and Rest Day window

**Trace ID:** `habits.rest`

More options exposes the next three Rest Day buttons and a separate Archive action. Selected rest dates can be canceled here or through the calendar. Escape closes the popover and returns focus to its trigger. A Rest Day can be planned only for tomorrow through local today+3. Today, past and later dates are rejected. A rest cannot hide an existing check-in or create completion Activity. The backend returns the available window.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-list](../../../frontend/src/views/planning/habits.php#L32) |
| Browser logic | [habits-page.js · const toggleRest = (habit, date, rested) =&gt;](../../../frontend/src/js/planning/habits-page.js#L108)<br>[habits-page.js · const openMenuFor = (anchor, habit, restDays) =&gt;](../../../frontend/src/js/planning/habits-page.js#L113) |
| Controller / service / domain | [HabitService.php · public function rest(](../../../backend/src/Application/Habits/HabitService.php#L173)<br>[HabitService.php · public function cancelRest(](../../../backend/src/Application/Habits/HabitService.php#L192) |
| Persistence | [PdoHabitRepository.php · public function insertRestDay(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L130)<br>[PdoHabitRepository.php · public function deleteRestDay(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L136) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_rest_days_use_a_three_day_sliding_window_and_only_protect_the_streak(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L162) |
| HTTP | `PUT /api/v1/habits/{id}/rest-days/{date}` (`api.habits.rest-days.store`) → [HabitController::rest](../../../backend/src/Http/Controller/HabitController.php#L51)<br>`DELETE /api/v1/habits/{id}/rest-days/{date}` (`api.habits.rest-days.destroy`) → [HabitController::cancelRest](../../../backend/src/Http/Controller/HabitController.php#L55) |

### Archive confirmation and retained history

**Trace ID:** `habits.archive`

Archive is secondary inside More options. Confirmation explains removal from active lists without deleting data; cancel performs no write. The existing owner/version-checked API timestamps the Habit and increments its version while retaining check-ins, rest days and Activity. Native PDO prepares require distinct archived_at/updated_at bindings even when their timestamp values are equal. A removed row returns keyboard focus to Refresh.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [habits.php · data-habit-list aria-live](../../../frontend/src/views/planning/habits.php#L32) |
| Browser logic | [habits-page.js · const archive = menuButton(t('Archive'),](../../../frontend/src/js/planning/habits-page.js#L142) |
| Controller / service / domain | [HabitService.php · public function archive(](../../../backend/src/Application/Habits/HabitService.php#L111) |
| Persistence | [PdoHabitRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php#L65) |
| Relevant tests (not a pass claim) | [HabitsRecurrenceTest.php · public function test_archiving_a_habit_preserves_history_and_other_habits_with_native_prepares(](../../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php#L200) |
| HTTP | `DELETE /api/v1/habits/{id}` (`api.habits.archive`) → [HabitController::archive](../../../backend/src/Http/Controller/HabitController.php#L34) |

<!-- END GENERATED TRACE -->

## Timezone compatibility

Supported aliases such as `Asia/Saigon` normalize to `Asia/Ho_Chi_Minh` on new input, even when PHP directly accepts the alias. Existing accepted fixed-offset inputs retain their prior behavior. A checked-in legacy Habit receiving an equivalent alias keeps its exact stored timezone; name/content edits remain possible without rewriting check-ins or Activity. A genuinely different timezone remains forbidden after the first check-in. Stored names are resolved through `TimeZoneNames::zone`, so a legacy alias keeps working on servers whose tz database no longer ships it.
