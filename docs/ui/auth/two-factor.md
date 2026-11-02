# /two-factor — Pending login challenge

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

A successful password check may create only a pending identity. The session is fully authenticated after the challenge succeeds.

<!-- BEGIN GENERATED TRACE -->

### Verify TOTP/email code or request fallback

**Trace ID:** `auth.twofactor`

TOTP permits the configured time-step window. Email fallback uses a hashed, expiring, limited-attempt code. The challenge cannot be bypassed by loading a protected page directly.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [two-factor.php · &lt;form class="stack-form" method="post" action="/two-factor"&gt;](../../../frontend/src/views/auth/two-factor.php#L8) |
| Controller / service / domain | [TwoFactorController.php · public function verify(](../../../backend/src/Http/Controller/TwoFactorController.php#L51)<br>[TwoFactorService.php · public function verify(](../../../backend/src/Application/Account/TwoFactorService.php#L50) |
| Persistence | [PdoTwoFactorRepository.php · public function find(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L23)<br>[PdoTwoFactorRepository.php · public function failedAttempt(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L32)<br>[PdoTwoFactorRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoTwoFactorRepository.php#L37) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_totp_two_factor_login_requires_a_valid_code(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L134) |
| HTTP | `GET /two-factor` (`two-factor`) → [TwoFactorController::page](../../../backend/src/Http/Controller/TwoFactorController.php#L27)<br>`POST /two-factor` (`two-factor.verify`) → [TwoFactorController::verify](../../../backend/src/Http/Controller/TwoFactorController.php#L51)<br>`POST /two-factor/email` (`two-factor.email`) → [TwoFactorController::sendEmail](../../../backend/src/Http/Controller/TwoFactorController.php#L70) |

<!-- END GENERATED TRACE -->


