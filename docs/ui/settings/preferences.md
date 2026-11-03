# /settings/preferences — Appearance and preferences

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: Settings → Appearance. Five preset themes (mountain, forest, ocean, pisces, stars) are independent from light/dark. Notes has its own layout/text preferences.

The UI supports English and Vietnamese; this documentation uses English.

<!-- BEGIN GENERATED TRACE -->

### Theme, light/dark, scenery and illustration toggles

**Trace ID:** `appearance.theme`

Appearance is account-persisted. applyAppearance consumes acknowledged preferences; decoration is not authoritative product data. Keep CSS selectors and preference serialization in sync.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [preferences.php · data-theme-picker](../../../frontend/src/views/settings/preferences.php#L18) |
| Browser logic | [preferences.js · export function initPreferences](../../../frontend/src/js/settings/preferences.js#L7)<br>[theme-catalog.js · export function applyAppearance](../../../frontend/src/js/settings/theme-catalog.js#L41) |
| Controller / service / domain | [AccountValidator.php · public function preferences(](../../../backend/src/Application/Account/AccountValidator.php#L76) |
| Persistence | [PdoAccountRepository.php · public function preferences(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L58)<br>[PdoAccountRepository.php · public function updatePreferences(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L133) |
| Relevant tests (not a pass claim) | [AccountHttpTest.php · public function test_illustrated_preferences_are_private_strict_and_survive_reload(](../../../backend/tests/Plain/Http/AccountHttpTest.php#L313) |
| HTTP | `GET /api/v1/preferences` (`api.preferences.show`) → [AccountController::preferences](../../../backend/src/Http/Controller/AccountController.php#L132)<br>`PATCH /api/v1/preferences` (`api.preferences.update`) → [AccountController::updatePreferences](../../../backend/src/Http/Controller/AccountController.php#L139) |

### Private backgrounds, Add tile, RGB and reset

**Trace ID:** `appearance.background`

Up to 12 owned backgrounds are retained. Upload validates JPEG/PNG/WebP, <=2MiB and <=4096x4096, re-encodes privately and serves only the owner. RGB is #RRGGBB; a submitted external URL/path is not accepted.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [preferences.php · data-background-upload](../../../frontend/src/views/settings/preferences.php#L68) |
| Browser logic | [preferences.js · data-background-upload](../../../frontend/src/js/settings/preferences.js#L265) |
| Controller / service / domain | [BackgroundService.php · public function add(](../../../backend/src/Application/Files/BackgroundService.php#L27)<br>[BackgroundService.php · public function delete(](../../../backend/src/Application/Files/BackgroundService.php#L56)<br>[BackgroundService.php · public function authorized(](../../../backend/src/Application/Files/BackgroundService.php#L82) |
| Persistence | [PdoAccountRepository.php · public function insertBackground(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L202)<br>[PdoAccountRepository.php · public function selectBackground(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L173)<br>[PdoAccountRepository.php · public function deleteBackground(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L208) |
| Relevant tests (not a pass claim) | [FilesHttpTest.php · public function test_uploaded_backgrounds_form_an_owned_list_that_can_be_selected_and_removed(](../../../backend/tests/Plain/Http/FilesHttpTest.php#L366) |
| HTTP | `POST /api/v1/preferences/background` (`api.background.store`) → [ProfileFileController::replaceBackground](../../../backend/src/Http/Controller/ProfileFileController.php#L44)<br>`GET /api/v1/preferences/backgrounds` (`api.backgrounds.index`) → [ProfileFileController::backgrounds](../../../backend/src/Http/Controller/ProfileFileController.php#L66)<br>`DELETE /api/v1/preferences/backgrounds/{background}` (`api.backgrounds.destroy`) → [ProfileFileController::deleteBackground](../../../backend/src/Http/Controller/ProfileFileController.php#L72)<br>`GET /files/backgrounds/{background}` (`backgrounds.show`) → [ProfileFileController::backgroundFile](../../../backend/src/Http/Controller/ProfileFileController.php#L81)<br>`PATCH /api/v1/preferences` (`api.preferences.update`) → [AccountController::updatePreferences](../../../backend/src/Http/Controller/AccountController.php#L139) |

### Personal quote, preset restore and locale

**Trace ID:** `appearance.quote`

Quote text requires explicit Save; theme/toggles save independently. Preserve newer quote drafts while a save is pending. Locale changes UI literals, not stored user content.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [preferences.php · data-quote-form](../../../frontend/src/views/settings/preferences.php#L43)<br>[preferences.php · data-interface-locale](../../../frontend/src/views/settings/preferences.php#L57) |
| Browser logic | [preferences.js · data-quote-form](../../../frontend/src/js/settings/preferences.js#L86)<br>[i18n.js · export function t(](../../../frontend/src/js/lib/i18n.js#L2) |
| Controller / service / domain | [AccountService.php · public function updatePreferences(](../../../backend/src/Application/Account/AccountService.php#L44) |
| Persistence | [PdoAccountRepository.php · public function updatePreferences(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L133) |
| Relevant tests (not a pass claim) | [translations.test.js · every literal interface string](../../../frontend/tests/js/translations.test.js#L25) |
| HTTP | `PATCH /api/v1/preferences` (`api.preferences.update`) → [AccountController::updatePreferences](../../../backend/src/Http/Controller/AccountController.php#L139) |

<!-- END GENERATED TRACE -->
