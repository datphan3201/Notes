# HTTP and API Contract

## Common behavior

- Same-origin cookie sessions; API base `/api/v1`.
- State-changing requests require CSRF. JSON uses `X-CSRF-TOKEN`; forms use `_token`.
- JSON success: `{ "data": ... }`; collection pages add `meta`.
- JSON failure: `{ "code": "TOKEN", "message": "...", "errors": { ... } }`; conflict may add `current`.
- IDs serialize as strings; timestamps use UTC ISO 8601 with microseconds.
- Reject unknown request keys. Distinguish malformed JSON 400, auth 401, inaccessible 404, conflict 409, expired CSRF/session 419, validation 422, rate limit 429, and service failure 503.
- All mutable aggregate operations require `base_version`; exact replays return the current representation without incrementing version.

## Router behavior

Static routes define methods, path template, name, controller, auth, CSRF, and rate-limit bucket. Path parameters are single decoded segments. Reject malformed encodings, NUL, and encoded separators. Unknown path is 404; wrong method is 405 with `Allow`. HEAD reuses GET headers and suppresses body.

## Preserved endpoints

Preserve all current auth/settings, `/api/v1/session`, Notes, `/api/v1/labels`, attachments, avatar, and private-file URLs. Existing Note mutations retain complete-snapshot/replay/conflict/tombstone semantics. Existing label endpoints remain compatibility aliases over the Tag service.

## New resource endpoints

Appearance PATCH accepts `visual_theme` from the five bundled identifiers,
strict booleans `show_background`, `show_illustrations`, `show_quote`, and
`custom_quote` (plain text, up to 500 code points). Responses/bootstrap add these
fields plus the existing account timezone. No URL/path/upload preference exists.
Task create/PATCH accepts nullable integer `estimated_minutes` (1–1440),
serialized as integer/null. Existing optimistic version, validation, scheduling,
ownership, and explicit completion contracts remain authoritative.

Dashboard adds `week_summary` (selected Task denominator/completed/percentage,
previous-week percentage or null, percentage-point change or null, daily factual
activity counts), and `habit_streak` (days, through_date, seven `recent_days` each
with `date`, `state` checked/missed/rest/open/untracked, `done` and `total` daily
Habits, and `tracking_since` account-local date or null when no daily Habit
exists). Dashboard `habits` lists every active Habit (`id`, `name`, `period`,
`target_frequency`, `primary_goal_id`, current-period `completed_days`,
`done_today`, `rest_today`, and its own `streak`).
Dashboard Today also recognizes existing Task start dates, recurring occurrence dates, and schedules overlapping the account-local day; scheduled timestamps serialize in UTC ISO format. These read-only facts do not create a scoring system. Review snapshots may add
`task_summary` and `previous_activity_count`; existing stored snapshots without
these keys remain valid and display unavailable metrics until explicit Refresh.

The session resource and authenticated HTML bootstrap add
`walkthrough: { dismissed: boolean }`. `POST /api/v1/walkthrough/dismiss`
accepts an empty JSON object, requires authentication and CSRF, rejects unknown
fields, and returns `{ data: { dismissed: true } }`. It only writes the signed-in
account's introduction state, is idempotent, and requires no aggregate version.
It does not accept a user identifier or change appearance preferences.

| Group | Routes |
| --- | --- |
| Areas | `GET/POST /areas`, `GET/PATCH/DELETE /areas/{id}`, `POST /areas/reorder` |
| Goals | `GET/POST /goals`, `GET/PATCH/DELETE /goals/{id}`, `GET /goals/{id}/children|roadmap`, `POST /goals/{id}/move|complete|reopen` |
| Milestones | CRUD plus `POST /milestones/{id}/complete|reopen` |
| Dependencies | `GET/POST /milestones/{id}/prerequisites`, `DELETE /milestones/{id}/prerequisites/{id}` |
| Tasks | CRUD plus `POST /tasks/{id}/complete|reopen` and `POST /tasks/{id}/note` |
| Checklist | `GET/POST /tasks/{id}/checklist`, `PATCH/DELETE /tasks/{id}/checklist/{id}`, `POST /tasks/{id}/checklist/reorder` |
| Contributions | `GET/POST /{sourceType}/{id}/contributions`, `DELETE /{sourceType}/{id}/contributions/{goalId}` for Goal/Milestone/Task/Habit |
| Tags | CRUD `/tags`, `POST /tags/{id}/move`; entity PATCH accepts complete `tag_ids` snapshot |
| Habits | CRUD plus `GET /habits/{id}/history`, `PUT/DELETE /habits/{id}/check-ins/{date}`, `PUT/DELETE /habits/{id}/rest-days/{date}`; active Habit responses add `streak` (`count`, `unit` days/weeks, `through_date`), `rest_days`, `rest_window` (`from`, `to`), `tracking_since` and the Habit-local `today` |
| Task series | `GET/POST /task-series`, `GET/PATCH /task-series/{id}`, `POST /task-series/{id}/pause|resume|end` |
| Reviews | `GET/POST /reviews`, `GET/PATCH /reviews/{id}`, `DELETE /reviews/{id}` (base_version; permanent), `POST /reviews/{id}/refresh|finalize|reopen` |
| Dashboard | `GET /dashboard?month=YYYY-MM` |
| Weekly selection | GET/POST Task and Milestone selection collections; DELETE item; POST reorder |
| AI | `POST /ai/actions`, `GET /ai/actions/{id}`, `POST /ai/actions/{id}/apply|reject` |

HTML pages are `/`, `/dashboard`, `/goals`, `/goals/{id}`, `/tasks`, `/habits`, `/reviews`, `/teamwork`, auth, and settings. There is no `/ai` page: the floating AI chat is the only AI entry point. `/` remains Notes for compatibility.

`GET /goals/{id}/roadmap` returns `goal`, `child_goals`, `milestones` (each
including `tasks`, `recurring_tasks`, `prerequisites`, `progress`, and
`completion_locked`), `direct_tasks`, `recurring_tasks`, `habits`, and
`contributions`. All rows are active and owner-scoped; Tasks from unrelated
Goals are not loaded. Milestone finite Task progress excludes occurrences.
Goal create/PATCH accepts optional `strategy_notes` (20,000 code points).
Reopen may return 422 `ANCESTOR_REOPEN_REQUIRED`, `errors`, and `ancestors`;
explicit `acknowledge_ancestor_reopen=true` retries the current operation.

## Mutation precedence

For an authenticated request:

1. Parse content type/body; reject malformed/unknown keys.
2. Validate scalar syntax.
3. Load source aggregate by owner; inaccessible is 404.
4. Lock owner and current aggregate.
5. If desired state equals current state, return no-op success even with stale base version where the endpoint contract allows replay.
6. Check base version.
7. Validate referenced owned endpoints and domain rules.
8. Write aggregate, relationships, and Activity atomically.

Never reveal whether a foreign ID exists. A foreign relationship endpoint returns the same field error/404 behavior as a missing one according to the route contract.

## Representative requests

Create Goal:

```json
{
  "area_id": "uuid",
  "parent_goal_id": null,
  "name": "Become a backend developer",
  "description": "",
  "expected_result": "Build and deploy a complete backend",
  "completion_criteria": "Can do so without tutorial assistance",
  "importance": 5,
  "deadline": null
}
```

Complete Milestone:

```json
{ "base_version": 4, "acknowledge_open_tasks": true }
```

Create Task series:

```json
{
  "name": "Weekly project review",
  "primary_goal_id": "uuid",
  "frequency": "weekly",
  "interval_count": 1,
  "weekdays": [1, 5],
  "start_date": "2026-09-18",
  "end_date": null,
  "timezone": "America/Mexico_City"
}
```

All field bounds, state transitions, and relationship rules are defined in documents 10–13 and must be converted into endpoint tests before controller implementation.

## Approved feedback account and Task extension — 2026-10-19

- GET/POST /forgot-password and /reset-password provide CSRF-protected recovery.
- Guest pages accept `?lang=en|vi` (kept for the session; otherwise
  Accept-Language decides). Registration stores that language, names the
  starting Areas in it, sends a verification link, and redirects to
  /dashboard; sign-in and two-step verification also land on /dashboard.
- GET /verify-email?token= verifies the address from the emailed link (24
  hours). GET /api/v1/email returns {email, verified, pending_email, delivered};
  POST /api/v1/email/verification resends the link; POST /api/v1/email/change
  {current_password, email} returns 202 and mails a one-hour link to the new
  address; GET /confirm-email?token= applies the change, marks it verified and
  notifies the previous address. Invalid or expired links render 422.
- POST /api/v1/reminders/{id}/read dismisses one due reminder (personal or
  assigned team task) from the bell; POST /api/v1/notifications/read also
  dismisses every due reminder. A new reminder time or assignee shows it again.
- DELETE /goals/{id} and /milestones/{id} accept `include_contents: true` to
  archive everything beneath them (sub-goals, milestones, tasks, repeating
  series, prerequisite links) in one transaction; without it the previous
  empty-container rule applies.
- Task series accept `reminder_time` (HH:MM); each generated occurrence gets a
  reminder at that local time. Listing Tasks or reading the Dashboard tops up
  series whose generated horizon is under 28 days.
- Team goal members include the member's `biography`.
- Profile PATCH additionally accepts optional plain-text biography (0–2,000 code
  points); omission preserves the current biography.
- Preferences PATCH additionally accepts background_color (empty or #RRGGBB),
  locale (en/vi), notifications_enabled and email_notifications (booleans).
  Existing preference fields remain accepted; background_url is read-only.
  background_id (empty string or an owned upload ID) selects an uploaded image;
  empty shows the preset visual_theme. Either choice clears background_color.
  An ID the account does not own returns 404.
- POST /api/v1/preferences/background accepts one multipart background image,
  adds it to the account's private list (at most 12) and selects it, returning
  201 with {id, url, created_at}. GET /api/v1/preferences/backgrounds lists the
  account's uploads oldest first. DELETE /api/v1/preferences/backgrounds/{id}
  removes one upload (404 when not owned); when it was selected, the preset theme
  shows again. DELETE /api/v1/preferences/background removes the selected upload.
  Mutations require authentication and CSRF. GET /files/backgrounds/{id} and
  GET /files/background (selected upload) serve only the authenticated
  account's images, or 404; no owner ID is accepted.
- GET /api/v1/reminders lists at most 100 due unsent, active non-Done owned Tasks
  when notifications are enabled.
- Tasks accept nullable reminder_at as an explicit UTC timestamp; editing it
  resets delivery metadata. Delivery metadata is never client-writable.
- TaskSeries additionally supports monthly/yearly; old daily/weekly inputs retain
  their semantics. History/Completed are derived browser filters, not statuses.
