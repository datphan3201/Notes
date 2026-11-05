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
| Controller / service / domain | [AccountController.php · public function login(](../../../backend/src/Http/Controller/AccountController.php#L45)<br>[AuthService.php · public function attempt(](../../../backend/src/Application/Account/AuthService.php#L79) |
| Persistence | [PdoAccountRepository.php · public function findByEmail(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L16) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_login_errors_are_generic_and_account_bucket_throttles_after_five_failures(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L236) |
| HTTP | `GET /login` (`login`) → [AccountController::loginPage](../../../backend/src/Http/Controller/AccountController.php#L36)<br>`POST /login` (`login.store`) → [AccountController::login](../../../backend/src/Http/Controller/AccountController.php#L45) |

### /register — Create account

**Trace ID:** `auth.register`

Registration creates owned preferences/default Areas transactionally, stores guest language, sends a verification link and establishes the normal session. Public registration does not grant system-admin role. An administrator decides who may register: Anyone with the link (default), Only invited emails, or Nobody. By invitation, the email must be on the admin's invitation list, and each invitation creates one account; closed hides the form and the Login page's sign-up link. The server enforces the mode inside the registration transaction.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [register.php · name="email"](../../../frontend/src/views/auth/register.php#L20) |
| Browser logic | [password-visibility.js · export function initPasswordVisibility](../../../frontend/src/js/lib/password-visibility.js#L35) |
| Controller / service / domain | [AccountController.php · public function register(](../../../backend/src/Http/Controller/AccountController.php#L80)<br>[AuthService.php · public function register(](../../../backend/src/Application/Account/AuthService.php#L38)<br>[RegistrationPolicy.php · public function assertAllowed(](../../../backend/src/Application/Account/RegistrationPolicy.php#L28) |
| Persistence | [PdoAccountRepository.php · public function insertUser(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L33) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57)<br>[SystemAdminHttpTest.php · public function test_registration_mode_and_invitations_decide_who_can_create_an_account(](../../../backend/tests/Plain/Http/SystemAdminHttpTest.php#L53) |
| HTTP | `GET /register` (`register`) → [AccountController::registerPage](../../../backend/src/Http/Controller/AccountController.php#L71)<br>`POST /register` (`register.store`) → [AccountController::register](../../../backend/src/Http/Controller/AccountController.php#L80) |

### Logout and account/session changes

**Trace ID:** `auth.logout`

Logout is POST with CSRF. Clear this account/tab recovery state and notify other tabs; do not erase unrelated browser storage.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-leave-guard-form](../../../frontend/src/views/layouts/app.php#L95) |
| Browser logic | [app.js · new BroadcastChannel(](../../../frontend/src/js/app.js#L61) |
| Controller / service / domain | [AccountController.php · public function logout(](../../../backend/src/Http/Controller/AccountController.php#L99)<br>[AuthService.php · public function logout(](../../../backend/src/Application/Account/AuthService.php#L180)<br>[SessionManager.php · public function invalidate(](../../../backend/src/Infrastructure/Session/SessionManager.php#L94) |
| Persistence | [PdoSessionHandler.php · public function destroy(](../../../backend/src/Infrastructure/Session/PdoSessionHandler.php#L104) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57) |
| HTTP | `POST /logout` (`logout`) → [AccountController::logout](../../../backend/src/Http/Controller/AccountController.php#L99) |

<!-- END GENERATED TRACE -->

## Additional auth screens

- [Forgot/reset password](recovery.md)
- [Email verification/change callbacks](email.md)
- [Two-factor challenge](two-factor.md)
