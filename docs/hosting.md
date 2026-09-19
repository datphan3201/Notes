# Hosting and Startup Runbook

This is the operational guide for the framework-free Planner application. It
covers a clean first installation, normal local starts, production hosting,
database migrations, scheduled maintenance, account creation, and recovery
from common startup failures.

The canonical runtime is PHP 8.5, MySQL 8.4, PHP-FPM or the PHP development
server for local work, and a static Vite build served from backend/public.
Laravel, Artisan, Blade, Eloquent, and a Node server are not required at
runtime.

For product workflows, see [interface-guide.md](interface-guide.md). For the
frozen technical contract, see [plan/15-operations.md](plan/15-operations.md).

## 1. Runtime model

The application is a same-origin PHP monolith:

~~~text
Browser
  -> web server document root: backend/public
  -> backend/public/index.php
  -> application-owned router/controllers/services
  -> PDO/MySQL
  -> private files in backend/storage/app/private (or another private path)
~~~

The Vite build is compiled before the application is served:

~~~text
frontend/src + frontend/vite.config.js
  -> npm run build
  -> backend/public/build/manifest.json and hashed assets
~~~

Node/npm is a build-time dependency only. In local development, Vite's dev
server is optional; the PHP application can serve the source views and the
generated build without it.

Only backend/public may be exposed by a web server. Never expose the
repository root, backend/src, backend/database, backend/storage, backend/.env,
vendor, or the frontend source tree.

## 2. Supported hosting modes

| Mode | Use | Command/runtime | Production suitable? |
| --- | --- | --- | --- |
| PHP development server | Local development and smoke checks | php -S 127.0.0.1:8000 -t public dev-router.php from backend | No |
| Apache + PHP-FPM | Production or an internal server | Document root backend/public; .htaccess rewrites non-files | Yes |
| Nginx + PHP-FPM | Production or an internal server | Document root backend/public; route non-files to index.php | Yes |
| Shared hosting | Only when PHP 8.5, MySQL 8.4, Composer/build tooling, and a configurable document root are available | Build before upload; point the document root at backend/public | Depends on provider |

The PHP development server is intentionally not a production process: it has
limited concurrency, no process supervision, and no TLS termination.

## 3. Requirements

Install these before the first setup:

- PHP 8.5 with curl, pdo_mysql, mbstring, intl, fileinfo, zip, gd, dom,
  sodium, session, and xmlwriter.
- Composer 2.x.
- MySQL 8.4 with InnoDB and utf8mb4_0900_ai_ci support.
- Node 22 and npm 10 for the asset build.
- A web server and PHP-FPM for production hosting.
- curl for smoke checks and flock for non-overlapping scheduled jobs.

Check the versions before changing the repository:

~~~bash
php -v
php -m
composer --version
mysql --version
node --version
npm --version
~~~

## 4. First-time local installation

Run this section once for a new checkout or a new machine. It creates the
application configuration, two isolated databases, dependencies, schema, and
browser assets.

### 4.1 Create isolated databases

Use separate databases and database users. Do not let PHPUnit, cleanup code, or
manual experiments use goals_dev as the test database.

The following example uses TCP users because the application connects to
127.0.0.1 by default. Replace the placeholder passwords before executing it:

~~~sql
CREATE DATABASE goals_dev
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE goals_test
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER 'goals_dev'@'127.0.0.1' IDENTIFIED BY '<development-db-password>';
CREATE USER 'goals_test'@'127.0.0.1' IDENTIFIED BY '<test-db-password>';

GRANT ALL PRIVILEGES ON goals_dev.* TO 'goals_dev'@'127.0.0.1';
GRANT ALL PRIVILEGES ON goals_test.* TO 'goals_test'@'127.0.0.1';
FLUSH PRIVILEGES;
~~~

Verify the connection using the same host and user values that will be placed
in the environment file:

~~~bash
mysql --host=127.0.0.1 --port=3306 \
  --user=goals_dev --password goals_dev -e 'SELECT DATABASE(), VERSION();'
mysql --host=127.0.0.1 --port=3306 \
  --user=goals_test --password goals_test -e 'SELECT DATABASE(), VERSION();'
~~~

If a database already exists, do not drop it during routine setup. Confirm the
target name and let the checksum-verified migration runner bring it up to date.

### 4.2 Create the target environment file

From the repository root:

~~~bash
cp backend/.env.example backend/.env
~~~

Edit backend/.env and set at least these values:

~~~dotenv
APP_ENV=local
APP_DEBUG=true
APP_URL=http://127.0.0.1:8000
APP_TIMEZONE=UTC

PLANNER_DB_HOST=127.0.0.1
PLANNER_DB_PORT=3306
PLANNER_DB_DATABASE=goals_dev
PLANNER_DB_USERNAME=goals_dev
PLANNER_DB_PASSWORD=<development-db-password>
PLANNER_DB_ALLOWED=goals_dev,goals_test

SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=false
SESSION_ENCRYPTION_KEY=<base64-encoded-32-byte-key>

PRIVATE_STORAGE_ROOT=storage/app/private
LOG_PATH=storage/logs/planner.log
LOG_LEVEL=debug

AI_ENABLED=false
~~~

Generate the session key with PHP and paste the output into the ignored
environment file. Generate a new key per installation; do not reuse a key from
another machine:

~~~bash
php -r 'echo base64_encode(random_bytes(32)), PHP_EOL;'
~~~

The target application reads PLANNER_DB_*. The DB_* values are only
compatibility fallbacks. If an old Laravel checkout left a legacy .env with
unrelated values such as notes_dev, replace it with the target example before
starting the application. Never commit .env or any secret value.

The default relative private and log paths resolve below backend/ and are
created by the application when needed. For production, use explicit absolute
paths outside the public document root instead.

### 4.3 Install PHP and browser dependencies

~~~bash
cd backend
composer install

cd ../frontend
npm ci
~~~

composer install creates backend/vendor; npm ci creates frontend/node_modules.
Both are ignored build outputs and should not be committed.

### 4.4 Apply and verify the schema

Run migrations from backend so the application loads the intended environment
file:

~~~bash
cd backend
php bin/console migrate
php bin/console migrate:status
php bin/console migrate:check
~~~

Expected results:

- The first migrate applies the five target migrations.
- migrate:status reports every migration as applied.
- migrate:check prints Migration state is healthy.

The runner checks SELECT DATABASE() and refuses a configured/actual database
name mismatch. Do not bypass that guard or run destructive SQL to resolve a
wrong-database error.

### 4.5 Build browser assets

~~~bash
cd ../frontend
npm run build
~~~

Confirm that backend/public/build/manifest.json exists. The generated
backend/public/build directory is ignored by Git and must be rebuilt after a
fresh clone or after frontend changes.

### 4.6 Start the local application for the first time

Use a second terminal if you want to keep the command output visible:

~~~bash
cd backend
php -S 127.0.0.1:8000 -t public dev-router.php
~~~

In another terminal, run the smoke checks:

~~~bash
curl -fsS http://127.0.0.1:8000/up
curl -I http://127.0.0.1:8000/login
curl -I http://127.0.0.1:8000/register
~~~

/up should return JSON with {"data":{"status":"ok"}}. /login and /register
should return 200. A protected page such as /dashboard should redirect an
unauthenticated browser to /login.

Open http://127.0.0.1:8000/register and create the first user. There is no
admin account or admin role in the current single-user product. Registration
creates the user, preferences, and the three default Areas in one application
transaction. Do not seed a plaintext password directly into MySQL.

Stop the local server with Ctrl-C. The application does not need a separate
Node/Vite process after npm run build.

## 5. Normal local startup after installation

Use this shorter path on subsequent days. It assumes MySQL is running, the
dependencies are already installed, and backend/.env still contains the target
values.

~~~bash
cd /path/to/web-app/backend
php bin/console migrate:check
php -S 127.0.0.1:8000 -t public dev-router.php
~~~

Then open http://127.0.0.1:8000. No migration, Composer install, or npm install
is needed on every start.

Run php bin/console migrate after pulling a release that contains new
migrations, then run php bin/console migrate:check. It is idempotent for an
already-current database. Re-run npm ci && npm run build only when frontend
dependencies or source changed, or when backend/public/build is missing.

To use Vite hot reload instead of the last production build, start it in a
second terminal:

~~~bash
cd /path/to/web-app/frontend
npm run dev
~~~

Set VITE_DEV_URL=http://127.0.0.1:5173 in backend/.env first. The PHP
application only accepts loopback Vite URLs and only in APP_ENV=local. Clear
VITE_DEV_URL and rebuild assets before a production deployment.

## 6. Releasing an update to an existing host

This is the normal sequence after the first deployment. Take a database and
private-storage backup before applying a release that changes migrations.

1. Put the release in a new checkout or maintenance window. Do not edit the
   production environment file from source control.
2. Fetch the intended commit and confirm the runtime versions.
3. Install locked PHP dependencies:

   ~~~bash
   cd backend
   composer install --no-dev --prefer-dist --optimize-autoloader
   ~~~

4. Install and compile the frontend:

   ~~~bash
   cd ../frontend
   npm ci
   npm run build
   ~~~

5. Apply only forward migrations to the configured production database:

   ~~~bash
   cd ../backend
   php bin/console migrate
   php bin/console migrate:check
   ~~~

6. Verify routes and the health endpoint:

   ~~~bash
   php bin/console routes
   curl -fsS https://planner.example.com/up
   ~~~

7. Reload PHP-FPM or switch the web server to the new release. Existing
   sessions remain valid unless a password change or an explicit session
   rotation invalidates them.
8. Run the scheduled-command smoke checks and monitor the application log.

Do not run migrate against goals_test during a production release, and do not
use DROP, migrate:fresh, or a test cleanup command against production. If a
release must be rolled back after a destructive schema change, restore a
known-good database and private-storage backup rather than trying to reverse a
migration by hand.

## 7. Production environment

Use a separate production database and credentials. A production environment
file must include values equivalent to:

~~~dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://planner.example.com
APP_TIMEZONE=UTC

PLANNER_DB_HOST=127.0.0.1
PLANNER_DB_PORT=3306
PLANNER_DB_DATABASE=goals_production
PLANNER_DB_USERNAME=planner_runtime
PLANNER_DB_PASSWORD=<production-db-password>
PLANNER_DB_ALLOWED=goals_production

SESSION_LIFETIME=120
SESSION_SECURE_COOKIE=true
SESSION_ENCRYPTION_KEY=<independent-base64-encoded-32-byte-key>
PRIVATE_STORAGE_ROOT=/srv/planner-private
LOG_PATH=/var/log/planner/application.log
LOG_LEVEL=warning
AI_ENABLED=false
~~~

The configuration loader refuses production debug mode, insecure cookies,
unknown environments, invalid database allowlists, missing session keys, and
private storage under the public root. Terminate HTTPS at the web server and
forward requests to PHP-FPM. Keep database passwords, session keys, and the
optional Google AI key out of Git and out of browser responses.

### 7.1 Apache

Point the virtual host at backend/public, enable rewrite and PHP-FPM, and
allow the repository's backend/public/.htaccess to run:

~~~apache
DocumentRoot /srv/planner/backend/public

<Directory /srv/planner/backend/public>
    AllowOverride All
    Require all granted
</Directory>
~~~

The .htaccess serves existing assets directly and sends other paths to
index.php. Deny access to dotfiles and keep backend/.env, vendor, source,
database, and storage outside the document root.

### 7.2 Nginx + PHP-FPM

A minimal shape is:

~~~nginx
server {
    listen 443 ssl http2;
    server_name planner.example.com;
    root /srv/planner/backend/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /index.php {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param HTTPS on;
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
    }

    location ~ \.php$ {
        return 404;
    }

    location ~ /\. {
        deny all;
    }
}
~~~

Adjust the PHP-FPM socket, TLS settings, and service user for the host. The
exact index.php location must remain the only PHP execution path; static assets
should be served directly by Nginx.

### 7.3 Permissions

The PHP-FPM user needs read access to the release and write access only to the
private storage and log directories:

~~~bash
install -d -m 0700 /srv/planner-private/attachments
install -d -m 0700 /srv/planner-private/avatars
install -d -m 0770 /var/log/planner
~~~

Do not make the repository or backend/public writable by PHP-FPM. Do not put
private uploads under backend/public.

## 8. Scheduled maintenance

Use the host's scheduler with a non-overlap lock. The commands load the same
production environment file as the web application:

~~~cron
*/15 * * * * cd /srv/planner/backend && flock -n /run/lock/planner-recurrence.lock php bin/console recurrence:materialize >> /var/log/planner/recurrence.log 2>&1
0 * * * * cd /srv/planner/backend && flock -n /run/lock/planner-files.lock php bin/console files:prune >> /var/log/planner/files.log 2>&1
5 * * * * cd /srv/planner/backend && flock -n /run/lock/planner-sessions.lock php bin/console sessions:prune >> /var/log/planner/sessions.log 2>&1
10 * * * * cd /srv/planner/backend && flock -n /run/lock/planner-rates.lock php bin/console rate-limits:prune >> /var/log/planner/rates.log 2>&1
10 0 * * * cd /srv/planner/backend && flock -n /run/lock/planner-snapshots.lock php bin/console snapshots:capture >> /var/log/planner/snapshots.log 2>&1
~~~

The PHP-FPM/service user must be able to acquire the lock files and write the
redirected logs. Run each command once manually after deployment and alert on
a non-zero exit code. areas:backfill is an idempotent upgrade helper, not a
recurring job.

## 9. Database and private-file backup

Back up the database and private storage from the same maintenance point. A
restore is performed into a new database and storage directory:

1. Restore the SQL dump and private files into isolated paths.
2. Point a temporary environment file at the restored database/storage.
3. Run php bin/console migrate:check.
4. Check that referenced attachment/avatar paths exist and no unexpected path
   leaves the private root.
5. Start the application in maintenance mode or on a private port.
6. Smoke-test /up, login, Notes, attachments, and the planning dashboard.
7. Switch traffic only after the checks pass.

Never restore production data over the only copy, and never put a SQL dump or
private file backup under backend/public.

## 10. Accounts and first use

There is no administrator account, role, team, or shared workspace in this
release. Every account is an independent owner of its own data.

Create the first account from the browser at /register. The application
validates the email, display name, and password, creates default preferences
and Areas, starts a session, and redirects to the Dashboard. The registration
route is the supported bootstrap path; there is no admin:create or Artisan
command.

For a user who knows the current password, use Settings -> Password. A
password change increments auth_version, invalidates all sessions for the user,
and requires a new login. A database-level recovery must use a PHP
password_hash(..., PASSWORD_BCRYPT) hash, increment auth_version, and delete
the user's sessions in one transaction; never write plaintext passwords.

## 11. Troubleshooting

### Missing required environment value

The application did not load a target environment file, or it contains only
legacy Laravel settings. Copy backend/.env.example to backend/.env, set every
PLANNER_DB_* value, and provide SESSION_ENCRYPTION_KEY.

### Access denied for user or connection refused

Confirm that MySQL is running, the host/port match, the database user is
granted on the exact host (127.0.0.1 versus localhost matters), and the
password in the environment file has no accidental quotes or whitespace. Test
with the same mysql --host --port --user values before retrying PHP.

### Migration is not healthy or a checksum mismatch

Run php bin/console migrate:status and confirm the database name. A pending
migration means the release has not run php bin/console migrate; a checksum
mismatch means an applied migration file was edited and must be restored or
handled as an explicit migration incident. Never edit the ledger to hide the
mismatch.

### Built asset manifest is missing

Run cd frontend && npm ci && npm run build. Confirm that
backend/public/build/manifest.json and its referenced files exist. Do not start
a production host with only frontend/src present.

### A page returns a generic 500

Inspect the configured log file without exposing it to the browser. In local
mode, verify the PHP extensions, session key length, private storage path, and
database connection. In production, keep APP_DEBUG=false; do not turn on debug
output for an internet-facing host.

### Uploads or avatars fail

Confirm that PRIVATE_STORAGE_ROOT is outside backend/public, is not a symlink,
and is writable by PHP-FPM. The application creates attachments and avatars
with restrictive permissions; do not make the entire repository writable.

### /dashboard redirects to /login

This is expected when the browser has no valid session. Register or log in
again. Password changes intentionally invalidate old sessions.

### AI is unavailable

AI is disabled by default. This does not block the rest of the application.
Set AI_ENABLED=true, a supported model, and a server-side GOOGLE_AI_API_KEY
only after the disclosure/consent requirement is accepted. Never put the key in
frontend source or browser configuration.

## 12. Verification checklist

### Test database

PHPUnit forces APP_ENV=testing and the exact database name goals_test, but the
connection host, user, and password still come from the environment. Export
the isolated test credentials before running it:

~~~bash
cd backend
export PLANNER_DB_HOST=127.0.0.1
export PLANNER_DB_PORT=3306
export PLANNER_DB_DATABASE=goals_test
export PLANNER_DB_USERNAME=goals_test
export PLANNER_DB_PASSWORD='<test-db-password>'
vendor/bin/phpunit -c phpunit.xml
~~~

Never point the test runner or its cleanup helpers at goals_dev or a production
database. The integration suites intentionally create and clean rows in
goals_test.

Use the narrowest checks after local changes and the complete gate before a
release:

~~~bash
cd backend
composer validate --strict
composer check-platform-reqs
php bin/console migrate:check
php bin/console routes
vendor/bin/phpunit -c phpunit.xml

cd ../frontend
npm run test:unit
npm run format:check
npm run build

cd ..
curl -fsS http://127.0.0.1:8000/up
~~~

For production acceptance also run the browser matrix, syntax/dependency/secret
scans, scheduled-command checks, backup/restore rehearsal, and cross-account
authorization tests described in [plan/08-verification.md](plan/08-verification.md).

Record actual command results in [implementation-status.md](implementation-status.md)
or [verification.md](verification.md). Do not mark a deployment healthy from
an unrun command or from a browser page that was not checked against the
current release.
