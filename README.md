# Personal Planning and Notes Application

This repository contains a framework-free PHP 8.5 personal planning application. It preserves Notes workflows and adds configurable Areas, nested Goals, Milestones, Tasks and Checklists, Habits, hierarchical Tags, recurrence, Activity, Dashboard, Reviews, and approval-gated AI proposals.

The product interface, validation messages, documentation, and developer-facing comments use English. The Dashboard includes a GitHub-style monthly Activity calendar with week columns, weekday labels, factual tooltips, month navigation, and a five-step visual intensity scale derived from completion counts.

The redesigned interface uses a shared sidebar, light/dark themes, consistent controls, and responsive layouts across planning, Notes, account settings, and authentication. Collection pages prioritize your existing work, with creation forms alongside it. The Dashboard places today's tasks beside monthly activity and habits, with weekly selections below. See the [interface guide](docs/interface-guide.md) for navigation and everyday workflows.

The application is a same-origin modular monolith. It does not use Laravel, another PHP framework, an ORM, collaboration/workspaces, arbitrary custom fields, or a generic graph model.

## Stack

- PHP 8.5 with application-owned HTTP, routing, validation, sessions, services, and PDO repositories
- MySQL 8.4 / InnoDB / `utf8mb4_0900_ai_ci`
- Composer packages limited to focused infrastructure utilities
- JavaScript modules, Alpine.js, custom CSS, Noto Sans
- Vite 8, Node 22, npm 10
- PHPUnit 12, Node's test runner, and Playwright for browser verification

## Repository layout

- `backend/public/`: the only public document root and front controller
- `backend/src/`: framework-free PHP application (`Planner\` namespace)
- `backend/database/plain-migrations/`: checksum-verified MySQL migrations
- `backend/bin/console`: migrations and maintenance commands
- `backend/tests/Plain/`: unit, MySQL integration, HTTP, and security tests
- `frontend/src/`: PHP views, browser modules, and CSS
- `frontend/tests/js/`: browser-module unit tests
- `docs/plan/`: frozen product, architecture, security, and phase contracts

## Setup and verification

See the [hosting and startup runbook](docs/hosting.md) for complete first-time installation, normal subsequent startup, production hosting, scheduler, backup, account bootstrap, and troubleshooting instructions. [Readme.txt](Readme.txt) contains the same command-oriented quick reference. The concise first-install command set is:

```bash
cd backend
composer install
php bin/console migrate

cd ../frontend
npm ci
npm run build
```

For later local starts, run php bin/console migrate:check from backend and start php -S 127.0.0.1:8000 -t public dev-router.php; do not repeat dependency installation unless dependencies changed. Production must point the web server document root at backend/public and use PHP-FPM. Secrets, the session encryption key, database passwords, and the optional Google AI API key belong only in ignored environment files.

## Documentation

- [Interface and everyday workflows](docs/interface-guide.md)
- [Hosting and startup runbook](docs/hosting.md)
- [Plan and decisions](PLAN.md)
- [Repository-grounded migration plan](docs/migration-plan.md)
- [Implementation status](docs/implementation-status.md)
- [Verification evidence](docs/verification.md)
- [Operations contract](docs/plan/15-operations.md)
- [Traceability matrix](docs/plan/16-traceability.md)
