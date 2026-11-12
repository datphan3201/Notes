# Reviews and Activity

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Daily/weekly/monthly Reviews store a snapshot plus a separate editable reflection. A snapshot is persisted evidence for its period, not a live recalculation whenever the page opens. Refresh is explicit and versioned; finalized Reviews must reopen before editing or refreshing.

Activity stores append-only domain facts and reversals. It is separate from mutable plans and Review reflections. Archiving expired Tasks preserves Activity and Review snapshots. Working reflections use explicit save and retain drafts on failure. Delete/reopen/finalize must follow the current workspace transaction and version rules.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `reviews`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/reviews.tsx](../../../apps/web/src/components/preview/reviews.tsx#L246) — `export default function ReviewsPreview(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L92) — `def review_snapshot(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L896) — `def apply_changes(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
