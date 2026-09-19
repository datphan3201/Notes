# Product Scope and Acceptance Boundaries

## Goal

Evolve the existing personal Notes application into an understandable goal and task management system while replacing Laravel with framework-free PHP. Preserve working behavior and use well-defined entities rather than user-created schemas.

## In scope

- Independent user accounts, sessions, CSRF, profile, password, preferences, avatar.
- Existing Notes, autosave/recovery, search, pinning, colors, attachments, and label compatibility.
- Configurable Areas; create three editable placeholders named `Area 1`,
  `Area 2`, and `Area 3` for each new account after M06 is installed. The
  Goals empty/onboarding state immediately invites renaming; product categories
  are never encoded as enums or hardcoded Career/Lifestyle labels.
- Arbitrary-depth Goals with one primary parent.
- Milestones with Task progress and Milestone-level prerequisites.
- Tasks with independent status, Checklist, completion criteria, Note, dates, schedule, Tags, contributions, and daily/weekly recurrence.
- Dedicated Habits and completion history.
- Hierarchical Tags shared by Notes, Goals, Milestones, Tasks, and Habits.
- Daily, weekly, and monthly Reviews.
- Dashboard activity grid, Today's Tasks, weekly selections, and Goal-related Habits.
- Google AI provider adapter for selected-context suggestions and approved creation.

## Explicitly excluded

- Teams, workspaces, sharing, comments, assignees, roles, and live collaboration.
- Notion-style databases, arbitrary custom properties, formulas, and generic graph storage.
- Task dependency graphs.
- Core numeric metrics or productivity scores.
- Advanced notification infrastructure, gamification, mobile apps, microservices.
- Monthly recurring Tasks, time entries, timers, email verification/reset, and offline/PWA functionality in this delivery.

## Product rules

1. Every object belongs to one user.
2. A Goal has exactly one primary location: Area or parent Goal.
3. A Milestone belongs to one Goal. A Task has at most one Goal or Milestone parent.
4. Contributions add meaning without moving or duplicating an object.
5. Milestone dependencies affect only Milestone completion.
6. Completion criteria are text and are never interpreted automatically.
7. Task status, Checklist, and completion criteria remain independent.
8. Checklist Items remain title, checked state, and order only.
9. Habits and recurring Tasks are ongoing work and do not affect Goal percentage.
10. AI actions use the same validation and authorization as manual operations.

## Definitions of completion

- A leaf Goal is 0% until explicitly completed and 100% when completed.
- A nonleaf Goal's live percentage is the equal mean of its active immediate child Goals, Milestones, and direct one-off Tasks.
- A Milestone contributes 100 only when explicitly Completed.
- A one-off Task contributes 100 only when Done.
- Recurring Tasks, Habits, contributions, archived objects, and Tasks inside Milestones are excluded.
- A calculated 100% does not silently change Goal status; the user explicitly completes the Goal.

## Lifecycle defaults

- Planning records use archive rather than destructive deletion in normal UI.
- A container must have active children moved or archived before it can be archived.
- Completed parents reject new active children. Reopen the parent first.
- Reopening a child under completed ancestors requires an explicit operation that reopens those ancestors in the same transaction.
- A completed Milestone may have unfinished Tasks only after `acknowledge_open_tasks=true`.

## Success criteria

The migration succeeds when the current Notes contracts pass without Laravel; the new domain invariants, security tests, frontend build, migrations, browser critical paths, and operational smoke checks pass; and no first-party runtime code imports Laravel/Illuminate.
