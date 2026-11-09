# Shared editing scope

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Realtime OT/WebSocket co-editing, presence and named carets belong to the retired PHP implementation and are deliberately excluded from V1. No realtime ticket endpoint or `/realtime` server is deployed by the current repository.

Accepted edit recipients use ordinary versioned title/content updates. Stale writes return a conflict and preserve the local draft rather than silently merging or overwriting. See [sharing](sharing.md) and [autosave](autosave.md). The retained text-operation library supports the Note editor; its presence does not establish a live collaboration feature.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.collaboration`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/live-workspace.tsx](../../../apps/web/src/components/live-workspace.tsx#L112) — `export default function LiveWorkspace()` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L80) — `def access_note(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_concurrency.py](../../../apps/api/tests/test_concurrency.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |

<!-- END GENERATED TRACE -->
