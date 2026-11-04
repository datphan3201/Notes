# /settings/profile — Profile, avatar and email

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: Settings → Profile. Public fields are escaped plain text. Email verification/change is token-driven; callbacks are [documented separately](../auth/email.md).

<!-- BEGIN GENERATED TRACE -->

### Display name and biography

**Trace ID:** `profile.details`

Profile PATCH accepts display_name and optional biography (up to 2,000 code points); omission preserves biography. Save feedback belongs to this form.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [profile.php · data-profile-form](../../../frontend/src/views/settings/profile.php#L25) |
| Browser logic | [profile.js · export function initProfile](../../../frontend/src/js/settings/profile.js#L4) |
| Controller / service / domain | [AccountService.php · public function updateProfile(](../../../backend/src/Application/Account/AccountService.php#L31) |
| Persistence | [PdoAccountRepository.php · public function updateDisplayName(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L122)<br>[PdoAccountRepository.php · public function updateBiography(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L220) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_registration_session_profile_preferences_and_password_flow(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L57) |
| HTTP | `GET /api/v1/profile` (`api.profile.show`) → [AccountController::profile](../../../backend/src/Http/Controller/AccountController.php#L118)<br>`PATCH /api/v1/profile` (`api.profile.update`) → [AccountController::updateProfile](../../../backend/src/Http/Controller/AccountController.php#L123) |

### Replace and remove avatar

**Trace ID:** `profile.avatar`

Avatar upload validates and re-encodes the image, stores it privately and serves the current account through /files/avatar. Queue removal after metadata changes.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [profile.php · data-avatar-input](../../../frontend/src/views/settings/profile.php#L19) |
| Browser logic | [profile.js · data-avatar-input](../../../frontend/src/js/settings/profile.js#L10) |
| Controller / service / domain | [FileService.php · public function replaceAvatar(](../../../backend/src/Application/Files/FileService.php#L188)<br>[FileService.php · public function removeAvatar(](../../../backend/src/Application/Files/FileService.php#L219)<br>[AvatarProcessor.php · public function makeJpeg(](../../../backend/src/Application/Files/AvatarProcessor.php#L15) |
| Persistence | [PdoAccountRepository.php · public function updateAvatarPath(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L252) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_avatar_is_reencoded_replaced_safely_streamed_and_removed(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L261) |
| HTTP | `POST /api/v1/profile/avatar` (`api.profile.avatar`) → [ProfileFileController::replaceAvatar](../../../backend/src/Http/Controller/ProfileFileController.php#L26)<br>`DELETE /api/v1/profile/avatar` (`api.profile.avatar.remove`) → [ProfileFileController::removeAvatar](../../../backend/src/Http/Controller/ProfileFileController.php#L36)<br>`GET/HEAD /files/avatar` (`files.avatar`) → [FileContentController::avatar](../../../backend/src/Http/Controller/FileContentController.php#L35) |

### Verification status, resend and change email

**Trace ID:** `profile.email`

Changing email requires current_password, emails a confirmation link to the new address and notifies the old address after confirmation. Never expose tokens in docs or public screenshots.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [profile.php · data-email-change-form](../../../frontend/src/views/settings/profile.php#L49) |
| Browser logic | [profile.js · data-email-change-form](../../../frontend/src/js/settings/profile.js#L33) |
| Controller / service / domain | [EmailVerificationService.php · public function requestChange(](../../../backend/src/Application/Account/EmailVerificationService.php#L87) |
| Persistence | [PdoEmailTokenRepository.php · public function replace(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoEmailTokenRepository.php#L16)<br>[PdoEmailTokenRepository.php · public function findByHash(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoEmailTokenRepository.php#L23) |
| Relevant tests (not a pass claim) | [ProductCompletionTest.php · public function test_email_verification_and_change_follow_their_own_links(](../../../backend/tests/Plain/Integration/ProductCompletionTest.php#L52) |
| HTTP | `GET /api/v1/email` (`api.email.show`) → [EmailController::status](../../../backend/src/Http/Controller/EmailController.php#L66)<br>`POST /api/v1/email/verification` (`api.email.verification`) → [EmailController::resend](../../../backend/src/Http/Controller/EmailController.php#L57)<br>`POST /api/v1/email/change` (`api.email.change`) → [EmailController::change](../../../backend/src/Http/Controller/EmailController.php#L79) |

<!-- END GENERATED TRACE -->
