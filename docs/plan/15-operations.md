# Operations, Migration, and Deployment Contract

The operator-facing procedure is maintained in the [Hosting and Startup
Runbook](../hosting.md). This contract freezes the behavior that runbook must
describe; the runbook distinguishes first installation, normal subsequent
starts, and production releases.

## Environment

Required target variables: application environment/debug/URL/timezone; DB host/port/database/user/password/charset/collation; session key/lifetime/secure flag; storage root; log path/level; Vite development URL only in local mode; optional AI enabled/provider/model/key.

Startup validates missing/invalid settings and refuses production debug, insecure production session cookies, web-accessible storage roots, and unknown environment values.

## CLI

```text
php bin/console migrate
php bin/console migrate:status
php bin/console migrate:check
php bin/console routes
php bin/console files:prune
php bin/console sessions:prune
php bin/console rate-limits:prune
php bin/console areas:backfill
php bin/console recurrence:materialize
php bin/console snapshots:capture
```

These commands are implemented. All return nonzero on partial failure and
print safe object counts/IDs, never secrets. `areas:backfill` is idempotent and
creates the three default Areas only for an account that currently has none.

## Scheduling

- Every 15 minutes: recurrence materialization (daily schedules tolerate delayed execution and catch up).
- Hourly: pending/orphan private file prune, expired sessions/rate limits.
- Daily after local-day rollover: Goal snapshots. The command finds users whose local previous day has not been captured.

Use OS scheduler/cron; no queue service is required.

## Vite

Native Vite config emits `backend/public/build/manifest.json` and assets. Production `AssetManifest` loads entry CSS/imports/scripts or throws a safe startup error when manifest/entry/file is missing. Local mode uses configured Vite URL and only permits loopback/explicit development hosts. Application APIs remain same-origin.

## Fresh installation

1. Install PHP/Composer/MySQL/Node/npm requirements.
2. Copy environment example and generate independent session encryption key.
3. Create separate `goals_dev` and `goals_test` databases/users.
4. Run Composer/npm installation.
5. Run target migrations and build assets.
6. Point web document root to `backend/public`.
7. Verify `/up`, registration, Notes, private storage permissions, and maintenance commands.

No legacy data/session import is required. Do not delete the legacy database automatically.

After this one-time setup, a normal local start only requires a healthy MySQL
service, php bin/console migrate:check, and the PHP development-server command
from backend. Composer/npm installation and asset building are not per-start
operations. A release that contains new migrations runs migrate once before
the new PHP code receives traffic, then runs migrate:check and the health
smoke test. The PHP development server is never a production host.

The supported production shape is Apache or Nginx with PHP-FPM and
backend/public as the sole document root. The web-server examples, file
permissions, scheduler/flock commands, account bootstrap, backup/restore, and
troubleshooting steps are kept in docs/hosting.md so they can be followed
without reading the implementation contracts.

## Deployment

Apache uses the public `.htaccess`. Nginx uses `try_files $uri /index.php?$query_string` and permits PHP execution only for `index.php`. Deny dotfiles, vendor, source, environment, docs, and storage. Use HTTPS, secure cookies, PHP-FPM, writable private/log directories, request limits matching validation, and MySQL backups.

## Backup/restore

Backup database and private storage from the same maintenance point. Restore into a new database/storage directory, run `migrate:check`, compare referenced paths, start in maintenance mode, smoke-test, then switch traffic. AI provider data is not the application source of truth.

## Framework retirement gate

Before removing Laravel:

- Plain parity suites and browser smoke pass.
- `composer why laravel/framework` has no required target caller.
- First-party `rg` scan finds no `Illuminate\\`, Laravel helpers/directives, `artisan`, or `laravel-vite-plugin` outside clearly historical docs.
- Production starts with a clean vendor directory from the target lockfile.
- Route list and migration status come from target CLI.

Remove Laravel code/packages/config only in M05 after this gate.
