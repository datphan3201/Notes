# Planning Domain Contract

## Shared fields

Names are trimmed/NFC-normalized plain text. Area names are 1–80 code points; entity names 1–200; Checklist titles 1–500. Description, expected result, and completion criteria are optional plain text up to 10,000 code points. Importance is 1–5, default 3. Every mutable entity has owner, version, created/updated time, and optional archive time where specified.

## Entities

| Entity | Required | Optional/default | Relationships |
| --- | --- | --- | --- |
| Area | name, position | description | root Goals |
| Goal | primary Area/Goal, name, importance | description, expected result, criteria, deadline | child Goals, Milestones, Tasks, Habits, Tags, contributions |
| Milestone | Goal, name, status | description, criteria, deadline | Tasks, Tags, prerequisites/dependents, contributions |
| Task | name, importance, status | Goal/Milestone parent, description, expected result, criteria, dates/schedule, Note, Tags, contributions, occurrence | Checklist Items |
| ChecklistItem | Task, title, position | checked=false | no nested objects |
| Habit | name, period, target, timezone | description, importance, primary Goal, Tags, contributions | check-ins |

## States

Goal: `Active`, `Completed`. Milestone: `NotStarted`, `InProgress`, `Completed`. Task: `NotStarted`, `InProgress`, `Blocked`, `Done`. Archived is an orthogonal timestamp, not a status value.

### Area

An account starts with three editable placeholders. The UI recommends two to
four active Areas and the backend permits at most four; one active Area is
allowed temporarily while reorganizing. The final active Area cannot be
archived. Rename/reorder increments the Area version once. Archive requires no
active root Goals; it never moves or archives Goals automatically. Area names
are owner-unique after the same normalization used for Tag uniqueness.

### Goal

| Trigger | Preconditions | Result |
| --- | --- | --- |
| Complete | active; leaf or calculated progress=100 | status Completed, completion Activity |
| Reopen | Completed | status Active; if invoked for a descendant, explicitly reopen completed ancestors in same transaction |
| Add child | Goal Active | create child; reject under Completed Goal |
| Archive | no active direct children/relationships requiring it | archived; excluded from active progress/navigation |

Calculated 100% never auto-completes. Reopening a finite child beneath a Completed Goal is one explicit operation that returns the list of ancestors to reopen before confirmation; confirmed request locks and reopens all atomically.

### Milestone

`NotStarted ↔ InProgress`, either non-completed state → `Completed`, `Completed → InProgress` through explicit reopen.

Completion requires every active prerequisite Completed. Unfinished active Tasks require `acknowledge_open_tasks=true`. Reopening a prerequisite is rejected while any Completed dependent remains; the user reopens dependents first. Adding a prerequisite to a Completed Milestone is rejected unless it is already Completed.

### Task

`NotStarted ↔ InProgress ↔ Blocked`, any non-Done → `Done`, `Done → InProgress` through explicit reopen. Done may coexist with unchecked Checklist Items after confirmation. Checklist changes never alter Task status and status changes never alter Checklist Items.

## Hierarchy

A Goal has `area_id XOR parent_goal_id`. A Task has zero or one of `goal_id XOR milestone_id`; no parent means Inbox. A Milestone has one Goal. Habit's primary Goal is optional. No object has multiple primary parents.

Moves lock the owner and involved objects, validate active owned destinations, reject self/descendant moves, update one parent, increment source version once, and preserve subtree IDs.

## Contributions

Sources Goal, Milestone, Task, and Habit may contribute to multiple Goals. Contributions do not change location, progress, scheduling, or completion. Duplicate/self edges are no-ops or validation errors consistently: POST duplicate returns current edge with 200 and no version increment; self Goal contribution is 422. Goal contribution graph cycles are 422.

Add/remove increments source aggregate version once and records no Activity. A stale different mutation is 409. Archived sources/targets accept no new edge; existing edges remain visible historically and are ignored from active related-work queries.

## Dependencies

`milestone_dependencies(milestone, prerequisite)` means the prerequisite must be Completed before the milestone can complete. Cross-Goal edges are allowed within an account. Add/remove increments the dependent Milestone version once. Duplicate add is 200 no-op. A cycle, self edge, inaccessible endpoint, or invalidation of Completed state is rejected.

## Archival

- Areas/Goals/Milestones/Tasks/Habits/TaskSeries use archive semantics.
- Archive never cascades silently.
- Containers require active direct children to be moved/archived first.
- Milestones with active dependency edges must remove them or archive counterpart objects first.
- A Task occurrence archive prevents regeneration through its persistent unique series/date row.
- Archived objects cannot receive children, Tags, contributions, dependencies, check-ins, weekly selections, or AI-created updates.
- Unarchive is not in v1. Recreate or retain in historical views.

Hard deletion is not exposed for planning entities in v1. Archive endpoints
use HTTP DELETE for compatibility with resource conventions but only set
`archived_at` after lifecycle validation.

## Goal progress

For an active Goal, each active immediate child Goal contributes its recursively calculated percentage, each active Milestone contributes 100 iff Completed, and each active direct one-off Task contributes 100 iff Done. Mean all eligible components equally. A leaf uses explicit Goal status. Exclude Tasks inside Milestones, recurring occurrences, Habits, contributions, and archived records.

Use iterative postorder traversal and a visited set. A detected stored cycle is an integrity error; do not return a misleading percentage. Round only in serializers/UI.

## Version/no-op rules

Every different successful aggregate mutation increments version exactly once, even if multiple child/junction rows change. Exact desired-state replay returns 200 with current version and does not update timestamps or Activity. Deletes/archives require current base version. Relationship endpoints apply this rule to their source aggregate.

## Ownership

Repositories never offer unscoped object lookup to controllers. Services load every referenced endpoint with the authenticated owner. Missing and foreign identifiers are indistinguishable outside validation field placement. Composite ownership foreign keys are defense in depth.
