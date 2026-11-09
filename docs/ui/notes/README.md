# Notes workspace

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Notes provide a plain-text document, grid/list, search, tags, pin/color and optional owned Goal or Task link. Checkable lines remain literal `- [ ]` / `- [x]` text with undo/composition behavior. Notes autosave differs from explicit-save Task/Review editors.

Private files, per-Note passwords, registered-account sharing, read-only AI summaries/questions and offline personal Note recovery have separate boundaries. Follow [autosave](autosave.md), [locks](locks.md), [sharing](sharing.md), [files](files.md), [AI](ai.md) and [offline](offline.md). Live realtime co-editing is excluded from this runtime; shared editors use versions and conflict recovery.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L29) — `export default function NotesPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L80) — `def access_note(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L327) — `def snapshot(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
