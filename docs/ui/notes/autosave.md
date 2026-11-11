# Note explicit save and recovery

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Typing and formatting update a local draft without sending workspace writes. The live workspace coordinates explicit Save, acknowledgements and recovery. Closing a dirty editor opens the web confirmation with Keep editing and Discard and exit actions; Escape cancels the confirmation; page unload warns while drafts remain. Note metadata actions and attachment/share/password operations retain their existing explicit controls. The Save button submits the selected Note title and rich content using the server version; a stale update conflicts instead of overwriting concurrent text. Request success must not erase typing entered after that request started.

A local draft retains its base version across reload. Recovery offers explicit reconciliation/download; offline conflicts preserve the remote version and recover local edits as a copy. Failed/pending saves stay visible. Account-scoped browser recovery is distinct from the server's stored Note and must be cleared appropriately on logout. Notes, Task working notes and Review reflections use explicit Save. Personal eligible drafts remain recoverable locally before Save; an offline Save explicitly queues the change for reconnection.

The shared save queue preserves newer edits while awaiting an acknowledgement. Saved-version/draft conflict choices explicitly resume the queue with the selected Note text; choosing the saved version does not reapply a failed local draft.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.autosave`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/live-workspace.tsx](../../../apps/web/src/components/live-workspace.tsx#L112) — `export default function LiveWorkspace()` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L580) — `def apply_changes(` |
| Retain evaluated local edits across acknowledgement refresh | [apps/web/src/lib/workspace-rebase.ts](../../../apps/web/src/lib/workspace-rebase.ts#L4) — `export function rebaseEdit<T>(` |
| Related tests | [apps/api/tests/test_concurrency.py](../../../apps/api/tests/test_concurrency.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |
| Related tests | [apps/web/tests/workspace-rebase.test.ts](../../../apps/web/tests/workspace-rebase.test.ts) |

<!-- END GENERATED TRACE -->
