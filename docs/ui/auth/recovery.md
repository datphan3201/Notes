# /forgot-password and /reset-password — Account recovery

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Use the actual link from mail. The attached editor snapshots are read-only references and are not documentation sources; source links below target the live repository.

<!-- BEGIN GENERATED TRACE -->

### Forgot password and reset form

**Trace ID:** `auth.recovery`

Known/unknown valid emails receive the same response. A reset has a hashed token, 30-minute expiry and single-use semantics. Reset changes password, auth_version and sessions atomically; it does not automatically log in.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [recovery.php · &lt;form](../../../frontend/src/views/auth/recovery.php#L8) |
| Browser logic | [password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [PasswordResetService.php · public function request(](../../../backend/src/Application/Account/PasswordResetService.php#L31)<br>[PasswordResetService.php · public function reset(](../../../backend/src/Application/Account/PasswordResetService.php#L57) |
| Persistence | [PdoPasswordResetRepository.php · public function replace(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L15)<br>[PdoPasswordResetRepository.php · public function lock(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L22)<br>[PdoPasswordResetRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L30) |
| Relevant tests (not a pass claim) | [FeedbackMaintenanceTest.php · public function test_reset_replaces_token_expires_and_invalidates_sessions(](../../../backend/tests/Plain/Integration/FeedbackMaintenanceTest.php#L35) |
| HTTP | `GET /forgot-password` (`password.forgot`) → [PasswordResetController::page](../../../backend/src/Http/Controller/PasswordResetController.php#L21)<br>`POST /forgot-password` (`password.forgot.store`) → [PasswordResetController::request](../../../backend/src/Http/Controller/PasswordResetController.php#L39)<br>`GET /reset-password` (`password.reset`) → [PasswordResetController::page](../../../backend/src/Http/Controller/PasswordResetController.php#L21)<br>`POST /reset-password` (`password.reset.store`) → [PasswordResetController::reset](../../../backend/src/Http/Controller/PasswordResetController.php#L51) |

<!-- END GENERATED TRACE -->


