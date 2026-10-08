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
