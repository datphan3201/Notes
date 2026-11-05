# /calendar — Calendar of planning dates

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The Calendar is a view over existing planning data, not a separate store: it reads the owner's Tasks, Milestones and Goals and changes them only through their ordinary versioned PATCH and POST endpoints. A Task appears once per day it touches (scheduled block, due date, repeat occurrence or start date, in that order when several share a day); Milestone and Goal deadlines appear as their own items with the chosen icon. Habits are not drawn: a daily Habit would mark every day without adding information, and its history stays on [Habits](../habits/README.md).

Weeks start on Monday, matching the Dashboard's This week. Scheduled instants are shown in the account timezone.

<!-- BEGIN GENERATED TRACE -->

### Month and week grid

**Trace ID:** `calendar.grid`

Month (Monday-first weeks, no trailing empty week) and Week views with previous/next, Today and a Goal filter (All goals, one Goal, or Inbox). Each day lists Goal and Milestone deadlines first, then timed blocks by start time, then other Task dates; month cells show three items and +N more, which selects the day. Overdue due dates and deadlines are red; completed items are faded and struck through. Below 600px the month shows one dot per item and the selected day's list carries the detail; a week reads as a list of days. The view and date are kept in the address (view, date) and the view is remembered per browser.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [calendar.php · data-calendar-grid](../../../frontend/src/views/planning/calendar.php#L45) |
| CSS | [calendar.css · Calendar layout](../../../frontend/src/css/calendar.css#L1) |
| Browser logic | [calendar-page.js · export function initCalendarPage(](../../../frontend/src/js/planning/calendar-page.js#L41)<br>[calendar-model.js · export function calendarEntries(](../../../frontend/src/js/planning/calendar-model.js#L74)<br>[calendar-model.js · export function monthWeeks(](../../../frontend/src/js/planning/calendar-model.js#L19) |
| Controller / service / domain | [PlanningService.php · public function list(string $type, int $userId): array](../../../backend/src/Application/Planning/PlanningService.php#L41) |
| Persistence | [PdoPlanningRepository.php · public function list(string $type, int $userId, bool $includeArchived = false): array](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [calendar-model.test.js · test('weeks start on Monday and a month never ends with an empty week'](../../../frontend/tests/js/calendar-model.test.js#L22)<br>[calendar-model.test.js · test('a Task appears once per day, with the most specific date kind'](../../../frontend/tests/js/calendar-model.test.js#L32)<br>[FullFeedbackHttpTest.php · public function test_changed_pages_render_their_new_controls(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L262) |
| HTTP | `GET /calendar` (`planning.calendar`) → [AccountController::planningPage](../../../backend/src/Http/Controller/AccountController.php#L188)<br>`GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/milestones` (`api.milestones.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`GET /api/v1/goals` (`api.goals.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23) |

### Move by drag, keyboard or Move to…

**Trace ID:** `calendar.move`

An item moves by drag and drop onto a day or the selected-day panel, by Alt with an arrow key (one day left/right, one week up/down; focus follows the item), or with Move to… beside it in the day list, which opens the native date picker (the touch path). Each move sends one PATCH with the item's base_version and only the dates the move rule changes (see Move rule), then reloads; a stale version or invalid date range shows the server's message and the reloaded state. Moves are announced to screen readers.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [calendar.php · data-calendar-day-list](../../../frontend/src/views/planning/calendar.php#L57) |
| Browser logic | [calendar-model.js · export function moveChanges(](../../../frontend/src/js/planning/calendar-model.js#L162)<br>[calendar-model.js · export function shiftInstant(](../../../frontend/src/js/planning/calendar-model.js#L60)<br>[calendar-page.js · async function move(](../../../frontend/src/js/planning/calendar-page.js#L186) |
| Controller / service / domain | [PlanningService.php · public function update(string $type, int $userId, string $id, array $input): array](../../../backend/src/Application/Planning/PlanningService.php#L182) |
| Persistence | [PdoPlanningRepository.php · public function update(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L94) |
| Relevant tests (not a pass claim) | [calendar-model.test.js · test('moving shifts every date on the source day and keeps scheduled clock times'](../../../frontend/tests/js/calendar-model.test.js#L56)<br>[calendar-model.test.js · test('daylight saving never moves the wall-clock time of a scheduled block'](../../../frontend/tests/js/calendar-model.test.js#L106) |
| Coverage limit | Move rules are unit-tested; drag and drop, Alt+arrow focus and the native picker need a browser check. |
| HTTP | `PATCH /api/v1/tasks/{id}` (`api.tasks.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`PATCH /api/v1/milestones/{id}` (`api.milestones.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54)<br>`PATCH /api/v1/goals/{id}` (`api.goals.update`) → [PlanningController::update](../../../backend/src/Http/Controller/PlanningController.php#L54) |

### Selected day, New task and Unscheduled

**Trace ID:** `calendar.capture`

The side panel lists everything on the selected day with its kind, time and Goal or Milestone, and Add task. New task, Add task and double-clicking a day open the shared floating editor in create mode with the due date preset to that day and the filtered Goal as its parent. Clicking any item opens it in the floating editor instead of leaving the Calendar. Unscheduled lists open one-off Tasks with no date at all, by importance; dragging one onto a day, or Set due date, gives it that due date.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [calendar.php · data-calendar-unscheduled aria-labelledby](../../../frontend/src/views/planning/calendar.php#L59)<br>[calendar.php · data-calendar-day-add](../../../frontend/src/views/planning/calendar.php#L52) |
| Browser logic | [calendar-model.js · export function unscheduledTasks(](../../../frontend/src/js/planning/calendar-model.js#L142)<br>[calendar-page.js · function openCreate(](../../../frontend/src/js/planning/calendar-page.js#L461) |
| Controller / service / domain | [PlanningService.php · public function create(string $type, int $userId, array $input): array](../../../backend/src/Application/Planning/PlanningService.php#L97) |
| Persistence | [PdoPlanningRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L77) |
| Relevant tests (not a pass claim) | [calendar-model.test.js · test('occurrences and completed work stay put; the tray lists only undated open one-offs'](../../../frontend/tests/js/calendar-model.test.js#L114) |
| HTTP | `POST /api/v1/tasks` (`api.tasks.store`) → [PlanningController::store](../../../backend/src/Http/Controller/PlanningController.php#L34) |

<!-- END GENERATED TRACE -->

## Move rule

Moving an item from day A to day B moves every date of that item that falls on day A by the same number of days; a scheduled block moves as a whole and keeps its local start and end times, also across daylight-saving changes. Other dates stay where they are, so moving a due date before a start date is rejected by the server with its usual message. A repeat occurrence's own date belongs to its series and does not move; completed items do not move. Dropping a Task from Unscheduled gives it the target day as its due date.
