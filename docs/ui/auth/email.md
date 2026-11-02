# /verify-email and /confirm-email — Email link results

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

These GET callbacks consume server-issued tokens; they are not arbitrary navigation targets. Profile supplies resend/change controls. Use local private mail-outbox files only for local testing.

<!-- BEGIN GENERATED TRACE -->

### Email verification and address-change confirmation

**Trace ID:** `auth.email`

Verification links expire after 24h; address-change links after 1h. The service validates ownership/purpose/expiry before applying changes. Invalid/expired links render 422. Never copy live tokens into examples.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [email-result.php · &lt;section](../../../frontend/src/views/auth/email-result.php#L1) |
| Controller / service / domain | [EmailVerificationService.php · public function verify(](../../../backend/src/Application/Account/EmailVerificationService.php#L68)<br>[EmailVerificationService.php · public function confirmChange(](../../../backend/src/Application/Account/EmailVerificationService.php#L110) |
| Persistence | [PdoEmailTokenRepository.php · public function findByHash(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoEmailTokenRepository.php#L23)<br>[PdoEmailTokenRepository.php · public function delete(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoEmailTokenRepository.php#L41) |
| Relevant tests (not a pass claim) | [ProductCompletionTest.php · public function test_email_verification_and_change_follow_their_own_links(](../../../backend/tests/Plain/Integration/ProductCompletionTest.php#L52) |
| HTTP | `GET /verify-email` (`email.verify`) → [EmailController::verify](../../../backend/src/Http/Controller/EmailController.php#L33)<br>`GET /confirm-email` (`email.change.confirm`) → [EmailController::confirmChange](../../../backend/src/Http/Controller/EmailController.php#L45) |

<!-- END GENERATED TRACE -->


