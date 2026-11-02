# Current decisions and product boundaries

[Documentation home](../README.md)

## Runtime and ownership

- PHP 8.5, strict types, explicit dependencies/bootstrap, focused Composer utilities, PDO and MySQL 8.4. No application framework, ORM or automatic container.
- Keep browser sources/PHP views in frontend, public deployment files in backend/public and private uploads outside that public root. Preserve same-origin application APIs, cookies, CSRF and `/api/v1` compatibility.
- Controllers parse/serialize HTTP; application services own transactions; domain code owns pure invariants; repositories own SQL. All owned lookups require the authenticated owner. Membership paths use explicit authorization, not an assumed owner match.
- Preserve unrelated local changes. Do not treat retired Laravel instructions or historical phase gates as active requirements.

## Product model

| Concept | Maintained boundary |
| --- | --- |
| Area / Goal | Configurable Areas and arbitrary-depth, single-parent Goal hierarchy |
| Milestone | Goal checkpoint; prerequisites are a separate acyclic relation |
| Task | Optional one primary Goal/Milestone, or Inbox; plain-text criteria, dates/schedule, optional estimate, independent Checklist and working Note |
| Dashboard roadmap | Explicit account-level Goal selection, shown below the header; no automatic highest-importance fallback. Archived/cleared/unset selections invite a new choice. |
| Daily/weekly plan | Explicit daily selection also selects the current Monday week, without changing Task dates/status. Today includes date/schedule matches; manual choices do not carry forward automatically. Both Dashboard panels are checklists; overdue reminders stop at History boundaries. |
| Progress | Finite primary children only; exclude Habits, contributions, occurrences and Tasks already represented through Milestones |
| Contributions | Many-to-many related work; no movement, progress weight or prerequisite meaning |
| Recurrence | Personal daily/weekly/monthly/yearly TaskSeries; Ended is terminal and future work requires a new series. Teamwork uses its separate completion-driven repeat path |
| Habit | Dedicated check-ins, fixed timezone after first check-in, streak/rest history; no Goal percentage contribution |
| Notes | Plain-text snapshot, autosave/recovery, checkable lines, Tags, private attachments; explicit permission for shared title/content edits |
| Reviews / Activity | Persisted snapshot/reflection versus append-only completion/reversal facts; never fabricated scoring |
| Teamwork | Membership roles, assignment, Goal chat; same-origin polling, not WebSocket collaboration |
| Accounts | User/admin roles, locking, email verification/change, recovery, optional email/TOTP 2FA |
| AI | Read-only chat plus separate validated proposal APIs; creation requires explicit Apply through ordinary services |

See each [UI route](../README.md#find-the-page-you-see) for current implementation and exceptions. Estimates are not time tracking. History retention archives rather than hard-deletes Tasks. Bulk Goal/Milestone archival requires explicit include_contents confirmation.

## Interface principles

Use the illustrated five-theme system, independent light/dark, user-controlled scenery/illustrations/quote and private backgrounds/RGB. Keep readable semantic controls and one selected content section at a time. Use short dialogs/drawers for short actions and focused components for longer work. Preserve drafts, focus, keyboard access and context on return. Do not combine unrelated workflows into one scrolling canvas merely to display them together.

The named fishbone head is the Goal and opens Goal information with Edit, Strategy and Related work. Milestone branches open Tasks; branch placement never creates dependencies. Help offers the illustrated walkthrough with account-wide first-visit dismissal. UI localization is English/Vietnamese; documentation is English.

## Deferred / excluded

No arbitrary custom fields/formulas, generic graph/database product, Task dependency graph, microservices, mobile app, per-Note passwords, PWA/offline sync, time-entry/timer subsystem, gamification, AI Modify/Delete or autonomous mutation. Existing retry/recovery handling is not offline synchronization. Future changes need explicit requirements and the normal ownership/transaction/verification boundaries.

## Updating decisions

Confirm intended behavior before implementation. Consolidate owning docs, traces and one brief audit entry at completion, rather than documenting every intermediate step. Record a source discrepancy as a known issue with its code/test pointers. Do not reintroduce a history of superseding paragraphs that disagree with the main text.
