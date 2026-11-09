# Manual acceptance checklist

[Testing](README.md) · [Feature/source maps](../README.md) · [Route sheet](../reference/routes.csv)

This is an **unexecuted test plan**, not a pass report. Use a separately prepared test/staging environment and synthetic QA-prefixed records. Record revision, origin, database/schema, browser/viewport, timezone, locale and enabled providers. API/browser harnesses may reset only guarded `planner_test`; never reset development or hosted data. Do not run both suites concurrently. Use separate owner A, ordinary account B and authorized admin C browser profiles. Keep credentials/codes/private content out of reports.

Source maps document current implementation. Product requirements and observed behavior that disagree need a recorded issue/decision, not a silently altered expectation. Realtime co-editing/Teamwork are deliberately excluded. Named routes in the generated sheet are patterns; inspect the handler/schema before sending a body. Browser shells do not establish ownership.

## Preparation and shared shell — P

- [ ] P01 — Verify intended revision/origin and isolated database; save preference values to restore after the run.
- [ ] P02 — Register synthetic A/B; prepare authorized C without granting roles through HTTP.
- [ ] P03 — Exercise English/Vietnamese, desktop/mobile, zoom, tab order, visible focus, labels and modal keyboard return.
- [ ] P04 — Navigate Notes, Dashboard, Goals, Tasks, Calendar, Habits, Reviews, settings, Help and permitted Administration; test direct URLs and Back/Forward.
- [ ] P05 — Confirm ordinary routes use persisted scoped data; explicit preview routes remain synthetic and do not call mutation/providers.
- [ ] P06 — Refresh while an assistant/editor is newly opened and auxiliary reads are delayed; preserve latest navigation, panel and draft.
- [ ] P07 — Failed/pending writes keep input, avoid duplicate submits and show actionable feedback; acknowledged saves survive reload.
- [ ] P08 — Open public health/readiness and private API routes separately; never count a shell/readiness 200 as authorized entity access.

## Authentication, recovery and MFA — A

- [ ] A01 — Register with confirmation/locale, reject invalid input and respect open/invitation-only/closed policy.
- [ ] A02 — Login errors preserve email; password visibility/keyboard and duplicate-submit guards work.
- [ ] A03 — Production unverified accounts can use only allowed verification/account paths until verified.
- [ ] A04 — Wrong Origin/missing CSRF writes fail; allowed exact local/Funnel origins apply only in development.
- [ ] A05 — Cookie is HttpOnly, SameSite=Lax and Secure on HTTPS/production; expired/logout/locked sessions fail.
- [ ] A06 — Recovery for unknown emails stays generic; link/code is delivered only through the configured worker/provider.
- [ ] A07 — Test latest six-digit code, bounded wrong attempts, original expiry, single-use exchange/reset and session revocation.
- [ ] A08 — Recovery/verification links survive language/reload, remove capabilities from visible URL and reject expired/reused tokens.
- [ ] A09 — First-factor MFA challenge is not a session; test refresh, authenticator, latest email fallback, expiry and replay rejection.
- [ ] A10 — Password change/TOTP or email MFA setup/enable/disable require current proof and preserve authoritative status.
- [ ] A11 — Confirm latest email-change code/link, reject stale/foreign values and revoke old sessions.
- [ ] A12 — Exercise migrated bcrypt compatibility and an account requiring legacy MFA recovery using isolated representative fixtures.

## Dashboard and daily/weekly plans — D

- [ ] D01 — Today/This week remain separate and use account-local dates; manual Today selection also selects the Monday week.
- [ ] D02 — Select/unselect without changing Task dates/status; next day does not auto-copy manual selection.
- [ ] D03 — Dashboard focus and Goals Main goal agree; cleared/archived focus invites a choice with no automatic fallback.
- [ ] D04 — Real Task/Habit completion and undo update persisted selections/facts without duplicate Activity on retry.
- [ ] D05 — Verify actual denominators, unavailable comparisons and Activity date boundaries; no fabricated scoring.
- [ ] D06 — Compare current desktop split layout with the recorded full-width requirement; leave unresolved until ISSUE-067 is decided.

## Areas, Goals and Milestones — G

- [ ] G01 — Create/update Area icon/accent/importance and deep single-parent Goals; validate exactly one Area/parent and preserve owned data.
- [ ] G02 — Reject hierarchy/self/contribution cycles and foreign references atomically, including concurrent inverse edits.
- [ ] G03 — Open Goal information/strategy/related work and Milestone Task panels; keep originating context in shared editors.
- [ ] G04 — Check progress excludes Habits/contributions/recurring occurrences and does not double-count Milestone Tasks.
- [ ] G05 — Create cross-Goal owned prerequisites, reject cycles/foreign references; visual branch order creates no dependency.
- [ ] G06 — Completion/reopen enforces required unfinished/prerequisite/ancestor acknowledgements; Cancel leaves data unchanged.
- [ ] G07 — Group archive/restore checks descendants and parent blockers, versions and explicit include-contents confirmation.
- [ ] G08 — Move/relate work without changing identity or silently introducing progress/prerequisite meaning.

- [ ] D07 — Hold a save response and its refresh: continue Habit/Task actions and switch tabs, keep the latest local state, serialize writes and coalesce the next batch.
- [ ] D08 — Fail a save after later edits: retain every draft, show an explicit retry, and preserve checklist acknowledgements for the appropriate queued batch.

## Tasks, recurrence and Calendar — T

- [ ] T01 — Capture in Inbox/Goal/Milestone/Calendar preserves context; fields/dates/estimate/checklist/reminder validate server-side.
- [ ] T02 — Create plus daily/week selection is atomic; retry identical client key creates once, changed replay conflicts.
- [ ] T03 — Search/status/time view/sort/grouping compose; inspect current mounted filters rather than assuming alternate helper equivalence.
- [ ] T04 — Test local midnight, overdue/History thresholds, multi-day schedule, manual selection and undated Backlog cases.
- [ ] T05 — Detail overview/notes/resources/related tabs preserve drafts; working text requires explicit Save.
- [ ] T06 — Checklist state is independent of Task completion; completion/reopen acknowledgements remain explicit and persist correctly.
- [ ] T07 — Two-tab stale writes return 409 and preserve newer remote/local text; older responses never erase later typing.
- [ ] T08 — Series daily/weekly/monthly/yearly rules preserve monthly/leap anchors; worker retries do not duplicate occurrences.
- [ ] T09 — Pause/resume/end persist; Ended cannot resume, further work needs a new series; templates retain intended metadata.
- [ ] T10 — Month/week/Gantt periods and selected-date capture persist; Habits do not appear as calendar events.
- [ ] T11 — Date/schedule moves preserve identity, associated dates and intended local clock time; test DST gaps/overlaps and invalid ranges.
- [ ] T12 — Keyboard/mobile Calendar interactions and stale/failed move recovery preserve context; distinguish assistant/UI paths.

## Habits, Reviews and retention — H

- [ ] H01 — Done/undo/rest use Habit-local days, with daily/weekly targets, partial first week and unfinished today behavior.
- [ ] H02 — Timezone/period remain frozen after history, including cleared check-ins; Habits never affect Goal percentage.
- [ ] H03 — Future rest planning is cancelable and does not fabricate Activity; past/future invalid check-ins reject correctly.
- [ ] H04 — Daily/weekly/monthly Review snapshots persist separately from reflection; refresh is explicit/versioned.
- [ ] H05 — Finalize blocks edit/refresh until reopen; stale save/delete conflicts and Cancel retain content.
- [ ] H06 — Timed/count History retention archives rather than deletes, stays owner-scoped and preserves Activity/Review facts.
- [ ] H07 — Overdue reminders quiet at History boundaries and processing progresses beyond a full already-sent page.

## Notes, private files and sharing — N

- [ ] N01 — Search/tags/pin/color/grid-list/links persist; user text remains literal, including markup-like strings.
- [ ] N02 — Main Notes autosave survives reload and typing during acknowledgement; Task/Review editors remain explicit-save.
- [ ] N03 — Checkbox text, undo/redo and IME composition retain literal document content.
- [ ] N04 — Two-tab conflicts preserve local recovery/base version; reconciliation/download never silently overwrites remote text.
- [ ] N05 — Password add/change/remove/unlock enforce current credentials, session/hash binding, attempt limits and 423 while locked.
- [ ] N06 — Locked text stays out of cards/search/files until authorized unlock, and password-protected Notes stay out of AI/offline even after editor unlock.
- [ ] N07 — Private attachments/backgrounds authorize A/B, reject oversized/failed upload metadata and avoid public storage URLs.
- [ ] N08 — Invite registered B, accept/decline and test view/edit permissions; B edits title/content only, owner metadata stays protected.
- [ ] N09 — Revoke/leave/owner-lock immediately removes shared access; suggestions use accepted sharing contacts only.
- [ ] N10 — Concurrent shared editors use versions/recovery; no realtime presence/OT/server fallback is promised.
- [ ] N11 — Summary/questions enqueue owned source-versioned read-only jobs, reject locked/foreign/stale source and show provider failure explicitly.
- [ ] N12 — Deleted Note/file bytes are cleaned through durable jobs without deleting unrelated content.

## Offline Notes — O

- [ ] O01 — Cache only eligible personal unshared/unlocked Notes and generic Notes shell/static assets; no private API/media in Cache Storage.
- [ ] O02 — Offline create/edit survives reload and replays once; stale edit creates a recovered copy while preserving server text.
- [ ] O03 — Offline delete syncs only unchanged owned versions; a remote edit/access change prevents destructive overwrite.
- [ ] O04 — Logout/account switch cleans account drafts/cache; local/Funnel/Vercel origins do not share browser state automatically.
- [ ] O05 — Shared/password-protected Notes and non-Notes sections are not presented as editable offline features.

## Settings, reports and administration — S

- [ ] S01 — Profile/bio/locale/timezone and supported theme/scenery/quote/color settings survive reload and reject unknown/invalid fields.
- [ ] S02 — Avatar/background/evidence image decode/size rules and private reads/deletes remain owner/moderator scoped.
- [ ] S03 — Notification read-one/all and category/email preferences never mutate B's notifications.
- [ ] S04 — Archive filters/paging, grouped restore blockers and confirmed permanent deletion preserve unrelated work/templates/facts.
- [ ] S05 — A/B can submit only authorized report snapshots/evidence and see truthful resolution status.
- [ ] S06 — Ordinary admin API access is 404; C can resolve with explicit action/dismissal and concurrent resolution acts once.
- [ ] S07 — Account lock/withdraw-share/warn and registration/invitation/history-cap policy persist with audit; admins cannot grant their own role or lock/delete protected admins.
- [ ] S08 — Guide/tour English/Vietnamese and retained screenshots accurately describe current navigation; record obsolete instructions as defects.

## Assistant and external operations — AI

- [ ] AI01 — Named read tools return owned active records only, exclude locked/received Notes and preserve current source versions.
- [ ] AI02 — Roadmap proposal uses readable parent refs and queues complete groups; zero domain writes occur before confirmation.
- [ ] AI03 — Confirm exact hash/acknowledgements, apply once atomically; stale/expired/foreign/rejected proposals do not mutate anything.
- [ ] AI04 — Stable-ID Task moves, local-time Calendar changes, Habit check-ins and Note changes use ordinary domain services.
- [ ] AI05 — Stop waiting/Reload/Reconnect recover durable completed/running output with SSE interrupted; clearing visible chat retains usage/approval state.
- [ ] AI06 — Reauthorize history sources and mask unavailable content; context relevance/source-chip noise remains ISSUE-063.
- [ ] AI07 — Real-provider evaluation records citation/adversarial quality, usage/prices/embedding budgets and trace continuity separately from fake-provider tests.
- [ ] AI08 — Worker crash/retry/restart/sleep preserves jobs and avoids duplicate reminders/occurrences/approved writes; readiness alone does not prove progress.
- [ ] AI09 — Hosted stable-origin cookies/CSRF, private buckets, actual inbox receipt, proxy streaming/uploads and cold starts receive dated acceptance evidence.
- [ ] AI10 — Rehearse consistent DB/private-file restore and representative migration/MFA recovery on an isolated target; never assume COPY counts establish recovery.
- [ ] AI11 — Measure snapshot payload/memory/latency with realistic large-account history/Habits/Notes and concurrent worker/AI load (ISSUE-048/066).

## Record outcomes

Save each run separately with case IDs, actual/expected results, revision/environment, safe evidence and unresolved issue IDs. Do not check boxes in this maintained blank plan to claim a global pass. Clean only the synthetic records created for that run, through ordinary authorized APIs, and restore test preferences. Historical artifacts/logs are not substitutes for fresh execution.
