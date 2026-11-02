# Manual feature checklist

[Testing](README.md) · [UI/source map](../README.md) · [Blank route sheet](../reference/routes.csv)

This is a test plan, not an execution report. All cases start unchecked. Use the canonical APP_URL, private demo credentials and newly created QA-prefixed data for mutations; do not delete or rewrite the existing roadmap. Use separate browser/account B for sharing and Teamwork, and authorized system-admin C for admin positives. Record environment/revision and save each test run separately.

Callbacks need real server-issued links; /files routes stream private bytes and /api/v1 routes are not HTML pages. Valid parameter examples are invitation action accept|decline, admin lock|unlock, series pause|resume|end, Review refresh|finalize|reopen, weekly type task|milestone and ISO YYYY-MM-DD Habit dates. Inspect named routes/source for required bodies and current versions instead of sending an empty request to every URL.

## Prerequisites — P

[Behavior and source trace](../operations/local-development.md)

- [ ] P01 — Open the canonical local APP_URL and confirm the intended revision/worktree; record browser and account role.
- [ ] P02 — Use the existing demo account only for reading its roadmap. Get credentials privately; do not add them to this sheet.
- [ ] P03 — Create new QA-prefixed objects for write/delete cases; record their IDs for cleanup.
- [ ] P04 — Confirm that reading the existing roadmap/Task does not alter its content.
- [ ] P05 — Create account B in a separate browser profile for sharing, membership and ownership cases.
- [ ] P06 — Use separate QA system-admin account C for positive admin cases; keep the ordinary account for expected 404s.
- [ ] P07 — For local email, inspect only the intended recipient’s private outbox message; keep OTPs/tokens out of reports.
- [ ] P08 — Record appearance/notification/history preferences before changing them; do password/email/2FA cases last.
- [ ] P09 — Use disposable data for archive-with-contents, retention, locking and scheduler cases; jobs can affect more than one object.

## Authentication — AUTH

[Behavior and source trace](../ui/auth/README.md)

- [ ] AUTH01 — Correct credentials land on Dashboard and preserve existing roadmap data.
- [ ] AUTH02 — One incorrect sign-in returns a generic failure without authentication; avoid exhausting demo rate limits.
- [ ] AUTH03 — Email normalization and password confirmation/length errors are clear and enforced by the backend.
- [ ] AUTH04 — Password visibility toggles without changing value, focus or submitted password.
- [ ] AUTH05 — Guest English/Vietnamese choice persists for the session and registration stores the chosen language.
- [ ] AUTH06 — Register B: normal user role, localized default Areas and verification message; no system-admin access.
- [ ] AUTH07 — Protected HTML redirects guests to login and protected JSON returns authentication failure.
- [ ] AUTH08 — Logout requires POST/CSRF, clears owned recovery state and prevents authenticated back-navigation from exposing data.
- [ ] AUTH09 — Concurrent tabs/account changes preserve account isolation and clear only that account’s recovery records.

## Dashboard — DASH

[Behavior and source trace](../ui/dashboard/README.md)

- [ ] DASH01 — Today, This week and Activity sections switch without inventing separate page routes.
- [ ] DASH02 — Today includes matching due/start/occurrence/overlapping schedules in the account timezone without duplicate rows.
- [ ] DASH03 — The compact overdue reminder excludes Done/archived/History-qualified Tasks, links to Overdue, and becomes encouragement at zero.
- [ ] DASH04 — Today and Week each show one progress summary above the checklist; empty denominators show — and filtering never changes the full totals.
- [ ] DASH05 — Open/edit Tasks from their rows; checklist Complete/Reopen preserves acknowledgement requirements without a separate Current focus card.
- [ ] DASH06 — Weekly percentage equals completed active selections / all active selections; empty denominators are honest.
- [ ] DASH07 — Previous-week comparison is unavailable without its denominator and otherwise uses percentage points.
- [ ] DASH08 — Activity year navigation, weekday alignment, tooltip counts and legend match server facts.
- [ ] DASH09 — Complete, reverse and complete again: Activity follows unreversed facts; Note edits do not increase it.
- [ ] DASH10 — Habit cards, aggregate streak and roadmap preview link to the correct owned objects and show factual counts.
- [ ] DASH11 — Add an existing Task or create a named Task in Today; day/week membership commits together without changing dates/status. Foreign IDs remain inaccessible.
- [ ] DASH12 — Complete/Reopen from either checklist updates both and the weekly summary; required confirmations remain explicit.
- [ ] DASH13 — Week sort (Importance/Scheduled time) and status filter work independently; filters do not change stored membership or summary denominators.
- [ ] DASH14 — Remove a daily selection without removing the Task/week; scheduled work can remain in Today. No automatic next-day carry-forward occurs.
- [ ] DASH15 — On progress, Scheduled, Due today and Overdue labels describe actual status/date facts; desktop/mobile controls fit the existing UI and four-row previews remain.
- [ ] DASH16 — Choose a roadmap below the header; reload and another authenticated session retain it. Unset/clear/archived choices invite selection, and foreign Goal IDs are rejected.
- [ ] DASH17 — Change roadmap during a delayed Dashboard refresh: the latest choice, preview links and saved preference remain coherent.
- [ ] DASH18 — Activity shows 30 inclusive local dates across month/year boundaries, fills zero days and excludes reversed facts; View activity opens the existing yearly tab.
- [ ] DASH19 — Desktop/mobile retain header → roadmap ordering, Activity before Habit streak, no global horizontal overflow and accessible native selectors/checklist controls.
- [ ] DASH20 — Today contains no week card: Activity and Habits, then the Today checklist. Checking a Habit updates its row, count and streak; unchecking restores them, and a Habit whose local date differs from the account date uses its own date.
- [ ] DASH21 — This week shows progress/bars, Milestones with Habit targets, then the full Weekly tasks list; Sort/Status work independently, the badge shows filtered/total, and more than four selected Tasks are all listed.
- [ ] DASH22 — Roadmap connectors fill in proportion to the preceding Milestone's progress (0%, partial, 100%); Completed Milestones show solid nodes and fully filled connectors; the last node has no connector.

## Areas, Goals, roadmaps and Milestones — GOAL

[Behavior and source trace](../ui/goals/README.md)

- [ ] GOAL01 — Create/rename/reorder Areas; normalized duplicate names, fifth active Area and removing the last active Area are rejected.
- [ ] GOAL02 — An Area with active root Goals cannot be archived without reorganizing those Goals.
- [ ] GOAL03 — Create Goal under an Area with optional description/outcome/criteria/importance/deadline.
- [ ] GOAL04 — Create nested Goals and navigate tree/timeline without losing IDs or primary location.
- [ ] GOAL05 — Move a Goal to a valid owned destination; self/descendant/foreign destinations fail.
- [ ] GOAL06 — Fishbone uses the real Goal name; paging and narrow-screen layout keep Milestones usable.
- [ ] GOAL07 — Selecting the named head opens one information dialog with Edit, Strategy and Related work.
- [ ] GOAL08 — Save Goal fields/Strategy; refresh/reopen retains saved data and newer unsaved typing.
- [ ] GOAL09 — Create/edit Milestone under the selected Goal; creation drafts stay associated with the correct branch.
- [ ] GOAL10 — Select a Milestone to focus finite/recurring Tasks and return without losing context.
- [ ] GOAL11 — Prerequisite edge requires completion of the referenced Milestone before dependent completion.
- [ ] GOAL12 — Tasks beneath a locked Milestone remain editable and completable.
- [ ] GOAL13 — Completing a Milestone with open Tasks asks for explicit acknowledgement; cancel changes nothing.
- [ ] GOAL14 — Reopening a prerequisite with a completed dependent is rejected until dependents are reopened.
- [ ] GOAL15 — Self/cyclic/foreign prerequisite and contribution edges fail without partial writes.
- [ ] GOAL16 — Goal/Milestone/Task/Habit contributions may target multiple owned Goals without moving primary work.
- [ ] GOAL17 — Goal percentage uses immediate finite children exactly once and excludes Habits/contributions/occurrences.
- [ ] GOAL18 — 100% calculated progress does not auto-complete a Goal; leaf completion remains explicit.
- [ ] GOAL19 — Reopen finite work beneath completed ancestors: cancel preserves state; confirm reopens ancestors atomically.
- [ ] GOAL20 — Archive empty QA container; explicit archive-with-contents clearly confirms scope and archives descendants/series without touching unrelated data.

## Personal Tasks, Checklist and working Note — TASK

[Behavior and source trace](../ui/tasks/README.md)

- [ ] TASK01 — Today/Next/This week/Backlog/All match each documented membership rule and display consistent count badges.
- [ ] TASK02 — Search/status filters compose with time views; responsive paging does not hide matching results permanently.
- [ ] TASK03 — Create Inbox Task without requiring Goal/Milestone structure.
- [ ] TASK04 — Create under a Goal or Milestone; invalid/foreign/completed-ancestor destinations are rejected.
- [ ] TASK05 — Save start/due date, importance, description and criteria; inspect normalized persisted values.
- [ ] TASK06 — Estimates accept nullable valid minutes, reject invalid bounds and never imply tracked time.
- [ ] TASK07 — Due/reminder pickers, presets and draggable date menu preserve values and remain inside the viewport.
- [ ] TASK08 — Row Edit and detail #edit open the correct Task and persist changes.
- [ ] TASK09 — Edit in two tabs: stale different saves require explicit reconciliation and do not erase newer typing.
- [ ] TASK10 — Completing with unchecked Checklist asks for acknowledgement; cancel leaves status unchanged.
- [ ] TASK11 — Checking every Checklist item does not auto-complete Task; reopening Task does not uncheck items.
- [ ] TASK12 — Working Note explicit Save survives reload; Checklist/refresh does not erase newer Note typing.
- [ ] TASK13 — Inline Check box text remains distinct from completion Checklist rows and Task status.
- [ ] TASK14 — Resources derives HTTP/HTTPS links without rewriting text or executing submitted markup.
- [ ] TASK15 — Select/unselect this week from row/detail synchronizes with Dashboard selections.
- [ ] TASK16 — NotStarted/InProgress/Blocked/Done and Reopen produce correct Completed/Activity behavior without auto-completing parents.
- [ ] TASK17 — Task Note conflict between tabs preserves saved/draft choices.
- [ ] TASK18 — Archive a QA Task: it leaves active lists/API usage while other Tasks remain unchanged.

- [ ] TASK19 — Opening Tasks without a valid view defaults to All; view links preserve context. Completed follows the selected view/search/tag filters and pages separately from open work.
- [ ] TASK20 — Visible Search/Status/Sort compose independently. Importance is descending; scheduled sort uses account-local work time with undated tasks last and stable ties.
- [ ] TASK21 — Clean Today/Week capture defaults Plan for to that view. Reopening a dirty capture preserves its values. Creating retains search/status/view/page and offers Open task; a failed planning step never creates a duplicate.
- [ ] TASK22 — Repeat disables Plan for; individual occurrences remain selectable later. Advanced capture fields remain accessible and the Create/Cancel footer stays visible on mobile.
- [ ] TASK23 — Native More options opens by keyboard and exposes dates/reminder/repeat/Archive. Row names align; context chips fit their text; Today icons expose meaningful hover/accessibility labels.
- [ ] TASK24 — Today add/remove from detail matches row behavior. Overview contains the completion checklist; Notes/Resources stay in Notes and preserve drafts when changing tabs.

## Personal repeating work — REPEAT

[Behavior and source trace](../ui/tasks/repeating.md)

- [ ] REPEAT01 — Preview daily/weekly/monthly/yearly intervals, weekdays and original-anchor month/year clamping.
- [ ] REPEAT02 — Create an end-bounded QA series; occurrences never exceed end date or duplicate a series/date identity.
- [ ] REPEAT03 — Verify supported template fields, Checklist/Tags/parent and reminder time on occurrences; distinguish API template support from capture payload mapping.
- [ ] REPEAT04 — Convert a normal row to repeat where offered; original Task remains independent and the new series starts as specified.
- [ ] REPEAT05 — Pause stops further generation; Resume skips paused dates and avoids duplicate existing occurrences.
- [ ] REPEAT06 — End explains future NotStarted archival and preserves started/completed occurrences. Ended rejects API Pause/Resume with 422, and repeated End with the current version is a no-op.
- [ ] REPEAT07 — Template/rule edits before/after the first occurrence enforce the service’s locking/replacement rules.
- [ ] REPEAT08 — Occurrence completion does not increase finite Goal progress or reopen a Completed Goal.
- [ ] REPEAT09 — Tasks/Dashboard reads may top up horizon; scheduler/catch-up/DST tests require controlled time and separate evidence.
- [ ] REPEAT10 — Repeating name search and All/Active/Paused/Ended share the same result/count/paging; Task-only controls are hidden and Ended has no Pause/Resume action.

## Habits, streaks and Rest Days — HABIT

[Behavior and source trace](../ui/habits/README.md)

- [ ] HABIT01 — Create daily and weekly Habits with target, timezone, optional Goal/Tags and description.
- [ ] HABIT02 — Edit/archive QA Habit durably without affecting existing Habits.
- [ ] HABIT03 — The checkbox before the Habit name checks in/undoes today directly, matching Dashboard; repeated check-in is idempotent and Undo reverses the right Activity.
- [ ] HABIT04 — Allowed past/today dates use Habit-local time; future check-ins are rejected.
- [ ] HABIT05 — Dots distinguish checked/missed/rest/open/untracked; dates before tracking are not missed.
- [ ] HABIT06 — Daily streak counts days and weekly streak counts qualifying weeks without counting a day twice.
- [ ] HABIT07 — Rest Day accepts only the next three local dates; today/past/fourth date are rejected.
- [ ] HABIT08 — Cancel future rest within its allowed window; rest protects streak without adding completion Activity.
- [ ] HABIT09 — Aggregate Dashboard streak considers all required daily Habits and correctly distinguishes rest/missed.
- [ ] HABIT10 — Browser timezone alias Asia/Saigon is canonicalized to Asia/Ho_Chi_Minh. Existing checked-in legacy Habits can save unrelated edits with an equivalent timezone while keeping stored timezone/history; genuinely different zones remain rejected.
- [ ] HABIT11 — More options provides the next three Rest Day choices and Archive; cancel preserves state, confirmation retains history, and Escape/refresh/mutations restore useful focus. Edit and its sticky Cancel/Save footer remain accessible on mobile.

## Notes — NOTE

[Behavior and source trace](../ui/notes/README.md)

- [ ] NOTE01 — Create/edit owned plain-text Note, explicitly Save and verify reload durability.
- [ ] NOTE02 — Autosave respects debounce/max-wait and honest Saving/Saved/Retry status.
- [ ] NOTE03 — Type while saving: late acknowledgement never erases newer input.
- [ ] NOTE04 — Offline/network retry preserves exact frozen request identity and does not duplicate creates.
- [ ] NOTE05 — Reload same tab: valid account-scoped recovery is offered before New note becomes available.
- [ ] NOTE06 — Conflict between tabs offers explicit saved/draft choice and preserves intended text.
- [ ] NOTE07 — Check box insertion/toggle/undo and IME composition preserve literal text and save behavior.
- [ ] NOTE08 — Search/sort/grid/list/paging, pin and RGB color persist as documented.
- [ ] NOTE09 — Delete QA Note: tombstone replay cannot resurrect it; linked Task is unlinked and file cleanup follows its own boundary.

## Tags and labels — TAG

[Behavior and source trace](../ui/shared/tags.md)

- [ ] TAG01 — Create/rename/delete normalized owned labels and observe matching Notes filtering.
- [ ] TAG02 — Planning Tag pickers update the complete tag_ids set without changing location/progress.
- [ ] TAG03 — Tag hierarchy move rejects self/cycles/foreign references; legacy labels and Tags use the same rows.

## Private files — FILE

[Behavior and source trace](../ui/notes/files.md)

- [ ] FILE01 — Upload allowed QA attachment; persisted metadata/name/MIME/size and reload listing are correct.
- [ ] FILE02 — Invalid signature, forbidden MIME, oversized file and unexpected multipart fields are rejected.
- [ ] FILE03 — Preview/download the owned media; safe UTF-8 filenames do not create executable HTML.
- [ ] FILE04 — HEAD/valid Range/invalid Range behave as documented (including 206/416).
- [ ] FILE05 — Foreign account/guest cannot stream an attachment or access private storage by guessed URL.
- [ ] FILE06 — Select/remove Note background and delete attachment; metadata, compensation and pending cleanup remain consistent.

## Note sharing and reports (requires B) — SHARE

[Behavior and source trace](../ui/notes/sharing.md)

- [ ] SHARE01 — Owner invites B with view permission; generic success shape does not enumerate unknown email accounts.
- [ ] SHARE02 — B accepts/declines invitation; access is available only after acceptance.
- [ ] SHARE03 — View recipient can read title/content but cannot edit or access owner-only controls/files.
- [ ] SHARE04 — Owner grants edit; B explicitly saves title/content with version checks.
- [ ] SHARE05 — Concurrent shared edit returns conflict instead of silently overwriting content.
- [ ] SHARE06 — Owner/other accepted recipients receive appropriate update/join notifications; actor does not notify themselves.
- [ ] SHARE07 — Owner revokes or changes permission; B immediately loses the removed capability.
- [ ] SHARE08 — B leaves a share; deleted Note no longer has accessible shares.
- [ ] SHARE09 — B reports the shared Note; admin sees the captured snapshot/reason, not live owner Note access.

## Bell and reminders — NOTIFY

[Behavior and source trace](../ui/shared/notifications.md)

- [ ] NOTIFY01 — Bell unread count/list loads owned entries and refreshes on the visibility-aware polling cadence.
- [ ] NOTIFY02 — Mark one/all read; unread count and persisted state agree after reload.
- [ ] NOTIFY03 — Invitation actions navigate/respond for the correct owned share/team membership.
- [ ] NOTIFY04 — Due personal reminder appears once until dismissed/completed/rescheduled.
- [ ] NOTIFY05 — Dismiss one/all reminders; changing time makes a new reminder visible.
- [ ] NOTIFY06 — Assigned team reminder links to the correct team Goal; reassignment respects visibility.
- [ ] NOTIFY07 — Notification opt-out and invitation-email preferences follow service exceptions for admin reports.
- [ ] NOTIFY08 — Authorized scheduler/mail run delivers eligible personal emails; team reminders stay in-app and delivery failures are recorded honestly.

## Reviews — REVIEW

[Behavior and source trace](../ui/reviews/README.md)

- [ ] REVIEW01 — Create Daily/Weekly/Monthly Review with stable period/timezone identity.
- [ ] REVIEW02 — Filter/paginate collection and open the correct in-page editor.
- [ ] REVIEW03 — Fact summary uses actual completion/overdue/snapshot data and honest missing denominators.
- [ ] REVIEW04 — Save reflection fields explicitly and verify reload.
- [ ] REVIEW05 — Type during save/refresh: newer unsaved draft is preserved.
- [ ] REVIEW06 — Concurrent stale save offers explicit reconciliation.
- [ ] REVIEW07 — Refresh Draft facts preserves reflections and advances version.
- [ ] REVIEW08 — Finalize freezes facts/editing; Reopen retains snapshot until explicit Refresh.
- [ ] REVIEW09 — Delete a QA Review permanently with version/ownership checks; unrelated Reviews remain.

## Teamwork (requires B) — TEAM

[Behavior and source trace](../ui/teamwork/README.md)

- [ ] TEAM01 — Create QA team Goal with details and invitations; owner/creator membership is correct.
- [ ] TEAM02 — Search/carousel paging and responsive 4/2/1-card layouts retain selected Goal context.
- [ ] TEAM03 — B accepts/declines invitation; non-member Goal/API access returns 404.
- [ ] TEAM04 — Team admin changes roles/removes eligible members while creator protections remain enforced.
- [ ] TEAM05 — Member name/biography and factual done/assigned completion are correct.
- [ ] TEAM06 — Create assigned team Task with shared capture fields plus owned team assignee.
- [ ] TEAM07 — Edit/reassign/delete team Task follows admin/member permissions and current version.
- [ ] TEAM08 — Viewer without assignment cannot modify team data; assigned viewer can use only their permitted own-status path.
- [ ] TEAM09 — Complete repeating team Task: one next occurrence follows its rule/reminder and end date; personal TaskSeries is not used.
- [ ] TEAM10 — Due team reminder and reassignment appear for the correct assignee without sending team reminder email.
- [ ] TEAM11 — Post/read escaped team chat; polling while open, message bounds and membership checks hold.
- [ ] TEAM12 — Archive QA team Goal or remove membership: access/notifications/chat respect updated membership; system-admin rights are unaffected.

## Profile — PROFILE

[Behavior and source trace](../ui/settings/profile.md)

- [ ] PROFILE01 — Save display name/biography and verify escaped persisted fields and omission behavior.
- [ ] PROFILE02 — Upload/replace/remove valid avatar; invalid/foreign avatar/file paths are rejected.

## Appearance — APPEAR

[Behavior and source trace](../ui/settings/preferences.md)

- [ ] APPEAR01 — Switch five preset themes and reload: selection persists account-wide.
- [ ] APPEAR02 — Switch light/dark independently from visual theme; text/focus remain readable.
- [ ] APPEAR03 — Independently toggle scenery, illustrations and quote without changing business data.
- [ ] APPEAR04 — Save custom quote, type during save and restore preset without losing newer drafts.
- [ ] APPEAR05 — Upload/select/delete owned backgrounds; enforce file validation and maximum list size.
- [ ] APPEAR06 — Select RGB/reset background and reload; external URL/path input is not accepted.
- [ ] APPEAR07 — Change locale and Note preferences: UI literals/layout change while user text remains literal.

## Task history — HISTORY

[Behavior and source trace](../ui/settings/history.md)

- [ ] HISTORY01 — Configure completed-hours/overdue-days and verify threshold boundary membership.
- [ ] HISTORY02 — Search retained Task names/descriptions and navigate detail.
- [ ] HISTORY03 — Reopen an overdue Task: cancel changes nothing; choose a non-past deadline or leave it empty to clear the old date. It leaves Overdue/History without a fabricated completion reversal.
- [ ] HISTORY04 — On disposable data, retention archives eligible history without hard-delete or unrelated-object changes.
- [ ] HISTORY05 — Admin cap applies in addition to optional user retention; no fabricated retention test result is inferred from a list refresh.
- [ ] HISTORY06 — History shows search/results before collapsed rules; completed time/due date sorts newest first, 12-row paging clamps after changes and searching descriptions resets the page. Back to Tasks returns to All.

## Email links — EMAIL

[Behavior and source trace](../ui/auth/email.md)

- [ ] EMAIL01 — Resend verification and consume the real matching token; verified state persists.
- [ ] EMAIL02 — Expired/invalid/replayed verification/change links fail safely without information disclosure.
- [ ] EMAIL03 — Request address change with current password; new-address confirmation applies change and notifies old address.
- [ ] EMAIL04 — Inspect correct private local mail or authorized SMTP delivery; do not log token/code content.

## Password, recovery and 2FA — SECURITY

[Behavior and source trace](../ui/settings/password.md)

- [ ] SECURITY01 — Change password with current/confirmation checks; old sessions/password become invalid.
- [ ] SECURITY02 — Forgot-password known/unknown email responses are indistinguishable.
- [ ] SECURITY03 — Reset valid token once within expiry; old sessions end and there is no automatic login.
- [ ] SECURITY04 — Enable TOTP only after valid setup confirmation; keep setup secret private.
- [ ] SECURITY05 — Enable email-code method; codes expire, have attempt limits and cannot replay.
- [ ] SECURITY06 — Password success with 2FA remains pending until valid challenge; direct protected requests cannot bypass it.
- [ ] SECURITY07 — Request allowed email fallback for TOTP and verify intended challenge behavior.
- [ ] SECURITY08 — Disable 2FA with current password on QA account; restore intended final access settings.

## AI — AI

[Behavior and source trace](../ui/shared/ai.md)

- [ ] AI01 — Floating chat opens/closes with preserved focus; /ai is not a browser page.
- [ ] AI02 — Disabled provider reports unavailable without domain writes or fake responses.
- [ ] AI03 — If an authorized live provider is configured, bounded owned context/question returns a safe answer; report this separately.
- [ ] AI04 — Chat proposal cards show the queued before/after changes. Malformed/foreign/stale/hash/expiry violations reject Apply; no separate /ai page is implied.
- [ ] AI05 — Explicit Apply runs only supported create/edit/transition/archive/delete operations atomically through ordinary services; no domain write occurs before confirmation. Replay/Cancel retain their outcome.
- [ ] AI06 — Chat reads are owner-scoped; editing an object after proposal generation returns 409 without applying it. Conversation history includes earlier proposal outcomes and does not silently repeat handled requests.

## Help walkthrough — HELP

[Behavior and source trace](../ui/shared/shell.md)

- [ ] HELP01 — First authenticated visit introduces Help only when recovery/other dialogs permit.
- [ ] HELP02 — Topic/step navigation, keyboard, images and responsive text remain usable.
- [ ] HELP03 — Skip/Close/Escape/Finish dismiss account-wide and reopening Help does not erase current work.

## Administration (requires C) — ADMIN

[Behavior and source trace](../ui/admin/README.md)

- [ ] ADMIN01 — Ordinary account receives 404 for admin page/APIs.
- [ ] ADMIN02 — C lists reports using stored snapshots, resolves/dismisses and triggers intended notifications.
- [ ] ADMIN03 — C searches users and locks/unlocks QA B; active sessions and sign-in reflect lock state.
- [ ] ADMIN04 — Self-lock is rejected; team-admin membership does not grant system-admin rights.
- [ ] ADMIN05 — Update valid system history limit; reject out-of-range settings and verify cap in a controlled maintenance case.

## Cross-cutting UI/API checks — COMMON

[Behavior and source trace](../architecture/http-security.md)

- [ ] COMMON01 — Refresh/deep-link/back/forward each real route; no fabricated route is required for in-page sections.
- [ ] COMMON02 — Mobile/desktop, keyboard-only interaction and visible focus cover the affected workflow.
- [ ] COMMON03 — At 200% zoom, content, dialogs, date pickers and form errors remain reachable/readable.
- [ ] COMMON04 — Empty/loading/error/retry states are honest and do not show fabricated counts.
- [ ] COMMON05 — Rapid switching/search/refresh cannot let stale reads overwrite newer UI state.
- [ ] COMMON06 — Dirty navigation, Escape/backdrop close and pending saves preserve editor drafts/context.
- [ ] COMMON07 — HTML/script-like names/text render as literal escaped content, including shared/chat/report content.
- [ ] COMMON08 — Guessed foreign IDs fail for reads/writes/relations/selections/files/provider context without disclosing ownership.
- [ ] COMMON09 — Missing/invalid CSRF, explicit foreign Origin, unknown fields and invalid enum/scalar inputs are rejected.
- [ ] COMMON10 — Version conflict, exact replay and archive/delete races preserve each endpoint’s contract.
- [ ] COMMON11 — Offline/network/5xx/429 paths retain correct retry/draft state and never report unsaved text as Saved.
- [ ] COMMON12 — UTC instants, local DATE boundaries, DST and changed account/Habit timezone are verified with controlled time where needed.

## Complete the test run — END

[Behavior and source trace](README.md)

- [ ] END01 — Restore initial account preferences/access settings; clean only recorded QA fixtures under their normal deletion/archive rules.
- [ ] END02 — Record Pass/Fail/Blocked/Not run per case/route with reproducible steps, expected/actual result and safe evidence.
- [ ] END03 — List untested provider/scheduler/time/concurrency/production boundaries explicitly; blank checklist entries are not passes.

## Bug report template

```text
Case / route / component Trace ID:
Revision and local changes:
Browser / account role / timezone:
QA fixture IDs (no passwords/tokens):
Steps:
Expected:
Actual status and visible result:
Safe console/request-ID evidence:
Related source/test links:
Pass / Fail / Blocked / Not run:
```

Time progression, DST, retention, quotas and race cases need controlled fixtures/time or a dedicated test harness. A reload is not proof that they passed. Live SMTP/AI and production backup/web-server tests require their own explicit evidence. Never put secrets in screenshot filenames or bug logs.
