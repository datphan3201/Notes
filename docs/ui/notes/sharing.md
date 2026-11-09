# Note sharing and invitations

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Owners invite registered accounts with view/edit permissions. Invitations are pending until accepted; accept/decline, permission change, revoke and leave use dedicated authenticated endpoints. Contact suggestions come from accepted sharing relationships and exclude locked accounts.

Recipients can read accepted shares; editors can change title/content only. Owner metadata/security actions stay owner-only. Owner locking or revocation removes access. Shared Notes and their media remain excluded from the offline personal Note cache. Concurrent edits use versions/conflict recovery; there is no WebSocket co-editing/presence server.

Recipients may report a shared Note; moderation uses an authorized snapshot, not unrestricted access to live private Notes.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes.sharing`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live Notes controls | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L29) — `export default function NotesPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/note_features.py](../../../apps/api/planner/note_features.py#L39) — `def invite(` |
| API / domain | [apps/api/planner/note_features.py](../../../apps/api/planner/note_features.py#L82) — `def respond_invitation(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L80) — `def access_note(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
