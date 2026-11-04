# /settings/reports — Report a user

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Any signed-in user can report another person's behaviour to the system administrators. The person is named by email; the reporter gets the same answer whether or not that email has an account, so the form cannot reveal who is registered. Evidence images are re-encoded to JPEG (metadata such as GPS removed), stored in private storage under `reports/` and served only to administrators, who review the report in [Administration](../admin/README.md). `files:prune` keeps every referenced evidence image; images of reports deleted with the reporter's account become orphans and are pruned.

<!-- BEGIN GENERATED TRACE -->

### Report form with image evidence

**Trace ID:** `user-reports.form`

The reporter names a person by email, describes the problem (10–2000 characters) and may attach up to 3 JPEG/PNG/WebP images (5 MB each, re-encoded to JPEG without metadata). The answer is identical whether or not the email has an account. Self-reports and a second open report about the same email are rejected.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [reports.php · data-user-report-form](../../../frontend/src/views/settings/reports.php#L10) |
| Browser logic | [user-reports.js · export function initUserReports](../../../frontend/src/js/settings/user-reports.js#L25)<br>[user-reports.js · export function evidenceProblem](../../../frontend/src/js/settings/user-reports.js#L9) |
| Controller / service / domain | [UserReportService.php · public function report(](../../../backend/src/Application/Admin/UserReportService.php#L46)<br>[ImageNormalizer.php · public function jpeg(](../../../backend/src/Application/Files/ImageNormalizer.php#L17) |
| Persistence | [PdoUserReportRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L16)<br>[PdoUserReportRepository.php · public function insertEvidence(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L22) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_user_reports_with_image_evidence_are_private_to_administrators(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L304) |
| HTTP | `GET /settings/reports` (`settings.reports`) → [AccountController::settingsPage](../../../backend/src/Http/Controller/AccountController.php#L172)<br>`POST /api/v1/user-reports` (`api.user-reports.store`) → [UserReportController::store](../../../backend/src/Http/Controller/UserReportController.php#L27) |

### The reporter's own reports and replies

**Trace ID:** `user-reports.mine`

Lists the reporter's reports with status and the administrator reply; never shows whether the email matched an account.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [reports.php · data-user-report-list](../../../frontend/src/views/settings/reports.php#L34) |
| Browser logic | [user-reports.js · const loadReports](../../../frontend/src/js/settings/user-reports.js#L47) |
| Controller / service / domain | [UserReportService.php · public function mine(](../../../backend/src/Application/Admin/UserReportService.php#L111) |
| Persistence | [PdoUserReportRepository.php · public function forReporter(](../../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoUserReportRepository.php#L37) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_user_reports_with_image_evidence_are_private_to_administrators(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L304) |
| HTTP | `GET /api/v1/user-reports` (`api.user-reports.index`) → [UserReportController::mine](../../../backend/src/Http/Controller/UserReportController.php#L38) |

<!-- END GENERATED TRACE -->
