# Tasks

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Tasks have exactly two completion states: Not completed (`todo`) and Completed (`done`). New and reopened Tasks are Not completed; the Complete/Reopen actions switch between these states. The editor displays completion read-only, and status filters expose only these two states plus All. Dates, plans and checklist changes never automatically change completion.

Tasks have independent dates, checklist, linked Notes, importance, primary Goal/Milestone and related work. No primary parent means Inbox. Completing a checklist does not itself complete the Task. Completion with unchecked items and reopening beneath completed ancestors require explicit acknowledgements.

The collection supports time views, search, status, sorting and Goal grouping. The shared floating editor preserves page context; `/tasks/{id}` provides the detailed working surface. Capture and manual plan selection can be committed in one workspace batch. See [filters](filters.md), [capture](capture.md), [detail](detail.md) and [recurrence](repeating.md).

Task rows show labeled This week, Today and Actions controls. Selected plans have a checkmark and accent treatment; selections use explicit daily/weekly membership, not inferred due dates. Completed Tasks disable plan changes. Importance is labeled and uses the shared star control; actions stay on the right in the same row on wide desktop screens, while compact/tablet and mobile layouts move/wrap them below Task text.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/tasks.tsx](../../../apps/web/src/components/preview/tasks.tsx#L58) — `export default function TasksPreview({` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L580) — `def apply_changes(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
