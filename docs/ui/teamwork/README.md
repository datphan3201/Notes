# /teamwork — Team Goals, members, Tasks and chat

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Teamwork uses its own tables/services and membership permissions. A team admin is not a system admin. Non-members receive 404. The member who created a team goal (`created_by`) is protected: other admins, including ones the creator promoted, cannot change the creator's role or remove them (403 `TEAM_CREATOR_PROTECTED`); only the creator can step down or leave, and the last-admin rule still applies. Clicking a team Task opens a details dialog laid out like the personal Task page; editors can edit its fields there (reminder and repeat are kept).

The page has searchable Goal cards, a paged carousel and focused Details/Members/Tasks/Chat panels.

<!-- BEGIN GENERATED TRACE -->

### Team Goal cards, search and carousel

**Trace ID:** `teamwork.goals`

The browser filters names/descriptions and pages up to four cards (two below 900px, one below 560px). Selecting a card loads one team Goal; responsive layout does not change access rights.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [teamwork.php · data-teamwork-page](../../../frontend/src/views/planning/teamwork.php#L1) |
| Browser logic | [teamwork-page.js · export function initTeamworkPage](../../../frontend/src/js/planning/teamwork-page.js#L91)<br>[teamwork-page.js · export function filterTeamGoals](../../../frontend/src/js/planning/teamwork-page.js#L19) |
| Controller / service / domain | [TeamService.php · public function show(](../../../backend/src/Application/Teamwork/TeamService.php#L102) |
| Persistence | [PdoTeamRepository.php · public function goalsFor(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L47)<br>[PdoTeamRepository.php · public function goal(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L22)<br>[PdoTeamRepository.php · public function updateGoal(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L32) |
| Relevant tests (not a pass claim) | [teamwork.test.js · team goal search](../../../frontend/tests/js/teamwork.test.js#L10)<br>[teamwork.test.js · carousel shows](../../../frontend/tests/js/teamwork.test.js#L26) |
| HTTP | `GET /api/v1/team-goals` (`api.team-goals.index`) → [TeamController::index](../../../backend/src/Http/Controller/TeamController.php#L20)<br>`POST /api/v1/team-goals` (`api.team-goals.store`) → [TeamController::store](../../../backend/src/Http/Controller/TeamController.php#L31)<br>`GET /api/v1/team-goals/{id}` (`api.team-goals.show`) → [TeamController::show](../../../backend/src/Http/Controller/TeamController.php#L37)<br>`PATCH /api/v1/team-goals/{id}` (`api.team-goals.update`) → [TeamController::update](../../../backend/src/Http/Controller/TeamController.php#L43)<br>`DELETE /api/v1/team-goals/{id}` (`api.team-goals.archive`) → [TeamController::archive](../../../backend/src/Http/Controller/TeamController.php#L49) |

### Invite, accept/decline, role, remove and completion

**Trace ID:** `teamwork.members`

Members have admin/member/viewer roles. Team admins manage membership; the creator cannot be removed/demoted by the normal flow. Member biography and factual done/assigned counts are shown. A locked account stays a member, shown as Locked, keeps the work already assigned to it and cannot be chosen for new work.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [teamwork.php · data-team-invite&gt;](../../../frontend/src/views/planning/teamwork.php#L160) |
| Browser logic | [teamwork-page.js · root.querySelector('&#91;data-team-invite&#93;')](../../../frontend/src/js/planning/teamwork-page.js#L105) |
| Controller / service / domain | [TeamService.php · public function invite(](../../../backend/src/Application/Teamwork/TeamService.php#L137)<br>[TeamService.php · public function changeRole(](../../../backend/src/Application/Teamwork/TeamService.php#L151) |
| Persistence | [PdoTeamRepository.php · public function members(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L81)<br>[PdoTeamRepository.php · public function insertMember(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L64)<br>[PdoTeamRepository.php · public function updateMember(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L90)<br>[PdoTeamRepository.php · public function deleteMember(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L104) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_teamwork_roles_tasks_chat_and_member_isolation(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L161) |
| HTTP | `POST /api/v1/team-goals/{id}/members` (`api.team-goals.members.store`) → [TeamController::invite](../../../backend/src/Http/Controller/TeamController.php#L57)<br>`PATCH /api/v1/team-goals/{id}/members/{member}` (`api.team-goals.members.update`) → [TeamController::changeRole](../../../backend/src/Http/Controller/TeamController.php#L70)<br>`DELETE /api/v1/team-goals/{id}/members/{member}` (`api.team-goals.members.destroy`) → [TeamController::removeMember](../../../backend/src/Http/Controller/TeamController.php#L79)<br>`POST /api/v1/team-goals/{id}/invitation/{action}` (`api.team-goals.respond`) → [TeamController::respond](../../../backend/src/Http/Controller/TeamController.php#L87) |

### Assigned Task capture, status, due/reminder and repeat

**Trace ID:** `teamwork.tasks`

Team members/admins may create Tasks; assignment is team-scoped. An assignee, including a viewer, may change only their own status through the allowed status-only path. Personal TaskSeries logic does not run here.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [teamwork.php · data-teamwork-page](../../../frontend/src/views/planning/teamwork.php#L1) |
| Browser logic | [teamwork-page.js · export function teamTaskPayload](../../../frontend/src/js/planning/teamwork-page.js#L52) |
| Controller / service / domain | [TeamService.php · public function updateTask(](../../../backend/src/Application/Teamwork/TeamService.php#L256)<br>[TeamTaskRepeat.php · public static function next(](../../../backend/src/Domain/Teamwork/TeamTaskRepeat.php#L59) |
| Persistence | [PdoTeamRepository.php · public function tasks(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L129)<br>[PdoTeamRepository.php · public function insertTask(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L112)<br>[PdoTeamRepository.php · public function updateTask(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L162) |
| Relevant tests (not a pass claim) | [teamwork.test.js · team task payload](../../../frontend/tests/js/teamwork.test.js#L31)<br>[TeamTaskRepeatTest.php · public function test_next_dates_follow_each_frequency_and_stop_after_the_end_date(](../../../backend/tests/Plain/Unit/TeamTaskRepeatTest.php#L13) |
| HTTP | `POST /api/v1/team-goals/{id}/tasks` (`api.team-goals.tasks.store`) → [TeamController::createTask](../../../backend/src/Http/Controller/TeamController.php#L96)<br>`PATCH /api/v1/team-goals/{id}/tasks/{task}` (`api.team-goals.tasks.update`) → [TeamController::updateTask](../../../backend/src/Http/Controller/TeamController.php#L102)<br>`DELETE /api/v1/team-goals/{id}/tasks/{task}` (`api.team-goals.tasks.archive`) → [TeamController::archiveTask](../../../backend/src/Http/Controller/TeamController.php#L108) |

### Team chat and polling

**Trace ID:** `teamwork.chat`

Messages are plain text, 1–2000 characters. The open chat polls every 5 seconds; this is not WebSocket collaboration. Chat/reminder notifications are user-scoped.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [teamwork.php · data-teamwork-page](../../../frontend/src/views/planning/teamwork.php#L1) |
| Browser logic | [teamwork-page.js · 5000](../../../frontend/src/js/planning/teamwork-page.js#L12) |
| Controller / service / domain | [TeamService.php · public function postMessage(](../../../backend/src/Application/Teamwork/TeamService.php#L314) |
| Persistence | [PdoTeamRepository.php · public function insertMessage(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L176)<br>[PdoTeamRepository.php · public function messages(](../../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php#L185) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_teamwork_roles_tasks_chat_and_member_isolation(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L161) |
| HTTP | `GET /api/v1/team-goals/{id}/messages` (`api.team-goals.messages.index`) → [TeamController::messages](../../../backend/src/Http/Controller/TeamController.php#L114)<br>`POST /api/v1/team-goals/{id}/messages` (`api.team-goals.messages.store`) → [TeamController::postMessage](../../../backend/src/Http/Controller/TeamController.php#L125) |

<!-- END GENERATED TRACE -->
