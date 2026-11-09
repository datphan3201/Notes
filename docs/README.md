# Documentation index

The maintained source of implementation is Next.js/FastAPI under `apps/` on `main`. PHP/JS paths were removed in `8714dc0`. Current behavior maps below reference React components, Python services and current tests. Historical migration/preview records are labeled and do not override current source or decisions.

## Find a feature

| Browser surface | Documentation |
| --- | --- |
| `/`, `/notes` | [Notes](ui/notes/README.md), [autosave](ui/notes/autosave.md), [passwords](ui/notes/locks.md), [sharing](ui/notes/sharing.md), [files](ui/notes/files.md), [AI](ui/notes/ai.md), [offline](ui/notes/offline.md) |
| `/dashboard` | [Dashboard](ui/dashboard/README.md) |
| `/goals`, `/goals/{id}` | [Areas/Goals](ui/goals/README.md), [roadmap](ui/goals/roadmap.md), [Milestones](ui/goals/milestones.md) |
| `/tasks`, `/tasks/{id}` | [Tasks](ui/tasks/README.md), [filters/planning](ui/tasks/filters.md), [capture](ui/tasks/capture.md), [details](ui/tasks/detail.md), [recurrence](ui/tasks/repeating.md) |
| `/calendar`, `/habits`, `/reviews` | [Calendar](ui/calendar/README.md), [Habits](ui/habits/README.md), [Reviews](ui/reviews/README.md) |
| `/settings/profile`, `/settings/preferences`, `/settings/password` | [Profile](ui/settings/profile.md), [Appearance](ui/settings/preferences.md), [password/MFA](ui/settings/password.md) |
| `/settings/notifications`, `/settings/history`, `/settings/archive`, `/settings/reports` | [Notifications](ui/settings/notifications.md), [History](ui/settings/history.md), [Archive](ui/settings/archive.md), [reports](ui/settings/reports.md) |
| `/login`, `/register`, `/two-factor` | [Authentication](ui/auth/README.md), [MFA challenge](ui/auth/two-factor.md) |
| `/forgot-password`, `/reset-password`, `/verify-email`, `/confirm-email` | [Recovery](ui/auth/recovery.md), [email links](ui/auth/email.md) |
| `/help`, `/admin` | [Guide](ui/help/README.md), [administration](ui/admin/README.md) |
| Shared controls | [Shell/styles](ui/shared/shell.md), [bell](ui/shared/notifications.md), [classification](ui/shared/tags.md), [assistant](ui/shared/ai.md) |

`/settings` opens the settings shell; `/account/{recover,reset,verify}` are accepted account-action aliases. `/preview/*` is a synthetic comparison surface, not live account data. Milestones and Review editors are in-page; files are streamed through authorized `/api/v1/files/*` or `/api/v1/account-files/*` endpoints. There is no realtime co-editing server in V1; see [shared editing scope](ui/notes/collaboration.md).

## Navigate implementation and operations

- [Decisions](architecture/decisions.md), [runtime](architecture/runtime.md), [persistence](architecture/persistence.md), [HTTP/security](architecture/http-security.md), [interaction invariants](architecture/interactions.md).
- [Routes and handlers](reference/routes.md), [blank route sheet](reference/routes.csv), [components](reference/components.md), [source lookup](reference/source-index.md), [CLI](reference/cli.md).
- [Installation](operations/installation.md), [development](migration/development.md), [deployment](operations/deployment.md), [cloud operations](operations/cloud.md), [jobs](operations/jobs.md).
- [Testing](testing/README.md), [manual acceptance plan](testing/manual-checklist.md), [evidence limits](testing/verification-limits.md).
- [Implementation status](migration/status.md), [approved scope/acceptance plan](migration/personal-ai-planner.md), [UI integration](migration/ui-integration.md), [assistant tools](migration/assistant-tools.md), [historical diagrams](diagrams/README.md).
- [Open issues](issues.md), [changelog](../CHANGELOG.md), [documentation maintenance](maintenance.md).

## Authority and evidence

Current user decisions and [product boundaries](architecture/decisions.md) govern intent. Source defines observed implementation; tests are evidence only when actually executed against a stated revision/environment. The [registry](traceability.json) owns current feature/source navigation, and the dependency-free [checker](../tools/docs/check.py) verifies it without application or database imports. Static checks do not establish complete parity, visual/accessibility quality, provider quality or hosted recovery. Known gaps stay in the issue list.
