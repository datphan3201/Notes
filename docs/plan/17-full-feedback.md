# Full Feedback Extension — 2026-10-27

The user directed that every item in the feedback PDF be delivered and that any
conflicting rule be changed. This contract replaces the matching exclusions in
`01-scope.md` and `09-deferred.md`. Existing layering, owner scoping, CSRF,
validation, versioned mutations and migration immutability still apply.

## 1. Roles, reports and account locking

- `users.role` is `user` (default) or `admin`. Admins are assigned only from the
  server console: `php bin/console users:role <email> admin|user`.
- `users.locked_at`/`locked_reason`. A locked account cannot sign in, and any
  existing session of it is rejected on the next request (auth version bump and
  session deletion at lock time).
- A recipient of a shared Note may report it with a reason (1–1000 chars). The
  report stores the reporter, note owner, note id and a snapshot of the Note title
  and first 2000 characters of content at report time. Admins see this snapshot,
  not the live private Note.
- Admin page `/admin` lists reports (open first) with reporter, owner, note title,
  reason and date; admins resolve or dismiss a report with an optional response,
  and lock/unlock accounts. Admins cannot lock themselves. Every report and
  resolution notifies the relevant users (admins on new report; reporter on
  resolution).
- Admins set the system Task history limit (100–10000, default 1000).
- Non-admin access to admin APIs returns 404.

## 2. Note sharing

- Only the owner shares a Note, by exact recipient email, with permission `view`
  or `edit`. The recipient receives an invitation notification and must accept
  (or decline). Unknown emails return the same success shape to avoid account
  enumeration but create nothing.
- Owner can change permission or remove (kick) a recipient at any time; a
  recipient can leave. Deleted Notes end all shares.
- Accepted recipients see the Note under the Notes "Shared with me" scope. `edit`
  recipients may change title and content with the Note's version (409 on
  conflict, explicit Save). Color, pin, tags, attachments and deletion remain
  owner-only; attachments are not exposed to recipients.
- A shared edit notifies the owner and other accepted recipients (one unread
  "updated" notification per note per user; actors are never notified about their
  own changes). Accepting notifies the owner ("new member joined").
- Share APIs return 404 for Notes the caller cannot access.

## 3. Notifications

- `notifications` rows: user, type, payload JSON, `read_at`, `created_at`.
  Types: `share_invite`, `share_joined`, `shared_note_updated`, `report_new`,
  `report_resolved`, `team_invite`, `team_joined`, `team_task_assigned`,
  `team_message`. Task reminders remain derived from Tasks and appear in the same
  bell list.
- The topbar shows a bell with an unread count, polled every 60s while visible.
  Opening lists the latest 50; items can be marked read individually or all.
- When `notifications_enabled` is false no new notification rows are created for
  that user (admin report notifications are always created). When
  `email_notifications` is also true, invitations are additionally emailed.

## 4. Two-factor authentication

- Methods: `email` (6-digit code, 10 minutes, hashed, single use, 5 attempts) or
  `totp` (RFC 6238, SHA-1, 6 digits, 30s, ±1 step; secret encrypted with the
  application session key). TOTP setup shows the secret for manual entry and an otpauth link (no QR dependency)
  and is enabled only after a valid code. Disabling requires the current password.
- Login with 2FA stores only a pending user id in the session and redirects to
  `/two-factor`; the session is authenticated only after a valid code. TOTP users
  may request an email code as fallback. Attempts are rate limited.

## 5. Settings and Task history

- Settings groups Profile, Appearance, Security (password + 2FA), Notifications
  and Task history. Appearance offers an "Add" tile beside the preset themes that
  uploads a private background or chooses an RGB color. Each upload joins the
  picker as its own tile; any preset or upload can be selected again, and an ×
  in an upload tile's top-right corner removes it from the account's list.
- Task history thresholds are user preferences: completed for N hours
  (1–720, default 24) and overdue for N days (1–365, default 3). History has a
  search field. A user retention preference (`null` = keep, or 1–3650 days) and
  the admin limit are applied by `php bin/console history:prune`: history Tasks
  older than the user's retention, and the oldest beyond the system limit, are
  archived (removed from all views, never hard-deleted).

## 6. Dashboard

- Activity shows a full calendar year (weeks as columns, Mon–Sun rows, month
  labels) with a year list from the account's first activity/creation year to the
  current year. `GET /api/v1/dashboard/activity?year=YYYY` returns daily counts.

## 7. Tasks and Goals

- Capture (Tasks, Goal and Milestone) shows Name, Description, Completion
  criteria, then three icon buttons: due date (Today/Tomorrow/Next week/Pick a
  date with month calendar), reminder (Later today 19:00/Tomorrow 09:00/Next week
  09:00/Pick a date & time) and repeat (Daily/Weekdays/Weekly/Monthly/Yearly/
  Custom: every N days/weeks/months/years with weekdays for weeks).
- Task rows: circular completion, name, due/overdue text, then due-date, reminder,
  repeat, week, Edit, Remove (archive with confirmation) and Important star.
  Repeat on an existing Task creates a series that starts after the Task's date;
  the Task itself is unchanged.
- Completed Tasks (not yet in history) appear in a Completed list under the active
  list; unticking moves them back. Overdue rows are red and labelled.
- Recurring series management (pause/resume/end) moves from Habits to a Tasks
  "Repeating" view.

## 8. Habits

- The Habits page only manages Habits. Habit creation accepts an optional
  description.

## 9. Notes

- Note color accepts the preset names or any `#rrggbb` color. Each Note may use
  one of its own image attachments as a background (`background_attachment_id`,
  owner-only, cleared when that attachment is deleted).
- The editor shows an explicit Save button that flushes autosave immediately.
- One View button toggles grid/list. Sort by title, date modified or date
  created, ascending or descending (`sort`, `direction` list parameters).

## 10. AI assistant

- The sidebar tab is removed. A floating assistant button opens a chat dialog
  that answers questions about the user's own Planner using a bounded summary of
  their Goals/Tasks/Habits (names, statuses, dates). The existing proposal page
  remains reachable from the dialog. When AI is disabled the dialog says so.

## 11. Teamwork

- `team_goals` (name, description, due date, status, version), members with role
  `admin`/`editor`/`viewer` and status `pending`/`accepted`, `team_tasks` (name,
  description, assignee member, status `todo`/`in_progress`/`done`, due date) and
  `team_messages`.
- The creator is an accepted admin. Admins invite by exact email (with suggestions
  from people already in the user's teams/shares), change roles and remove
  members; at least one admin always remains. Editors manage tasks; viewers read
  and chat. Members may leave.
- The Teamwork page lists the user's team goals with progress (done/total team
  tasks), due date and member avatars; selecting one shows details, tasks with
  assignee/status/due, per-member completion (done/assigned) and team chat
  (polled every 5s while open, 1–2000 chars per message).
- Non-members receive 404 for every team endpoint.

### 11.1 Teamwork layout and team task capture — 2026-10-28

- Under the page header: a search box that filters team goals by name and
  description, then a single-row carousel showing at most 4 goals (2 under
  900px, 1 under 560px) with left/right arrows that move one full page.
- The selected goal shows its name, then two rows: Goal details | Members, and
  Tasks (wider) | Team chat. Members, Tasks and chat scroll inside fixed-height
  panels. Admins open an Invite dialog from the Members header (email + role);
  member rows show name, completion, role and Remove.
- Team tasks are added from a dialog with the same fields as the Tasks page
  capture form (name, description, due date / reminder / repeat pickers, start
  date, estimated minutes, importance 1–5) plus the Teamwork-only assignee.
  Migration `0021_extend_team_tasks` adds `importance` (1–5, default 3),
  `start_date`, `estimated_minutes` (1–1440), `reminder_at` (UTC) and
  `repeat_rule` (JSON `{frequency daily|weekly|monthly|yearly, interval_count
  1–99, weekdays ISO 1–7 for weekly, end_date|null}`).
- Completing a repeating team task creates the next occurrence (same name,
  description, assignee, importance, estimate and rule) whose due date is the
  next rule date after the completed task's due date (or the completion date
  when it had none); the reminder moves by the same number of days. No
  occurrence is created after `end_date`.
- A due team-task reminder appears in the assignee's notification bell (linking
  to the team goal) until the task is completed or removed. Team reminders are
  in-app only; email reminders stay limited to personal Tasks.
