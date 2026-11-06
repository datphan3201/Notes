# Console and documentation commands

[Documentation home](../README.md)

Run application commands from backend. [bin/console](../../backend/bin/console) is the command authority; it boots the configured app/database, including help/routes. No Artisan or framework CLI is used.

| Command | Purpose |
| --- | --- |
| `php bin/console migrate` | Apply forward checksum-verified migrations |
| `php bin/console migrate:status` / `migrate:check` | Inspect ledger / verify state |
| `php bin/console routes` | Runtime route listing |
| `php bin/console schedule:run` / `schedule:work` | Run due jobs / persistent scheduler |
| `php bin/console recurrence:materialize` | Extend recurring Task occurrences |
| `php bin/console reminders:send` | Send due opted-in personal reminder emails |
| `php bin/console snapshots:capture` | Capture closed-day Goal progress |
| `php bin/console history:prune` | Archive retained history under configured limits |
| `php bin/console files:prune` | Process pending/orphan file deletion |
| `php bin/console sessions:prune` / `rate-limits:prune` | Expired infrastructure cleanup |
| `php bin/console areas:backfill` | Create default Areas where needed |
| `php bin/console users:role <email> admin\|user` | Operator-controlled system role change; recorded in Administrator activity |
| `php bin/console registration:mode [open\|invite\|closed]` | Show or set who may register (default open); recorded in Administrator activity |
| `php bin/console mail:test <email>` | Deliver a test message through configured transport |
| `php bin/realtime.php` | Run the live-collaboration WebSocket server (long-running; see [jobs](../operations/jobs.md#realtime-server)) |

From the repository root, documentation commands work without a database:

```bash
php tools/docs/routes.php
php tools/docs/sync.php --write
php tools/docs/check.php
php tools/docs/tests/run.php
```

The first inspects actual route factory declarations using uninitialized controller objects solely for method binding; no controller/request is executed. The second refreshes trace tables/source line links, lookup indexes and blank route inventory/CSV. The third checks coverage, unique references, links and final diagram hashes. The fourth runs documentation-tool regression cases in an isolated fixture without application bootstrap or a database. Neither generator should be used to overwrite filled-in test results: save each executed test run as a separate local report.

## Quick public preview

| Command | What it does |
| --- | --- |
| `bash tools/dev/install-command.sh` | Installs `planner` in ~/.local/bin (run once, again after moving the checkout) |
| `planner` or `bash tools/dev/funnel.sh` | Serves this checkout at the machine's fixed Tailscale Funnel address `https://<machine>.<tailnet>.ts.net`, live collaboration included |
| `planner tunnel` or `bash tools/dev/tunnel.sh` | Serves it behind two Cloudflare quick tunnels (random address each run) |

Both start a user-level MySQL that is down, back up and apply pending migrations (asking unless `--yes`), build the frontend only when it changed (`--build` / `--no-build`), and stop everything on Ctrl+C. Options: `--port`, `--realtime-port`, `--no-realtime`. Setup and limits: [local development](../operations/local-development.md#share-the-local-app-at-a-fixed-address-with-tailscale-funnel).

## Existing running host

From the repository root, bash tools/deploy/existing-runtime.sh --dry-run previews the existing-server CD path. bash tools/deploy/install-existing-runtime.sh installs a user timer; PLANNER_TUNNEL_METRICS can select the running quick tunnel's loopback metrics endpoint. See [deployment](../operations/deployment.md#reuse-an-already-running-php-server-and-cloudflare-tunnel) for scope, main/clean-tree guards, failure recovery and schema/dependency restrictions. This path does not start another server or copy backend/.env to GitHub.

node --test tools/deploy/tests/*.test.mjs verifies the deployer with temporary Git repositories and fake external commands; it does not connect to the app database or run a host deployment.
