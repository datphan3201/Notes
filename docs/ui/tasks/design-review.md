# Tasks design review

[Tasks](README.md) · [Issue register](../../issues.md)

Reviewed and approved on 2026-11-02 (Asia/Saigon). All recommendations are implemented: default All, view-scoped/paged Completed, dedicated Notes, aligned rows, visible Search/Status/Sort, context-aware capture, applicable series controls and retrieval-first History. Dashboard was owned independently; this change adds only Tasks-scoped presentation and reuses existing selection APIs. Theme, typography, cards and native controls are preserved.

## Roles and visual consistency

Dashboard supports daily/weekly execution and progress. Tasks should provide the complete work catalogue, preparation, scheduling, detailed editing and retrieval. Keep Today/This week views and shared completion/planning actions: opening the full list from Dashboard should retain context. Avoid adding a second Dashboard of progress cards to Tasks.

Keep the existing typography, theme tokens, pale page background, white panels, teal accent, control sizes, rounded corners, completion button and native select/dialog/detail patterns. Prefer aligning and simplifying existing components over introducing a new navigation or visual system.

## Implemented decisions

| Area | Observed behavior | Recommendation | Priority |
| --- | --- | --- | --- |
| Completed section | Its pipeline uses the global recent-completed set without the selected time view. A task outside Today/Week can appear below that view. | Implemented: scope to the current view with independent pagination. [ISSUE-011](../../issues.md#issue-011--tasks-completed-section-does-not-follow-the-selected-time-view). | P1; implemented |
| Repeating | Search/status controls remain visible but the series branch does not apply them. The badge counts non-Ended series while the list renders Ended rows too. | Implemented: series search/state/count/paging; Task controls hidden. [ISSUE-012](../../issues.md#issue-012--repeating-exposes-inapplicable-task-filters-and-a-different-count-scope). | P1 |
| Row hierarchy | Many inline actions compete with the name; flex spacing lets names start at different positions. Parent chips stretch with the content column. | Align tick, flexible left-aligned text and a compact action area. Keep parent chips sized to their text. Retain quick planning/star controls; make Archive secondary. | P1 |
| Planning facts | Rows show status/deadline/reminder but omit the start/work interval and reason for Today membership. Daily selection is represented differently from Dashboard. | Reuse agreed Today/status/date language and icon states. Surface relevant scheduled/date facts and distinguish daily planning from the due date. | P1 |
| Search and sorting | Search is inside collapsed details; there is no Tasks sort control comparable to Week's sort/status controls. | Keep search visible; offer independent Sort/Status selects using the established format. Put additional filters in the existing expandable area. | P1 |
| New task | Generic suggestion chips and optional descriptions/criteria make the dialog long. Create is below the scrolling fields. There is no explicit day/week selection; successful capture switches to All and clears filters. | Start with name, parent and an explicit planning choice. Put optional definitions/details below the existing expandable control, simplify suggestions, and keep Create visible. Preserve context after creation. | P1; implemented |
| Task detail | Header offers Week and Complete but no Today action. The same Notes card moves between Overview and Notes; completion checklist is nested inside the note editor's Write view. | Add the existing Today action. Prefer core information/criteria/checklist in Overview and working notes/resources in Notes. Preserve checklist and note checkboxes as distinct data. | P2; implemented |
| History | Configuration precedes retrieval. All matching records render without paging, in the order returned by the planning collection rather than a dedicated history chronology. | Put search/history first, make rules expandable, add recent-first ordering and manageable paging. Keep the existing retention/reopen contracts and explain archive versus deletion consistently. | P2 |

The broader planning/layout choices are tracked in [ISSUE-013](../../issues.md#issue-013--tasks-planning-and-retrieval-affordances-are-inconsistent-across-screens). Persisted fields and Task/date/recurrence invariants are preserved.

## Information hierarchy

- Tasks collection: view controls, visible search plus independent Sort/Status, aligned task rows and a view-scoped Completed group.
- New task: name first; parent and explicit planning; scheduling controls; optional details; the existing Create/Cancel actions remain visible.
- Task detail: Overview for definition/context/completion checks, Notes for working text/resources, Related work for contributions. Preserve existing draft/conflict behavior.
- History: search and results first; retention rules remain accessible through the existing expandable pattern.

All is now the default catalogue view; direct Today/Week URLs retain their context. The user approved All and dedicated Notes. Secondary row actions reuse native disclosure rather than introducing a new overflow menu.

## Evidence and limits

- [Tasks renderer](../../../frontend/src/js/planning/planning-page.js): taskRow, Repeating branch, Completed pipeline, post-create navigation and note-card placement.
- [View membership](../../../frontend/src/js/planning/task-views.js), [collection filtering](../../../frontend/src/js/planning/collection-page.js) and [series rendering](../../../frontend/src/js/planning/series-list.js).
- [New task template](../../../frontend/src/views/planning/tasks.php), [shared capture fields](../../../frontend/src/views/planning/task-capture-fields.php), [task detail](../../../frontend/src/views/planning/task.php), [history view](../../../frontend/src/views/settings/history.php) and [history renderer](../../../frontend/src/js/settings/task-history.js).
- An isolated Node exercise using the actual taskMatchesView helper reproduced two globally recent-completed IDs versus one matching Today ID. This establishes the scope difference, not an agreed product policy or browser acceptance result.
- Implementation checks: 90 Node tests, touched PHP template lint, scoped formatting, production build, documentation sync/check and Archify finalize (validate/deliver/check/browser-check). Browser smoke used a separate local QA account for capture, row/detail Today toggles, completion/reopen, checklist creation and persisted Notes. Read fixtures exercised Completed scope/pagination, series search/states/count and newest-first History search/pagination. A simulated selection failure after a real creation verified no duplicate creation. Tasks was checked at 320/390/768/1440 widths; expanded mobile capture kept Create visible. Screenshots were inspected and remain ignored local artifacts. No backend test suite or exhaustive browser regression is claimed. See [verification scope](../../testing/documentation-checks.md).
