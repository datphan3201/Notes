# Current decisions and product boundaries

[Documentation home](../README.md)

## Selected trial deployment (2026-11-08)

The user selected Funnel and Vercel, replacing the four-option deployment proposal. [Funnel](../migration/deployment-routes.md) exposes the watched local full stack; Vercel hosts only Next.js and forwards same-origin API requests through that existing Funnel to FastAPI. PostgreSQL, private files and the durable worker stay on the current machine. Both routes therefore depend on that machine, Docker and Tailscale remaining available. Google Cloud/VPS/Render provisioning is deferred. Only configured exact origins are trusted; the selected primary frontend origin also determines email links. Local proxy/command checks are distinct from an actual hosted Vercel trial.

## Runtime and ownership

- **Personal AI Planner target (2026-11-07):** Next.js/React/TypeScript, FastAPI/Python, PostgreSQL/pgvector and a modular monolith with separate API/worker processes under `apps/`. Teamwork is permanently removed by user decision; historical data remains preserved. V1 omits live collaboration. The [migration plan](../migration/personal-ai-planner.md) and [status](../migration/status.md) govern cutover. The legacy product table below remains a behavioral reference, not evidence of new-runtime feature parity.

- **Tech-stack migration policy:** Previous constraints forbidding application frameworks, ORMs, dependency-injection containers, or frontend frameworks have been lifted ([ISSUE-044](../issues.md#issue-044--planned-tech-stack-and-architecture-migration)). The codebase may be migrated to a new backend/frontend tech stack and architecture while preserving the core product model and security boundaries below.
- **Current baseline implementation:** PHP 8.5, PDO and MySQL 8.4 under `backend/`, with browser sources in `frontend/`, public files in `backend/public` and private uploads outside the public root.
- **Core ownership & security boundaries:** All owned lookups and writes require the authenticated owner (`user_id`). Membership and shared-resource paths use explicit authorization, returning `404` when inaccessible. Private uploads remain outside unauthenticated public web roots.

## Cloud trial target (2026-11-08)

The user selected [Render + Vercel + Supabase](../migration/render-vercel-supabase.md): Vercel hosts Next.js, Render runs the API and PostgreSQL polling worker, and Supabase provides PostgreSQL/pgvector plus private object storage. The Free trial colocates separate API/worker processes in one container and accepts sleep-related background delays; a paid dedicated worker is an optional later choice. FastAPI remains the authorization/session authority. Hosted deployment and real-data transfer are separate unperformed gates. Funnel remains the local testing fallback; Google Cloud provisioning is deferred. This supersedes the earlier Funnel-backed Vercel-only cloud trial.

## Product model

| Concept | Maintained boundary |
| --- | --- |
| Area / Goal | Configurable Areas and arbitrary-depth, single-parent Goal hierarchy |
| Icons / importance | Areas, Goals, Milestones and Habits take an optional icon and accent from a fixed server-validated catalogue (null = automatic default); Tasks have none. Importance is 1–5 stars at every level, Area included |
| Milestone | Goal checkpoint; prerequisites are a separate acyclic relation |
| Task | Optional one primary Goal/Milestone, or Inbox; plain-text criteria, dates/schedule, optional estimate, independent Checklist and working Note |
| Dashboard roadmap / Main goal | One explicit account-level focus Goal, shown as the Dashboard roadmap and as the Goals page Main goal and changeable from both; no automatic highest-importance fallback. Archived/cleared/unset selections invite a new choice. |
| Calendar | A Monday-first month/week view over Task, Milestone and Goal dates; moves and quick capture use the ordinary versioned APIs (no calendar store, no external sync). Habits are not drawn |
| Daily/weekly plan | Explicit daily selection also selects the current Monday week, without changing Task dates/status. Today includes date/schedule matches; manual choices do not carry forward automatically. Dashboard Today and This week are separate tabs with the same layout (insight cards above one full-width checklist); Today never shows week content, and Habits can be checked in from Today. Overdue reminders stop at History boundaries. |
| Progress | Finite primary children only; exclude Habits, contributions, occurrences and Tasks already represented through Milestones |
| Contributions | Many-to-many related work; no movement, progress weight or prerequisite meaning |
| Recurrence | Personal daily/weekly/monthly/yearly TaskSeries; Ended is terminal and future work requires a new series |
| Habit | Dedicated check-ins, fixed timezone after first check-in, streak/rest history; no Goal percentage contribution |
| Notes | Plain-text snapshot, autosave/recovery, checkable lines, Tags, private attachments; optional link to one owned Goal or Task (note_links), kept outside the autosave snapshot. Optional per-Note password (bcrypt, session unlock, enforced server-side). Sharing with registered accounts only; edit recipients co-edit title/content live over the realtime WebSocket server (OT, server-sequenced), falling back to autosave. AI summary per Note and AI questions with cited Notes (read-only). Offline: service worker + IndexedDB copy with a queued outbox; conflicts become an “(offline copy)” Note |
| Reviews / Activity | Persisted snapshot/reflection versus append-only completion/reversal facts; never fabricated scoring |
| Accounts | User/admin roles, locking, email verification/change, recovery, optional email/TOTP 2FA. System admins are granted and removed only with the server console and cannot be locked by another admin. Registration is open, invitation-only or closed as the admin decides. Locking hides the account's shared Notes until unlock |
| Moderation | Resolving a report means acting (withdraw the Note's shares, warn, lock) unless the account is already locked; dismissing takes no action, and the reporter is told which. Every administrator and console action is recorded in an append-only activity log |
| AI | Chat agent with owner-scoped read tools (Areas, Goals, Milestones, Tasks, Habits, Notes). Its Goal/Milestone/Task create, edit, complete, reopen and archive, roadmap creation and Task moves, Habit create, edit, archive and check-in, and Note create, edit and delete are only queued into one validated proposal; nothing changes until the user confirms the chat card, and Apply runs ordinary services against the versions read (any change since → 409, nothing applied) |

See each [UI route](../README.md#find-the-page-you-see) for current implementation and exceptions. Estimates are not time tracking. History retention archives rather than hard-deletes Tasks. Bulk Goal/Milestone archival requires explicit include_contents confirmation.

## Interface principles

Use the illustrated five-theme system, independent light/dark, user-controlled scenery/illustrations/quote and private backgrounds/RGB. Keep readable semantic controls and one selected content section at a time. Use short dialogs/drawers for short actions and focused components for longer work. Editing or creating a Task, Goal or Milestone from another page happens in the shared floating editor (a side sheet) without leaving the page; the full Task page and roadmap remain for working notes, Related work and moves. Preserve drafts, focus, keyboard access and context on return. Do not combine unrelated workflows into one scrolling canvas merely to display them together.

The named fishbone head is the Goal and opens Goal information with Edit, Strategy and Related work. Milestone branches open Tasks; branch placement never creates dependencies. Help offers the illustrated walkthrough with account-wide first-visit dismissal. UI localization is English/Vietnamese; documentation is English.

## Deferred / excluded

No arbitrary custom fields/formulas, generic graph/database product, Task dependency graph, native mobile app, offline editing outside Notes, time-entry/timer subsystem, gamification, or autonomous AI mutation (every AI change needs the user's confirmation; AI changes beyond Goals, Milestones, Tasks, Habits and Notes are not yet supported). Notes offline sync (2026-11-04, approved to meet the course rubric) covers Notes only; other pages show their last cached copy offline.

## Updating decisions

Confirm intended behavior before implementation. Consolidate owning docs, traces and one brief audit entry at completion, rather than documenting every intermediate step. Record a source discrepancy as a known issue with its code/test pointers.
