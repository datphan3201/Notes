# Shared — Notification bell and reminders

[Documentation home](../../README.md) · [All routes](../../reference/routes.md)

Entry: topbar bell on authenticated pages. Delivery preferences are in [Notifications settings](../settings/notifications.md).

<!-- BEGIN GENERATED TRACE -->

### Unread count, list, mark read and invitations

**Trace ID:** `bell.list`

The bell polls every 60s while visible, displays the latest 50 and routes invitation actions through Note-sharing APIs. Notifications are user-owned; admin report notifications bypass ordinary opt-out. New notifications carry params (who, which Note, permission, report outcome) and the bell words them in the reader's language; older ones without params show their stored text. Retired Teamwork notifications remain stored but are excluded from the list, unread count and read updates.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-notifications&gt;](../../../frontend/src/views/layouts/app.php#L113) |
| CSS | [feedback.css · Bell panel anchor](../../../frontend/src/css/feedback.css#L94) |
| Browser logic | [notifications.js · export function initNotifications](../../../frontend/src/js/lib/notifications.js#L73)<br>[notifications.js · export function notificationText(](../../../frontend/src/js/lib/notifications.js#L22) |
| Controller / service / domain | [NotificationService.php · public function inbox(](../../../backend/src/Application/Notifications/NotificationService.php#L65)<br>[NotificationService.php · public function markRead(](../../../backend/src/Application/Notifications/NotificationService.php#L77) |
| Persistence | [PdoNotificationRepository.php · public function latest(](../../../backend/src/Infrastructure/Persistence/Pdo/Notifications/PdoNotificationRepository.php#L31)<br>[PdoNotificationRepository.php · public function unreadCount(](../../../backend/src/Infrastructure/Persistence/Pdo/Notifications/PdoNotificationRepository.php#L48)<br>[PdoNotificationRepository.php · public function markRead(](../../../backend/src/Infrastructure/Persistence/Pdo/Notifications/PdoNotificationRepository.php#L56) |
| Relevant tests (not a pass claim) | [FullFeedbackHttpTest.php · public function test_owner_controls_note_sharing_permissions_and_notifications(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L54)<br>[notification-text.test.js · test('notifications are worded in the reader language from their params'](../../../frontend/tests/js/notification-text.test.js#L14)<br>[FullFeedbackHttpTest.php · public function test_retired_notifications_are_preserved_without_entering_the_bell_or_badge(](../../../backend/tests/Plain/Http/FullFeedbackHttpTest.php#L191) |
| HTTP | `GET /api/v1/notifications` (`api.notifications.index`) → [NotificationController::index](../../../backend/src/Http/Controller/NotificationController.php#L19)<br>`POST /api/v1/notifications/read` (`api.notifications.read-all`) → [NotificationController::readAll](../../../backend/src/Http/Controller/NotificationController.php#L33)<br>`POST /api/v1/notifications/{id}/read` (`api.notifications.read`) → [NotificationController::read](../../../backend/src/Http/Controller/NotificationController.php#L25) |

### Due personal reminders and dismissal

**Trace ID:** `bell.reminders`

Due reminders are derived from Tasks and merged into the bell. Dismissal uses reminder_read_at independently from email reminder_sent_at. Changing the reminder time makes a new reminder visible.

| Layer | Entry point |
| --- | --- |
| UI / DOM | [app.php · data-notifications-list](../../../frontend/src/views/layouts/app.php#L123) |
| CSS | [feedback.css · Bell panel anchor](../../../frontend/src/css/feedback.css#L94) |
| Browser logic | [notifications.js · const load = async () =&gt;](../../../frontend/src/js/lib/notifications.js#L104) |
| Controller / service / domain | [TaskReminderService.php · public function due(](../../../backend/src/Application/Planning/TaskReminderService.php#L20)<br>[TaskReminderService.php · public function markRead(](../../../backend/src/Application/Planning/TaskReminderService.php#L30) |
| Persistence | [PdoReminderRepository.php · public function due(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoReminderRepository.php#L27)<br>[PdoReminderRepository.php · public function markRead(](../../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoReminderRepository.php#L49) |
| Relevant tests (not a pass claim) | [ProductCompletionTest.php · public function test_due_reminders_can_be_dismissed_and_return_when_rescheduled(](../../../backend/tests/Plain/Integration/ProductCompletionTest.php#L103) |
| HTTP | `GET /api/v1/reminders` (`api.reminders.index`) → [ReminderController::index](../../../backend/src/Http/Controller/ReminderController.php#L14)<br>`POST /api/v1/reminders/{id}/read` (`api.reminders.read`) → [ReminderController::read](../../../backend/src/Http/Controller/ReminderController.php#L19) |

<!-- END GENERATED TRACE -->
