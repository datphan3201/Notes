# Notes workspace

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Notes provide a rich document, grid/list, search, tags, pin/color and optional owned Goal or Task link. The editor supports bold, italic, strikethrough, highlight, H1–H3, bullet/numbered/nested checklists, links, blockquotes, inline code and code blocks. Tab indents paragraphs/headings, nests list items or indents code lines; Shift+Tab reverses indentation. Existing plain-text Notes remain readable, with literal `- [ ]` / `- [x]` lines converted to editable checkboxes. Note title/content changes use explicit Save, with local drafts and conflict recovery.

Card previews show only the highest-priority nonempty content category: headings, otherwise checkboxes, otherwise ordinary text. Selection scans the complete document before limiting the preview to three headings/checks or 200 text characters; the Note title remains separate.

Rich JSON is stored as `document` in existing Note details. Server validation permits only supported nodes, marks and safe link schemes, and derives the searchable/AI-compatible `content` text. Metadata edits retain formatting; an explicit plain-content-only API update clears the rich document. Drafts, offline recovery and shared edits retain both representations. Locked responses omit the rich document as well as masking plain content.

Task Notes use these same Note resources and editor, opened from the Task Notes tab. Legacy Task working text is migrated by revision `0006`; the separate text-only write path is retired.

Private files, per-Note passwords, registered-account sharing, read-only AI summaries/questions and offline personal Note recovery have separate boundaries. Follow [saving and recovery](autosave.md), [locks](locks.md), [sharing](sharing.md), [files](files.md), [AI](ai.md) and [offline](offline.md). Live realtime co-editing is excluded from this runtime; shared editors use versions and conflict recovery.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `notes`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/notes.tsx](../../../apps/web/src/components/preview/notes.tsx#L31) — `export default function NotesPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L80) — `def access_note(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L327) — `def snapshot(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
