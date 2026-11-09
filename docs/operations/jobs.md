# Durable jobs and scheduling

[Operations](README.md) · [Source](../../apps/api/planner/jobs.py)

`python -m planner.jobs` runs the polling worker, scheduling periodic jobs and processing persisted PostgreSQL jobs. The Render supervisor starts it alongside the API when `PLANNER_RUN_WORKER=true`. Development uses a watched process; the alternative Cloud Tasks topology uses authenticated `planner.worker_api:app` ingress and dispatcher.

| Job | Work |
| --- | --- |
| `assistant` | Provider/tool rounds, source-versioned Note AI, durable run output/proposal |
| `index` | Eligible source chunks and optional embeddings; locked Notes excluded |
| `recurrence` | Materialize active TaskSeries occurrences with stable business keys |
| `reminders` | In-app/email reminders respecting preferences, History and deduplication |
| `retention` | Archive expired/excess History Tasks, preserving facts/snapshots |
| `email` | Configured HTTPS Resend or SMTP delivery outside write transactions |
| `delete-file` | Remove private bytes after committed metadata deletion |

## Leases and retries

Claims use `FOR UPDATE SKIP LOCKED`, a ten-minute lease and a fresh lease token. Completion updates only the owned lease. Transient errors reschedule with bounded exponential delay; jobs become `dead` after five attempts. Completed email payloads are cleared. Interruption releases/requeues through the ordinary finish path. Retries and crashes mean at-least-once processing; business keys/idempotency must prevent duplicate effects.

Scheduling pages accounts and enqueues periodic work; it does not run provider work inside HTTP GETs. Stopping/sleeping the container pauses all polling work. Readiness checks database connectivity, not queue health or actual mail delivery. Monitor queue age, expired leases, dead jobs, assistant failures and provider delivery separately.

## Inspection and recovery

Use a narrowly authorized read-only database session to inspect counts by status/kind, oldest queued availability and dead-job error codes. Do not dump payloads, email tokens or prompts. Investigate the underlying failure before any deliberate retry; changing a status blindly can duplicate external delivery. No supported general retry/admin queue CLI is currently implemented.

The private worker endpoints require verified service identity/audience and belong to a separate ASGI app. They must not be exposed as anonymous public cron URLs. Details are in the [alternative cloud topology](../migration/cloud.md). Recovery drills and always-on background expectations remain in [open issues](../issues.md).
