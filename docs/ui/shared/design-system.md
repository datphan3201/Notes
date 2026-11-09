# Shared UI components and templates

[Documentation home](../../README.md) · [Workspace shell](shell.md)

Planner's component library is the shared implementation for reusable interface pieces. The interactive catalogue is `/preview/components` (`?lang=en` or `?lang=vi`). It uses synthetic examples, requires no account and performs no API writes. Language, light/dark and five illustrated scenery selections apply only while viewing the catalogue; leaving restores the previous document appearance.

## Layers and ownership

| Layer | Source | Responsibility |
| --- | --- | --- |
| Theme and typography | `apps/web/src/styles/baseline/tokens.css`, `illustrated.css` and workspace appearance | Existing surface/text/accent/border/focus/status colors, Be Vietnam Pro and account theme preferences |
| Shared dimensions and component rules | `apps/web/src/styles/ui-system.css` | 4/8/12/16/24/32 px spacing, 44 px controls, 8 px control radius through the existing token, 16 px panel/header radius, feedback and status styles |
| Controls | `apps/web/src/components/ui/button.tsx`, `field.tsx` | Native buttons/inputs/selects/textareas, busy and disabled states, labels and field feedback |
| Layout and feedback | `apps/web/src/components/ui/layout.tsx`, `feedback.tsx` | Standard and custom page headers, content surfaces, notices and badges |
| Interaction templates | `apps/web/src/components/ui/patterns.tsx`, existing `dialog.tsx` and `floating-actions.tsx` | Tabs/panels, forms, async confirmations, discard prompts, toast feedback, modal focus/backdrop/Escape behavior and floating action groups |

Import from `@/components/ui`. Components accept already localized content; they do not choose the account language or perform business mutations. Existing imports from `components/preview/ui.tsx` re-export the common implementations, preserving feature callers while removing duplicate generic implementations. Feature-specific entity icons/pickers remain in that feature module.

## Component catalogue

| Component | Use and contract |
| --- | --- |
| `Button` | `primary`, `secondary`, `danger` or `ghost`; defaults to `type="button"`. Use explicit `type="submit"` in a form. `busy` adds an accessible busy state/spinner and disables repeated activation; it does not start or save work. Native props/ref are forwarded. |
| `IconButton` | Requires a localized `label`; native button props/ref are forwarded. Use decorative icons with `aria-hidden`. |
| `Field` | Wraps one labeled control and optional hint/error. Preserves the existing implicit label pattern. Caller owns extra `aria-describedby` relationships when composing custom controls. |
| `Input`, `Textarea`, `Select` | Native controls with shared styling. Native props/ref, required/disabled/read-only, validation and keyboard semantics remain available. Use textual types with `Input`; checkboxes/radios/file pickers retain their specialized existing components/styles. |
| `TextField` | A composed text input with generated or explicit ID, label and linked hint/error text. Supports native input props. |
| `PageHeader` | Standard title, optional description and action children. Uses the account's existing illustrated header style. |
| `PageHeaderFrame` | The same rounded container for custom heading markup such as Dashboard date/greeting and Goal roadmap controls. `illustrated={false}` preserves plain settings/detail headers. |
| `Surface` | A themed `section` for content, with shared spacing/border/radius and native section attributes. Use semantic headings inside it. Specialized Task/Note/Calendar cards keep their own domain layouts. |
| `Notice`, `Badge` | Informational/success/error feedback and neutral/accent/success/danger status labels. Error notices use `role="alert"`; ordinary notices use `role="status"`. Color accompanies readable text. |
| `LoadingSpinner` | A localized status label and decorative spinner; inherits the existing reduced-motion behavior. |
| `Tabs`, `Panel` | Linked tab/panel IDs, active state, roving focus and Arrow/Home/End support. The caller supplies a unique `id` per tab group and matching panel keys. |
| `Dialog`, `FormDialog`, `Confirm` | Existing modal lifecycle and draft/confirmation behavior, now backed by shared controls. Confirmations and discard prompts use a centered content-height modal, at most 400 px wide with 16 px viewport margins; long bodies scroll while actions stay available. This applies in the workspace and standalone catalogue. `FormDialog` submits native validated form data and handles submit errors; its hidden form remains mounted during discard confirmation so Keep editing retains uncontrolled input values; `Confirm` awaits its handler, disables repeated activation and keeps errors visible. Successful handlers close their own dialog. |
| `FloatingTaskPicker` | Nonmodal movable Task selection template with search/filters, selected/busy states and Add/return/pointer/native drag callbacks and an optional tray-return drop zone. [Workspace adapter and semantics](task-picker.md). |
| `FloatingActions` | Existing lower-left action popover, outside-click/Escape dismissal and arbitrary child actions; use `closeOnAction={false}` for interactive preferences instead of one-shot commands. |
| `State`, `Toast` | Existing shared loading/preview-content states and dismissible status feedback. `State` retains its preview-specific empty/sample copy for compatibility; live empty states should use appropriate product copy. |

## Example

```tsx
import { Button, FormDialog, TextField } from "@/components/ui";

<FormDialog
    title={text("New task", "Công việc mới")}
    text={text}
    onClose={close}
    onSubmit={async (form) => {
        await saveTask(new FormData(form));
        close();
    }}
>
    <TextField
        label={text("Task title", "Tên công việc")}
        name="title"
        required
    />
</FormDialog>

<Button variant="primary" busy={saving} onClick={save}>
    {text("Save changes", "Lưu thay đổi")}
</Button>
```

Keep business permissions, draft storage, explicit Save and server acknowledgement in feature services. Reuse a matching component/template before adding page-specific markup or CSS. Add a variant only for a recurring visual/interaction need; do not turn this library into a general schema-driven form framework. Feature CSS may own domain layout but should use the shared tokens for common controls.

## Current adoption and verification

The common Header/Field/Tabs/Panel/State/FormDialog/Confirm/Toast callers use the new shared implementations through compatibility exports. Dashboard, Tasks, Goal/Milestone detail and Settings custom headers use `PageHeaderFrame`; the other main page headers use `PageHeader`. Settings profile text/select controls and five settings content sections use the common controls/surfaces. All modal close buttons use `IconButton`. The local Next.js development indicator sits at the bottom-right to avoid intercepting the shared lower-left floating action trigger. Existing specialized cards, auth field behavior and remaining native feature buttons have not all been rewritten; the existing shared CSS classes continue to style them.

Inspect the catalogue at desktop/mobile widths, in both color modes and with each scene. Verify native form submission, invalid input feedback, discard confirmation, async confirmation failure/retry, focus and tab keyboard navigation. Run the narrow existing feature browser checks after changing interaction templates. Local checks on 2026-11-09: production E2E build/TypeScript passed; 36 existing complete-feature/Archive cases passed across desktop/mobile before the final discard-retention adjustment, followed by four focused Habit/profile form cases after the final build. CLI browser checks confirmed native required validation and submit, Keep editing retaining input values and returning focus, five scene images, Vietnamese labels, Arrow/Home tab controls, floating-popover Escape and no horizontal overflow at 390 px. Light desktop and dark mobile screenshots were inspected. Documentation checker and 17 documentation regressions passed. Automated database checks used only the guarded disposable `planner_test` database; catalogue interactions perform no API writes. No cloud deployment or physical-device acceptance is implied.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `shared.design-system`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Button and icon controls | [apps/web/src/components/ui/button.tsx](../../../apps/web/src/components/ui/button.tsx#L18) — `export function Button({` |
| Form controls and accessible text fields | [apps/web/src/components/ui/field.tsx](../../../apps/web/src/components/ui/field.tsx#L26) — `export function TextField({` |
| Shared page and surface templates | [apps/web/src/components/ui/layout.tsx](../../../apps/web/src/components/ui/layout.tsx#L8) — `export function PageHeader({` |
| Async confirmation and form templates | [apps/web/src/components/ui/patterns.tsx](../../../apps/web/src/components/ui/patterns.tsx#L273) — `export function Confirm({` |
| Interactive synthetic catalogue | [apps/web/src/components/component-library.tsx](../../../apps/web/src/components/component-library.tsx#L12) — `export default function ComponentLibrary({` |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |
| Related tests | [apps/web/tests/e2e/crud-audit.spec.ts](../../../apps/web/tests/e2e/crud-audit.spec.ts) |

<!-- END GENERATED TRACE -->
