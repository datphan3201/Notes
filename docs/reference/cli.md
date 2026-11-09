# CLI reference

[Documentation home](../README.md)

Run from the repository root unless a working directory is specified. Commands that write data require the intended environment and separately authorized operational scope. Do not pass credentials in shell arguments or paste them into reports.

| Working directory | Command | Effect / boundary |
| --- | --- | --- |
| root | `bash tools/dev/planner-v1.sh [--funnel]` | Guarded development startup/migrations and watched processes; optional public Funnel |
| root | `docker compose --profile test up -d db-test --wait` | Start disposable PostgreSQL test service on port 5434 |
| root | `python3 tools/docs/check.py [--write]` | Validate docs or refresh generated source/route tables; no DB/app imports |
| root | `python3 -m unittest discover -s tools/docs/tests -q` | Documentation checker/generator regression fixtures |
| root | `python3 tools/deploy/planner_v1.py funnel` | Print Funnel startup plan; `--execute` starts it |
| root | `python3 tools/deploy/planner_v1.py vercel --origin https://FRONTEND --backend https://API` | Print web deploy plan; `--execute` calls Vercel CLI |
| root | `python3 tools/deploy/planner_v1.py check --url https://FRONTEND` | Read-only login/readiness check against the requested origin |
| apps/api | `uv sync --frozen --python 3.12` | Install locked Python environment |
| apps/api | `uv run alembic upgrade head` | Apply forward migrations to configured DB/schema; inspect target first |
| apps/api | `uv run uvicorn planner.main:app --host 127.0.0.1 --port 8001` | Start API only |
| apps/api | `uv run python -m planner.jobs` | Run scheduler/polling worker against configured DB |
| apps/api | `uv run python -m planner.serve` | Container supervisor; optionally migrates and starts worker |
| apps/api | `uv run python -m planner.admin person@example.com admin` | Grant role and audit; use `user` to revoke; requires checked target |
| apps/api | `uv run python -m planner.demo_seed --email roadmap.demo@example.com` | Plan a new synthetic two-month account; explicit target/password/execute required to write; [procedure](../operations/demo-account.md) |
| apps/api | `uv run python -m planner.migrate_legacy --help` | Guarded legacy export/verify/import; private data workflow, see development guide |
| apps/web | `npm ci` | Install npm lockfile |
| apps/web | `npm run dev` | Start Next.js development server |
| apps/web | `npm run typecheck` / `npm test` / `npm run build` | Type, unit and production build checks |
| apps/web | `npm run build:e2e` / `npm run test:e2e` | Isolated browser build/suite; destructive fixtures only in planner_test |

The retained `tools/deploy/migrate_to_supabase.py` performs a raw transactional database COPY, not a guarded general-purpose sync/file migration command; do not use it as the ordinary release path (ISSUE-065). Retired PHP `bin/console`, Composer, realtime and legacy deployment commands are available only in Git history. No current command grants roles over HTTP or safely retries arbitrary dead jobs.
