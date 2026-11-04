# /forgot-password and /reset-password — Account recovery

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

The email carries a link and a 6-digit code: open the link, or enter the code under **Have a code from the email?** on /forgot-password to continue to the new-password form. Use the actual link or code from mail. The attached editor snapshots are read-only references and are not documentation sources; source links below target the live repository.

<!-- BEGIN GENERATED TRACE -->

### Forgot password and reset form

**Trace ID:** `auth.recovery`

Known/unknown valid emails receive the same response. The email carries a link and a 6-digit code; either leads to the new-password form. Tokens and codes are stored hashed, expire after 30 minutes and are single-use; a code dies after five wrong guesses. Reset changes password, auth_version and sessions atomically; it does not automatically log in.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [recovery.php · action="&lt;?= $reset ? '/reset-password' : '/forgot-password' ?&gt;"](../../../frontend/src/views/auth/recovery.php#L8)<br>[recovery.php · action="/forgot-password/code"](../../../frontend/src/views/auth/recovery.php#L20) |
| Browser logic | [password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [PasswordResetService.php · public function request(](../../../backend/src/Application/Account/PasswordResetService.php#L31)<br>[PasswordResetService.php · public function reset(](../../../backend/src/Application/Account/PasswordResetService.php#L97)<br>[PasswordResetService.php · public function verifyCode(](../../../backend/src/Application/Account/PasswordResetService.php#L63) |
| Persistence | [PdoPasswordResetRepository.php · public function replace(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L15)<br>[PdoPasswordResetRepository.php · public function lock(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L22)<br>[PdoPasswordResetRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoPasswordResetRepository.php#L47) |
| Relevant tests (not a pass claim) | [FeedbackMaintenanceTest.php · public function test_reset_replaces_token_expires_and_invalidates_sessions(](../../../backend/tests/Plain/Integration/FeedbackMaintenanceTest.php#L35)<br>[FeedbackMaintenanceTest.php · reset code](../../../backend/tests/Plain/Integration/FeedbackMaintenanceTest.php#L71) |
| HTTP | `GET /forgot-password` (`password.forgot`) → [PasswordResetController::page](../../../backend/src/Http/Controller/PasswordResetController.php#L21)<br>`POST /forgot-password` (`password.forgot.store`) → [PasswordResetController::request](../../../backend/src/Http/Controller/PasswordResetController.php#L40)<br>`GET /reset-password` (`password.reset`) → [PasswordResetController::page](../../../backend/src/Http/Controller/PasswordResetController.php#L21)<br>`POST /reset-password` (`password.reset.store`) → [PasswordResetController::reset](../../../backend/src/Http/Controller/PasswordResetController.php#L72)<br>`POST /forgot-password/code` (`password.forgot.code`) → [PasswordResetController::verifyCode](../../../backend/src/Http/Controller/PasswordResetController.php#L54) |

<!-- END GENERATED TRACE -->
