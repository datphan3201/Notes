# Periodic jobs, processes and mail

[Operations](README.md) · [Console source](../../backend/bin/console)

## Scheduler

Run one scheduler through cron every minute, for example (replace installation path):

```cron
* * * * * cd /srv/planner/backend && flock -n /tmp/planner-scheduler.lock php bin/console schedule:run
```

Alternatively supervise `php bin/console schedule:work`; it checks the schedule every minute. On a development machine `planner` (tools/dev/funnel.sh and tunnel.sh) runs `schedule:work` for as long as it serves the app. [Scheduler](../../backend/src/Application/Scheduling/Scheduler.php) and [its repository](../../backend/src/Infrastructure/Persistence/Pdo/Scheduling/PdoScheduledJobRepository.php) track due jobs/outcomes. Inspect command status/logs; do not assume invoking the scheduler proves all deliveries succeeded.

| Job | Due interval | Observable effect |
| --- | --- | --- |
| reminders:send | 60s | Opted-in due personal Task emails; failures are reported |
| recurrence:materialize | 3600s | Extend personal series horizon; series/date identity prevents duplicates |
| snapshots:capture | 21600s | Capture available closed-day Goal progress facts |
| history:prune | 3600s | Archive retention/cap-qualified Tasks, never hard-delete |
| sessions:prune | 3600s | Remove expired session rows |
| rate-limits:prune | 3600s | Remove expired buckets |
| files:prune | 86400s | Process pending deletion and unreferenced managed bytes |

Task/Dashboard reads additionally top up personal recurrence in current code. They are not a substitute for reminders, snapshots or cleanup jobs. Every command uses configured application data; run destructive retention/prune experiments only against intentional QA fixtures.

## Realtime server

`php bin/realtime.php` is a long-running WebSocket process for live co-editing of shared Notes (not a cron job). Run exactly one per installation under a supervisor: setup.sh installs `planner-realtime.service` (restart on failure, PHP-FPM user) and release.sh restarts it after each release. It listens on `REALTIME_LISTEN` behind the `/realtime` proxy, keeps its database connection alive and exits for a supervised restart if the connection is lost; open editors reconnect and resend unacknowledged edits. Logs go to the application log and `journalctl -u planner-realtime`.

## Mail

See [environment variables](../../backend/.env.example) and [mail infrastructure](../../backend/src/Infrastructure/). With MAIL_HOST configured, delivery uses SMTP and MAIL_PORT/MAIL_ENCRYPTION/MAIL_USERNAME/MAIL_PASSWORD. Without SMTP, local/testing writes restrictive .eml messages under private storage/mail-outbox; production uses the system transport. Configure MAIL_FROM_ADDRESS/NAME.

An authorized operator can run `php bin/console mail:test <recipient-email>` to test the configured delivery path. That is an actual outbound message when delivery is enabled; use an intended recipient. Never paste verification/reset links or codes into docs/log screenshots.

Invitation (including Note shares), verification/change, password reset (link and 6-digit code) and reminder delivery have different product triggers. Personal reminder emails are at-least-once across a delivery/commit crash boundary and can duplicate after a crash; do not claim exactly-once external delivery.
