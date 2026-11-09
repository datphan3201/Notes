# Tasks

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Tasks have independent status, dates, checklist, working text, importance, primary Goal/Milestone and related work. No primary parent means Inbox. Completing a checklist does not itself complete the Task. Completion with unchecked items and reopening beneath completed ancestors require explicit acknowledgements.

The collection supports time views, search, status, sorting and Goal grouping. The shared floating editor preserves page context; `/tasks/{id}` provides the detailed working surface. Capture and manual plan selection can be committed in one workspace batch. See [filters](filters.md), [capture](capture.md), [detail](detail.md) and [recurrence](repeating.md).

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/tasks.tsx](../../../apps/web/src/components/preview/tasks.tsx#L55) — `export default function TasksPreview({` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L248) — `def update(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L465) — `def apply_changes(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
