# UI-to-code documentation

Start with the URL or visible label, not a historical implementation phase. Every component trace links its **UI/DOM → browser logic → controller/service/domain → persistence → relevant tests**, plus exact named HTTP routes. Tests listed in a trace are pointers, not claims they currently pass.

## Find the page you see

| Browser route | Visible feature | Documentation |
| --- | --- | --- |
| `/` | Notes, search, grid/list, editor | [Notes](ui/notes/README.md) |
| `/` | Password, Unlock | [Note passwords](ui/notes/locks.md) |
| `/` | Live editing of shared Notes, presence | [Live collaboration](ui/notes/collaboration.md) |
| `/` | AI summary, Ask AI | [AI summary and questions](ui/notes/ai.md) |
| `/` | Offline banner, waiting to sync | [Offline use and sync](ui/notes/offline.md) |
| `/dashboard` | Today, This week, Activity | [Dashboard](ui/dashboard/README.md) |
| `/goals` | Areas, Goal tree/timeline | [Goals](ui/goals/README.md) |
| `/goals/{id}` | Fishbone, Goal information, Strategy | [Roadmap](ui/goals/roadmap.md) |
| `/goals/{id}` | Milestone, prerequisites, Tasks | [Milestone panel](ui/goals/milestones.md) |
| `/tasks` | Today, Next, This week, Backlog, All | [Task filters](ui/tasks/filters.md) |
| `/tasks` | New task, due/reminder/repeat | [Task capture](ui/tasks/capture.md) |
| `/tasks` | Repeating, Pause/Resume/End | [TaskSeries](ui/tasks/repeating.md) |
| `/tasks/{id}` | Edit, Checklist, working note, Related | [Task details](ui/tasks/detail.md) |
| `/calendar` | Month/week dates, drag to reschedule, Unscheduled | [Calendar](ui/calendar/README.md) |
| `/habits` | Check-ins, streaks, missed/rest dates | [Habits](ui/habits/README.md) |
| `/reviews` | Daily/Weekly/Monthly collection and editor | [Reviews](ui/reviews/README.md) |
| `/teamwork` | Team Goals, members, assignments, chat | [Teamwork](ui/teamwork/README.md) |
| `/settings/profile` | Name, biography, avatar, email | [Profile](ui/settings/profile.md) |
| `/settings/preferences` | Appearance, backgrounds, RGB, quote, locale | [Preferences](ui/settings/preferences.md) |
| `/settings/password` | Password and 2FA setup | [Security](ui/settings/password.md) |
| `/settings/notifications` | In-app/email delivery preferences | [Notifications settings](ui/settings/notifications.md) |
| `/settings/history` | History rules, retained Tasks and Reopen | [Task history](ui/settings/history.md) |
| `/settings/reports` | Report a user with description and image evidence | [Report a user](ui/settings/reports.md) |
| `/login`, `/register`, POST `/logout` | Authentication/session | [Authentication](ui/auth/README.md) |
| `/forgot-password`, `/reset-password` | Password recovery | [Recovery](ui/auth/recovery.md) |
| `/two-factor` | Pending login challenge | [2FA challenge](ui/auth/two-factor.md) |
| `/verify-email`, `/confirm-email` | Token-driven email results | [Email links](ui/auth/email.md) |
| `/admin` | Note and user reports, accounts, system history limit | [Administration](ui/admin/README.md) |

There are no current HTML pages at `/task/`, `/notes`, `/ai`, `/milestones/{id}` or `/reviews/{id}`. Notes uses `/`; Milestones and Review editors are in-page components. `/files/*` streams private files; `/api/v1/*` returns data, not HTML pages.

## Find shared controls

| UI label / concern | Entry |
| --- | --- |
| Sidebar, topbar, theme, fonts/CSS, mobile layout, dialogs, Help | [Shared shell](ui/shared/shell.md) |
| Bell, unread count, invitations, due reminders | [Notification bell](ui/shared/notifications.md) |
| Floating AI chat; proposal previews and explicit Apply | [AI](ui/shared/ai.md) |
| Tags / legacy labels | [Classification](ui/shared/tags.md) |
| Save, Retry, Recover, saved-version/draft conflict | [Notes autosave](ui/notes/autosave.md) |
| Share / Shared with me / Report | [Note sharing](ui/notes/sharing.md) |
| Upload / Preview / Download / Note background | [Private files](ui/notes/files.md) |

## Search by component or source file

- Use [the component lookup](reference/components.md) to search all visible labels and stable Trace IDs in one table.
- Use [the source-file lookup](reference/source-index.md) when a changed template, browser module, stylesheet, service, repository or test is known and you need its affected component traces. This index describes registered references; read call sites for transitive consumers.
- Each source reference must match a unique location. Named test links identify related regression cases; explicit coverage notes distinguish helper tests from a real browser flow.

## Trace a change

Example: **“Change how Today counts Tasks.”**

1. Open [Task filters → Today](ui/tasks/filters.md#today).
2. Follow the exact `data-task-view="today"` template hook and `taskMatchesView` source links.
3. Check the History prefilter and independent status/search filtering; the badge uses the same membership pipeline.
4. Follow Dashboard links if the change must also affect server-projected Dashboard cards. Browser filters do not change SQL projections.
5. Update relevant tests, behavior text and trace references; [regenerate/check links](maintenance.md).

## Cross-cutting references

- [Issue report: discovered problems and pending decisions](issues.md)
- [Brief audit history](audit-history.md)
- [Current decisions and product boundaries](architecture/decisions.md)
- [Runtime/layers](architecture/runtime.md), [data/transactions](architecture/persistence.md), [HTTP/security](architecture/http-security.md), [interaction invariants](architecture/interactions.md)
- [Installation, development, production and jobs](operations/README.md)
- [Test commands and manual checklist](testing/README.md), [verification limits](testing/verification-limits.md)
- [All HTTP routes](reference/routes.md) and [blank route test sheet](reference/routes.csv)
- [Archify visual maps](diagrams/README.md)
- [Documentation authoring and change tracking](maintenance.md)

## What is authoritative

Current user decisions and [maintained boundaries](architecture/decisions.md) govern intended changes. UI pages describe observed source behavior; named symbols and route declarations are the implementation evidence. Known discrepancies are explicit in [the issue report](issues.md), never silently “fixed” in prose. Changing a requirement is not proof of a code change, and a passing documentation check does not certify app behavior.

Completed migration plans, contradictory append-only histories and old verification totals were removed. Git history holds committed historical records; the live docs contain current navigation, constraints and operating procedures.
