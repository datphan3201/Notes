# Calendar and scheduling

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Calendar projects Task, Milestone and Goal dates into month/week/Gantt views. It has no separate event database or external calendar synchronization; Habits are not drawn. Quick capture and moves use ordinary workspace writes.

## Move rule

The UI calculates date changes while retaining the selected entity identity, validates the resulting fields on the server and waits for acknowledgement. AI rescheduling shifts associated dates together, preserves local clock time across DST and rejects invalid/past moves or unsupported completed/repeating items. UI and assistant paths have distinct implementations; inspect both before changing scheduling rules.

Account-facing dates remain separate from UTC scheduled intervals. Check DST gaps/overlaps, midnight, mobile drag/keyboard fallback and stale versions when changing this surface.

## Existing Task selection

Month/week calendars occupy the full content width, with no selected-day agenda or separate task-selection sidebar. The floating task button directly toggles the shared picker over the Calendar; its panel leaves the trigger accessible on mobile. The picker retains contextual New task, Add and drag/return actions. Clicking another date updates the destination while it is open.

Use the [shared floating Task picker](../shared/task-picker.md) to choose existing Tasks with search/filters, Add or drag-and-drop. It keeps the destination page interactive and the picker open; New task retains the shared editor and current context. See the picker contract for plan selections, whole-interval date moves, primary-parent transfer confirmation and recurring/completed restrictions.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `calendar`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/calendar.tsx](../../../apps/web/src/components/preview/calendar.tsx#L42) — `export default function CalendarPreview({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L222) — `def calendar(` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L284) — `def update(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_assistant_tools.py](../../../apps/api/tests/test_assistant_tools.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
