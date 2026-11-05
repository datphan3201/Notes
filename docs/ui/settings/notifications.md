# /settings/notifications — Delivery preferences

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: Settings → Notifications. The [shared bell](../shared/notifications.md) is a separate consumer of these preferences.

<!-- BEGIN GENERATED TRACE -->

### Notifications, invitation emails and Task reminders

**Trace ID:** `notifications.preferences`

Preferences control new in-app rows and opted-in email delivery. Admin report notifications are always created. Personal Task reminder emails require the scheduler and configured transport; team Task reminders are in-app only.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [notifications.php · data-notification-settings](../../../frontend/src/views/settings/notifications.php#L1) |
| Browser logic | [delivery-preferences.js · export function initDeliveryPreferences](../../../frontend/src/js/settings/delivery-preferences.js#L4) |
| Controller / service / domain | [AccountService.php · public function updatePreferences(](../../../backend/src/Application/Account/AccountService.php#L44)<br>[NotificationService.php · public function notify(](../../../backend/src/Application/Notifications/NotificationService.php#L40)<br>[TaskReminderService.php · public function send(](../../../backend/src/Application/Planning/TaskReminderService.php#L39) |
| Persistence | [PdoNotificationRepository.php · public function insert(](../../../backend/src/Infrastructure/Persistence/Pdo/Notifications/PdoNotificationRepository.php#L16)<br>[PdoAccountRepository.php · public function updatePreferences(](../../../backend/src/Infrastructure/Persistence/Pdo/Account/PdoAccountRepository.php#L133) |
| Relevant tests (not a pass claim) | [FeedbackMaintenanceTest.php · public function test_recurring_capture_and_reminders_are_owned_and_settings_stay_isolated(](../../../backend/tests/Plain/Integration/FeedbackMaintenanceTest.php#L107) |
| HTTP | `PATCH /api/v1/preferences` (`api.preferences.update`) → [AccountController::updatePreferences](../../../backend/src/Http/Controller/AccountController.php#L141) |

<!-- END GENERATED TRACE -->
