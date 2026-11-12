# Shared floating Task picker

[Documentation home](../../README.md) · [Component library](design-system.md)

Dashboard, Calendar and Goal/Milestone task selection use one nonmodal floating picker. Search, Goal/Inbox filtering, an unscheduled-only filter, task rows and Add/New task controls share the same implementation. Completed/archived Tasks are omitted; selected Tasks remain visible with a disabled selected Add state and can still be dragged to another valid destination. The window stays open after selection and does not make the page inert.

## Context determines the operation

| Destination | Add or drop behavior |
| --- | --- |
| Dashboard Today | Selects the existing Task for today and the current week. Dates, status and primary parent remain unchanged. |
| Dashboard This week | Selects for the current week; preserves an existing Today selection. |
| Calendar date | Sets the Task's all-day Calendar placement. Its start, due and reminder dates stay unchanged. The current API adapter stores the selected local day as a scheduled instant pending the database change. |
| Goal / Milestone | Changes the Task's primary parent. Inbox Tasks attach directly; a Task already owned by another parent requires a compact confirmation. It creates no duplicate Task and does not change content, dates or status. |

Calendar uses a single floating Task button to toggle this picker directly, with no selected-day/task-selection sidebar cards. Its default panel position leaves the trigger available for a second click, including on mobile.

The current Calendar provides date cells and Gantt day targets, not a new hourly calendar. The destination label always identifies the Add button's target. Selecting another Calendar date or changing Dashboard Today/This week updates that label. Dragging may choose another visible drop destination directly. Navigation to another section, Goal or Milestone dismisses the picker to avoid retaining a stale destination.

Recurring occurrences can be selected into plans, but their date/primary-parent changes must be made through the recurring series. Archived/completed parents cannot receive newly attached Tasks. All owned writes still pass existing versioned server validation. Explicit Add/drop awaits ordinary workspace saving and shows row progress; failures retain the app's draft/save-error recovery. The selected state describes the local selection, with save errors visible separately.

## Return to the tray

The picker has an explicit return drop zone and per-row localized return action. A return changes only the current relationship/date fields; it never deletes or archives a Task, its content or attached Notes.

| Context | Return behavior |
| --- | --- |
| Dashboard Today | Clears the Today selection and preserves the weekly selection. |
| Dashboard This week | Clears both weekly and Today selections, preserving the daily-implies-weekly invariant. |
| Calendar | Clears only the Task's Calendar placement, even if its date differs from the picker's selected day. Start, due and reminder stay unchanged. |
| Goal / Milestone | Clears only the exact matching primary parent and places the Task in Inbox. Tasks owned by a different parent are not detached. |

Desktop destination cards are draggable while the picker is open. They identify returns with a separate MIME type so ordinary Calendar moves/resizes retain their original handlers. Selected picker rows can also be dragged to the return zone using the existing pointer grips. Return buttons provide a keyboard/mobile alternative. Completed/archived Tasks and recurrence date/parent restrictions remain enforced.

## Pointer, keyboard and mobile behavior

Use the top grip to move the window; its Arrow keys also move it. Movement and viewport/content resizing keep it inside the viewport. Search receives initial focus; close restores the originating visible control. Escape from within the picker closes it. There is no backdrop or focus trap.

Task grips support pointer dragging, including touch Pointer Events, with a small movement threshold, ghost and highlighted drop target. Desktop native row dragging uses a dedicated Task ID MIME payload; other calendar drags keep their original behavior. Add provides the equivalent keyboard/mobile path. On narrow screens the same window shrinks to fit and scrolls its Task list; it does not become a blocking full-screen editor.

The New task action closes the picker and opens the existing shared editor with the selected plan/date/parent. It does not silently create a record. A local synthetic example is available in `/preview/components`; its Add/drop changes only demonstration state.

## Reuse

`FloatingTaskPicker` from `@/components/ui` is a presentational template: supply task rows, goal choices, destination/hint, busy/error state and callbacks. It performs no API writes. `TaskPickerProvider`, `useTaskPicker` and `TaskDropZone` in `components/task-picker.tsx` adapt it to the authenticated or explicit synthetic workspace. The provider is mounted once around `WorkspaceView`.

```tsx
const picker = useTaskPicker();

<Button onClick={() => picker.open({ kind: "calendar", date })}>
    {text("Choose tasks", "Chọn công việc")}
</Button>
<TaskDropZone target={{ kind: "calendar", date }}>
    {children}
</TaskDropZone>
```

Wrap a real destination with `TaskDropZone`; it composes existing native drag handlers and supports div/section/span hosts. Only Task IDs found in the current account data can be applied, and the API remains authoritative. Keep parent-confirmation, selection semantics and date transformations in the adapter/helper rather than copying them into each page.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.task-picker`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Reusable nonmodal Task selection template | [apps/web/src/components/ui/floating-task-picker.tsx](../../../apps/web/src/components/ui/floating-task-picker.tsx#L19) — `export function FloatingTaskPicker({` |
| Workspace context, assignment and transfer confirmation | [apps/web/src/components/task-picker.tsx](../../../apps/web/src/components/task-picker.tsx#L25) — `export function TaskPickerProvider({` |
| Shared native/pointer drop destinations | [apps/web/src/components/task-picker.tsx](../../../apps/web/src/components/task-picker.tsx#L130) — `export function TaskDropZone({` |
| Date/selection/parent transformations and drag IDs | [apps/web/src/lib/task-picker.ts](../../../apps/web/src/lib/task-picker.ts#L28) — `export function pickedTaskPatch(` |
| Related tests | [apps/web/tests/task-picker.test.ts](../../../apps/web/tests/task-picker.test.ts) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->

## Local verification — 2026-11-09

- Final E2E production build/TypeScript passed; all 34 Node checks passed, including six Task selection/date/drag-ID regressions.
- Existing parity suite passed 18 desktop/mobile cases after integration, including contextual Calendar/Milestone creation through the picker. Later refinements cover selected-row dragging, pointer identity, resize clamping and control layout.
- CLI browser checks against the guarded `planner_test` API verified Dashboard Add/native drop without date changes, Calendar Add/native drop with preserved clock times, Goal attachment, transfer cancellation/confirmation, existing-Task attachment to a Milestone, and mobile Add. Five fixture Tasks remained five records throughout.
- The synthetic catalogue verified window movement, pointer drop, search/filter/empty state, disabled duplicate Add with dragging still allowed, keyboard movement/Escape and viewport clamping after filter/content changes. Desktop/mobile screenshots were inspected and filter controls checked for full visibility.

Real database checks used only disposable `planner_test` on port 5434 with external mail/AI/storage disabled. The catalogue has no API writes. These checks do not claim physical-device acceptance or a cloud deployment.

### Reverse-flow verification — 2026-11-09

The final E2E production build/TypeScript passed and the Node suite passed 37 checks, including return-field and matching-parent regressions. CLI tests against guarded `planner_test` verified native card returns from Today, This week, Calendar and Milestone, plus the Goal return button at 390 px. Today retained weekly selection; week removal cleared both selections; Calendar cleared all four date/schedule fields while retaining status/content; parent return retained the same attached Note ID, Task link and content. Four fixture Tasks remained four records. Ordinary Calendar day-to-day dragging with the tray open was also checked after the return flow. These mutations used no development/cloud data; no cloud deployment was performed.
