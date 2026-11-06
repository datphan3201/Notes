# Planner

Planner is a personal planning and notes web application: Goals with roadmaps and Milestones, Tasks with schedules and repeats, Habits, a Calendar, Reviews, team Goals, and a Notes workspace with sharing, live co-editing, per-Note passwords, AI summaries and offline use. The interface is available in English and Vietnamese and works on phones, tablets and desktops in light and dark themes.

Built with framework-free PHP 8.5, MySQL 8.4, vanilla JavaScript modules with Alpine.js, and Vite.

## Features

| Area | Highlights |
| --- | --- |
| Notes | Grid/list, live search, tags, pin, colours, checklists, image/video/file attachments, autosave with conflict recovery, links to Goals/Tasks |
| Note security | Optional password per Note, enforced by the server; locked text never appears in cards, search, AI or the offline copy |
| Sharing | Invite registered accounts (view or edit), invitations by notification and email, live co-editing with presence and named carets |
| AI | Note summaries, questions answered from your Notes with cited sources, and an assistant that proposes planning changes for confirmation |
| Offline | Installable PWA; Notes can be read, searched, edited and created offline and sync on reconnect |
| Planning | Areas, Goal hierarchy and fishbone roadmap, Milestones with prerequisites, Tasks, Today/Week plans, Calendar, repeating Tasks, Habits with streaks, Reviews |
| Teams | Team Goals with members, roles, assigned Tasks and chat |
| Accounts | Email verification, password reset by link or code, two-factor authentication (email or TOTP), profile/avatar, preferences, admin reports and locking |
| Help | A user guide for everyone at `/help` in Vietnamese and English, with real screenshots from demo accounts, and a short tour behind **?** |

## Architecture

```
Browser (PWA: service worker + IndexedDB)
   │ HTTPS                       │ WSS /realtime
Nginx ── PHP-FPM ── backend/public/index.php ──┐
   └──────── bin/realtime.php (WebSocket) ─────┴── MySQL 8.4
cron ── bin/console schedule:run (reminders, retention, cleanup)
```

- [backend/src](backend/src/) — namespace `Planner\`: HTTP controllers → application services (transactions) → domain rules → PDO repositories, wired explicitly in [bootstrap](backend/bootstrap/); no framework or ORM.
- [frontend/src](frontend/src/) — PHP views, JavaScript modules, CSS and translations, built by Vite into `backend/public/build`.
- [backend/database/plain-migrations](backend/database/plain-migrations/) — forward-only, checksum-verified schema migrations.
- Only [backend/public](backend/public/) is web-served; uploads live in private storage outside it.

Details: [runtime and processes](docs/architecture/runtime.md), [data and transactions](docs/architecture/persistence.md), [HTTP and security](docs/architecture/http-security.md).

## Quick start (local)

Requirements: PHP 8.5 with the extensions in [composer.json](backend/composer.json), Composer 2, MySQL 8.4, Node 22.

```bash
cd backend
cp -n .env.example .env          # set database credentials, APP_URL, SESSION_ENCRYPTION_KEY
composer install
php bin/console migrate
(cd ../frontend && npm ci && npm run build)
php -S 127.0.0.1:8000 -t public dev-router.php
php bin/realtime.php             # optional, second terminal: live co-editing
```

Open http://localhost:8000 (it must match `APP_URL`) and register. Full setup, hot reload and troubleshooting: [installation](docs/operations/installation.md) and [local development](docs/operations/local-development.md).

To share it publicly from this machine, run `bash tools/dev/install-command.sh` once and then `planner`: it serves the checkout at a fixed Tailscale Funnel address (or `planner tunnel` for a Cloudflare quick tunnel). See [sharing the local app](docs/operations/local-development.md#share-the-local-app-at-a-fixed-address-with-tailscale-funnel).

## Configuration

All settings are environment variables documented in [backend/.env.example](backend/.env.example): database, session key, mail (SMTP or a local outbox), AI provider (`AI_ENABLED`, `GOOGLE_AI_API_KEY`, `AI_MODEL`, `AI_EMBEDDING_MODEL`) and live collaboration (`REALTIME_*`). Never commit `.env` files or keys.

## Tests

```bash
cd backend && php vendor/bin/phpunit -c phpunit.xml   # requires the isolated goals_test database
cd frontend && npm run test:unit && npm run format:check
php tools/docs/check.php                               # documentation coverage and links
```

Integration tests refuse to run unless the connected database is `goals_test`. See [testing](docs/testing/README.md) and the [manual checklist](docs/testing/manual-checklist.md).

## Deployment

[tools/deploy/setup.sh](tools/deploy/setup.sh) provisions an Ubuntu host — MySQL, PHP-FPM, Nginx with the `/realtime` WebSocket proxy, the `planner-realtime` service, the scheduler and backups — behind a Cloudflare Tunnel or a direct domain with Let's Encrypt; releases are pulled from green `main` CI. See [deployment](docs/operations/deployment.md) and [jobs and processes](docs/operations/jobs.md).

## Documentation

Users read the in-app [user guide](docs/ui/help/README.md) (Settings › User guide); its screenshots are rebuilt with `tools/guide`. Developers start at the [documentation index](docs/README.md): find the page or label you see and follow its trace from template to browser module, HTTP route, service, SQL and tests. Also: [product decisions](docs/architecture/decisions.md), [open issues](docs/issues.md), [changelog](CHANGELOG.md), [contributor and agent rules](AGENTS.md), [documentation maintenance](docs/maintenance.md).
