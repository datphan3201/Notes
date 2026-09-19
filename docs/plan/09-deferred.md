# Deferred and Excluded Work

## Deferred extensions

- Monthly or completion-relative recurring Tasks.
- Time estimates, actual time entries, timer UI, and time analytics.
- Habit streaks and richer trend analytics.
- Deadline/Habit/Milestone reminders and delivery channels.
- Email verification and password recovery.
- Offline/PWA access and synchronization.
- Public deployment/containerization unless separately requested.
- AI Modify/Delete permissions, additional providers, and larger autonomous actions.

These may reuse existing boundaries but require their own contracts and tests before implementation.

Future time tracking adds an owner-scoped `time_entries` table keyed to Task
(start, stop, duration, source) rather than changing Task completion semantics.
Current UUID ownership and Task repository boundaries permit that extension;
M01–M10 must not add a timer column or running-process state prematurely.

## Explicitly excluded

- Teams, workspaces, sharing, comments, assignees, collaboration roles, and WebSockets.
- Per-Note passwords and shared Notes.
- User-defined fields, schemas, formulas, Notion-like databases.
- Task dependencies or a generic graph database.
- Gamification/productivity scores.
- Microservices/event-sourcing/CQRS infrastructure.
- Mobile application.

Historical course documents may mention these features; `PLAN.md` supersedes them.
