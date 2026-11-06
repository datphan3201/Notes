# Changelog

Notable user-visible and operational changes, newest first. Dates are Asia/Ho_Chi_Minh. Detailed contracts live in the [documentation](docs/README.md); commit history holds the full record.

## 2026-11-05

### Added
- `planner` now also runs the scheduler while it serves the app, so Task reminder emails and periodic jobs work without a server (`--no-scheduler` to skip).
- `planner` command (`tools/dev/install-command.sh`): one word to serve the checkout; the serve scripts now start the user-level database themselves and rebuild the frontend only when it changed.
- `tools/dev/funnel.sh`: serve this checkout at a fixed `https://<machine>.<tailnet>.ts.net` address through Tailscale Funnel, with live collaboration on the same name; shares its setup steps with `tunnel.sh` through `tools/dev/lib.sh`. ([docs](docs/operations/local-development.md#share-the-local-app-at-a-fixed-address-with-tailscale-funnel))
- **Gantt view** in the Calendar: Goals, Milestones or Tasks as bars on a timeline that slides sideways and keeps growing, with Days/Weeks/Months zoom, expandable Goal → Milestone → Task rows, prerequisite links, and drag (or Alt+arrow) to move a bar or change its start or deadline. Goals and Milestones gain an optional **start date** (migration 0033), also editable in the floating editor and by the AI assistant. ([docs](docs/ui/calendar/README.md))
- **User guide** at Settings › User guide (`/help`), written for everyday users in Vietnamese and English: what Planner is for, how goals, milestones, tasks, habits, notes and the calendar fit together, every use case step by step with real screenshots, and common questions. The **?** tour is rewritten around the same screenshots and links to the full guide. Screenshots are reproducible with `tools/guide`. ([docs](docs/ui/help/README.md))
- **AI on the Calendar:** the assistant can put Tasks into a time slot, set start dates, remove a slot and reschedule Tasks, Milestones and Goals by a number of days or to a date (Calendar move rule, local times kept across daylight saving); every change is previewed as *Reschedule* and applied only on confirmation. ([docs](docs/ui/shared/ai.md#calendar-scheduling-from-the-chat))
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
