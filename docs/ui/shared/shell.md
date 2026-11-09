# Shared workspace shell

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Next.js route files mount `Workspace`, which mounts `LiveWorkspace`. It reads an authenticated workspace snapshot and provides the reviewed React components with real data. Several live view components live under `components/preview/`; only explicit `/preview/*` routes mount synthetic data providers.

Navigation, floating editors, dialogs, notifications and the assistant preserve current page/draft/focus state. Late refresh responses must not close a newly opened panel. Client rendering does not authorize access: every business read/write remains server-scoped.

## Shared component library

[Components and templates](design-system.md) owns the common controls, page headers, surfaces and dialog patterns under `apps/web/src/components/ui/`. `/preview/components` is the synthetic interactive catalogue. Existing preview-path imports re-export shared implementations; feature-specific layouts remain with their modules.

## Mobile text entry

Shared control styles give text inputs, textareas, selects and editable rich-text surfaces a minimum 16 px font on narrow or touch-capable screens. Larger Note title fields keep their existing sizing, and the Note body honors larger font preferences. This addresses small-field focus zoom without disabling pinch zoom or resetting user zoom when a field blurs. Desktop typography remains unchanged on non-touch wide screens. Real iOS keyboard show/dismiss behavior still requires an on-device check; browser emulation only verifies styles and viewport configuration.

## Style file ownership

The baseline stylesheet set in `src/styles/baseline/`, global/parity/auth styles and reviewed feature styles own the visual system. Inspect import order and component use before changing an override. Five illustrated themes, independent light/dark preferences, readable controls and mobile/keyboard behavior remain product requirements.

Autosave is silent: it shows no global progress banner or automatic success toast; error/retry feedback remains visible. Autosave updates the view immediately and batches nearby edits after a 400 ms quiet period. One write/acknowledgement cycle runs at a time; edits made during it stay visible and are replayed over the acknowledged snapshot for the next batch. Ordinary background saves do not make the workspace inert. Explicit destructive operations retain their separate short blocking state. A failed save keeps the latest draft and requires an explicit retry; leaving with pending/failed work remains guarded.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.shell`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/live-workspace.tsx](../../../apps/web/src/components/live-workspace.tsx#L112) — `export default function LiveWorkspace()` |
| Mounted feature routing | [apps/web/src/components/preview/workspace.tsx](../../../apps/web/src/components/preview/workspace.tsx#L95) — `export function WorkspaceView(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L335) — `def snapshot(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L481) — `def apply_changes(` |
| Retain evaluated local edits across acknowledgement refresh | [apps/web/src/lib/workspace-rebase.ts](../../../apps/web/src/lib/workspace-rebase.ts#L4) — `export function rebaseEdit<T>(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |
| Related tests | [apps/web/tests/e2e/dashboard-saves.spec.ts](../../../apps/web/tests/e2e/dashboard-saves.spec.ts) |
| Related tests | [apps/web/tests/workspace-rebase.test.ts](../../../apps/web/tests/workspace-rebase.test.ts) |

<!-- END GENERATED TRACE -->

## Floating page actions

Dashboard, Goals, Tasks, Calendar, Habits and Notes use `apps/web/src/components/floating-actions.tsx` for their page actions instead of header buttons. A fixed trigger at the lower-left of the content area beside the sidebar (screen-left on mobile) opens a native nonmodal popover; outside click or Escape closes it. The component accepts localized labels and arbitrary children, including Notes preferences; `closeOnAction={false}` keeps the panel open for other interactive content. Action buttons close the panel before opening their ordinary editor; manual Refresh controls are removed, while failed-load/save retry controls remain.
