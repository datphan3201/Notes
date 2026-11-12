# Task views and planning

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Time views and Task status are separate filters. The mounted collection exposes exactly four primary tabs: `All`, `Today`, `This week`, and `Other`. `Today` contains current scheduled work, tasks manually added for today, and unfinished overdue tasks; `This week` contains explicit weekly selections (and tasks scheduled within the current Monday-based week); `Other` partitions tasks outside both `Today` and `This week` (including unscheduled, later, or future tasks). Recurring series management is accessible via a dedicated secondary navigation button (`Repeating series` / `Chuỗi lặp`), preserving series creation, editing, pausing, and history without occupying a primary tab.

The toolbar uses the shared `CollectionToolbar` template: search spans available desktop width, while status, parent, and tag filters align with 44 px touch targets and expand/collapse cleanly on mobile screens. Selecting a Task for Today also selects the Monday-based current week; removing a selection does not rewrite its schedule or status.

Search/status/grouping operate on the loaded workspace. Completed/History presentation follows account History preferences. Dashboard projections and Task list projections have separate implementations and must be compared when changing membership rules. No claim is made that the full workspace snapshot is bounded for large accounts (ISSUE-066).

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `tasks.filters`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/tasks.tsx](../../../apps/web/src/components/preview/tasks.tsx#L58) — `export default function TasksPreview({` |
| Live Task projection | [apps/web/src/components/live-model.ts](../../../apps/web/src/components/live-model.ts#L118) — `export function fromSnapshot(` |
| Alternate typed Task-view helper; unit-tested, not mounted by WorkspaceView | [apps/web/src/lib/task-views.ts](../../../apps/web/src/lib/task-views.ts#L30) — `export function matchesView(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L272) — `def task_plan(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L290) — `def select_task(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L825) — `def dashboard(` |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
