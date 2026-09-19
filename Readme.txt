PERSONAL PLANNING AND NOTES APPLICATION
=======================================

The complete hosting and startup runbook is in docs/hosting.md. This file is
the command-oriented quick reference for local installation and deployment.

RUNTIME
-------

The canonical backend is framework-free PHP 8.5 under backend/src. Laravel,
Blade, Artisan, Eloquent, and the Laravel Vite plugin are not runtime or
development dependencies.

Requirements:

- PHP 8.5 with curl, pdo_mysql, mbstring, intl, fileinfo, zip, gd, dom,
  sodium, session, and xmlwriter.
- Composer 2.x.
- MySQL 8.4 using InnoDB and utf8mb4_0900_ai_ci.
- Node 22 and npm 10.

LOCAL INSTALLATION
------------------

Create separate user-owned goals_dev and goals_test databases. Never point the
test runner or cleanup commands at goals_dev.

    cd backend
    cp .env.example .env
    composer install

Generate a session key and place it in the ignored .env file:

    php -r 'echo base64_encode(random_bytes(32)), PHP_EOL;'

Configure PLANNER_DB_* for goals_dev, then run:

    php bin/console migrate
    php bin/console migrate:check

Install and build the existing frontend:

    cd ../frontend
    npm ci
    npm run build

LOCAL STARTUP
-------------

The production document root is backend/public. For local development only:

    cd backend
    php -S 127.0.0.1:8000 -t public dev-router.php

FIRST START CHECK
-----------------

After the first migration and asset build, check the running application from
another terminal:

    curl -fsS http://127.0.0.1:8000/up
    curl -I http://127.0.0.1:8000/login
    curl -I http://127.0.0.1:8000/register

Open http://127.0.0.1:8000/register to create the first user. There is no
admin account or admin role. Registration creates the user, preferences, and
default Areas through the normal application transaction.

SUBSEQUENT LOCAL STARTS
-----------------------

Once installation is complete, use this shorter sequence each time:

    cd backend
    php bin/console migrate:check
    php -S 127.0.0.1:8000 -t public dev-router.php

Do not repeat composer install, npm ci, or npm run build on every start. Run
php bin/console migrate after pulling a release that contains new migrations,
then run migrate:check again. Rebuild assets only after frontend changes or
when backend/public/build/manifest.json is missing. Stop the local server with
Ctrl-C.

The PHP development server is for local use only. Production must use
Apache/Nginx with PHP-FPM and backend/public as the only document root; see
docs/hosting.md for both examples.

Vite development mode is optional. Run `npm run dev` from frontend and set an
explicit loopback VITE_DEV_URL in backend/.env. Production does not require a
Vite server.

TEST DATABASE
-------------

The PHPUnit configuration forces APP_ENV=testing and the exact database name
goals_test. Supply the isolated test connection through environment values:

    export PLANNER_DB_HOST=127.0.0.1
    export PLANNER_DB_PORT=3306
    export PLANNER_DB_DATABASE=goals_test
    export PLANNER_DB_USERNAME=goals_test
    export PLANNER_DB_PASSWORD='your-local-test-password'

VERIFICATION
------------

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

Run PHP syntax validation over first-party PHP and follow the browser matrix in
docs/plan/08-verification.md before release.

MAINTENANCE AND SCHEDULING
--------------------------

    php bin/console files:prune
    php bin/console sessions:prune
    php bin/console rate-limits:prune
    php bin/console areas:backfill
    php bin/console recurrence:materialize
    php bin/console snapshots:capture

Schedule recurrence materialization every 15 minutes; file, expired-session,
and rate-limit pruning hourly; and Goal snapshots after local-day rollover.
Run `areas:backfill` once after upgrading an installation that predates Areas.
Use an OS-level non-overlap lock.

AI
--

AI is disabled by default. When explicitly enabled, configure the stable model
and server-side key in backend/.env. The browser never receives the key. The
provider can only return a stored proposal; planning rows are created only
after explicit approval through the ordinary application services.

SECURITY
--------

Keep backend/.env, database credentials, SESSION_ENCRYPTION_KEY, and
GOOGLE_AI_API_KEY outside version control. In production use HTTPS,
SESSION_SECURE_COOKIE=true, APP_DEBUG=false, a private storage path outside the
public root, and a web server that executes only backend/public/index.php.

TROUBLESHOOTING
---------------

- Missing PLANNER_DB_* values: copy backend/.env.example to backend/.env and
  configure the target database, session key, and storage/log paths. A legacy
  Laravel .env is not a target configuration.
- Database access denied/refused: verify MySQL is running and test the exact
  host, port, user, password, and database with the mysql client.
- Migration checksum/pending error: inspect php bin/console migrate:status;
  never edit the migration ledger or run destructive cleanup against goals_dev.
- Missing asset manifest: run npm ci and npm run build from frontend.
- Upload/storage error: keep PRIVATE_STORAGE_ROOT outside backend/public and
  writable only by the PHP process.

For production release, scheduler, backup/restore, PHP-FPM, Apache, Nginx,
account recovery, and the full verification matrix, read docs/hosting.md.
