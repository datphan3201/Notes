# Task capture

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The shared editor captures a Task in the originating view and retains its Goal/Milestone/date context. Name, description, criteria, importance, checklist, start/due dates, estimates, reminder, scheduled interval and optional recurrence are validated by the server. Dates are calendar values; scheduled instants are stored in UTC and displayed in the account timezone.

Explicit Create/Save waits for acknowledgement. A failed request keeps the draft. Workspace creation uses a client key to replay an identical request without creating duplicates; reusing that key with different fields conflicts. Plan-on-capture uses the same transaction as Task creation. Recurrence templates and one-off plan selection are separate workflows.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.capture`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/task-editor.tsx](../../../apps/web/src/components/preview/task-editor.tsx#L19) — `export default function TaskPreviewEditor({` |
| Shared capture and acknowledgement coordinator | [apps/web/src/components/preview/task-interaction.tsx](../../../apps/web/src/components/preview/task-interaction.tsx#L14) — `export default function SharedTaskInteraction({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L481) — `def apply_changes(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L249) — `def create(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |

<!-- END GENERATED TRACE -->
