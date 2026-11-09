# Component lookup

Generated from [traceability.json](../traceability.json). One owner per current feature document; source maps distinguish UI, services and related tests.

| Trace ID | Feature | Browser surface |
| --- | --- | --- |
| `tasks` | [Tasks](../ui/tasks/README.md) | `/tasks` |
| `tasks.filters` | [Task views and planning](../ui/tasks/filters.md) | `/tasks`; `/dashboard` |
| `tasks.capture` | [Task capture](../ui/tasks/capture.md) | `/tasks`; `/dashboard`; `/goals/{id}`; `/calendar` |
| `tasks.detail` | [Task details and working notes](../ui/tasks/detail.md) | `/tasks/{id}` |
| `tasks.repeating` | [Repeating Tasks](../ui/tasks/repeating.md) | `/tasks` |
| `dashboard` | [Dashboard](../ui/dashboard/README.md) | `/dashboard` |
| `goals` | [Areas and Goals](../ui/goals/README.md) | `/goals` |
| `goals.roadmap` | [Goal roadmap and related work](../ui/goals/roadmap.md) | `/goals/{id}` |
| `goals.milestones` | [Milestones and prerequisites](../ui/goals/milestones.md) | `/goals/{id}` |
| `calendar` | [Calendar and scheduling](../ui/calendar/README.md) | `/calendar` |
| `habits` | [Habits](../ui/habits/README.md) | `/habits`; `/dashboard` |
| `reviews` | [Reviews and Activity](../ui/reviews/README.md) | `/reviews` |
| `notes` | [Notes workspace](../ui/notes/README.md) | `/`; `/notes` |
| `notes.autosave` | [Note autosave and recovery](../ui/notes/autosave.md) | `/`; `/notes` |
| `notes.locks` | [Note passwords](../ui/notes/locks.md) | `/`; `/notes` |
| `notes.sharing` | [Note sharing and invitations](../ui/notes/sharing.md) | `/`; `/notes` |
| `notes.collaboration` | [Shared editing scope](../ui/notes/collaboration.md) | `/`; `/notes` |
| `notes.files` | [Private Note attachments](../ui/notes/files.md) | `/`; `/notes` |
| `notes.ai` | [Note summaries and questions](../ui/notes/ai.md) | `/`; `/notes` |
| `notes.offline` | [Offline Notes and PWA](../ui/notes/offline.md) | `/`; `/notes` |
| `auth` | [Authentication and sessions](../ui/auth/README.md) | `/login`; `/register`; `POST /api/v1/auth/logout` |
| `auth.recovery` | [Password recovery](../ui/auth/recovery.md) | `/forgot-password`; `/reset-password`; `/account/recover`; `/account/reset` |
| `auth.two-factor` | [Two-factor challenge](../ui/auth/two-factor.md) | `/two-factor` |
| `auth.email` | [Verification and email-change links](../ui/auth/email.md) | `/verify-email`; `/confirm-email`; `/account/verify` |
| `settings.profile` | [Profile and account files](../ui/settings/profile.md) | `/settings/profile` |
| `settings.preferences` | [Appearance and preferences](../ui/settings/preferences.md) | `/settings/preferences` |
| `settings.password` | [Password and MFA settings](../ui/settings/password.md) | `/settings/password` |
| `settings.notifications` | [Notification preferences](../ui/settings/notifications.md) | `/settings/notifications` |
| `settings.history` | [Task History and retention](../ui/settings/history.md) | `/settings/history`; `/tasks` |
| `settings.archive` | [Archive, restore and permanent deletion](../ui/settings/archive.md) | `/settings/archive` |
| `settings.reports` | [User reports and private evidence](../ui/settings/reports.md) | `/settings/reports` |
| `admin` | [Administration](../ui/admin/README.md) | `/admin` |
| `help` | [User guide and tour](../ui/help/README.md) | `/help` |
| `shared.shell` | [Shared workspace shell](../ui/shared/shell.md) | `/`; `/dashboard`; `/goals`; `/tasks`; `/calendar`; `/habits`; `/reviews`; `/settings`; `/help`; `/admin` |
| `shared.notifications` | [Notification bell](../ui/shared/notifications.md) | `/`; `/dashboard` |
| `shared.tags` | [Classification and related links](../ui/shared/tags.md) | `/`; `/tasks`; `/goals`; `/habits` |
| `shared.ai` | [Floating AI assistant](../ui/shared/ai.md) | `all authenticated workspace pages` |
| `shared.design-system` | [Shared UI components and templates](../ui/shared/design-system.md) | `/preview/components` |
| `shared.task-picker` | [Shared floating Task picker](../ui/shared/task-picker.md) | `/dashboard`; `/calendar`; `/goals/{id}`; `/preview/components` |
