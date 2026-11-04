# Authentication routes

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Guest pages use the guest layout and session language selection (`?lang=en|vi`). Registration and successful sign-in land on Dashboard. Use the canonical APP_URL host to avoid an intentional CSRF-origin rejection.

<!-- BEGIN GENERATED TRACE -->

### /login — Sign in

**Trace ID:** `auth.login`

Generic failures do not reveal whether an email exists. Password visibility is a shared client helper. Rate limits apply by email/IP and IP; locked accounts cannot authenticate.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [login.php · name="email"](../../../frontend/src/views/auth/login.php#L9) |
| Browser logic | [password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [AccountController.php · public function login(](../../../backend/src/Http/Controller/AccountController.php#L43)<br>[AuthService.php · public function attempt(](../../../backend/src/Application/Account/AuthService.php#L76) |
| Persistence | [PdoAccountRepository.php · public function findByEmail(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L16) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_login_errors_are_generic_and_account_bucket_throttles_after_five_failures(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L236) |
| HTTP | `GET /login` (`login`) → [AccountController::loginPage](../../../backend/src/Http/Controller/AccountController.php#L34)<br>`POST /login` (`login.store`) → [AccountController::login](../../../backend/src/Http/Controller/AccountController.php#L43) |

### /register — Create account

**Trace ID:** `auth.register`

Registration creates owned preferences/default Areas transactionally, stores guest language, sends a verification link and establishes the normal session. Public registration does not grant system-admin role.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [register.php · name="email"](../../../frontend/src/views/auth/register.php#L16) |
| Browser logic | [password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [AccountController.php · public function register(](../../../backend/src/Http/Controller/AccountController.php#L78)<br>[AuthService.php · public function register(](../../../backend/src/Application/Account/AuthService.php#L37) |
| Persistence | [PdoAccountRepository.php · public function insertUser(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L33) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57) |
| HTTP | `GET /register` (`register`) → [AccountController::registerPage](../../../backend/src/Http/Controller/AccountController.php#L69)<br>`POST /register` (`register.store`) → [AccountController::register](../../../backend/src/Http/Controller/AccountController.php#L78) |

### Logout and account/session changes

**Trace ID:** `auth.logout`

Logout is POST with CSRF. Clear this account/tab recovery state and notify other tabs; do not erase unrelated browser storage.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-leave-guard-form](../../../frontend/src/views/layouts/app.php#L88) |
| Browser logic | [app.js · new BroadcastChannel(](../../../frontend/src/js/app.js#L58) |
| Controller / service / domain | [AccountController.php · public function logout(](../../../backend/src/Http/Controller/AccountController.php#L97)<br>[AuthService.php · public function logout(](../../../backend/src/Application/Account/AuthService.php#L177)<br>[SessionManager.php · public function invalidate(](../../../backend/src/Infrastructure/Session/SessionManager.php#L94) |
| Persistence | [PdoSessionHandler.php · public function destroy(](../../../backend/src/Infrastructure/Session/PdoSessionHandler.php#L104) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57) |
| HTTP | `POST /logout` (`logout`) → [AccountController::logout](../../../backend/src/Http/Controller/AccountController.php#L97) |

<!-- END GENERATED TRACE -->

## Additional auth screens

- [Forgot/reset password](recovery.md)
- [Email verification/change callbacks](email.md)
- [Two-factor challenge](two-factor.md)
