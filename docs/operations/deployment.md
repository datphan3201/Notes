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

### Host provisioning

[The Oracle Cloud setup script](../../tools/deploy/oracle-ubuntu-setup.sh) prepares an Ubuntu 24.04 LTS instance (amd64 or arm64) end to end. Clone the repository to a world-traversable path as the deploy user, point DNS at the instance, allow ingress TCP 80/443 in the VCN security list or NSG, then run from the clone:

```bash
sudo mkdir -p /srv/planner && sudo chown "$USER" /srv/planner
git clone https://github.com/datphan3201/Notes.git /srv/planner
sudo bash /srv/planner/tools/deploy/oracle-ubuntu-setup.sh --domain notes.example.com --email you@example.com
```

It installs Nginx, PHP 8.5-FPM with the required extensions, Composer 2, Node.js 22 and Certbot, and runs MySQL 8.4 from the official `mysql:8.4` Docker image (MySQL's APT repository publishes no arm64 packages) on 127.0.0.1:3306 with data in /var/lib/planner-mysql. On first run it creates the `planner` database and user, writes a production backend/.env with generated credentials and session key, installs the Nginx site from the rules above, obtains a Let's Encrypt certificate with an HTTPS redirect, opens host iptables before Oracle's REJECT rule, installs the [scheduler](jobs.md) cron as www-data and the nightly backup cron, and runs the first release. Pass `--skip-tls` while DNS is not ready; production cookies are Secure-only, so sign-in requires re-running without it. Re-running keeps MySQL data, /etc/planner credentials, backend/.env and backup.conf. Configure MAIL_* and optional AI_* in backend/.env afterwards.

Writable directories (private storage and the log directory) are setgid www-data with default ACLs so files stay writable by both PHP-FPM and the deploy user; source files stay deploy-owned. The deploy user may only reload php8.5-fpm and run the backup helper through sudo.

### Releases

`bash tools/deploy/release.sh [--build-frontend]` ([source](../../tools/deploy/release.sh)) installs production dependencies, prepares writable directories, takes a verified pre-release backup and only then runs migrate, migrate:status and migrate:check before reloading PHP-FPM. It refuses to migrate when the backup helper is missing or fails; `--skip-backup` exists only for non-production hosts. Releases update the checkout in place, so a failure after the code update leaves new code running until it is fixed or rolled back to the printed previous revision.

### GitHub Actions

[The pipeline](../../.github/workflows/ci-cd.yml) runs shell-script checks, documentation/traceability checks, frontend Prettier/Node tests/Vite build and PHPUnit against an isolated MySQL 8.4 `goals_test` service on every push and pull request to `main`.

Deployment is opt-in. With the repository variable `DEPLOY_ENABLED=true`, pushes to `main` (and manual runs on `main`) check out the verified commit on the host, sync the built backend/public/build artifact and run release.sh, one deployment at a time in the `production` environment. Without the variable the deploy job is reported as skipped; with it, missing secrets fail the run. Required secrets: `ORACLE_HOST`, `ORACLE_USER`, `ORACLE_SSH_KEY` (a private key whose public half is in the deploy user's authorized_keys) and `ORACLE_KNOWN_HOSTS`. Optional: `ORACLE_PORT`, `ORACLE_DEPLOY_PATH` (default /srv/planner) and `ORACLE_APP_URL` for the `/up` health check.

`ORACLE_KNOWN_HOSTS` pins the host key; the workflow never trusts a key fetched at deploy time. Produce it with `ssh-keyscan -H -p <port> <host>` and accept it only after its fingerprints match those printed by the setup script or `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` on the instance console. A private repository additionally needs a read-only deploy key on the host for `git fetch`.

## Back up and restore

Use a protected MySQL option file for mysqldump/mysql authentication, not a password embedded in shell history. Back up goals database plus the configured private storage root and preserve their alignment. Store backups privately; they contain personal data and expiring secret mail links.

On provisioned hosts, [the backup helper](../../tools/deploy/backup.sh) is installed as root-owned /usr/local/sbin/planner-backup and configured by root-only /etc/planner/backup.conf. Each run writes database.sql.gz (single-transaction mysqldump through the root option file), private-storage.tar.gz, a MANIFEST with the source revision and SHA256SUMS to /var/backups/planner/<UTC time>-<label>, keeps 14 days by default and, when `RCLONE_REMOTE` is set, copies the backup off-site. Releases take a `pre-release` backup and cron takes a `daily` one; run `sudo planner-backup manual` before risky manual work. Local copies alone do not survive loss of the instance, so configure an off-site remote.

Restore into a new database and private directory. Configure the candidate release to that target, run migrate:check, verify referenced files, authenticate and smoke-test in a controlled window, then switch traffic. Rehearse restoration instead of assuming a SQL dump certifies recoverability.

If a failed migration changed DDL before MySQL auto-commit, do not claim a transaction rolled it back. Inspect completed statements and plan a forward repair or restore the matching database/storage backup. Application source rollback alone is insufficient after an incompatible schema change.
