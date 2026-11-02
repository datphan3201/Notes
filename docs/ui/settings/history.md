# /settings/history — Task history and retention

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: Tasks → Task history, or Settings → Task history. History is derived from dates and status, not a stored Task status.

The threshold projection and the archive job are distinct. The job may archive retained history under the user retention setting or system cap; it does not hard-delete Tasks.

<!-- BEGIN GENERATED TRACE -->

### Completed-hours, overdue-days and retention settings

**Trace ID:** `history.rules`

Defaults are 24 elapsed completed-hours and 3 local overdue-days. Retention is optional; the admin history cap still applies. Changing thresholds changes membership without rewriting Task completion facts.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [history.php · data-history-rules](../../../frontend/src/views/settings/history.php#L10) |
| Browser logic | [task-history.js · export function initTaskHistory](../../../frontend/src/js/settings/task-history.js#L12)<br>[task-views.js · export function taskInHistory](../../../frontend/src/js/planning/task-views.js#L66) |
| Controller / service / domain | [TaskHistoryService.php · public function prune(](../../../backend/src/Application/Planning/TaskHistoryService.php#L29)<br>[AccountValidator.php · public function preferences(](../../../backend/src/Application/Account/AccountValidator.php#L76) |
| Persistence | [PdoTaskHistoryRepository.php · public function preferences(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L16)<br>[PdoTaskHistoryRepository.php · public function historyTasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L32)<br>[PdoTaskHistoryRepository.php · public function archive(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoTaskHistoryRepository.php#L47) |
| Relevant tests (not a pass claim) | [task-views.test.js · history uses elapsed](../../../frontend/tests/js/task-views.test.js#L115) |
| HTTP | `PATCH /api/v1/preferences` (`api.preferences.update`) → [AccountController::updatePreferences](../../../backend/src/Http/Controller/AccountController.php#L139) |

### Search, detail navigation and Reopen

**Trace ID:** `history.list`

The client derives the history set and filters names/descriptions. Reopen uses the existing Task transition; an old deadline may still independently qualify an unfinished Task for history.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [history.php · data-history-list](../../../frontend/src/views/settings/history.php#L24) |
| Browser logic | [task-history.js · export function historyMatches](../../../frontend/src/js/settings/task-history.js#L6) |
| Controller / service / domain | [PlanningService.php · public function transition(](../../../backend/src/Application/Planning/PlanningService.php#L345) |
| Persistence | [PdoPlanningRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php#L51) |
| Relevant tests (not a pass claim) | [task-views.test.js · history uses elapsed](../../../frontend/tests/js/task-views.test.js#L115) |
| HTTP | `GET /api/v1/tasks` (`api.tasks.index`) → [PlanningController::index](../../../backend/src/Http/Controller/PlanningController.php#L23)<br>`POST /api/v1/tasks/{id}/reopen` (`api.tasks.reopen`) → [PlanningController::transition](../../../backend/src/Http/Controller/PlanningController.php#L92) |

<!-- END GENERATED TRACE -->


