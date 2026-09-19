# Habits and Recurring Tasks Contract

## Habits

Daily Habit target is exactly 1 completion day/day. Weekly target is 1–7 distinct days/Monday–Sunday week. A Habit may have one primary Goal and multiple Goal contributions.

`PUT /habits/{id}/check-ins/{YYYY-MM-DD}` is idempotent. The selected date is interpreted in the Habit's fixed IANA timezone, must not be future there, and creates one check-in plus Activity. Repeated PUT returns existing data without another Activity. DELETE removes the active check-in and appends one reversal Activity referencing the original; repeated DELETE is 204 no-op.

After the first check-in, period and timezone are immutable. To change them, archive and create a replacement. Name, description, importance, Goal, Tags, and contributions remain editable.

Streaks are deferred. Derive current weekly completed-days/target directly from check-ins.

## TaskSeries rule

V1 frequency:

- Daily: every `interval_count` calendar days from `start_date`.
- Weekly: every `interval_count` Monday-based weeks from the start week on `weekdays` values 1–7.

Constraints: interval 1–52; at least one weekday for weekly; no weekdays for daily; optional end date is inclusive and not before start; timezone is valid IANA. Local schedule time and positive duration are optional. A nullable deadline offset is 0–365 days.

## Occurrence calculation

Use local calendar dates; never add fixed seconds. The pure calculator receives rule plus exclusive cursor and inclusive horizon and yields sorted unique eligible dates greater than cursor.

- Creation cursor is the day before start date.
- Materialization horizon is `today in series timezone + 35 calendar days`, inclusive.
- Cap one transaction to 200 occurrence attempts.
- After each batch, set cursor to the last fully evaluated calendar date, not merely the last generated date.
- If more eligible/evaluated dates remain, commit and continue another transaction.
- Unique `(series_id, occurrence_date)` makes retry/concurrency safe.
- GET requests never materialize.

Each occurrence copies the series template into a normal Task, including parent, text, importance, checklist templates, Tags, contributions, schedule, and deadline. It has independent version/status/checklist/Note thereafter.

## Time conversion

Store occurrence date and rule timezone. Convert optional local time to UTC:

- Nonexistent DST time advances to the first valid local instant after the gap.
- Ambiguous local time chooses the earlier instant.
- Store the choice as UTC; never recalculate an existing occurrence after timezone rules change.

## Series lifecycle

| Operation | Behavior |
| --- | --- |
| Pause | Set Paused and `paused_at`; existing occurrences remain |
| Resume | Set Active; advance cursor to the day before current local date if older, so paused dates are skipped; materialize forward |
| End | Set Ended and end date to selected date; archive future NotStarted occurrences after confirmation; preserve started/Done occurrences |
| Edit template/rule | Not allowed in place after any occurrence exists; use End-and-replace transaction |

Before the first occurrence exists, PATCH may change rule/template with current base version. End-and-replace creates the new series, ends the old one, handles future NotStarted occurrences, and returns both IDs atomically.

## Progress and Activity

Occurrences appear in Today/weekly planning, Activity, and Reviews. They are excluded from Goal/Milestone finite Task denominators and Goal progress. A Milestone UI lists recurring work separately from finite Task progress.

## Failure/replay behavior

Materialization locks the series row. Duplicate insert is treated as an idempotent success after verifying existing ownership/series/date. A malformed series stops that series, records a safe operational error, and does not prevent other series from processing. The command exits nonzero if any series fails.
