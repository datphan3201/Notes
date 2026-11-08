# /admin — System reports, users and settings

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

System admins are assigned by the server console, not registration. Ordinary accounts receive 404. Admin access to a report exposes its snapshot, not the live private Note.

Administration exists because accounts are created by people the operator may not know, Notes are shared by email, Teams invite others and users can report each other. Its controls are therefore registration (who may create an account), moderation that acts (withdraw a shared Note, warn, lock) and an activity record of every administrator action. It never reads private planning data.

<!-- BEGIN GENERATED TRACE -->

### Open/resolved reports and resolution

**Trace ID:** `admin.reports`

List report snapshots, reason, reporter/owner (with lock state) and date. An open report has a resolution form: choose actions — Stop sharing this note with everyone (removes every share, including pending invitations), Warn the owner (an always-delivered notification that never names the reporter) and Lock the owner’s account — add an optional reply, then Resolve or Dismiss. Resolve requires at least one action unless the owner is already locked; Dismiss takes none. The reporter is told “reviewed and action was taken” or “reviewed. No action was needed” accordingly. The actions taken are stored with the report and shown as chips once handled, and each one is recorded in Administrator activity.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-reports](../../../frontend/src/views/admin/index.php#L21) |
| Browser logic | [admin-page.js · export function initAdminPage](../../../frontend/src/js/admin/admin-page.js#L98) |
| Controller / service / domain | [ReportService.php · public function list(](../../../backend/src/Application/Admin/ReportService.php#L70)<br>[ReportService.php · public function resolve(](../../../backend/src/Application/Admin/ReportService.php#L92)<br>[ReportOutcome.php · public static function assertConsistent(](../../../backend/src/Application/Admin/ReportOutcome.php#L17)<br>[NoteShareService.php · public function revokeAll(](../../../backend/src/Application/Notes/NoteShareService.php#L240) |
| Persistence | [PdoReportRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L23)<br>[PdoReportRepository.php · public function resolve(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php#L52) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L101)<br>[SystemAdminHttpTest.php · public function test_resolving_a_note_report_takes_the_chosen_action_and_tells_the_reporter(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L97) |
| HTTP | `GET /api/v1/admin/reports` (`api.admin.reports`) → [AdminController::reports](../../../backend/src/Http/Controller/AdminController.php#L35)<br>`POST /api/v1/admin/reports/{id}/resolve` (`api.admin.reports.resolve`) → [AdminController::resolve](../../../backend/src/Http/Controller/AdminController.php#L47) |

### User reports with image evidence

**Trace ID:** `admin.user-reports`

List reports filed from Settings: reported email, matched account (or none), reporter, reason and evidence thumbnails served only to admins. Resolve with Warn this account and/or Lock this account (or because the account is already locked), or Dismiss with no action; an optional reply goes to the reporter, whose notification says whether action was taken. A report whose email matches no account can only be dismissed. Actions are stored with the report and recorded in Administrator activity.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-user-reports](../../../frontend/src/views/admin/index.php#L35) |
| Browser logic | [admin-page.js · const loadUserReports](../../../frontend/src/js/admin/admin-page.js#L227) |
| Controller / service / domain | [UserReportService.php · public function list(](../../../backend/src/Application/Admin/UserReportService.php#L127)<br>[UserReportService.php · public function resolve(](../../../backend/src/Application/Admin/UserReportService.php#L159)<br>[UserReportService.php · public function evidence(](../../../backend/src/Application/Admin/UserReportService.php#L202) |
| Persistence | [PdoUserReportRepository.php · public function list(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L53)<br>[PdoUserReportRepository.php · public function evidencePath(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L89) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_user_reports_with_image_evidence_are_private_to_administrators(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L304)<br>[SystemAdminHttpTest.php · public function test_user_reports_can_lock_the_reported_account(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L169) |
| HTTP | `GET /api/v1/admin/user-reports` (`api.admin.user-reports`) → [UserReportController::index](../../../backend/src/Http/Controller/UserReportController.php#L43)<br>`POST /api/v1/admin/user-reports/{id}/resolve` (`api.admin.user-reports.resolve`) → [UserReportController::resolve](../../../backend/src/Http/Controller/UserReportController.php#L55)<br>`GET /admin/user-reports/{id}/evidence/{position}` (`admin.user-reports.evidence`) → [UserReportController::evidence](../../../backend/src/Http/Controller/UserReportController.php#L78) |

### Search users, lock/unlock

**Trace ID:** `admin.users`

Locking bumps auth_version and deletes sessions; locked users cannot sign in or keep existing sessions. It also hides the Notes they shared from every recipient; unlocking restores shared Note access. The list shows who locked an account and why. Self-lock is rejected, and administrators cannot be locked here: the role is granted and removed only with the server console (users:role), so one administrator cannot shut another out.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-users](../../../frontend/src/views/admin/index.php#L43) |
| Browser logic | [admin-page.js · data-admin-user-search](../../../frontend/src/js/admin/admin-page.js#L104) |
| Controller / service / domain | [AccountLockService.php · public function lock(](../../../backend/src/Application/Admin/AccountLockService.php#L30)<br>[ReportService.php · public function setLocked(](../../../backend/src/Application/Admin/ReportService.php#L136) |
| Persistence | [PdoAccountRepository.php · public function adminUserList(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L327)<br>[PdoAccountRepository.php · public function setLocked(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L278)<br>[PdoAccountRepository.php · public function deleteSessions(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L336) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L101)<br>[SystemAdminHttpTest.php · public function test_locking_hides_shared_notes_records_the_admin_and_spares_administrators(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L141) |
| HTTP | `GET /api/v1/admin/users` (`api.admin.users`) → [AdminController::users](../../../backend/src/Http/Controller/AdminController.php#L69)<br>`POST /api/v1/admin/users/{id}/{action}` (`api.admin.users.lock`) → [AdminController::lock](../../../backend/src/Http/Controller/AdminController.php#L78) |

### System Task history limit

**Trace ID:** `admin.history`

The admin can set the history cap (100–10000, default 1000). The history maintenance job applies it in addition to per-user retention. It archives Tasks, not hard-deletes them.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-settings](../../../frontend/src/views/admin/index.php#L71) |
| Browser logic | [admin-page.js · data-admin-settings](../../../frontend/src/js/admin/admin-page.js#L106) |
| Controller / service / domain | [TaskHistoryService.php · public function prune(](../../../backend/src/Application/Planning/TaskHistoryService.php#L30) |
| Persistence | [PdoSystemSettingRepository.php · public function historyLimit(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoSystemSettingRepository.php#L22)<br>[PdoSystemSettingRepository.php · public function setHistoryLimit(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoSystemSettingRepository.php#L31) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_reports_reach_admins_and_locked_accounts_lose_access(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L101) |
| HTTP | `GET /api/v1/admin/settings` (`api.admin.settings`) → [AdminController::settings](../../../backend/src/Http/Controller/AdminController.php#L93)<br>`PATCH /api/v1/admin/settings` (`api.admin.settings.update`) → [AdminController::updateSettings](../../../backend/src/Http/Controller/AdminController.php#L100) |

### Registration mode and invitations

**Trace ID:** `admin.registration`

Registration sets who can create an account: Anyone with the link, Only invited emails or Nobody (closed). Invited emails are listed with Waiting for sign-up or Account created and who used them; an unused invitation can be removed, and an email that already has an account cannot be invited. The operator can set the same mode with php bin/console registration:mode [open|invite|closed] before exposing a new host. Every change is recorded in Administrator activity.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-registration](../../../frontend/src/views/admin/index.php#L47)<br>[index.php · data-admin-invite-form](../../../frontend/src/views/admin/index.php#L59) |
| Browser logic | [admin-page.js · const renderInvites = (invites) =&gt;](../../../frontend/src/js/admin/admin-page.js#L342) |
| Controller / service / domain | [ReportService.php · public function invite(](../../../backend/src/Application/Admin/ReportService.php#L199)<br>[RegistrationPolicy.php · final readonly class RegistrationPolicy](../../../backend/src/Application/Account/RegistrationPolicy.php#L12) |
| Persistence | [PdoRegistrationInviteRepository.php · public function markUsed(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoRegistrationInviteRepository.php#L49)<br>[PdoSystemSettingRepository.php · public function registrationMode(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoSystemSettingRepository.php#L36)<br>[0030_add_system_admin_controls.php · CREATE TABLE registration_invites](../../../backend/database/plain-migrations/0030_add_system_admin_controls.php#L42) |
| Relevant tests (not a pass claim) | [SystemAdminHttpTest.php · public function test_registration_mode_and_invitations_decide_who_can_create_an_account(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L53)<br>[SystemAdminHttpTest.php · public function test_console_commands_change_roles_and_registration_and_are_recorded(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L184) |
| HTTP | `PATCH /api/v1/admin/settings` (`api.admin.settings.update`) → [AdminController::updateSettings](../../../backend/src/Http/Controller/AdminController.php#L100)<br>`GET /api/v1/admin/registration-invites` (`api.admin.invites`) → [AdminController::invites](../../../backend/src/Http/Controller/AdminController.php#L135)<br>`POST /api/v1/admin/registration-invites` (`api.admin.invites.store`) → [AdminController::invite](../../../backend/src/Http/Controller/AdminController.php#L142)<br>`DELETE /api/v1/admin/registration-invites` (`api.admin.invites.destroy`) → [AdminController::removeInvite](../../../backend/src/Http/Controller/AdminController.php#L149) |

### Administrator activity

**Trace ID:** `admin.activity`

An append-only record of administration, newest first (100 entries): locks and unlocks, warnings, withdrawn shares, report resolutions and dismissals, setting changes, invitations, and role or registration changes made with the server console (shown as Server console). Each entry has the time, the actor and a short summary; it never stores report evidence or Note content.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [index.php · data-admin-activity](../../../frontend/src/views/admin/index.php#L88) |
| Browser logic | [admin-page.js · const loadActivity = async () =&gt;](../../../frontend/src/js/admin/admin-page.js#L387) |
| Controller / service / domain | [AdminActionLog.php · public function record(](../../../backend/src/Application/Admin/AdminActionLog.php#L18) |
| Persistence | [PdoAdminActionRepository.php · public function recent(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoAdminActionRepository.php#L30)<br>[0030_add_system_admin_controls.php · CREATE TABLE admin_actions](../../../backend/database/plain-migrations/0030_add_system_admin_controls.php#L28) |
| Relevant tests (not a pass claim) | [SystemAdminHttpTest.php · public function test_locking_hides_shared_notes_records_the_admin_and_spares_administrators(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L141)<br>[SystemAdminHttpTest.php · public function test_console_commands_change_roles_and_registration_and_are_recorded(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L184) |
| HTTP | `GET /api/v1/admin/actions` (`api.admin.actions`) → [AdminController::actions](../../../backend/src/Http/Controller/AdminController.php#L128) |

### Delete an account

**Trace ID:** `admin.users.delete`

Beside Lock, Delete account removes an ordinary account for good after the administrator types its email (case and spaces ignored). Administrators, including oneself, cannot be deleted here. Everything the account owns goes, with its files; so do its shares with others. Reports about it and administrator history stay with the link cleared. Recorded in Administrator activity as Deleted an account.

| Layer | Entry point |
| --- | --- |
| Browser logic | [admin-page.js · const deleteButton = (account) =&gt;](../../../frontend/src/js/admin/admin-page.js#L142) |
| Controller / service / domain | [AccountDeletionService.php · public function deleteByAdmin(](../../../backend/src/Application/Account/AccountDeletionService.php#L52)<br>[AccountDeletionController.php · public function admin(](../../../backend/src/Http/Controller/AccountDeletionController.php#L36) |
| Persistence | [PdoCascadeDeleter.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/PdoCascadeDeleter.php#L42) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_an_administrator_deletes_an_ordinary_account_after_typing_its_email(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L391) |
| HTTP | `DELETE /api/v1/admin/users/{id}` (`api.admin.users.delete`) → [AccountDeletionController::admin](../../../backend/src/Http/Controller/AccountDeletionController.php#L36) |

<!-- END GENERATED TRACE -->
