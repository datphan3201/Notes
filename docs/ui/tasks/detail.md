# Task details and working notes

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The detail surface separates overview/checklist, working notes/resources and related work. Task working text uses explicit Save; it does not inherit the main Notes autosave workflow. Preserve typing across tab changes and request acknowledgements.

A Task has at most one primary Goal or Milestone. Moving work preserves its identity, checklist and history. Related Goal links are additional context, not progress-bearing parentage or prerequisites. Updates require the displayed version; stale writes return 409. Server rules govern completion, ancestor reopening and archive operations.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.detail`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/task-detail.tsx](../../../apps/web/src/components/preview/task-detail.tsx#L82) — `export default function TaskPreviewDetail(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L248) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L140) — `def validate_relations(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_assistant_tools.py](../../../apps/api/tests/test_assistant_tools.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |

<!-- END GENERATED TRACE -->
