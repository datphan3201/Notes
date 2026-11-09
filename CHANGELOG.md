# Changelog

Notable user-visible and operational changes, newest first. Dates are Asia/Ho_Chi_Minh. Detailed contracts live in the [documentation](docs/README.md); commit history holds the full record.

Entries describe their own historical stage. In particular, earlier 2026-11-08 preparation/pause/unprovisioned statements were superseded by the recorded deployment, merge to `main` and legacy retirement. Current operations and unresolved acceptance live in the documentation/status and issue list; historical verification totals are not fresh test results.

## 2026-11-08

### Removed
- Removed the quote card from the Dashboard header.
- Removed the global autosave progress banner and automatic save-success toast. Background persistence and error/retry feedback remain; browser checks observe a nonvisual saving attribute instead of relying on a popup.
- Retired and completely removed legacy PHP 8.5 backend (`backend/`), vanilla JavaScript/PHP frontend views (`frontend/`), obsolete PHP tools and workflows per user directive following successful production deployment of the modern Next.js 16 and FastAPI runtime on Vercel, Render Singapore, and Supabase.
- Converted `.ai` symlink into a standalone root repository directory preserving agent rules and Karpathy guidelines.

### Added
- Added Brevo HTTPS transactional email delivery, production configuration and reminder support. Brevo takes priority over Resend/SMTP when its private API key is configured; retries retain a provider idempotency key.
- Added an operator-only, transactional two-calendar-month roadmap demo fixture for a new ordinary account: historical planning, Tasks/checklists, Habits/rest/check-ins, Notes/lock, recurrence examples, Reviews/facts, plans/notifications and lexical AI context. Explicit target/schema checks and existing-email refusal protect current accounts; seeding sends no mail or provider requests. See the [demo procedure](docs/operations/demo-account.md).
- Prepared the selected Render + Vercel + Supabase cloud trial: a Free Render blueprint, supervised API/polling-worker container with forward migrations, private application schema and Supabase Storage adapter, and HTTPS Resend email delivery for Render Free's SMTP restrictions. Vercel command plans accept the Render backend. Hosted accounts, secrets, mail/provider acceptance and data cutover remain unperformed; Free sleep delays background jobs. See the [deployment guide](docs/migration/render-vercel-supabase.md).
- Safe plan/execute/check helpers for the selected Funnel and Vercel routes. Vercel proxies the existing Funnel backend; the launcher accepts its exact primary origin for CSRF and email links, preserves localhost/Funnel access and supports a Docker Desktop CLI override. Added proxied readiness and a Vercel project configuration. This was the earlier deployment selection; the current Render/Vercel/Supabase target is recorded above. Actual hosting trials remain pending.

### Changed
- Moved floating page actions to the lower-left beside the desktop sidebar and to the screen-left on mobile; the panel opens above the trigger and toast feedback stays clear of it.
- Moved Dashboard, Goals, Tasks, Calendar, Habits and Notes header actions into reusable floating action panels. Removed manual Refresh controls; error retry actions remain available.
- Applied the same 16px corner radius to all workspace page headers and their illustration backgrounds, preserving Notes header dropdown overflow.
- Dashboard header now has rounded corners, including its illustration background.
- Workspace loading now uses an accessible spinner, and loading/error/save/toast controls show only the selected language instead of combined Vietnamese/English labels. Startup feedback remembers the selected language.
- Email verification feedback now appears in a dismissible modal over the sign-in form, with resend/status feedback inside the dialog and native keyboard focus handling.
- Verification notices use a vertical layout with a separate email address and full-width primary/secondary actions, avoiding cramped text and buttons on mobile.
- Verification notices now appear only after signing in with valid credentials for an unverified account. New account/reset/change passwords require at least 8 characters consistently in the browser and API.
- Authentication pages default to English when no explicit or remembered guest language is selected.
- Account registration now confirms success before continuing to Dashboard; password recovery explicitly confirms successful reset-link requests without claiming inbox delivery or revealing account existence.
- AI assistant message input grows and shrinks with its content, scrolling internally above a viewport-aware height limit.
- Synchronized maintained README, architecture, UI/source maps, operations, test plan and agent rules with the active `apps/` runtime on `main`; corrected manual deployment, process-pool budget, private file URLs, response/session contracts and the actually mounted React views. Labeled old migration/preview/handoff and diagram records as historical. Retired legacy-only ISSUE-035–044 with their removed runtime; this does not claim new-runtime parity or complete recovery. The stale-documentation part of ISSUE-064 is resolved; its orphaned deployment test remains open.
- Replaced removed PHP documentation tooling/registry with a standard-library Python checker/generator, current route/component/source indexes, regression fixtures and a separate documentation CI workflow. Preserved historical diagram bytes/receipts. Recorded cloud COPY limitations (ISSUE-065), unbounded workspace snapshot growth (ISSUE-066) and the unresolved Dashboard layout contract (ISSUE-067); no runtime, hosted state or private data changed.
- Integrated every approved personal UI cluster with the authenticated Next.js/FastAPI/PostgreSQL workspace, replacing fixtures on ordinary routes: planning, Tasks/detail/recurrence/Calendar, Habits/Reviews/Activity, Notes, account/Appearance/History/Archive, notifications, guide/reporting/administration and assistant. Closed the specific UI inventory gaps ISSUE-049–062; historical acceptance remains under ISSUE-045. See the [integration record](docs/migration/ui-integration.md).
- Added transactional batch writes and version/ownership checks for the reviewed editors, cross-Goal prerequisite and contribution graphs, completion/reopen acknowledgements, grouped archive/restore/permanent deletion, recurrence templates, weekly/rest Habit semantics and automated archive-only History retention.
- Connected Note invitations/acceptance and permissions, private attachment/background actions, passwords, real summaries/questions, account-scoped offline recovery/outbox and an installable manifest. Concurrent remote edits survive recovery; offline deletion requires an unchanged server version.
- Connected private profile/avatar/background and report evidence images, actual email-change/email-MFA codes, moderator roles/actions/policies/invitations/history cap and audit entries. Administrator grants stay in a server-only console command.
- Extended development schema through Alembic 0005 after private backups and isolated rehearsal. Fresh migration and schema comparison passed; MySQL, private archives and the retained PHP baseline remain preserved. No cloud deployment or cutover was performed.

### Verification
- Autosave queue follow-up passed 23 web unit tests, TypeScript/production E2E build and all 70 isolated desktop/mobile browser cases, plus documentation checks. Vercel production reached READY; an authenticated cloud browser verified continued actions/tab switching during an intercepted pending write, with zero business writes sent and unchanged demo Habit history. Recorded the separately observed fixed-Saturday Habit-strip date bug as ISSUE-068.
- Render/Vercel/Supabase preparation passed 127 backend tests, 19 web unit tests, 22 focused desktop/mobile browser cases, four deployment-helper tests, TypeScript, production build, official blueprint validation and a local Docker migration/job/restart/failure probe. Work is paused at the user's request; [handoff](docs/migration/deployment-handoff.md) records the missing hosted-account setup and acceptance. Supabase Storage/Resend contracts used HTTP mocks; no hosted deployment or cloud-data transfer was performed.
- Assistant tool restoration passed 111 isolated PostgreSQL backend tests, 19 web unit tests and all 62 desktop/mobile browser cases, plus TypeScript, production E2E build, Ruff and documentation checks. A synthetic live-provider/worker proposal created one Goal, three Milestones and six Tasks only after ordinary Apply in `planner_test`. Public Funnel readiness passed.
- Passed 94 isolated PostgreSQL backend tests, 19 web unit tests and the complete 54-case desktop/mobile browser suite, plus TypeScript, production/E2E builds, Ruff, three deployment-helper tests and 17 documentation regressions. Verified public Funnel readiness and a local production web build proxying that Funnel; hosted Vercel testing remains pending.

### Fixed
- Centered Habit missed-day and completed-day marks using consistent SVG icons instead of font-dependent text glyphs.
- Simplified the Habits quote card beside Streak, removing the pasted illustration and overlapping scenery in favor of a clean, readable quote.
- Fixed Tasks-specific header styling overriding the shared rounded corners.
- Unverified accounts return to an actionable sign-in form instead of a blocked workspace Retry screen. Registration shows a dedicated success state leading to sign-in; verification can be resent/rechecked and the account switched without bypassing server verification.
- AI assistant input now sends with Enter and inserts a newline with Ctrl+Enter, preserving text composition and the message length limit.
- Dashboard/background autosaves now keep the workspace interactive, show local edits immediately and coalesce nearby changes through one sequential save queue. Acknowledgement refreshes preserve newer edits and each queued Task completion keeps its checklist acknowledgement. Failed saves retain the latest draft for explicit retry rather than dropping later actions; explicit destructive operations retain their separate blocking state.
- Fixed workspace refresh overwriting a newly opened assistant or shared Task editor while auxiliary requests were still loading. Preserve current navigation, open panels and drafts after all awaited reads. A delayed-response browser regression reproduces the previous assistant disappearance.
- Restored the assistant's 35 named baseline planning tools, including complete roadmaps, Milestone/Task groups, stable-ID Task moves, Calendar rescheduling, transitions, Habit check-ins and Note operations. Writes compile one readable proposal with local refs and explicit acknowledgements, then use the ordinary atomic workspace service only after hash/version-checked Apply. Reject now persists, and withdrawing guarded delete/recreate operations clears any stale proposal. Preserved Gemini tool-call metadata across model rounds. See the [tool record](docs/migration/assistant-tools.md).
- Stopping assistant output is now a normal pause with Reconnect, rather than an error. Added owner-scoped, paged chat history and restore after reload, including requests still running; completed server results remain recoverable. SSE observation has an authenticated read fallback for interrupted/buffered proxy streams. Clearing visible chat preserves usage reservations and approvals; history masks answers whose source is no longer accessible. Verified with 97 backend tests and four desktop/mobile assistant cases, including interrupted SSE, stop/reload/recovery and clear without resetting usage.
- Restored the floating AI assistant launcher on authenticated pages: its CSS class had diverged from the reviewed launcher, leaving it in normal page flow. Retained an accessible mobile label and fixed collapsed-body visibility. Desktop/mobile browser regressions verify fixed positioning, viewport visibility and open/collapse/reopen/close; TypeScript and the production build passed. A synthetic read-only request also received a real configured-provider response; no account content was sent in that probe.
- Reviewed UI saves and destructive confirmations now wait for real acknowledgements and keep drafts/errors on failure. Live routes no longer expose fixture passwords, sample MFA codes, mock success or canned assistant proposals.
- Fixed temporary Habit ID resolution, account timezone aliases, duplicate security panels, archived graph cleanup, batched Note metadata reads, reminder pagination beyond the first 200 rows and stale authentication redirects after unmount.
- Assistant requests retain bounded real conversation turns and receive trusted account language/timezone/current date. Read-only Note jobs use only their owned source version; summaries and answers never mutate planning data. Explicit Apply remains hash/version-bound and atomic.

## 2026-11-07

### Added
- Baseline-alignment follow-up after user feedback: restored the illustrated Main goal card and Area disclosure, deadline Timeline, centered Goal information and in-page Milestone focus, Notes sidebar/modal, compact Habit day strips, in-panel Calendar controls/mobile dates, Review snapshot/reflection workflow and Appearance tabs. Preview controls move into a topbar popover; icon actions use a compact picker. Browser review and remaining gaps are recorded in the [UI review](docs/migration/full-ui-review.md#baseline-alignment-follow-up); acceptance, automated checks and backend integration remain pending.
- Combined in-memory UI review for all remaining interface clusters: Goals/Areas and fishbone Milestones, Notes/files/share/lock examples, Calendar/Gantt, Habits, Reviews/Activity, personal settings and security confirmations, History/Archive, illustrative assistant proposals and guide/report/admin screens. Dashboard and Tasks now share the sample entities and floating editors. See the [review record](docs/migration/full-ui-review.md); backend integration, automated checks and user acceptance remain deferred.
- UI-only Task workspace for ISSUE-053: baseline collection controls/rows, compact centered creation and side-sheet editing, advanced schedule/reminder/recurrence date examples, detail Overview/Notes/Related panels, separate checklist and working-note drafts, completion/reopen prompts and localized series lifecycle controls. Synthetic interactions are available from the workspace preview; UI approval, tests and backend integration remain pending. See the [Task UI record](docs/migration/tasks-ui.md).
- UI-only Dashboard refinement for ISSUE-050: Daily Habits/recent-activity calendar, Weekly Milestones/Habit targets/activity chart, full status filters, undefined empty progress, and local plan/check-in/edit interactions. Available from the workspace preview; desktop/mobile visuals have been inspected, while UI approval, tests and backend integration remain pending. See the [Dashboard UI record](docs/migration/dashboard-ui.md).
- UI-only shared workspace preview at `/preview/workspace`: baseline shell/scenery, mobile navigation, localized editor and discard/delete dialogs, notification read/unread controls and synthetic loading/empty/error feedback. Local changes stay in memory; ISSUE-049 remains under user review, with tests and backend integration deferred. See the [shared UI review record](docs/migration/workspace-ui.md).
- Source-based UI refinement inventory in [ISSUE-049–062](docs/issues.md#ui-refinement-queue), separating remaining workspace clusters for user prioritization. The inventory does not claim browser/test acceptance; UI approval precedes further backend integration and testing.
- The migrated runtime can be shared with `bash tools/dev/planner-v1.sh --funnel`, retaining localhost access, exact development-origin checks, HTTPS session cookies and Fast Refresh through the public hostname.
- Development launcher `bash tools/dev/planner-v1.sh` starts PostgreSQL, Next.js Fast Refresh, API reload and a watched scheduler/worker, with private TOTP key initialization and database/port guards. Development CSP permits the framework's code evaluation while the production policy stays restricted.
- A separate Personal AI Planner migration candidate under `apps/`: Next.js/React/TypeScript, FastAPI/Python, PostgreSQL/pgvector, personal workspace APIs/UI, cookie sessions and TOTP, private files, durable jobs, cited-context AI proposals requiring explicit approval, staging snapshot/import tooling, new tests/CI and container/cloud procedures. The [plan](docs/migration/personal-ai-planner.md), [status](docs/migration/status.md) and [setup](docs/migration/development.md) distinguish implemented behavior from remaining parity/release gates. Legacy runtime, tests, MySQL and Team data remain intact.
- Real PostgreSQL concurrency coverage and a read-only authenticated load tool. Fixed a new-runtime pool starvation issue by releasing authentication reads before endpoint dispatch and closing database dependencies at function scope. The remaining latency budget is tracked in ISSUE-048.

### Changed
- Began integrating the approved UI with the real system: shared shell icons/navigation and Dashboard Daily/Weekly/Activity now use authenticated data, persisted focus/plans/check-ins and confirmed versioned Task transitions. Habit completion/undo records Activity without duplicate replay facts. Other reviewed clusters remain pending; see the [integration record](docs/migration/ui-integration.md).
- Permanently removed Teamwork from the PHP/JS product and retained frontend assets: navigation, Dashboard assignments, routes/API, services, chat, reminders, notifications, guides, demo tooling and dedicated tests. Note-sharing contacts now use the existing Note-sharing controller. Historical migrations, MySQL rows and private legacy archives are preserved; retired notifications remain stored but hidden. Updated route/component documentation and regression coverage.
- Refined migrated authentication against the retained guest UI: explicit login/register/recovery/MFA routes, original branding and language navigation, password visibility/confirmation and field feedback, Dashboard redirects and localized default Areas. Restored recovery-code exchange and email fallback for pending MFA with expiry/single-use checks. Browser tests now use separate ports, build output and private storage so development/Funnel can stay running. See the [auth acceptance record](docs/migration/authentication-ui.md) for intentional differences and remaining account gaps.
- Restored the baseline visual system and page-specific React interactions: original route destinations, illustrated shell, Task planning/filter controls, Goal hierarchy/fishbone panels, Notes classification and checkbox editor, Calendar views and appearance settings. Added explicit planning-draft discard/recovery and expanded desktop/mobile acceptance coverage. Full parity remains tracked in ISSUE-045 and the [UI acceptance record](docs/migration/ui-parity.md).
- Copied the authorized legacy MySQL snapshot into local PostgreSQL after a verified backup, staging restore/merge rehearsal and reconciliation. Imported 3 accounts and core personal data without replacing existing development records; retained all source rows, Teamwork data and private-file backups. The importer now supports an explicit development merge, preserves activity events, rejects account collisions and leaves external AI indexing deferred.
- Consolidated duplicate Karpathy Guidelines files into one canonical skill and compatible discovery links. Added rules for the new runtime; no unrelated user-wide skills were removed.

### Fixed
- Development startup no longer mistakes closed sockets in `TIME_WAIT` for an active server when restarting immediately after a migration.
- Gemini-compatible embedding responses may omit item indexes. Preserve their input order while retaining index-based reordering for OpenAI-format responses; regression tests cover both. Ordinary tests explicitly disable development AI/SMTP credentials.
- Watched workers handle stop/reload signals and release interrupted job leases for retry, so development code changes do not leave work waiting for lease expiry.

## 2026-11-05

### Added
- **Deleting for good:** *Delete for good* and *Empty archive* in Settings › Archive; *Delete account* for administrators (type the email; ordinary accounts only) and for everyone in Settings › Security (password). Deletion follows the database's foreign keys in one transaction and removes the account's private files. ([archive](docs/ui/settings/archive.md), [admin](docs/ui/admin/README.md), [security](docs/ui/settings/password.md))
- `planner` now also runs the scheduler while it serves the app, so Task reminder emails and periodic jobs work without a server (`--no-scheduler` to skip).
- `planner` command (`tools/dev/install-command.sh`): one word to serve the checkout; the serve scripts now start the user-level database themselves and rebuild the frontend only when it changed.
- `tools/dev/funnel.sh`: serve this checkout at a fixed `https://<machine>.<tailnet>.ts.net` address through Tailscale Funnel, with live collaboration on the same name; shares its setup steps with `tunnel.sh` through `tools/dev/lib.sh`. ([docs](docs/operations/local-development.md#share-the-local-app))
- **Gantt view** in the Calendar: Goals, Milestones or Tasks as bars on a timeline that slides sideways and keeps growing, with Days/Weeks/Months zoom, expandable Goal → Milestone → Task rows, prerequisite links, and drag (or Alt+arrow) to move a bar or change its start or deadline. Goals and Milestones gain an optional **start date** (migration 0033), also editable in the floating editor and by the AI assistant. ([docs](docs/ui/calendar/README.md))
- **User guide** at Settings › User guide (`/help`), written for everyday users in Vietnamese and English: what Planner is for, how goals, milestones, tasks, habits, notes and the calendar fit together, every use case step by step with real screenshots, and common questions. The **?** tour is rewritten around the same screenshots and links to the full guide. Screenshots are reproducible with `tools/guide`. ([docs](docs/ui/help/README.md))
- **AI on the Calendar:** the assistant can put Tasks into a time slot, set start dates, remove a slot and reschedule Tasks, Milestones and Goals by a number of days or to a date (Calendar move rule, local times kept across daylight saving); every change is previewed as *Reschedule* and applied only on confirmation. ([docs](docs/ui/calendar/README.md#move-rule))
- **Archive** in Settings: every archived Area, Goal, Milestone, Task and Habit, filterable by type and name, with *Restore*. A Goal or Milestone comes back with everything archived together with it; items inside an archived parent ask for the parent first, and Areas respect the four-active limit. ([docs](docs/ui/settings/archive.md))

### Changed
- Reminders can be set to any minute (a full time field in the device's clock format instead of 12-hour, 5-minute steps) and to moments tied to the task: when it starts, 15 minutes or 1 hour before, or 9:00 on or before its due date.
- The notification bell, the AI proposal card, the habit streak date, preset quotes, network errors and the note editor heading now follow the interface language; proposal dates read like the rest of Planner and the assistant waits up to 90 seconds for long answers.
- Sceneries renamed to describe their illustrations: Summit trail, Forest path, Coastal cove, Pisces and Starlit lake (Vietnamese names added; stored theme ids unchanged).
- Summit trail (formerly Mountain journey) now uses its own sharp watercolour illustration for the background, page headers, roadmap and previews like the other sceneries; the blurry enlarged crops of a reference screenshot were removed from every theme.

### Fixed
- The sender's avatar in a note share invitation no longer stretches across the row.

## 2026-11-04

### Added
- **Note passwords:** per-Note password (typed twice; change and remove need the current password). Locked Notes ask for the password before opening, editing, deleting, pinning, sharing, files, AI or live editing; locked text never appears in cards, search, AI answers or the offline copy. ([docs](docs/ui/notes/locks.md))
- **Live collaboration:** shared Notes are co-edited in real time over WebSocket (`bin/realtime.php`, server-sequenced operational transformation) with presence chips and named remote carets; falls back to autosave when the server is unreachable. ([docs](docs/ui/notes/collaboration.md))
- **AI on Notes:** AI summary per Note (regenerate, out-of-date badge) and *Ask AI* questions answered from the user's Notes with clickable sources (keyword + embedding retrieval). ([docs](docs/ui/notes/ai.md))
- **Offline / PWA:** installable app (manifest, service worker); the Notes list, search and editor work offline from an IndexedDB copy, and offline creates/edits/deletes sync on reconnect, conflicts kept as an “(offline copy)”. ([docs](docs/ui/notes/offline.md))
- **Account:** prominent banner for unverified accounts with *Resend email*; password recovery by emailed 6-digit code as well as by link.
- **Calendar** page with month/week views, drag-and-drop rescheduling and an Unscheduled tray; shared floating editor for Tasks, Goals and Milestones.
- **Administration:** registration modes (open, invitation-only, closed) with an invitation list; report resolution with explicit actions (withdraw shares, warn, lock) and truthful reporter notifications; locking hides the account's shared Notes and blocks new Team assignments; administrators cannot lock each other; append-only administrator activity log; `registration:mode` console command.
- **Deployment:** `planner-realtime` systemd service and Nginx `/realtime` WebSocket proxy; green-main continuous deployment for an existing PHP + Cloudflare Tunnel runtime.

### Changed
- Sharing invites one or several registered accounts at once and rejects unknown addresses; recipients autosave and see owner, permission and share time.
- Note cards show pinned / password / shared status icons in grid and list views; in-app dialogs replace browser prompts.
- Goals controls and dialogs unified with the shared editing patterns.
- Accessibility: WCAG AA contrast on pastel notes and sign-in, labelled streak dots, pagination landmarks (axe: no violations on the main pages).
- Notes workspace JavaScript loads as its own chunk.

### Fixed
- Creating or renaming an Area to the name of an archived Area showed “service unavailable”; it now explains that names are unique including archived Areas.

### Database
- `0030_add_system_admin_controls`, `0031_add_note_locks_ai_and_sync`, `0032_add_password_reset_codes`.

## 2026-11-03

### Added
- User-chosen icons and accent colours for Areas, Goals, Milestones and Habits; 1–5 star importance at every planning level (migration `0029`).
- Notes linked to one Goal or Task (`note_links`); Tasks *Group by Goal*; Dashboard team tasks.
- AI chat builds whole roadmaps (Goal, Milestones, Tasks) in one confirmation card and moves Tasks instead of recreating them.
- Shared hosting module (`tools/deploy/setup.sh`) with quick-tunnel, Cloudflare-tunnel and direct ingresses, backups and pull-based CD.

### Fixed
- Retired AI models are reported as configuration errors, not outages.
- Cloudflare Tunnel hosting keeps real client addresses and CSRF origin.

## 2026-11-02

### Added
- Dashboard Daily/Weekly tabs with progress, actionable Habits, saved roadmap selection (migrations `0025`, `0026`) and 30-day Activity.
- Tasks catalogue, capture, detail and History layout; Habits direct check-in with rest days.
- GitHub Actions CI and production provisioning scripts.

### Fixed
- Habit archive with native PDO prepares; Notes pagination and layout preference refresh; demo Review snapshots; Dashboard chart readability.
