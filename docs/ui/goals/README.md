# Areas and Goals

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Areas organize arbitrary-depth, single-parent Goals. A Goal has exactly one Area or parent Goal; owner-scoped validation rejects inaccessible references and cycles. Areas/Goals expose supported icon/accent choices and 1–5 importance. An explicit Main goal uses the same account focus as Dashboard.

Goal progress uses finite primary children, excluding Habits, related contributions and repeating occurrences. Archiving is distinct from permanent deletion; including nested contents requires an explicit grouped action. See [roadmaps](roadmap.md) and [Milestones](milestones.md).

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `goals`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/planning.tsx](../../../apps/web/src/components/preview/planning.tsx#L66) — `export default function PlanningPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L140) — `def validate_relations(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L869) — `def progress_for_user(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L549) — `def archive(` |
| Related tests | [apps/api/tests/test_domain.py](../../../apps/api/tests/test_domain.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
