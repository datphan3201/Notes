# Note passwords

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

A Note password is hashed with the configured password hasher and enforced on the server. Unlock records are bound to the login session and current lock hash; changing the password invalidates prior unlocks. Guessing is throttled.

Locked content is masked from snapshots/search/file access until authorized unlock. Password-protected Notes are excluded from AI retrieval even when the user has unlocked the editor, and from offline storage. Note ownership/sharing authorization remains required independently of password knowledge. Password changes/removal require the current password where the endpoint specifies it.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.locks`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live Notes controls | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L40) — `export default function NotesPreview({ text, taskId, resourceNoteId, onResourceClose }: { text: Text; taskId?: number; resourceNoteId?: string; onResourceClose?: () => void }) {` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L341) — `def note_password(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L362) — `def note_unlock(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L80) — `def access_note(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
