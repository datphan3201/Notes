# Changelog

Notable user-visible and operational changes, newest first. Dates are Asia/Ho_Chi_Minh. Detailed contracts live in the [documentation](docs/README.md); commit history holds the full record.

## 2026-11-04

### Added
- **Note passwords:** per-Note password (typed twice; change and remove need the current password). Locked Notes ask for the password before opening, editing, deleting, pinning, sharing, files, AI or live editing; locked text never appears in cards, search, AI answers or the offline copy. ([docs](docs/ui/notes/locks.md))
- **Live collaboration:** shared Notes are co-edited in real time over WebSocket (`bin/realtime.php`, server-sequenced operational transformation) with presence chips and named remote carets; falls back to autosave when the server is unreachable. ([docs](docs/ui/notes/collaboration.md))
- **AI on Notes:** AI summary per Note (regenerate, out-of-date badge) and *Ask AI* questions answered from the user's Notes with clickable sources (keyword + embedding retrieval). ([docs](docs/ui/notes/ai.md))
- **Offline / PWA:** installable app (manifest, service worker); the Notes list, search and editor work offline from an IndexedDB copy, and offline creates/edits/deletes sync on reconnect, conflicts kept as an “(offline copy)”. ([docs](docs/ui/notes/offline.md))
- **Account:** prominent banner for unverified accounts with *Resend email*; password recovery by emailed 6-digit code as well as by link.
- **Calendar** page with month/week views, drag-and-drop rescheduling and an Unscheduled tray; shared floating editor for Tasks, Goals and Milestones.
- **Deployment:** `planner-realtime` systemd service and Nginx `/realtime` WebSocket proxy; green-main continuous deployment for an existing PHP + Cloudflare Tunnel runtime.

### Changed
- Sharing invites one or several registered accounts at once and rejects unknown addresses; recipients autosave and see owner, permission and share time.
- Note cards show pinned / password / shared status icons in grid and list views; in-app dialogs replace browser prompts.
- Goals controls and dialogs unified with the shared editing patterns.
- Accessibility: WCAG AA contrast on pastel notes and sign-in, labelled streak dots, pagination landmarks (axe: no violations on the main pages).
- Notes workspace JavaScript loads as its own chunk.

### Database
- `0030_add_note_locks_ai_and_sync`, `0031_add_password_reset_codes`.

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
