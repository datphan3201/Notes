# Personal AI Planner

A personal planning and Notes application with Areas, hierarchical Goals, Milestones, Tasks, Habits, Calendar, Reviews and an AI assistant whose changes require confirmation. The interface supports Vietnamese and English.

The active runtime is on **`main` under `apps/`**. Legacy PHP/vanilla JavaScript sources and tooling were retired in commit `8714dc0`; they are available through Git history, not a runnable rollback checkout in this tree. Teamwork is removed; realtime shared-Note co-editing is outside V1. Registered-account Note sharing remains supported.

| Component | Source | Stack / responsibility |
| --- | --- | --- |
| Web | [apps/web](apps/web/) | Next.js 16, React 19, TypeScript; same-origin API proxy |
| API | [apps/api/planner](apps/api/planner/) | FastAPI, SQLAlchemy 2, Pydantic; business validation, sessions and authorization |
| Worker | [jobs.py](apps/api/planner/jobs.py) | PostgreSQL jobs, leases/retries, recurrence, reminders, mail, retention and AI |
| Persistence | [migrations](apps/api/migrations/) | PostgreSQL 17, pgvector, Alembic; private files via local/GCS/Supabase adapter |

## Run locally

Requirements: Node 22, Python 3.12, uv and Docker Compose. From the repository root:

```bash
bash tools/dev/planner-v1.sh
```

Open `http://localhost:3000`. The launcher installs locked dependencies, checks `planner_dev`, runs forward migrations, and starts web/API/worker watching. It preserves private configuration. See [development](docs/migration/development.md) for manual setup, private email/AI configuration and Funnel sharing.

## Verify

```bash
python3 tools/docs/check.py
python3 -m unittest discover -s tools/docs/tests -q
python3 -m unittest discover -s tools/deploy/tests -p 'test_planner_v1.py' -q
```

API lint/tests and web typecheck/unit/build/browser commands are in [testing](docs/testing/README.md). Database tests migrate and truncate **only isolated `planner_test`** after configured/actual name checks; never target development or hosted data. API and browser suites share that disposable database and must run sequentially.

## Deployment and documentation

Repository deployment records identify Vercel web, Render Singapore API/worker and Supabase PostgreSQL/private Storage. [Cloud operations](docs/operations/cloud.md) records the topology, configuration and runbooks; it is not a fresh live health check. [render.yaml](render.yaml) selects `main` and disables automatic deployment. Free-container sleep pauses background work.

Start at the [documentation index](docs/README.md), [current decisions](docs/architecture/decisions.md), [open issues](docs/issues.md), [changelog](CHANGELOG.md) and [repository instructions](AGENTS.md). Outstanding historical-data acceptance, AI quality/cost, recovery and capacity work remain explicit; a deployment or passing static check does not close them.
