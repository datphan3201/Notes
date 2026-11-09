# Historical Archify visual maps

[Documentation home](../README.md) · [Current runtime](../architecture/runtime.md) · [Artifact policy](../maintenance.md#historical-artifacts)

**Historical artifacts, not current Next.js/FastAPI architecture diagrams.** These HTML/JSON outputs and original automated receipts describe the retired PHP implementation or product contracts reviewed in 2026-11-04–07. Their source paths/revisions/validation totals are historical. The current Markdown feature/source/route maps supersede them for implementation work.

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

Seven source-backed maps pin historical commit `2e9e68d690e77c581806917de2f6678984de5249`; navigation/TaskSeries maps include product-contract reviews after Teamwork removal. The old system map depicts PHP/PDO, and Notes save/realtime/API details do not establish behavior of the new runtime. Even matching product concepts require current source verification.

This documentation pass preserves every artifact and receipt byte rather than fabricating new provenance or browser validation. The current checker validates links to these files but does not validate their internal HTML/JSON source paths, hashes or receipts. Historical whitespace is ISSUE-007. The former request to keep these diagrams current (ISSUE-036) was retired when their scope was explicitly made historical; current architecture uses maintained Markdown/Mermaid.
