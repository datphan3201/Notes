# Classification and related links

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The current runtime stores supported tags/classification and related links through typed entity fields and `details`, not the retired label/pivot HTTP APIs. Note tags filter the workspace and persist with acknowledged saves.

Tags, importance, primary parents, contributions and Milestone prerequisites have separate meanings. A related Goal is additional context; it does not move work or add progress weight. Server validation rejects inaccessible links, self-related Goals and prohibited cycles. Inspect the input schema before adding classification fields.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.tags`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L29) — `export default function NotesPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L193) — `def validated(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L140) — `def validate_relations(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
