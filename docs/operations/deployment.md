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

The hosting module under [tools/deploy](../../tools/deploy/setup.sh) shares one core across every way of exposing the site: host packages, MySQL 8.4, backend/.env, writable-directory permissions, backups, the scheduler, releases and pull-based continuous deployment. Only the ingress differs, and each ingress is a separate file under tools/deploy/ingress.

| Ingress | Use | Needs | APP_URL |
| --- | --- | --- | --- |
| [quick-tunnel](../../tools/deploy/ingress/quick-tunnel.sh) (default) | Trying a deployment | Nothing: Cloudflare assigns a random https://*.trycloudflare.com URL | Rewritten on every tunnel start |
| [cloudflare-tunnel](../../tools/deploy/ingress/cloudflare-tunnel.sh) | Stable hostname, no open ports | DNS zone on Cloudflare and a tunnel token | `https://<domain>` |
| [direct](../../tools/deploy/ingress/direct.sh) | Any DNS provider | A/AAAA record, inbound TCP 80/443 | `https://<domain>` |

### Host provisioning

[The setup script](../../tools/deploy/setup.sh) prepares an Ubuntu 24.04 LTS host (amd64 or arm64; an Oracle Cloud instance, another VM or a home server). Clone the repository to a world-traversable path as the deploy user, then run it from the clone:

```bash
sudo mkdir -p /srv/planner && sudo chown "$USER" /srv/planner
git clone https://github.com/datphan3201/Notes.git /srv/planner
sudo bash /srv/planner/tools/deploy/setup.sh                                   # quick tunnel
sudo bash /srv/planner/tools/deploy/setup.sh --ingress cloudflare-tunnel \
    --domain notes.example.com --tunnel-token-file ~/tunnel-token             # named tunnel
sudo bash /srv/planner/tools/deploy/setup.sh --ingress direct \
    --domain notes.example.com --email you@example.com                       # public Nginx
```

The [shared steps](../../tools/deploy/lib/host.sh) install Nginx, PHP 8.5-FPM with the required extensions, Composer 2, Node.js 22 and jq, and run MySQL 8.4 from the official `mysql:8.4` Docker image (MySQL's APT repository publishes no arm64 packages) with host networking on 127.0.0.1:3306 and data in /var/lib/planner-mysql. On first run they create the `planner` database and user and a production backend/.env with generated credentials and session key. Every run installs root-owned helpers (/usr/local/lib/planner, planner-backup, planner-tunnel-url), PHP upload limits, the [scheduler](jobs.md) cron as www-data, the nightly backup cron, runs a release and serves the application on the local-only Nginx server 127.0.0.1:8080 built from the rules above. Setup ends with a /up check on that server and prints the public URL.

Re-run setup with another `--ingress` to switch; MySQL data, /etc/planner credentials, backend/.env and backup.conf are kept, APP_URL follows the new ingress and the tunnel service is disabled when leaving a tunnel ingress. Configure MAIL_* and optional AI_* in backend/.env afterwards.

- **Tunnels.** [Shared cloudflared plumbing](../../tools/deploy/lib/cloudflared.sh) installs cloudflared from Cloudflare's signed APT repository and runs planner-tunnel.service as an unprivileged user against 127.0.0.1:8080, so no inbound port is opened and Cloudflare terminates TLS. Because every request then arrives from loopback, Nginx takes the client address from `CF-Connecting-IP` only for loopback peers; otherwise every visitor would share one rate-limit and login-throttle identity ([Request::clientIp](../../backend/src/Http/Request.php)). [CsrfGuard](../../backend/src/Http/Security/CsrfGuard.php) compares the browser Origin with APP_URL, so APP_URL must equal the public URL. A quick tunnel URL changes on every restart, including reboots; [planner-tunnel-url](../../tools/deploy/tunnel-url.sh) reads it from cloudflared's metrics server and rewrites APP_URL and /etc/planner/public-url each time, and links in mail sent earlier stop working. Quick tunnels have no uptime guarantee. For a named tunnel, route its public hostname to HTTP 127.0.0.1:8080 in Cloudflare Zero Trust; the token is kept in root-only /etc/planner/cloudflared.env.
- **Direct.** Adds a public port-80 server for `--domain`, opens host iptables before any REJECT rule (Oracle images), obtains a Let's Encrypt certificate with an HTTPS redirect and leaves renewal to certbot.timer. Allow inbound TCP 80/443 in the cloud firewall (Oracle: VCN security list or NSG). Pass `--skip-tls` while DNS is not ready; production cookies are Secure-only, so sign-in requires re-running without it.

Writable directories (private storage and the log directory) are setgid www-data with default ACLs so files stay writable by both PHP-FPM and the deploy user; source files stay deploy-owned. The deploy user may only reload php8.5-fpm and run the backup helper through sudo.

### Releases

`bash tools/deploy/release.sh [--build-frontend]` ([source](../../tools/deploy/release.sh)) installs production dependencies, prepares writable directories, takes a verified pre-release backup and only then runs migrate, migrate:status and migrate:check before reloading PHP-FPM. One release runs at a time. It refuses to migrate when the backup helper is missing or fails; `--skip-backup` exists only for non-production hosts. Exit status 3 means it failed before the database was touched; 4 means another release holds the lock. Releases update the checkout in place.

### Continuous integration and deployment

[The CI workflow](../../.github/workflows/ci-cd.yml) runs shell-script checks (bash -n, shellcheck), documentation/traceability checks, frontend Prettier/Node tests/Vite build and PHPUnit against an isolated MySQL 8.4 `goals_test` service on every push and pull request to `main`. It holds no deployment secrets and must keep its file name, which the deployer queries.

Deployment is pull-based and identical for every ingress. planner-deploy.timer runs [the pull deployer](../../tools/deploy/pull-deploy.sh) as the deploy user every two minutes. It asks the GitHub API for the newest push to the deployed branch whose ci-cd.yml run succeeded, and only fast-forwards to it: it never moves backwards, refuses when tracked files were edited on the host and skips while another release runs. It then runs release.sh with a frontend build and checks /up on 127.0.0.1:8080. When the release fails before migrations it restores and re-releases the previous revision; a failure after migrations started, or an unhealthy /up, leaves the new revision in place for a forward fix or a restore from the pre-release backup. A failed commit is not retried until a newer commit is green or `--force` is given. Logs: `journalctl -u planner-deploy`; preview with `bash tools/deploy/pull-deploy.sh --dry-run`. Public repositories need no credentials (the unauthenticated API limit is 60 requests per hour per IP, above the timer's 30). A private repository needs a read-only deploy key or credential for `git fetch` and a fine-grained token (Actions and Contents: read) in the deploy user's ~/.config/planner/github-token. Use `--no-auto-deploy` to release only by hand.

## Back up and restore

Use a protected MySQL option file for mysqldump/mysql authentication, not a password embedded in shell history. Back up goals database plus the configured private storage root and preserve their alignment. Store backups privately; they contain personal data and expiring secret mail links.

On provisioned hosts, [the backup helper](../../tools/deploy/backup.sh) is installed as root-owned /usr/local/sbin/planner-backup and configured by root-only /etc/planner/backup.conf. Each run writes database.sql.gz (single-transaction mysqldump through the root option file), private-storage.tar.gz, a MANIFEST with the source revision and SHA256SUMS to /var/backups/planner/<UTC time>-<label>, keeps 14 days by default and, when `RCLONE_REMOTE` is set, copies the backup off-site. Releases take a `pre-release` backup and cron takes a `daily` one; run `sudo planner-backup manual` before risky manual work. Local copies alone do not survive loss of the instance, so configure an off-site remote.

Restore into a new database and private directory. Configure the candidate release to that target, run migrate:check, verify referenced files, authenticate and smoke-test in a controlled window, then switch traffic. Rehearse restoration instead of assuming a SQL dump certifies recoverability.

If a failed migration changed DDL before MySQL auto-commit, do not claim a transaction rolled it back. Inspect completed statements and plan a forward repair or restore the matching database/storage backup. Application source rollback alone is insufficient after an incompatible schema change.
