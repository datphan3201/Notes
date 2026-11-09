# Interaction and state invariants

[Documentation home](../README.md) · [Shared shell](../ui/shared/shell.md)

## State ownership

| Concern | Current owner | Required behavior |
| --- | --- | --- |
| Live workspace | [live-workspace.tsx](../../apps/web/src/components/live-workspace.tsx) | Preserve latest navigation/panels/drafts across awaited refreshes; acknowledge writes |
| Data mapping | [live-model.ts](../../apps/web/src/components/live-model.ts) | Keep stable server identity/version and account-local date semantics |
| Main Notes | [notes-page.tsx](../../apps/web/src/components/preview/notes.tsx), [note-document.tsx](../../apps/web/src/components/note-document.tsx) | Explicit Save/version conflicts with local draft recovery |
| Planning edits | [editor.tsx](../../apps/web/src/components/preview/task-editor.tsx) | Explicit Save/Create/discard, retain input after failure |
| Offline Notes | [offline-notes.ts](../../apps/web/src/lib/offline-notes.ts) | Account-scoped outbox, preserve remote edits, unchanged-version deletion |
| Assistant | [live-assistant.tsx](../../apps/web/src/components/live-assistant.tsx) | Durable history, Stop waiting/Reconnect, exact reviewed Apply/Reject |
| Dialogs | [dialog.tsx](../../apps/web/src/components/dialog.tsx) | Semantic controls, keyboard/focus and context preservation |

Background autosaves batch nearby changes and keep navigation/controls available. Serialize writes, retain edits during acknowledgement/refresh, and keep each batch's explicit domain acknowledgements until it is sent. Save failure keeps the complete draft for explicit retry; ordinary autosave does not inert the whole workspace.

Older acknowledgements must not erase newer typing. Task and standalone Notes share the same Note editor/resource and explicit Save; Review reflections also use explicit Save. Note typing stays in local drafts until Save. Shared Notes use version conflicts, not realtime merging. Rich Note checkboxes and their derived text remain separate from completion checklist/domain status. Never silently save a dirty planning draft on Escape/navigation.

## Facts and denominators

Goal percentages use finite primary children only; contributions, Habits and recurring occurrences add no duplicate weight. Daily/weekly selections do not change Task dates/status. Activity records real transitions/reversals; Reviews retain persisted snapshots. Habit streak/rest rules use Habit-local dates. Label unavailable comparisons rather than inventing productivity scores.

## Verification

Source maps and tests identify behavior to inspect. Browser/API tests and human visual/keyboard/localization acceptance provide different evidence. Follow [manual acceptance](../testing/manual-checklist.md), record remaining discrepancies in [issues](../issues.md), and never infer ownership from a visible page shell.
