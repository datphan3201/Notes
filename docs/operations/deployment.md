# Production release, backup and recovery

[Operations](README.md)

## Production configuration

Use a separate database/account, APP_ENV=production, APP_DEBUG=false, HTTPS APP_URL, SESSION_SECURE_COOKIE=true, an independent session key, absolute private/log paths outside backend/public and an empty VITE_DEV_URL. Configure optional mail/AI credentials server-side. [ConfigLoader](../../backend/src/Config/ConfigLoader.php) validates startup constraints; do not bypass them.

Production uses PHP-FPM. Point the web root only at backend/public, deny dotfiles and source/private directories, and execute PHP only through the public front controller. The repository root must never become a web root to make assets accessible.

Example Nginx location rules inside the TLS server block (replace paths/socket with host configuration):

```nginx
root /srv/planner/backend/public;
location / { try_files $uri /index.php?$query_string; }
location = /index.php {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/index.php;
    fastcgi_pass unix:/run/php/php8.5-fpm.sock;
}
location ~ \.php$ { return 404; }
location ~ /\. { deny all; }
```

For Apache use the public [.htaccess](../../backend/public/.htaccess) with rewrite/PHP-FPM enabled and a virtual host rooted at backend/public. Configure request size/time limits for supported uploads. Never make all source or secrets writable by the web user. Only private storage/log/runtime directories need write access.

## Release procedure

1. Back up database and private storage from the same maintenance point before schema changes.
2. Prepare a clean release checkout; keep production secrets outside tracked files.
3. From backend run `composer install --no-dev --prefer-dist --optimize-autoloader` and `composer check-platform-reqs`.
4. From frontend run `npm ci` and `npm run build`; deploy backend/public/build with its manifest.
5. From backend run `php bin/console migrate`, then migrate:status and migrate:check against the intended production database.
6. Switch release/reload PHP-FPM. Check `/up`, guest auth screens, authenticated data, private files and key business flows.
7. Enable/verify [periodic jobs](jobs.md) and monitor safe logs/request IDs. Verify SMTP and provider delivery separately if enabled.

Do not use goals_test/test cleanup or destructive schema-reset commands during a release. Production Vite dev-server mode is not supported.

## Automation and CI/CD

- [The GitHub Actions pipeline](../../.github/workflows/ci-cd.yml) runs documentation/traceability checks, frontend Prettier/Node tests/Vite build and PHPUnit against an isolated MySQL 8.4 `goals_test` service on every push and pull request to `main`.
- When repository secrets `ORACLE_HOST`, `ORACLE_USER` and `ORACLE_SSH_KEY` (plus optional `ORACLE_PORT`, `ORACLE_DEPLOY_PATH` and `ORACLE_APP_URL`) are configured, pushes to `main` sync the checkout and prebuilt `backend/public/build` artifact to the host and execute [tools/deploy/release.sh](../../tools/deploy/release.sh). When those secrets are absent, the deploy job exits cleanly after CI verification.
- For initial Ubuntu 24.04 LTS host setup on Oracle Cloud Always Free, [tools/deploy/oracle-ubuntu-setup.sh](../../tools/deploy/oracle-ubuntu-setup.sh) installs Nginx, MySQL, PHP 8.5-FPM with required extensions, Composer 2, Node.js 22 and Certbot.
- For manual on-host releases, run `bash tools/deploy/release.sh --build-frontend` (or without `--build-frontend` when `backend/public/build/manifest.json` has already been synced).

## Back up and restore

Use a protected MySQL option file for mysqldump/mysql authentication, not a password embedded in shell history. Back up goals database plus the configured private storage root and preserve their alignment. Store backups privately; they contain personal data and expiring secret mail links.

Restore into a new database and private directory. Configure the candidate release to that target, run migrate:check, verify referenced files, authenticate and smoke-test in a controlled window, then switch traffic. Rehearse restoration instead of assuming a SQL dump certifies recoverability.

If a failed migration changed DDL before MySQL auto-commit, do not claim a transaction rolled it back. Inspect completed statements and plan a forward repair or restore the matching database/storage backup. Application source rollback alone is insufficient after an incompatible schema change.
