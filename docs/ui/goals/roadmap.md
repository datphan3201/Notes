# Goal roadmap and related work

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The fishbone head represents the Goal. Goal information, strategy and related work remain focused panels; Milestone branches open their Tasks. Visual placement does not establish dependency ordering. Milestone cards omit the Not started label; progress bars are centered across the card with equal side insets and anchored at its bottom, independently of title or prerequisite length.

Primary hierarchy, related contributions and Milestone prerequisites are distinct relationships. Related work must stay within the authenticated account; cycles are rejected for Goal contribution graphs. Progress does not count the same Task both directly and through a Milestone. Editors preserve parent context and use the ordinary versioned workspace transaction.

## Existing Task selection

Use the [shared floating Task picker](../shared/task-picker.md) to choose existing Tasks with search/filters, Add or drag-and-drop. It keeps the destination page interactive and the picker open; New task retains the shared editor and current context. See the picker contract for plan selections, whole-interval date moves, primary-parent transfer confirmation and recurring/completed restrictions.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `goals.roadmap`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/planning.tsx](../../../apps/web/src/components/preview/planning.tsx#L68) — `export default function PlanningPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L143) — `def validate_relations(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L580) — `def apply_changes(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_domain.py](../../../apps/api/tests/test_domain.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
