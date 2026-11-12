# Repeating Tasks

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

TaskSeries stores a recurrence rule and Task template; the durable worker materializes occurrences. Reading Tasks never materializes work. Daily/weekly/monthly/yearly recurrence preserves the original monthly/leap-day anchor and uses the series timezone.

Series can be archived from the repeating view and restored or permanently deleted through Archive. Archiving preserves its lifecycle state and existing Tasks; the worker skips archived templates. Active series can pause and resume; Ended is terminal. Further repeating work requires a new series. Generated Tasks remain distinct occurrences and do not contribute duplicate finite progress. Templates retain relevant Task metadata. Restart/retry must not duplicate an occurrence; stopping or sleeping the worker delays generation.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.repeating`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/task-editor.tsx](../../../apps/web/src/components/preview/task-editor.tsx#L20) — `export default function TaskPreviewEditor({` |
| API / domain | [apps/api/planner/jobs.py](../../../apps/api/planner/jobs.py#L96) — `def materialize(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| Related tests | [apps/api/tests/test_ai_jobs.py](../../../apps/api/tests/test_ai_jobs.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_domain.py](../../../apps/api/tests/test_domain.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |
| Related tests | [apps/api/tests/test_crud_matrix.py](../../../apps/api/tests/test_crud_matrix.py) |
| Related tests | [apps/web/tests/e2e/crud-audit.spec.ts](../../../apps/web/tests/e2e/crud-audit.spec.ts) |

<!-- END GENERATED TRACE -->
