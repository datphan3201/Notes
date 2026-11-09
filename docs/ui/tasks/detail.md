# Task details and linked Notes

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The detail surface separates overview/checklist, linked Notes and related work. Task Notes are ordinary Note resources linked by `task_id`; there is no separate working-text editor or Task-content write path. Each Task has at most one attached Note, enforced by a database uniqueness constraint and versioned server validation. The Task Notes tab embeds its canonical Notes editor directly, with a Create note control only while no Note is attached. Title/content formatting and Save remain on the Task page. The editor component, rich JSON, explicit Save, local draft/conflict recovery and password unlock are shared with standalone Notes. Discarding a dirty draft asks for confirmation; switching Task tabs preserves the mounted draft. Full attachment/share/metadata controls remain available in the standalone Notes surface.

Resources are separate `Task.details.resource_note_ids` links to existing owned Notes. Multiple resource links are allowed, and the same Note can be referenced by different Tasks without changing its Goal/Task association or copying its content. Resource Notes open the shared dialog on top of the Task, preserving the attached Note draft. Unlinking never deletes the Note. Server validation rejects foreign, duplicate and self-primary resource links; permanent Note deletion removes its references in owned Tasks/templates atomically. Checkboxes inside Note content do not change the Task completion checklist/status.

Snapshot Tasks expose owner-only `note_ids` so locked Notes can be listed without revealing titles, bodies or masked links. Archived Notes are excluded from the active list. Migration `0006` backfills nonempty legacy `Task.working_note` to linked Notes, preserves timestamps/archive state and existing Note content/locks, and reuses an identical same-owner/task Note. Different existing content is retained separately. The legacy column is retained for preservation but excluded from API output/input and active editing. Future legacy imports and demo seeds also create canonical Notes. Revision `0007` selects one active attached Note per Task (preferring the legacy working-text match, then oldest creation/ID); additional Notes become Resources with their content, formatting, locks and files preserved.

Today and This week header actions are matching labeled toggles. Their pressed state uses explicit daily/weekly plan selections, never inferred due/overdue/scheduled dates. Selecting Today also selects the week; removing Today preserves the week; removing the week clears both. These actions reuse the shared picker transformations, preserve Task dates/status and are disabled for completed Tasks.

A Task has at most one primary Goal or Milestone. Moving work preserves its identity, checklist and history. Related Goal links are additional context, not progress-bearing parentage or prerequisites. Updates require the displayed version; stale writes return 409. Server rules govern completion, ancestor reopening and archive operations.

Local verification on 2026-11-09: final E2E build/TypeScript and 38 Node checks passed. Browser checks on the synthetic workspace verified an overdue unselected Task stays selectable, Today selects the week, week removal clears both, Today removal retains the week, date/status text stays unchanged and both labeled controls remain visible at mobile width. No database mutation or cloud deployment was required for these checks.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.detail`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/task-detail.tsx](../../../apps/web/src/components/preview/task-detail.tsx#L83) — `export default function TaskPreviewDetail(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L143) — `def validate_relations(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_assistant_tools.py](../../../apps/api/tests/test_assistant_tools.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |
| Related tests | [apps/web/tests/task-picker.test.ts](../../../apps/web/tests/task-picker.test.ts) |

<!-- END GENERATED TRACE -->
