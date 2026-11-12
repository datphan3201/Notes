# Durable jobs and scheduling

[Operations](README.md) · [Source](../../apps/api/planner/jobs.py)

`python -m planner.jobs` runs the polling worker, scheduling periodic jobs and processing persisted PostgreSQL jobs. The Render supervisor starts it alongside the API when `PLANNER_RUN_WORKER=true`. Development uses a watched process; the alternative Cloud Tasks topology uses authenticated `planner.worker_api:app` ingress and dispatcher.

In the released backend, idle polling backs off to five seconds; scheduling runs independently from one short-work lane and one AI/index lane. `PLANNER_SCHEDULER_MODE=legacy` seeds the initial mode. Thereafter the `scheduler:desired` database row is authoritative: the scheduler holds its row lock through each tick, so an operator mode change waits for the active tick to finish. `compare` logs bounded aggregate candidate mismatches while retaining legacy scheduling; `due` uses indexed, bounded reminder/series selection and a persistent bounded hourly retention scan. Recurrence checkpoints are invalidated by edits and archival restoration. These changes and migrations `0010`–`0012` were released in `838fed3`; production was switched directly to due mode on 2026-11-12 after the owner explicitly waived shadow comparison.

After the additive migration, run `python -m planner.scheduler_admin --expect-project PROJECT_REF` to inspect checkpoint backfill, then use `--execute` to backfill under owner locks. `--set-mode compare` or `--set-mode due` is a dry run unless paired with `--execute`. The due switch requires 24 hours of uninterrupted, non-truncated matching comparisons for the current compare-mode generation; a mismatch or a gap longer than three minutes resets the streak. `--expect-mode` prevents overwriting a concurrent mode change.

The local `rollout_when_verified.py` can switch from compare to due only after that database gate, fresh lane heartbeats, 24 hours of successful UptimeRobot probes, memory below 80% of the recorded instance limit, and a matching expected live Render commit. Missing or unfavorable evidence leaves compare mode unchanged. Its local timer requires this machine, user service manager, Docker-independent network access and valid Render/database credentials.

The generic `/health/worker` endpoint checks independent scheduler, fast-lane and slow-lane heartbeats. Repeated worker exits are retried with bounded backoff; the API remains available after retries are exhausted and the stale heartbeat makes worker health fail. The operator-only `python -m planner.job_status --expect-project PROJECT_REF` prints aggregate queue and worker state without job payloads.

`python -m planner.job_cleanup --expect-project PROJECT_REF` is a dry run. Executing it requires an explicit recent verified backup, continuous due-mode scheduler observations, no pending legacy periodic jobs, fresh worker heartbeats and at least 48 hours since the legacy queue drained. It deletes only completed legacy periodic keys in bounded batches and preserves email and business-effect receipts. No production cleanup has yet been performed.

| Job | Work |
| --- | --- |
| `assistant` | Provider/tool rounds, source-versioned Note AI, durable run output/proposal |
| `index` | Eligible source chunks and optional embeddings; locked Notes excluded |
| `recurrence` | Materialize active TaskSeries occurrences with stable business keys |
| `reminders` | In-app/email reminders respecting preferences, History and deduplication |
| `reminder-dispatch` | One Task/reminder instant, rechecked before dispatch in due mode |
| `retention` | Archive expired/excess History Tasks, preserving facts/snapshots |
| `email` | Configured HTTPS Resend or SMTP delivery outside write transactions |
| `delete-file` | Remove private bytes after committed metadata deletion |

## Leases and retries

Claims use `FOR UPDATE SKIP LOCKED`, a ten-minute lease and a fresh lease token. Completion updates only the owned lease. Transient errors reschedule with bounded exponential delay; jobs become `dead` after five attempts. Completed email payloads are cleared. Interruption releases/requeues through the ordinary finish path. Retries and crashes mean at-least-once processing; business keys/idempotency must prevent duplicate effects.

Scheduling pages accounts and enqueues periodic work; it does not run provider work inside HTTP GETs. Stopping/sleeping the container pauses all polling work. Readiness checks database connectivity, not queue health or actual mail delivery. Monitor queue age, expired leases, dead jobs, assistant failures and provider delivery separately.

## Inspection and recovery

Use a narrowly authorized read-only database session to inspect counts by status/kind, oldest queued availability and dead-job error codes. Do not dump payloads, email tokens or prompts. Investigate the underlying failure before any deliberate retry; changing a status blindly can duplicate external delivery. No supported general retry/admin queue CLI is currently implemented.

The private worker endpoints require verified service identity/audience and belong to a separate ASGI app. They must not be exposed as anonymous public cron URLs. Details are in the [alternative cloud topology](../migration/cloud.md). Recovery drills and always-on background expectations remain in [open issues](../issues.md).
