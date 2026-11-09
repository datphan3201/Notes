# Task details and linked Notes

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The detail surface separates overview/checklist, linked Notes and related work. Task Notes are ordinary Note resources linked by `task_id`; there is no separate working-text editor or Task-content write path. Open/create from the Task Notes tab to use the same Notes editor, rich JSON, explicit Save, draft/conflict recovery, attachments, sharing and password unlock. Closing the Note returns to the originating Task Notes tab. Checkboxes inside Note content do not change the Task completion checklist/status.

Snapshot Tasks expose owner-only `note_ids` so locked Notes can be listed without revealing titles, bodies or masked links. Archived Notes are excluded from the active list. Migration `0006` backfills nonempty legacy `Task.working_note` to linked Notes, preserves timestamps/archive state and existing Note content/locks, and reuses an identical same-owner/task Note. Different existing content is retained separately. The legacy column is retained for preservation but excluded from API output/input and active editing. Future legacy imports and demo seeds also create canonical Notes.

A Task has at most one primary Goal or Milestone. Moving work preserves its identity, checklist and history. Related Goal links are additional context, not progress-bearing parentage or prerequisites. Updates require the displayed version; stale writes return 409. Server rules govern completion, ancestor reopening and archive operations.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.detail`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/task-detail.tsx](../../../apps/web/src/components/preview/task-detail.tsx#L80) — `export default function TaskPreviewDetail(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L251) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L143) — `def validate_relations(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_assistant_tools.py](../../../apps/api/tests/test_assistant_tools.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |

<!-- END GENERATED TRACE -->
