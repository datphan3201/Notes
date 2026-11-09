# Current implementation and acceptance status

[Documentation home](../README.md) · [Open issues](../issues.md) · [Cloud operations](../operations/cloud.md)

## Repository state

The migrated Next.js/FastAPI/PostgreSQL system is the active runtime on `main`. Merge commit `2cfadd6` integrated the migration, `a26304b` added root health/request user-agent logging, and `8714dc0` removed the PHP/JS baseline and obsolete tooling. Earlier statements that the feature branch is unmerged, production is unprovisioned or the old runtime remains runnable are superseded.

Repository deployment records identify Vercel frontend, Render Singapore API/polling worker, and Supabase PostgreSQL/private Storage. This status is based on committed source/history/runbooks, **not a new live health, data reconciliation or hosted configuration audit**. See the operations runbook before any deployment.

## Implemented source scope

[UI integration](ui-integration.md) maps the connected personal workspace: authenticated planning/graph edits, Task/date/recurrence/Calendar, Habit check-ins/Reviews, Notes/autosave/invitations/passwords/files/offline, account settings/MFA/email, moderation/History/Archive and the durable assistant. Synthetic previews remain explicit `/preview/*` surfaces. Teamwork is removed and realtime co-editing deliberately excluded.

Alembic currently ends at `0006` (canonical Task Note backfill). API and worker use bounded pools, persisted jobs/leases, ordinary scoped domain transactions and private storage. AI exposes the [35-tool catalogue](assistant-tools.md), confirmed hash/version-bound Apply, durable Reject/history and SSE/read fallback. Source context relevance and cost/quality remain unresolved; existence of implementation is not complete acceptance.

## Historical execution evidence

The [changelog](../../CHANGELOG.md) and [historical preparation handoff](deployment-handoff.md) record earlier local runs: deployment preparation reported 127 backend tests, 19 web unit tests and 22 focused desktop/mobile cases; assistant restoration reported 111 backend tests and 62 browser cases. Different runs covered different revisions/scopes. Those totals are retained historical reports, not claims that this checkout just passed them. Ignored logs, if present locally, are not portable CI evidence.

The earlier local data-transfer report described 59 MySQL tables/140 rows and 14 private files, staging backup restore/merge rehearsal and guarded development import. It reported reconciliation of core personal records while preserving unsupported raw records/Teamwork history. That report does not verify the current hosted database, active private attachments, all relation/settings mappings or legacy MFA recovery. The importer still returns `cutover_ready: false`.

## Autosave follow-up — 2026-11-08

The frontend working-tree update passed 23 web unit tests, TypeScript/production E2E build and all 70 desktop/mobile browser cases on isolated `planner_test`. The new cases hold write and refresh responses, coalesce later actions, retain failed drafts, preserve queued checklist acknowledgements and reject unseen concurrent Task versions. Note saved/draft choices were exercised after conflict. Documentation integrity, its 17 regression cases and whitespace checks passed. Earlier selector-failure/intermediate queue runs are superseded by the final complete 70-case run.

Vercel production deployment `dpl_ATfnKHgPanB6KsKh5V9fD9XxmjED` reached READY at `planner-t1.vercel.app` from the local frontend checkout; no Git commit/push or backend deployment was performed. An authenticated browser on that hostname continued a second Habit action and switched tabs while its first write response was held. The probe intercepted all workspace writes locally, confirmed unchanged server Habit history and logged out with 204. This verifies the deployed client's interaction behavior, not real provider delivery or complete cloud recovery. A separate date-label defect observed there remains ISSUE-068.

## Remaining acceptance

| Issue | Outstanding evidence |
| --- | --- |
| ISSUE-045 | Representative historical data, human desktop/mobile/keyboard/localization and Calendar/Gantt acceptance |
| ISSUE-046 | Remaining mapping/MFA/file restoration, consistent managed DB+file backup/restore and recovery rehearsal; hosted transfer reconciliation |
| ISSUE-047 | Live provider evaluation/citations/adversarial behavior, embedding/usage accounting, paid budgets and cross-queue traces |
| ISSUE-048 | Agreed sustained workload budget, realistic large datasets, worker/AI contention and hosted capacity measurements |
| ISSUE-063 | Selective scoped retrieval, compact candidates, calibrated relevance/read budgets and clear citation/source presentation |
| ISSUE-064–067 | Orphaned legacy deploy test, cloud COPY limitations, unbounded workspace snapshot and unresolved Dashboard layout, as detailed in the issue list |

Historical small-fixture load reports include p95 645.59 ms at 100 concurrency and 129.64 ms at 20 concurrency. They measure local saturation under those fixtures, not a production capacity promise. Run [current verification commands](../testing/README.md) against isolated test data before making new pass claims.
