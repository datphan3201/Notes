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

All nine maps cite committed revision `2e9e68d690e77c581806917de2f6678984de5249` (2026-11-04 refresh). Source ranges were reviewed against that committed snapshot, including changed ownership/transition paths, before regeneration. The three former approved-contract-only maps now also carry source evidence for the implemented daily/weekly, Task classification and terminal TaskSeries rules.

These remain focused explanatory maps, not exhaustive physical ERDs or every possible branch:

- **System:** framework-free PHP, guarded HTTP, application transactions, owned PDO queries and private storage. Calendar reuses planning APIs; optional AI/provider, SMTP and jobs do not become independent application services.
- **Navigation:** current planning pages including `/calendar`, Notes, account/admin pages and shared controls. Edges mean containment, not redirects; Milestone panels, Review editors and floating AI remain in-page. The complete route inventory lives in [the HTTP reference](../reference/routes.md).
- **Planning containment:** Area/Goal/Milestone/Task/Checklist and optional primary Habits, with independent contributions/prerequisites. Notes links, explicit Main goal/roadmap preference and icon/importance presentation are explained separately from containment edges.
- **Tasks and daily/weekly:** independent time views/status/sort, Goal grouping in roadmap order, view-scoped Completed, retained History, atomic daily/week selection and quiet overdue reminders. Dashboard Today and This week remain separate tabs with different supporting cards; selection never changes Task status or dates.
- **Transitions and recurrence:** conditional acknowledgement for unchecked items/ancestor reopening, explicit overdue Reopen deadline choice, atomic side effects and terminal personal TaskSeries. Teamwork repeat is a separate flow. See [ISSUE-002](../issues.md#issue-002--ended-taskseries-has-inconsistent-uiapi-transition-rules) for the lifecycle history.
- **Notes:** the unchanged autosave machine is repinned to current committed source. Primary save states and non-success/recovery outcomes are separate maps. Goal/Task note links stay outside the autosave snapshot; Task/Review editors use explicit Save.

The pinned snapshot includes the shared floating editor and Goals UI unification: Goal/Milestone/Task creators and editors preserve their parent context, roadmap creation preserves append order, Milestone Tasks share Task-row structure, and Area management exposes icon/stars/Rename/Archive. Navigation includes the floating editor as a shared control. Strategy and Related work remain in the Goal information dialog. The linked revision is the implementation commit; this subsequent documentation/receipt commit does not change runtime behavior.

The source refresh follows [ISSUE-029](../issues.md#issue-029--goals-controls-and-dialogs-diverge-from-shared-editing-patterns) and retains the resolution of [ISSUE-028](../issues.md#issue-028--diagram-navigation-and-evidence-notes-lag-the-current-branch). Canonical receipts record each artifact's validation, delivery, strict provenance and automated browser checks. This evidence does not establish live application acceptance, provider compliance or a perceptual visual review. No generated application screenshots are committed.
