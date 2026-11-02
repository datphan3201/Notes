# Archify visual maps

[Documentation home](../README.md) · [Regeneration workflow](../maintenance.md#archify)

All maintained diagrams are authored with Archify and stored here, with their candidate JSON and final automated receipts. Open the standalone HTML in a browser; the route/component Markdown remains the editable UI-to-code lookup layer.

| Question | Interactive diagram | Source | Automated receipt |
| --- | --- | --- | --- |
| How does UI reach owned persistence? | [System](system/index.html) | [JSON](system/candidate.json) | [Receipt](system/index.finalize-summary.json) |
| Where are route groups/shared controls? | [UI navigation groups](ui-navigation/index.html) | [JSON](ui-navigation/candidate.json) | [Receipt](ui-navigation/index.finalize-summary.json) |
| What are Task views versus statuses and series? | [Task classifications](task-planning/index.html) | [JSON](task-planning/candidate.json) | [Receipt](task-planning/index.finalize-summary.json) |
| What belongs to the primary planning hierarchy? | [Planning containment](planning-structure/index.html) | [JSON](planning-structure/candidate.json) | [Receipt](planning-structure/index.finalize-summary.json) |
| What happens on Complete/Reopen and acknowledgement? | [Task request sequence](task-transition/index.html) | [JSON](task-transition/candidate.json) | [Receipt](task-transition/index.finalize-summary.json) |
| How does Week work become Today work and complete? | [Daily/weekly planning contract](daily-weekly-planning/index.html) | [JSON](daily-weekly-planning/candidate.json) | [Receipt](daily-weekly-planning/index.finalize-summary.json) |
| How does personal repeat work pause/resume/end? | [Terminal TaskSeries contract](task-series-lifecycle/index.html) | [JSON](task-series-lifecycle/candidate.json) | [Receipt](task-series-lifecycle/index.finalize-summary.json) |
| When is a Note dirty/saving/saved/retrying/conflicted? | [Notes save lifecycle](notes-autosave/index.html) | [JSON](notes-autosave/candidate.json) | [Receipt](notes-autosave/index.finalize-summary.json) |
| Who handles validation/session/missing-Note errors? | [Notes save outcomes](notes-save-outcomes/index.html) | [JSON](notes-save-outcomes/candidate.json) | [Receipt](notes-save-outcomes/index.finalize-summary.json) |

## Evidence and scope

Code-backed source links are pinned to committed revision b1b5f976a9efdba105d7de6b7dd4417a5e52f74f. The Task planning, daily/weekly workflow and terminal TaskSeries maps are explicitly labeled approved-contract diagrams: they describe the approved local implementation without attributing uncommitted bytes to that earlier revision. The worktree also contains local changes, including Vite/CSP and auth-template edits; Markdown traces point to current source, while diagrams must not claim those local bytes are committed evidence. Recheck cited sources when behavior changes.

These are focused explanatory maps, not exhaustive physical ERDs or every possible branch. Task planning includes daily selection and Overdue, default All, view-scoped Completed, independent sorting and applicable series-state filters; its previous pinned classification map was replaced. The daily/weekly workflow shows selection versus Task completion and the explicit Reopen deadline decision. The route inventory is complete in [the HTTP reference](../reference/routes.md). The navigation tree groups capabilities; its edges are containment, not redirects. Planning containment excludes Inbox Tasks and describes contributions/prerequisites separately. The terminal series map describes the approved API lifecycle and its rejection/no-op rules; [ISSUE-002](../issues.md#issue-002--ended-taskseries-has-inconsistent-uiapi-transition-rules) records the implementation and passing service/HTTP verification. The sequence shows a conditional acknowledgement round-trip. Notes maps deliberately separate primary save paths from error/recovery outcomes.

Automated validation, strict artifact/provenance checks and browser checks passed for the delivered artifacts. This does not constitute a perceptual visual audit or application acceptance test. Receipts hold exact checks/limits; no generated app screenshots are committed.

Current local source differences include [HTTP wiring](../../backend/bootstrap/http.php), [Application](../../backend/src/Http/Application.php), [local CSP](../../backend/src/Http/Security/ContentSecurityPolicy.php), [Vite config](../../frontend/vite.config.js), [login template](../../frontend/src/views/auth/login.php) and [recovery template](../../frontend/src/views/auth/recovery.php). They were preserved; these diagrams do not claim them as committed evidence.

The current local implementation also changes [Habit timezone validation](../../backend/src/Application/Habits/HabitService.php) and [TaskSeries validation/transitions](../../backend/src/Application/Recurrence/TaskSeriesService.php), with [integration](../../backend/tests/Plain/Integration/HabitsRecurrenceTest.php) and [HTTP](../../backend/tests/Plain/Http/PlanningHttpTest.php) regression cases. Use these live source traces for the fix rather than the older pinned diagram citations.
