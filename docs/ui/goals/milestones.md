# Milestones and prerequisites

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

A Milestone is a checkpoint in one owned Goal, with Tasks shown in its focused panel. Its prerequisites are a separate owner-scoped acyclic graph and can reference Milestones in another owned Goal. Branch order alone creates no prerequisite.

Creation/editing uses the shared editor and authoritative parent validation. Completion and reopening apply the server's unfinished-work/prerequisite/ancestor acknowledgement rules. Archive operations clean affected graph relationships atomically; grouped contents and permanent deletion have explicit confirmation/version requirements.

Milestone detail headers keep action menus outside their header bounds visible. Titles/actions wrap on narrow screens, and mobile action menus open toward the available content area. Illustrated page headers retain background clipping and rounded corners.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `goals.milestones`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/planning.tsx](../../../apps/web/src/components/preview/planning.tsx#L68) — `export default function PlanningPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L735) — `def prerequisites(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L589) — `def archive(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
