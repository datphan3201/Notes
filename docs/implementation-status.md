# Implementation Status

Updated 2026-10-08 UTC. This ledger describes the current application and recorded
checks. Contracts describe required behavior; a historical Verified phase does
not establish that every edge case has been tested.

## Canonical application

Framework-free PHP 8.5 under `backend/src` (`Planner\`), explicit bootstrap
wiring, owned PDO repositories, MySQL, same-origin cookie sessions and ordinary
escaped PHP views under `frontend/` are active. Laravel has been retired.
M00–M10 were recorded as implemented and verified on 2026-09-18; their phase
specifications remain maintenance contracts in `docs/plan/phases/`.

Current features include authentication/settings, Notes/Tags with autosave and
recovery, private attachments/avatars, configurable Areas, nested Goals,
Milestones, Tasks/Checklists/Task Notes, contributions, Milestone dependencies,
Habits, daily/weekly recurrence, Dashboard/Activity, Reviews and approval-gated
AI proposals. AI availability depends on server configuration.

## Current planning and interface behavior

- The owned roadmap projection groups existing relationships consistently.
  Finite primary children determine Goal progress; Strategy, Habits,
  contributions and recurring occurrences do not inflate it.
- The fishbone shows the actual Goal name at its head and six Milestone cards
  per page. Desktop uses a horizontal spine; narrower screens use a vertical
  spine. Branch position expresses membership, never a prerequisite.
- Selecting the named head opens saved Goal information. Existing Edit goal,
  Strategy and Related work are grouped disclosures in one native dialog,
  replacing the four top-level Goal tabs. Closing retains drafts and restores
  focus; pending saves block dismissal. Conflict reconciliation temporarily
  replaces the dialog and returns to the original form. Completed Goals remain
  inspectable. Milestone focus and paging remain available.
- Strategy/details and Task/Review editors preserve newer typing during save,
  dirty drafts during refresh, and explicit saved-version/draft conflict choices.
  Milestone Task capture retains a separate draft per branch. Task Notes and
  Reviews use explicit Save; these drafts do not promise browser-crash recovery.
- Planning mutations preserve owner scoping, finite progress and completion
  acknowledgements. Reopening finite descendants explicitly reopens completed
  Goal ancestors atomically; dependency failure rolls back the operation.
  Adding finite work requires reopening completed ancestors first. Non-finite
  series materialization does not silently reopen Goals.
- Tasks support nullable estimated minutes (1–1440) and a versioned edit dialog.
  Today/Next/This week/Backlog derive from existing dates, schedules and weekly
  selections. Capture may start in Inbox without required parent structure.
- Dashboard modes separate Today, This week and Activity. Focus actions use
  Edit (20%) and Complete (80%). Counts and percentages use documented actual
  denominators. Review facts remain saved snapshots until explicitly refreshed.
- Five bundled themes (Mountain journey, Forest, Ocean, Pisces and Starry sky)
  retain independent light/dark and background/illustration/quote toggles.
  Private quote overrides are account-persisted. Theme uploads are unavailable;
  existing avatars/attachments remain separate workflows.
- Help beside Appearance opens a 33-step illustrated walkthrough. First-visit
  dismissal is account-wide; other dialogs and Notes recovery take priority.
  Walkthrough images remain explicitly replaceable placeholders.
- Original reference graphics remain bundled rather than simplified. The app
  adapts them to live data and responsive controls; this is not a certified
  100% pixel match to the static reference.

## Schema and deployment

There are nine checksum migrations. Current extensions are:

| Migration | Purpose |
| --- | --- |
| 0006 | Goal Strategy notes |
| 0007 | Account-wide walkthrough dismissal |
| 0008 | Interface themes, visibility and private quotes |
| 0009 | Optional Task estimated minutes |

Earlier browser examples used isolated MySQL databases (`goals_test` and
`goals_ui_review`). The local-startup follow-up now uses persistent `goals_dev`
on loopback port 3307, with all nine migrations applied and healthy. Its data
directory is `~/.local/share/planner/mysql/data`, outside temporary storage and
Git. The old system `notes_dev` database was not modified or imported. A separate
local demo account now contains the roadmap reference dataset described below;
registration remains the supported bootstrap for other accounts. Production
was not deployed. Other installations must migrate and
check following [the runbook](hosting.md).

## Current verification

See [Verification](verification.md) for dated commands and browser scope.
Current checks include the full PHPUnit suite (**90 tests / 715 assertions**),
**47 Node tests**, formatting and the production Vite build. The focused
Planning HTTP suite passes **2 tests / 38 assertions** against guarded real
MySQL `goals_test`.

## Cleanup

Obsolete Laravel audit/migration/file-map/handoff documents, the duplicate
`Readme.txt` runbook and generated comparison gallery were removed. Active
links now point to the canonical contracts and hosting guide. The obsolete
visual baseline and append-only historical test logs were consolidated into
current status/evidence; original migration records remain in Git history.
Generated screenshots, Playwright logs/snapshots, PHPUnit caches, retired
Laravel compiled views/cache and old application logs were removed: 454 generated/cache files, approximately 47.98 MiB, plus six obsolete/duplicate documents and Windows download metadata.

Keep current source, tests, migrations, contracts, phase specifications,
assignment source, bundled theme/reference/guide images, dependencies and the
current deployment build. Private user files and unrelated application work
are outside this cleanup.

## Open findings and evidence limits

- Task Note autosave/recovery remains separate follow-up work; the current
  browser uses explicit Save. Main Notes autosave/recovery is already active.
- Recurrence DST/catch-up and lifecycle edge cases, Habit timezone freezing,
  and full AI operation rendering remain audit follow-ups. Existing tests
  cover subsets, not exhaustive certification.
- The entire matrix in [Verification contract](plan/08-verification.md) has
  not been rerun exhaustively for this UI change. Quota/race permutations,
  DB/storage failure injection, cross-account browser file access, native
  video seeking and all accessibility/event-order cases need their own evidence.
- Live Google-provider validation, Apache-specific rewrite execution and
  production deployment/backup rehearsal were not rerun for this change.

Do not mark an unresolved finding complete based on a historical phase status
or an unrelated passing suite.

## Local startup and push preparation — 2026-10-07

The old ignored environment files still targeted the retired Laravel schema.
They were backed up privately and replaced with canonical Planner settings and
independent generated credentials/session keys. The system account could not
create Planner databases, so a separate user-owned MySQL 8.4.11 instance was
started with disk-backed storage outside Git. `goals_dev` is the app database;
`goals_test` is isolated for destructive integration cleanup. Both listen only
on loopback port 3307. PHP serves the built app at port 8000.

Current startup checks: nine migrations applied, repeat migration is a no-op,
`migrate:check` healthy, `/up` reports ok, `/login` and `/register` return 200.
Fresh full PHPUnit on the separate test database passes **90 / 715**, frontend
**47** tests/format/build and Composer validation/platform checks pass, and
**156** first-party PHP files pass syntax checks. Staged source contains no
generated credentials or environment files. Restart instructions are in the
hosting runbook. No legacy-data import or production deployment was performed.

## Local 419 correction — 2026-10-07

A browser using `http://localhost:8000` could load auth forms, but submission
returned 419 because the ignored local `APP_URL` was `http://127.0.0.1:8000`.
The CSRF guard correctly treats those hosts as distinct origins. The local
setting now matches the published localhost URL, and the runbook uses the same
origin consistently. No CSRF, session or database behavior was weakened.

Real HTTP cookie/token probes verified both login and registration reach their
normal validation feedback on localhost. Missing tokens and the other host
still return 419. No probe account was created.

## Persistent roadmap demo — 2026-10-08 UTC

The running `goals_dev` database now contains a dedicated demo account populated
through normal authenticated HTTP APIs from the user's `roadmap.png` reference.
Its Goal, "AI production engineer + Quant secondary", contains eight Milestones
and 55 Tasks. The learning cycle, Learning Chat, Project Chat and Expert Lens
are Goal Strategy notes. Checklist items, a Task Note, two Habits with check-ins,
weekly Task selections and a Weekly Review provide examples of existing flows.
Other accounts and the old `notes_dev` database were not modified. Demo access
details are kept outside Git; new registrations are not automatically seeded.

Real Chromium verified the authenticated Dashboard, roadmap paging (six/two
Milestones), named Goal information, Strategy and the eight Foundations Tasks.
The roadmap API independently returned eight Milestones and 55 Tasks; no
unhandled browser errors were observed. Progress remains calculated by the
existing domain rules rather than copied from illustration percentages.

## Typography refinement — 2026-10-08 UTC

Be Vietnam Pro replaces Noto Sans through the existing Fontsource/Vite pipeline.
Four actual weights and Latin, Latin Extended and Vietnamese subsets are served
locally. Shared rem-based tokens set body text to 15px, navigation/actions to
14px, metadata to 13px, compact captions to 12px and section headings to 17–18px.
Workspace/settings titles use 28px, falling to 24px on narrow screens. Supporting
text no longer falls to 8–11px; activity weekday spacing accommodates the larger
labels. The existing illustrated graphics and navigation are retained.

Mobile form inputs use 16px, while Note title/content retain their own scale and
existing 14/16/18px content preference. A conflicting mobile Habit-dot font rule
was removed so hollow/check marks stay centered. Formatting and Vite build pass;
real Chromium checked nine populated workspaces at three widths, five dialog
states at desktop/mobile, Vietnamese font loading and Note-size preservation.
Backend behavior and persisted demo content were not changed.

## Checkable Note content — 2026-10-08 UTC

Notes and Task working notes now share a text-and-checkbox editor with a
**Check box** action, line continuation/exit, keyboard toggles and undo/redo.
Checkable lines remain plain text in the existing content/body fields and
snapshots; user-authored HTML is displayed literally. Notes retains autosave and
account-scoped recovery, while Task Note retains explicit Save and its existing
versioned draft buffer. Personal note checks do not change Task status/progress
or create planning Activity.

The existing Task completion Checklist moved into the working-note card, with
its own label, checked/total count and contextual Add action. Its records and
owned/versioned mutations remain intact, including unchecked-item acknowledgement
when completing a Task. Overview places task context beside the combined Note
card; the Notes tab focuses that same component. Help and the interface guide
explain the distinction and save behavior. No schema or HTTP contract changed.

Verification: all 54 browser-module unit tests pass, including seven new tests
for literal/Unicode preservation, selected-line conversion, duplicate titles,
continuation/exit, surrogate-safe deletion and text replacement. Existing Notes
and Planning HTTP tests pass on guarded `goals_test` (7 tests, 142 assertions).
PHP template syntax, Prettier and the Vite build pass. Real Chromium verified
creation/autosave/reopen, keyboard checks, undo/redo, multiline paste, composition
event gating, conflict-version projection, offline draft recovery, Task explicit
Save, checklist refresh/tab draft preservation and late-save acknowledgements.
Desktop/mobile captures were inspected; temporary captures and verification
records were removed after inspection. Native OS IME and other browser engines
were not exercised by this run.

## Feedback sections 1–3 — 2026-10-19, paused at user request

The user confirmed Settings/account, Tasks/Goals and Task history (not the
three recommendation steps). Retention is keep-all; two-factor authentication
is explicitly postponed. English/Vietnamese interface selection is approved.

Implemented in the working tree:

- Settings navigation grouping, direct light/dark action, password visibility,
  biography, private re-encoded background upload/RGB color, notification choices.
  Note defaults move to Notes without changing its autosave state machine.
- Recovery forms and one-use hashed 30-minute tokens, owner-before-token locking,
  request/attempt throttles, auth-version bump and session invalidation. Local
  delivery uses private outbox files; production needs system mail configuration.
- Shared Task capture fields for Tasks/Goal/Milestone, native date/time presets,
  versioned importance toggle, edit links, circular completion/reopen, confirmed
  archive, reversible weekly selection, Completed/History filters retaining data.
- Daily/weekly/monthly/yearly recurrence with stable month-end/leap-day anchors,
  custom weekly days/intervals and atomic initial occurrence materialization.
  Individual Tasks support reminders; delivery is opt-in with reminders:send.
- Account-persisted en/vi locale with a shared static UI catalog and selected
  dynamic Task/Settings controls. Arbitrary owned content is not translated.
  Browser checks switched vi -> en and created a Task whose mixed-language title
  stayed unchanged, with no console errors during that flow. Browser mutations
  used goals_test on a separate :8081 server, not the user's goals_dev records.
- Fixed an existing walkthrough empty-hash error found during real-browser QA.
- Added forward migrations 0010–0015 and applied them to goals_dev; current
  migrate:check reports healthy. Old migrations were not edited.

Evidence so far: narrow backend gate 26 tests / 346 assertions; focused recovery
and owner-isolation suite 2 / 21; ViewTest 4 / 14; Node suite 56 passing; Vite build
and frontend format:check pass. Full backend run and final status follow below.

Not yet accepted as a complete feedback release: browser coverage of background
upload, reminder delivery, shared capture/draft preservation and history/reopen
needs completion; dynamic error/help/summary localization needs an audit. No
production mail delivery or cron setup was performed. Recurring reminders must
be configured on generated occurrences; series-wide reminder rules are not yet
implemented. No 2FA, destructive retention, admin, sharing or Teamwork was added.
No further feature work continues until the user resumes.

### Final checkpoint before pausing — 2026-10-19

- `php backend/vendor/bin/phpunit -c backend/phpunit.xml`: **94 tests / 743
  assertions**, all pass, 123.761 seconds, real guarded goals_test.
- `npm --prefix frontend run test:unit`: **56 tests**, all pass.
- `npm --prefix frontend run format:check`: pass.
- `npm --prefix frontend run build`: pass (52 modules).
- First-party syntax sweep: **157 PHP files**, zero errors; final view sweep
  after localization also reports zero syntax errors.
- `git diff --check`: pass. `php backend/bin/console migrate:check`: healthy.
- `curl -fsS http://localhost:8000/up`: status ok.
- Real Chromium on isolated :8081/goals_test: registration/password-visibility,
  first-visit walkthrough dismissal, account language vi -> en persistence, Task
  creation while UI is Vietnamese, unchanged mixed-language Task title after
  switching back to English. That flow logged zero console errors/warnings.
- Temporary QA browser and :8081 server were closed. Normal local :8000 server
  remains available. No production deployment, mail-provider verification, cron
  installation or automatic Task deletion was performed.

Paused at the user's explicit request after finishing the current core language
section and verification. Resume with the outstanding acceptance checks above;
do not treat the three feedback sections as fully accepted/release-certified.

## Feedback audit fixes — 2026-10-27

An audit of the user's feedback PDF against the paused feedback release found
and fixed these defects inside the approved scope:

- Habit and Task-series creation rejected browser time zones such as
  `Asia/Saigon` ("The time zone is invalid") because the local PHP 8.5.4 uses a
  system tz database without legacy links. `Planner\Support\TimeZoneNames` maps
  aliases to an equivalent identifier through ext-intl; Habit, Task series and
  account preference validation store the canonical name.
- Task filter count badges applied the active view's status rule, so Completed
  showed 0 while Today was open. Each badge now applies its own view's rule.
- Unfinished Tasks overdue for one or two dates appeared in no filter except All.
  Today now carries them until History takes them, marked "Overdue" in text and
  danger colors (contract updated in `docs/plan/05-ui-ux.md`).
- Removed triple escaping in the sidebar account caption and localized remaining
  Appearance, archive-confirmation and repeating-capture messages.

Evidence: `php backend/vendor/bin/phpunit -c backend/phpunit.xml` **96 tests /
751 assertions** pass on guarded goals_test; `npm --prefix frontend run
test:unit` **58** pass; `format:check` and `build` pass. No real-browser check of
these changes was performed. `frontend/package-lock.json` already had unrelated
uncommitted dependency updates dated 2026-10-26 that this work did not change.

## Full feedback extension — 2026-10-27

The user directed that every feedback-PDF item be delivered and conflicting
rules be changed. PLAN.md, 01-scope, 09-deferred, agent.md and the new contract
`docs/plan/17-full-feedback.md` record the decision. Forward migrations
0016–0020 add roles/locking/reports/system settings, Note shares and
notifications, two-factor codes, history preferences and RGB/background Note
styles, and Teamwork tables. Old migrations were not edited.

Implemented:

- Roles and administration: `users:role` console command, `/admin` with
  report review (snapshot, not live Note), resolve/dismiss with reply, account
  lock/unlock (sessions invalidated, login refused) and the history limit.
- Note sharing: owner invites by email (no account enumeration), view/edit
  permission, change/remove, recipient accept/decline/leave, "Shared with me",
  title/content editing with version conflicts, reporting, notifications.
- Notifications: bell with unread count (60 s polling), share/report/team
  events and Task reminders; opt-out and email copies follow Settings.
- Two-step verification: email codes or RFC 6238 authenticator (secret
  encrypted with the session key, manual key/otpauth link, email fallback).
- Settings: Security groups password and 2FA; Appearance "+" tile for a private
  image or RGB color; Settings → Task history with Find, user thresholds and
  retention; `history:prune` archives expired history and anything beyond the
  administrator limit (never hard-deletes).
- Dashboard Activity: full-year grid with month labels and a year list.
- Tasks/Goals: shared capture with visible description and icon menus for due
  date, reminder and repeat (presets, month calendar, time, custom interval);
  rows with tick, schedule icons, week pin, Edit, Remove, Important star;
  Completed list under the active list; Repeating view replaces the Habits tab.
- Habits: Recurring tab removed; optional description.
- Notes: one View toggle, Sort by title/modified/created, explicit Save, any RGB
  color, background from an attached image, Share.
- AI: sidebar tab replaced by a floating chat that answers from a bounded,
  read-only summary; proposals remain at /ai.
- Teamwork: team goals with members/roles (admin/editor/viewer), invitations,
  assigned tasks with status, per-member completion and polled team chat.

Evidence: full `phpunit` **102 tests / 824 assertions** pass on guarded
goals_test, plus the later page-render test (1 test / 52 assertions) for every
changed page; new coverage includes sharing permissions/isolation, reports and
locking, TOTP login, Teamwork roles/chat and RFC 6238 vectors. Node suite **62**
pass; `format:check` and `build` pass; changed PHP and views lint clean.
Not done: no real-browser walkthrough of the new UI, no `migrate` on goals_dev,
no production mail/cron setup, and authenticator setup has no QR image (manual
key and otpauth link only). `frontend/package-lock.json` changes predate this work.

## Teamwork layout and team task capture — 2026-10-28

Implemented contract `docs/plan/17-full-feedback.md` §11.1: Teamwork search box,
4-per-page goal carousel with page arrows, Goal details | Members and Tasks |
Team chat layout with scrolling panels, Invite dialog, and a team task dialog
that reuses the Tasks capture fields plus assignee. Migration
`0021_extend_team_tasks` adds importance, start date, estimate, reminder and
repeat rule; completing a repeating team task creates the next occurrence and due
team reminders reach the assignee's bell.
Evidence: full `phpunit` **106 tests / 896 assertions** pass, including `TeamTaskRepeatTest` (2 tests) and `FullFeedbackHttpTest` (6 tests /
129 assertions) pass; Node suite **67** pass; `format:check` and `build` pass.
Not done: no real-browser walkthrough; `php bin/console migrate` must be run on
goals_dev for 0021.

## Unified check marks and stronger theme backgrounds — 2026-10-28

Every completion/check-in marker now draws one shape: the `--check-mark` CSS
mask (same path as `#icon-check`) via `frontend/src/js/lib/check-mark.js`,
replacing the mixed `✓`/`○`/`☑` glyphs on Dashboard, Tasks, Task detail, Goal
roadmap previews, Habits, streaks, Teamwork and the note Check box button.
Native checkboxes use `appearance: none` with the same mask. Theme background
imagery shows 20 points more (veil 100%/89% → 80%/69%; Mountain backdrop
opacity 0.09/0.07 → 0.29/0.27). Task "Select for this week" and Dashboard
"Complete" labels now pass through `t()`.
Evidence: full `phpunit` **106 tests / 896 assertions** pass; Node suite **67**
pass; `format:check` and `build` pass.
Not done: no real-browser visual check of the new markers or backgrounds.

## Goal leave prompt, missed Habit days and background list — 2026-10-28

- Goal detail no longer asks "Leave this goal?" without edits: the draft check
  ignored that Task capture forms start with `repeat_interval` 1 and Normal
  importance, so every visit counted as unsaved. Clearing an optional field back
  to empty also no longer leaves the Goal edit form dirty.
- Habit dots: checked dates show the check mark, past unchecked dates since
  tracking began show an x (missed), today stays open, earlier dates are
  unmarked. Dashboard `habit_streak.tracking_since` gives the account-local date
  of the first Habit; per-Habit dots use that Habit's creation date.
- Personal backgrounds are a private per-account list (migration
  `0022_create_user_backgrounds`, at most 12). Each upload appears as a picker
  tile; presets and uploads can be reselected (`background_id` preference) and
  an × removes an upload. Contracts 03, 04, 12 and 17 were updated first.
Evidence: full `phpunit` **107 tests / 923 assertions** pass, including the new
background list HTTP test and `tracking_since` assertions; Node suite **70**
pass; `format:check` and `build` pass; changed PHP lints clean.
Not done: no real-browser check; `php bin/console migrate` must be run on
goals_dev for 0022 before the app is used.

## Password toggle, task icons, draggable date picker, AI page, Habit Rest Days — 2026-10-29

- Password fields (login, register, reset, Security) show an eye icon inside
  the right edge of the input instead of a Show/Hide text button.
- Task rows use single-colour line icons (calendar, clock, repeat, pin) instead
  of colour emoji; reminders read "Reminder" in task and team facts.
- The due-date/reminder/repeat menu has a drag grip, can be moved anywhere in
  the viewport, and re-clamps itself on screen when it grows into the calendar.
- The `/ai` proposal page and its "Request a planning proposal" link were
  removed; the floating AI chat stays. The proposal API is unchanged.
- Habits: "List of habits" heading; Edit (dialog) and Delete (archive) per
  Habit; a centred tick opens "Mark today as done" plus Rest Day choices for
  the next 3 days (migration `0023_create_habit_rest_days`,
  `PUT/DELETE /api/v1/habits/{id}/rest-days/{date}`). Per-Habit streaks
  (days or weeks) and a combined Dashboard streak that only counts a day when
  no daily Habit was missed. Dashboard lists every active Habit with its streak.
  Contracts 03, 04 and 12 were updated.
Evidence: `php bin/console migrate` applied 0023 on goals_dev; full `phpunit`
**112 tests / 940 assertions** pass (new Rest Day window, back-dated rest,
streak unit tests, /ai 404); Node suite **73** pass; `format:check` and
`build` pass.
Not done: no real-browser visual check.

## Product completion pass: email, reminders, archive, i18n — 2026-10-29

- Email: one mailer for every message. With `MAIL_HOST` set it uses a built-in
  SMTP client (STARTTLS/SSL, AUTH PLAIN/LOGIN, UTF-8 encoded headers);
  otherwise production uses the system transport and local/testing keep
  messages in `storage/app/private/mail-outbox`. `php bin/console mail:test`
  checks delivery. Registration sends a verification link; Profile shows the
  state, resends it and changes the email through a confirmation link.
- Background jobs: `schedule:run` (cron, every minute) and `schedule:work`
  (long-running) run reminders, recurrence, history, snapshots and clean-up at
  their intervals (migration `0024_complete_product_gaps`). Repeating Tasks are
  also topped up when Tasks or Dashboard are read.
- Reminders: dismissible from the bell; editing the Task time uses local time
  instead of UTC; repeating Tasks can carry a reminder time.
- Management gaps closed: remove Goals/Milestones with their contents, remove
  Areas and Reviews, edit Milestones, rename/remove checklist items, add
  sub-goals, prerequisites, links to other goals, tags on Goals/Tasks/Habits
  with a Task tag filter, Habit-to-Goal links, a two-way week toggle, member
  biographies in Teamwork.
- Language: guest pages switch language, Reviews/roadmap/confirmations/Notes
  status texts and view attributes are translated, and a Node test fails when a
  literal `t()` string has no Vietnamese entry. The guide was rewritten in 17
  bilingual steps with theme illustrations instead of placeholders.
Evidence: new `SmtpTransportTest` (fake SMTP server), `ProductCompletionTest`
and `AccountEmailHttpTest` pass; frontend Node suite 75 pass, `format:check`
and `build` pass. Full `phpunit` **123 tests / 1023 assertions** pass; migration 0024 applied on goals_dev.
Not done: real SMTP delivery needs the owner's SMTP credentials; the AI
proposal API stays without a UI until the AI work resumes; no real-browser pass.
