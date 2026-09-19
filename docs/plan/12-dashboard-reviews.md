# Dashboard, Activity, and Reviews Contract

## Today and overdue

Today is the authenticated user's preference timezone.

Today's Tasks are active, non-Done Tasks where at least one applies: deadline=today; scheduled interval overlaps today's local day; recurring occurrence_date=today. Overdue is non-Done with deadline before today. A Task appears once per section even when multiple rules match.

## Weekly selections

Week starts Monday in the user's current timezone. Task and Milestone selection tables use `(user_id, week_start, object_id)` uniqueness and explicit position. POST duplicate is no-op. Reordering requires the exact active selection ID set. Completion does not remove selection. Archived objects disappear from active view but retain historical rows.

## Activity

A completion event is identified by `(source_type, source_id, source_version, event_type)`. Relevant event types: TaskCompleted, ChecklistChecked, HabitCheckedIn, MilestoneCompleted and their reversal types.

- Completing/checking writes one event in the domain mutation transaction.
- Reopening/unchecking writes one reversal referencing the active completion event.
- Re-completion after reversal creates a new completion tied to the new source version.
- Replay/no-op writes nothing.
- Effective local date and timezone are captured when the event occurs.
- The monthly API fact remains binary: a date is active if at least one completion event for that date has no reversal. The Dashboard may map the already-returned factual `total` to GitHub-style visual intensity levels (0, 1, 2–3, 4–6, and 7+) so busy dates are easier to scan. These levels are presentation only and must not be stored or described as a productivity score.

Tooltip counts active facts by type. The query uses `NOT EXISTS` on reversal reference and groups by effective date/type. Note edits and creation do not count. The monthly calendar renders weeks as columns, Sunday through Saturday as rows, and includes keyboard-accessible day cells, month navigation, weekday labels, an activity summary, and a Less/More legend.

## Goal snapshots

Daily maintenance calculates active Goals per user timezone after local-day close and upserts `(user, goal, local_date)`. It never overwrites a non-identical existing snapshot silently; checksum mismatch is an operational warning requiring review. Snapshot collection has no retroactive fabrication.

## Reviews

Kinds: Daily, Weekly, Monthly. Period identity uses the timezone captured at Review creation: date; Monday start; first day of month. Unique `(user, kind, period_start)`.

Draft creation builds a snapshot containing completed Tasks/Checklist Items, Habit check-ins, reached Milestones, available Goal snapshots, overdue work, generation timestamp, and timezone. Reflection fields: reflection, went well, went wrong, change next.

| Operation | Preconditions | Result |
| --- | --- | --- |
| Refresh | Draft and current version | rebuild factual snapshot, preserve reflections, increment version |
| Edit | Draft and current version | update reflection fields, increment once |
| Finalize | Draft/current version | status Finalized, finalized timestamp, version, Activity not emitted |
| Reopen | Finalized/current version | Draft; snapshot remains until explicit Refresh |

A timezone preference change does not change existing Review identity or snapshot grouping. Finalized snapshots never update automatically. Missing historical Goal snapshots are labeled unavailable.

## Dashboard response

`GET /api/v1/dashboard?month=YYYY-MM` returns user timezone, requested month, activity days/counts, today/overdue Tasks, current-week selections, and Habits with current period counts. Invalid month is 422. Queries are bounded to the visible period and do not load full object histories.
