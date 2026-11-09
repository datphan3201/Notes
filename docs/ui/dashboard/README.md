# Dashboard

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Today and This week are separate tabs. Current desktop source uses a Task checklist column with supporting cards beside it, collapsing on narrow screens. A retained decision instead asks for cards above a full-width checklist; this unresolved layout contract is ISSUE-067, not silently treated as accepted. They use real account-local selections, Task state, Habit check-ins and Activity. Manual selection does not change Task dates/status and does not roll forward automatically.

The roadmap preview is a single fluid row: its displayed milestones share the available width equally at every viewport, with no fixed-width mobile cells or horizontal scrolling. Long labels clamp to three lines; their full title remains available and each milestone still opens its detail.

Local responsive checks on 2026-11-09 used the synthetic six-milestone roadmap at 320, 390, 768, 1280 and 1920 px: all steps stayed on one row, shared equal widths and required no horizontal scroll. Full titles and mobile milestone navigation remained available. The production E2E build/TypeScript passed; no database changes or cloud deployment were performed.

The roadmap is the explicit account focus Goal, shared with Main goal on Goals. Missing/archived focus invites a choice; there is no automatic importance-based fallback. Activity reflects recorded completion/reversal transitions rather than a fabricated score. Habit results remain separate from Goal progress. Unavailable comparisons must remain visibly unavailable.

Autosave is silent: it shows no global progress banner or automatic success toast; error/retry feedback remains visible. Autosave updates the view immediately and batches nearby edits after a 400 ms quiet period. One write/acknowledgement cycle runs at a time; edits made during it stay visible and are replayed over the acknowledged snapshot for the next batch. Ordinary background saves do not make the workspace inert. Explicit destructive operations retain their separate short blocking state. Queued versioned edits keep their original read version (or the version acknowledged for this client's preceding write); an unrelated concurrent edit still conflicts. A failed save keeps the latest draft and requires an explicit retry; leaving with pending/failed work remains guarded.

## Existing Task selection

Use the [shared floating Task picker](../shared/task-picker.md) to choose existing Tasks with search/filters, Add or drag-and-drop. It keeps the destination page interactive and the picker open; New task retains the shared editor and current context. See the picker contract for plan selections, whole-interval date moves, primary-parent transfer confirmation and recurring/completed restrictions.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `dashboard`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/dashboard.tsx](../../../apps/web/src/components/preview/dashboard.tsx#L33) — `export function DashboardView({` |
| Shared live projections | [apps/web/src/components/preview/workspace-data.tsx](../../../apps/web/src/components/preview/workspace-data.tsx#L1176) — `export function usePreviewData(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L823) — `def dashboard(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L301) — `def select_focus(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L530) — `def activity(` |
| Retain evaluated local edits across acknowledgement refresh | [apps/web/src/lib/workspace-rebase.ts](../../../apps/web/src/lib/workspace-rebase.ts#L4) — `export function rebaseEdit<T>(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/workspace.spec.ts](../../../apps/web/tests/e2e/workspace.spec.ts) |
| Related tests | [apps/web/tests/e2e/dashboard-saves.spec.ts](../../../apps/web/tests/e2e/dashboard-saves.spec.ts) |
| Related tests | [apps/web/tests/workspace-rebase.test.ts](../../../apps/web/tests/workspace-rebase.test.ts) |

<!-- END GENERATED TRACE -->
