# Milestones and prerequisites

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

A Milestone is a checkpoint in one owned Goal, with Tasks shown in its focused panel. Its prerequisites are a separate owner-scoped acyclic graph and can reference Milestones in another owned Goal. Branch order alone creates no prerequisite.

Creation/editing uses the shared editor and authoritative parent validation. Completion and reopening apply the server's unfinished-work/prerequisite/ancestor acknowledgement rules. Archive operations clean affected graph relationships atomically; grouped contents and permanent deletion have explicit confirmation/version requirements.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `goals.milestones`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/planning.tsx](../../../apps/web/src/components/preview/planning.tsx#L66) — `export default function PlanningPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L693) — `def prerequisites(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L248) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L549) — `def archive(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
