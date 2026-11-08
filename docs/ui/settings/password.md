# /settings/password — Security

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: Settings → Security. Password changes and enabling/disabling 2FA can invalidate sessions; test with disposable accounts and restore access deliberately.

<!-- BEGIN GENERATED TRACE -->

### Change password and visibility toggle

**Trace ID:** `security.password`

Require current password and exact confirmation, at least 10 code points, at most 72 bytes, no NUL. A successful change bumps auth_version and deletes sessions atomically; redirect to sign in.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [password.php · data-password-form](../../../frontend/src/views/settings/password.php#L13) |
| Browser logic | [password.js · export function initPassword](../../../frontend/src/js/settings/password.js#L5)<br>[password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [AuthService.php · public function changePassword(](../../../backend/src/Application/Account/AuthService.php#L185) |
| Persistence | [PdoAccountRepository.php · public function updatePasswordAndVersion(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L239)<br>[PdoAccountRepository.php · public function deleteSessions(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L336) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57) |
| HTTP | `POST /api/v1/password` (`api.password.update`) → [AccountController::changePassword](../../../backend/src/Http/Controller/AccountController.php#L158) |

### Set up email codes or TOTP, confirm and disable

**Trace ID:** `security.twofactor`

TOTP secret is encrypted and setup becomes active only after a valid code. Email codes are hashed, single-use and attempt/expiry limited. Disabling requires the current password. Pending login is separate from an authenticated session.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [password.php · data-two-factor-settings](../../../frontend/src/views/settings/password.php#L35) |
| Browser logic | [two-factor.js · export function initTwoFactor](../../../frontend/src/js/settings/two-factor.js#L10) |
| Controller / service / domain | [TwoFactorService.php · public function beginTotpSetup(](../../../backend/src/Application/Account/TwoFactorService.php#L67)<br>[TwoFactorService.php · public function confirmTotp(](../../../backend/src/Application/Account/TwoFactorService.php#L75)<br>[TwoFactorService.php · public function disable(](../../../backend/src/Application/Account/TwoFactorService.php#L97)<br>[Totp.php · public static function verify(](../../../backend/src/Domain/Account/Totp.php#L31) |
| Persistence | [PdoTwoFactorRepository.php · public function store(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L16)<br>[PdoTwoFactorRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L23)<br>[PdoTwoFactorRepository.php · public function failedAttempt(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L32) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_totp_two_factor_login_requires_a_valid_code(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L137) |
| HTTP | `GET /api/v1/two-factor` (`api.two-factor.show`) → [TwoFactorController::status](../../../backend/src/Http/Controller/TwoFactorController.php#L83)<br>`POST /api/v1/two-factor/totp` (`api.two-factor.totp.begin`) → [TwoFactorController::beginTotp](../../../backend/src/Http/Controller/TwoFactorController.php#L88)<br>`POST /api/v1/two-factor/totp/confirm` (`api.two-factor.totp.confirm`) → [TwoFactorController::confirmTotp](../../../backend/src/Http/Controller/TwoFactorController.php#L95)<br>`POST /api/v1/two-factor/email` (`api.two-factor.email.send`) → [TwoFactorController::sendSetupEmail](../../../backend/src/Http/Controller/TwoFactorController.php#L102)<br>`POST /api/v1/two-factor/email/confirm` (`api.two-factor.email.confirm`) → [TwoFactorController::confirmEmail](../../../backend/src/Http/Controller/TwoFactorController.php#L110)<br>`POST /api/v1/two-factor/disable` (`api.two-factor.disable`) → [TwoFactorController::disable](../../../backend/src/Http/Controller/TwoFactorController.php#L117) |

### Delete my account

**Trace ID:** `security.delete-account`

Settings › Security ends with Delete account: the current password, a tick that the data cannot be recovered and a final confirmation delete the account and everything it owns for good, then the browser returns to sign-in. Administrator accounts see an explanation instead (their role is removed with the server console first). Wrong passwords are refused; the route uses the password-change rate limit.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [password.php · data-account-delete-form](../../../frontend/src/views/settings/password.php#L73) |
| Browser logic | [account-deletion.js · export function initAccountDeletion](../../../frontend/src/js/settings/account-deletion.js#L5) |
| Controller / service / domain | [AccountDeletionService.php · public function deleteOwn(](../../../backend/src/Application/Account/AccountDeletionService.php#L78)<br>[AccountDeletionController.php · public function own(](../../../backend/src/Http/Controller/AccountDeletionController.php#L23) |
| Persistence | [PdoCascadeDeleter.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/PdoCascadeDeleter.php#L42) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_people_delete_their_own_account_with_their_password(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L424) |
| HTTP | `POST /api/v1/account/delete` (`api.account.delete`) → [AccountDeletionController::own](../../../backend/src/Http/Controller/AccountDeletionController.php#L23) |

<!-- END GENERATED TRACE -->
