# /admin — System reports, users and settings

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

System admins are assigned by the server console, not registration or Teamwork. Ordinary accounts receive 404. Admin access to a report exposes its snapshot, not the live private Note.

<!-- BEGIN GENERATED TRACE -->

### Open/resolved reports and resolution

**Trace ID:** `admin.reports`

List report snapshots, reason, reporter/owner and date. Resolve/dismiss with response; notification recipients follow report service rules.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-reports](../../../frontend/src/views/admin/index.php#L20) |
| Browser logic | [admin-page.js · export function initAdminPage](../../../frontend/src/js/admin/admin-page.js#L11) |
| Controller / service / domain | [ReportService.php · public function list(](../../../backend/src/Application/Admin/ReportService.php#L65)<br>[ReportService.php · public function resolve(](../../../backend/src/Application/Admin/ReportService.php#L80) |
| Persistence | [PdoReportRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L23)<br>[PdoReportRepository.php · public function resolve(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L51) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L98) |
| HTTP | `GET /api/v1/admin/reports` (`api.admin.reports`) → [AdminController::reports](../../../backend/src/Http/Controller/AdminController.php#L31)<br>`POST /api/v1/admin/reports/{id}/resolve` (`api.admin.reports.resolve`) → [AdminController::resolve](../../../backend/src/Http/Controller/AdminController.php#L43) |

### User reports with image evidence

**Trace ID:** `admin.user-reports`

List reports filed from Settings: reported email, matched account (or none), reporter, reason and evidence thumbnails served only to admins. Resolve/dismiss once with an optional reply to the reporter; lock the matched account from the card.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-user-reports](../../../frontend/src/views/admin/index.php#L34) |
| Browser logic | [admin-page.js · const loadUserReports](../../../frontend/src/js/admin/admin-page.js#L141) |
| Controller / service / domain | [UserReportService.php · public function list(](../../../backend/src/Application/Admin/UserReportService.php#L124)<br>[UserReportService.php · public function resolve(](../../../backend/src/Application/Admin/UserReportService.php#L149)<br>[UserReportService.php · public function evidence(](../../../backend/src/Application/Admin/UserReportService.php#L169) |
| Persistence | [PdoUserReportRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L53)<br>[PdoUserReportRepository.php · public function evidencePath(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L88) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_user_reports_with_image_evidence_are_private_to_administrators(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L304) |
| HTTP | `GET /api/v1/admin/user-reports` (`api.admin.user-reports`) → [UserReportController::index](../../../backend/src/Http/Controller/UserReportController.php#L42)<br>`POST /api/v1/admin/user-reports/{id}/resolve` (`api.admin.user-reports.resolve`) → [UserReportController::resolve](../../../backend/src/Http/Controller/UserReportController.php#L54)<br>`GET /admin/user-reports/{id}/evidence/{position}` (`admin.user-reports.evidence`) → [UserReportController::evidence](../../../backend/src/Http/Controller/UserReportController.php#L76) |

### Search users, lock/unlock

**Trace ID:** `admin.users`

Locking bumps auth_version and deletes sessions; locked users cannot sign in or keep existing sessions. Self-lock is rejected. Team roles do not grant these endpoints.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-users](../../../frontend/src/views/admin/index.php#L41) |
| Browser logic | [admin-page.js · data-admin-user-search](../../../frontend/src/js/admin/admin-page.js#L17) |
| Controller / service / domain | [ReportService.php · public function setLocked(](../../../backend/src/Application/Admin/ReportService.php#L99) |
| Persistence | [PdoAccountRepository.php · public function adminUserList(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L327)<br>[PdoAccountRepository.php · public function setLocked(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L278)<br>[PdoAccountRepository.php · public function deleteSessions(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L336) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L98) |
| HTTP | `GET /api/v1/admin/users` (`api.admin.users`) → [AdminController::users](../../../backend/src/Http/Controller/AdminController.php#L64)<br>`POST /api/v1/admin/users/{id}/{action}` (`api.admin.users.lock`) → [AdminController::lock](../../../backend/src/Http/Controller/AdminController.php#L73) |

### System Task history limit

**Trace ID:** `admin.history`

The admin can set the history cap (100–10000, default 1000). The history maintenance job applies it in addition to per-user retention. It archives Tasks, not hard-deletes them.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-settings](../../../frontend/src/views/admin/index.php#L45) |
| Browser logic | [admin-page.js · data-admin-settings](../../../frontend/src/js/admin/admin-page.js#L19) |
| Controller / service / domain | [TaskHistoryService.php · public function prune(](../../../backend/src/Application/Planning/TaskHistoryService.php#L30) |
| Persistence | [PdoSystemSettingRepository.php · public function historyLimit(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoSystemSettingRepository.php#L18)<br>[PdoSystemSettingRepository.php · public function setHistoryLimit(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoSystemSettingRepository.php#L27) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L98) |
| HTTP | `GET /api/v1/admin/settings` (`api.admin.settings`) → [AdminController::settings](../../../backend/src/Http/Controller/AdminController.php#L88)<br>`PATCH /api/v1/admin/settings` (`api.admin.settings.update`) → [AdminController::updateSettings](../../../backend/src/Http/Controller/AdminController.php#L95) |

<!-- END GENERATED TRACE -->
