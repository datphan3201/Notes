# First installation

[Operations](README.md)

## Requirements

PHP 8.5 with the extensions in [composer.json](../../backend/composer.json), Composer 2, MySQL 8.4/InnoDB/utf8mb4_0900_ai_ci, Node 22 and npm 10. Production uses Nginx (or Apache) with PHP-FPM, plus the long-running realtime process for live collaboration; PHP's development server is for local work only.

Check installed capabilities rather than assuming dependency installation succeeded:

```bash
php -v
php -m
composer --version
mysql --version
node --version
npm --version
```

## Isolated databases

An operator creates goals_dev and goals_test with separate users/passwords; neither is a disposable alias for production. Example SQL, with placeholders replaced outside source control:

```sql
CREATE DATABASE goals_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE goals_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'goals_dev'@'127.0.0.1' IDENTIFIED BY '<development-password>';
CREATE USER 'goals_test'@'127.0.0.1' IDENTIFIED BY '<test-password>';
GRANT ALL PRIVILEGES ON goals_dev.* TO 'goals_dev'@'127.0.0.1';
GRANT ALL PRIVILEGES ON goals_test.* TO 'goals_test'@'127.0.0.1';
```

Verify access using the same TCP host/port/user as the application. Do not drop an existing database to resolve an access error.

## Environment and dependencies

From the repository root, copy [the environment example](../../backend/.env.example) to backend/.env only if the destination does not already exist. Supply the database credentials, APP_URL and a fresh base64-encoded 32-byte SESSION_ENCRYPTION_KEY. Keep private storage outside backend/public. APP_ENV=local and insecure local cookies are appropriate only for loopback development.

```bash
cd backend
composer install
composer check-platform-reqs
php bin/console migrate
php bin/console migrate:status
php bin/console migrate:check
cd ../frontend
npm ci
npm run build
```

Optional features: set `AI_ENABLED=true`, `GOOGLE_AI_API_KEY` (and optionally `AI_MODEL`, `AI_EMBEDDING_MODEL`) for the assistant, AI summaries and Ask AI; keep `REALTIME_ENABLED=true` and run `php bin/realtime.php` for live co-editing ([local](local-development.md) or [production](deployment.md#live-collaboration-realtime-server) setup). Offline support needs HTTPS (or localhost) because browsers only register service workers in secure contexts.

The migration ledger/checksum is authoritative; read migrate:status instead of relying on a historical fixed migration count. Do not edit applied migrations or use a test reset to repair app data.

Create backend/.env.testing from the same example with APP_ENV=testing, exact goals_test database/allowlist and its separate credentials. The test harness checks the actual database before cleanup. It does not need the live AI provider.

## First account

Start [local development](local-development.md), open `/register` and create an account. There is no universal seeded password. Public registration creates role user, not admin. An authorized operator assigns system admin using `php bin/console users:role <email> admin`; never grant that role merely to make a negative-access test pass.
