# Approved UI integration

[Documentation home](../README.md) · [Open issues](../issues.md) · [Run locally](development.md)

The approved personal workspace now runs against authenticated FastAPI/PostgreSQL data on `feat/personal-ai-planner-v1`. The user authorized integration and relevant tests after the UI review. Teamwork stays removed; realtime collaborative editing stays outside V1. The PHP/JS reference, MySQL source and private migration archives remain preserved. No production cutover or cloud deployment is implied.

## Runtime and persistence

`workspace.tsx` mounts `LiveWorkspace`, which supplies the reviewed components with an authenticated snapshot and ordinary CSRF-protected API writes. It does not mount the synthetic preview provider. `live-model.ts` maps UUIDs, account-local dates and typed fields between the API and the reviewed UI; `/workspace/changes` validates and commits a related batch atomically. Displayed versions protect updates and confirmed destructive actions. Failed writes retain recoverable drafts and show an error; successful saves wait for acknowledgement. `/preview/*` remains a separate in-memory comparison surface.

| Module | Integrated behavior |
| --- | --- |
| Shell / Dashboard | Real identity, focus, day/week selections, daily/weekly projections, Activity history, notification read state and Task destinations, routed desktop/mobile navigation |
| Areas / Goals / Milestones | Hierarchy, icons/colors/importance, strategy/related work, fishbone panels, cross-Goal owned prerequisite DAG, finite progress, confirmation-aware completion/reopen and grouped archive/restore/delete |
| Tasks / Calendar | Shared capture/editor/detail, checklist and working notes, related Goals, plans/filters/pins, account-local schedules and reminders, month/week/Gantt movement; stored recurrence templates and materialized occurrences with pause/resume/end |
| Habits / Reviews | Actual check-ins, future rest windows, timezone/period freeze, daily/weekly streaks, dated Activity, independent daily/weekly/monthly snapshots, editable reflections and finalization/reopen |
| Notes | Acknowledged autosave, version conflict recovery/download, tags/pin/color/links, passwords and session unlocks, pending invitations and recipient acceptance, read/edit permissions and revocation/leave, private files and image backgrounds |
| Offline Notes / PWA | Account-scoped IndexedDB drafts/outbox and generic shell cache; offline personal Note creates/edits/deletes; reconnect version checks preserve concurrent server edits, recovering edited drafts as copies. Password-protected/shared Notes and private media are excluded from the offline cache |
| Account / Appearance | Name/bio/private avatar and background, real email-change codes/links and session revocation, password/recovery/verification, email or authenticator MFA, themes/quotes/colors, locale/timezone and notification preferences |
| History / Archive | Completion/overdue thresholds, optional timed retention and system count cap; an hourly worker archives expired work without hard deletion. Group restoration, parent blockers, name/type filters, paging and acknowledged permanent deletion |
| Reporting / Administration | Authorized shared-Note reports and snapshots, private evidence, user report status, role-gated moderation, warning/lock/share withdrawal, member controls, registration/invitation policy, history cap and audit log |
| Assistant / Note AI | [35 named planning tools](assistant-tools.md), complete Goal/Milestone/Task proposals with local references, durable Reject, explicit transition acknowledgements, durable worker/SSE answers, bounded recent real conversation turns and trusted account date/language/timezone, named sources, current → proposed fields, explicit reject/confirm and hash/version-checked atomic Apply; source-versioned Note summaries/questions, never canned live answers |
| Help | Retained localized screenshot-led guide, FAQ and contextual tour |

## Assistant recovery

Assistant prompts and results are durable server-side. `GET /api/v1/assistant/runs` restores the account's history in pages of 30; the UI can load older messages. Reload restores completed answers and resumes observing the latest queued/running request. Note/proposal sources are re-authorized on read; unavailable or password-protected sources mask the historical prompt/answer rather than exposing stale content.

The square control means **Stop waiting**: it stops browser observation, preserves the server request and shows a normal paused status with Reconnect. It does not cancel the worker or apply any proposal. Event streams are backed by authenticated periodic reads, so a buffered/interrupted proxy stream cannot hide an already completed result indefinitely. `DELETE /api/v1/assistant/runs` clears the account's visible history using a timestamp; durable runs, usage reservations and approval records remain, so clearing chat cannot reset AI budgets. Chat content is not stored in the offline Note cache.

## Data and operations

Alembic `0004_complete_workspace` and `0005_private_assets` extend the current PostgreSQL schema. Forward upgrades were applied to development only after private backups and isolated migration checks. A fresh disposable PostgreSQL database reached the same head; `alembic check` found no new schema operations. No MySQL reset/import or replacement of private files was needed for this integration.

The development web/API/worker remain watched for code changes, and the existing Funnel continues forwarding HTTPS to the web application. The worker handles recurrence, reminders, retention, mail, indexing, AI and private-file cleanup. Administrator roles are assigned only from the server operator's console; an ordinary account cannot grant itself that role.

## Verification and limits

The isolated PostgreSQL suite covers ownership/404, CSRF, graph cycles and atomic rollback, stale versions and writer races, real single-use email/MFA challenges, private files/evidence, report resolution races, recurrence templates, retention boundaries, reminder pagination, Note query batching and deterministic AI/source/approval behavior. Browser tests use actual cookie/CSRF APIs, a production Next build, disposable accounts/storage and the guarded `planner_test` database; they never reset development or contact live mail/AI providers. Current execution results are recorded in [status](status.md).

These checks establish integration of the approved interfaces, not pixel-perfect equivalence of every historical screen or production acceptance. Concurrent shared Notes use version conflicts rather than realtime co-editing. Offline deletion never wins over a newer server version. The broader migration/recovery, model-quality/cost and production capacity gates remain in ISSUE-045–048. Cloud rollout is a separate operation.
