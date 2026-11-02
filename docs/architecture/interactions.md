# Interaction and state invariants

[Documentation home](../README.md)

## Labels, hooks and browser initialization

[app.js](../../frontend/src/js/app.js) initializes pages using data attributes. Change a template hook and its consumer together. UI labels can be translated; source symbols and route names remain the trace keys. Page shells, dialogs and tabs may share a URL: do not infer a route from a visible heading.

The shared [CSS map](../ui/shared/shell.md#style-file-ownership) identifies styling owners. Keep semantic controls, visible keyboard focus, responsive layouts and readable zoom. Preserve the illustrated appearance without treating decorative assets as live data.

## Reads, writes and drafts

| Concern | Owner | Invariant |
| --- | --- | --- |
| Stale reads | [ReadCoordinator](../../frontend/src/js/lib/read-coordinator.js) / feature read guards | Only current request may replace visible state |
| Planning drafts | [DraftBuffer](../../frontend/src/js/planning/draft-buffer.js) | Older acknowledgement must not erase newer typing |
| Notes autosave | [AutosaveMachine](../../frontend/src/js/notes/autosave-machine.js) | Frozen request identity, one logical in-flight mutation, explicit conflict choice |
| Notes recovery | [RecoveryStore](../../frontend/src/js/lib/recovery-store.js) | Account-scoped, validated sessionStorage recovery |
| Transitions | [transitionEntity](../../frontend/src/js/planning/transitions.js) | Required completion/ancestor acknowledgements remain explicit |
| Navigation/dialogs | [workspace-ui](../../frontend/src/js/lib/workspace-ui.js), [backdrop helper](../../frontend/src/js/lib/dialog-backdrop.js) | Preserve draft/focus, guard pending saves and dirty navigation |

Checkable Note lines remain literal `- [ ]` / `- [x]` plain text with compatible undo/composition behavior. Completion Checklist rows remain separate domain data and Activity. Task notes, shared title/content edits and Review reflections use explicit Save; do not apply the main Notes autosave contract to them accidentally.

## Facts and denominator discipline

Show actual selected/completed denominators and label unavailable comparisons. Goal percentages use finite primary children only. Weekly selected completion differs from immutable Review snapshots. Activity counts unreversed facts, not edits or an inferred productivity score. Habit streaks use Habit-local days/rest rules. Preserve these distinctions when reusing cards/charts.

## Change review

Trace the visible component first, follow every relevant server effect, and inspect sibling implementation/tests. Update its behavior text and structured references before refreshing generated links. A UI-only change does not establish HTTP/authorization correctness; a passing API test does not establish visual/accessibility quality.
