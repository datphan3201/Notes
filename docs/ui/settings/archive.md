# /settings/archive — Archive

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Archiving never deletes planning data: it hides an Area, Goal, Milestone, Task or Habit from every active list (Goals, Tasks, Calendar, Dashboard, Habits, the AI assistant) and keeps its history, check-ins and Activity. Task history retention also archives old Tasks, so they appear here. The Archive page lists everything archived and restores it; Notes are deleted rather than archived and do not appear, and Team Goals have their own owner controls in [Teamwork](../teamwork/README.md).

## Restore rules

- **Together in, together out.** Archiving a Goal or Milestone with its contents stamps the item and everything beneath it with one timestamp. The Archive lists only the Goal or Milestone ("comes back with N items") and restoring it restores exactly that group: sub-Goals, Milestones and Tasks archived with it. Items archived separately before stay archived and are listed on their own. Archives made before the shared timestamp are grouped by a 5-second window.
- **Parents first.** A Goal, Milestone or Task whose Area, parent Goal, Goal or Milestone is still archived cannot be restored; the page names that parent and the server refuses with 422. A Habit only links to a supporting Goal and can always be restored.
- **Area limit.** An Area is restored only while fewer than four Areas are active. Area names stay unique including archived ones, so a restored Area never collides.
- **Not undone.** Repeating series ended by an archive stay ended (start a new one from the Task), and Milestone prerequisite links removed when a Milestone was archived with its Tasks are not recreated.
- Restore is owner-only (another account's id is 404), version-checked (409 when the item changed after the page loaded) and CSRF-protected; it increments each restored item's version.

<!-- BEGIN GENERATED TRACE -->

### Archived items, type filter and search

**Trace ID:** `archive.list`

Lists the owner's archived Areas, Goals, Milestones, Tasks and Habits newest first (up to 500 per type) with kind, status, archive time and where each lived. Contents archived together with a Goal or Milestone are folded into it as a count. A type filter (Everything, Areas, Goals, Milestones, Tasks, Habits) and a name search page through 12 items at a time; items inside an archived parent say which parent to restore first and their Restore button is disabled.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [archive.php · data-archive-list](../../../frontend/src/views/settings/archive.php#L28)<br>[app.php · &#91;'Archive', '/settings/archive'](../../../frontend/src/views/layouts/app.php#L21) |
| CSS | [feedback.css · /* Settings › Archive */](../../../frontend/src/css/feedback.css#L1667) |
| Browser logic | [archive.js · export function initArchivePage](../../../frontend/src/js/settings/archive.js#L32)<br>[archive.js · export function archiveMatches](../../../frontend/src/js/settings/archive.js#L15)<br>[archive.js · export function restoreBlocker](../../../frontend/src/js/settings/archive.js#L25) |
| Controller / service / domain | [ArchiveService.php · public function list(](../../../backend/src/Application/Archive/ArchiveService.php#L44) |
| Persistence | [PdoArchiveRepository.php · public function archived(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoArchiveRepository.php#L28) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_archive_lists_archived_items_and_restores_a_goal_with_what_was_archived_with_it(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L296)<br>[archive.test.js · test('archive filters by type and name](../../../frontend/tests/js/archive.test.js#L16) |
| HTTP | `GET /settings/archive` (`settings.archive`) → [AccountController::settingsPage](../../../backend/src/Http/Controller/AccountController.php#L172)<br>`GET /api/v1/archive` (`api.archive.index`) → [ArchiveController::index](../../../backend/src/Http/Controller/ArchiveController.php#L21) |

### Restore with its group, parents first

**Trace ID:** `archive.restore`

Restore sends the item's version. The server locks the owner, refuses an item that is not archived, changed (409), belongs to someone else (404) or lives inside an archived parent (422 naming it), and an Area while four are active. A Goal or Milestone comes back with the sub-Goals, Milestones and Tasks archived with it; the page reports how many items returned and reloads. Archiving with contents uses one timestamp for the whole group so the group can be restored exactly.

| Layer | Entry point |
| --- | --- |
| Browser logic | [archive.js · restore.addEventListener](../../../frontend/src/js/settings/archive.js#L89) |
| Controller / service / domain | [ArchiveService.php · public function restore(](../../../backend/src/Application/Archive/ArchiveService.php#L81)<br>[ArchiveService.php · private function bundle(](../../../backend/src/Application/Archive/ArchiveService.php#L139)<br>[PlanningService.php · public function archive(string $type, int $userId, string $id, array $input): array](../../../backend/src/Application/Planning/PlanningService.php#L247) |
| Persistence | [PdoArchiveRepository.php · public function restore(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoArchiveRepository.php#L69) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_archive_lists_archived_items_and_restores_a_goal_with_what_was_archived_with_it(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L296)<br>[FullFeedbackHttpTest.php · public function test_archive_restores_an_area_only_below_the_active_area_limit(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L351)<br>[archive.test.js · test('only items inside an archived parent wait for it](../../../frontend/tests/js/archive.test.js#L31) |
| HTTP | `POST /api/v1/archive/{type}/{id}/restore` (`api.archive.restore`) → [ArchiveController::restore](../../../backend/src/Http/Controller/ArchiveController.php#L27) |

<!-- END GENERATED TRACE -->
