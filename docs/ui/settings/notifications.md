# Notification preferences

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Notification preferences persist through the validated preferences API. Worker delivery respects the relevant account category/email settings and unavailable accounts. Muting email is distinct from reading an in-app notification.

Notifications and email jobs use owner-scoped records. Reminder eligibility observes schedule/History boundaries and delivery deduplication. Disabling delivery does not prove existing queued jobs have disappeared; inspect worker filtering and job outcomes. Actual email receipt requires a configured provider and operational verification.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.notifications`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L51) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L217) — `def preferences(` |
| API / domain | [apps/api/planner/jobs.py](../../../apps/api/planner/jobs.py#L254) — `def process_one(` |
| API / domain | [apps/api/planner/jobs.py](../../../apps/api/planner/jobs.py#L199) — `def reminders(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |

<!-- END GENERATED TRACE -->
