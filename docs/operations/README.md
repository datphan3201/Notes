# Operations

[Documentation home](../README.md)

| Task | Guide |
| --- | --- |
| Set up PHP, MySQL, environment, dependencies and schema | [First installation](installation.md) |
| Run the existing database/app with hot reload | [Local development](local-development.md) |
| Release, serve with PHP-FPM, back up and restore | [Production](deployment.md) |
| Reuse an existing tunnel and deploy green main without another host | [Existing runtime](deployment.md#reuse-an-already-running-php-server-and-cloudflare-tunnel) |
| Recurrence, reminders, snapshots and cleanup | [Jobs and mail](jobs.md) |
| Console command navigation | [CLI reference](../reference/cli.md) |

Only backend/public is a document root. Use goals_dev for local app data and the isolated goals_test database for destructive tests. Never run test cleanup against a running app database. Instructions here are procedures, not a claim that this host is deployed or its cron/SMTP has been certified.
