# Notification bell

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The shared bell reads owned notifications and unread state from the API. Read-one/read-all operations validate identifiers and never broaden into another account's rows. Destinations route to the relevant live feature.

Invitations, due reminders and account messages have different delivery/category rules. The worker produces durable notifications/emails; the bell does not run scheduling work. Reminder paging must progress beyond already-sent pages and avoid duplicates. Shared-Note accept/decline uses the invitation endpoints.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.notifications`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/preview/notifications.tsx](../../../apps/web/src/components/preview/notifications.tsx#L15) — `export default function PreviewNotifications({` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L586) — `def notifications(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L544) — `def read_notifications(` |
| API / domain | [apps/api/planner/jobs.py](../../../apps/api/planner/jobs.py#L199) — `def reminders(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |

<!-- END GENERATED TRACE -->
