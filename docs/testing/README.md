# Testing

[Documentation home](../README.md) · [Evidence limits](verification-limits.md) · [Manual plan](manual-checklist.md)

Run from the indicated directory. These commands are procedures, not claims they have just passed. CI definition: [.github/workflows/planner-v1.yml](../../.github/workflows/planner-v1.yml).

## Static and documentation checks

From the repository root:

```bash
python3 tools/docs/check.py
python3 -m unittest discover -s tools/docs/tests -q
python3 -m unittest discover -s tools/deploy/tests -p 'test_planner_v1.py' -q
bash -n tools/dev/planner-v1.sh
```

From `apps/api`:

```bash
uv sync --frozen --python 3.12
uv run ruff check planner tests migrations
```

From `apps/web`:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Node's TAP summary can report one result per test file in the installed runtime; record the reporter's units rather than inventing an assertion total. The orphaned legacy deployment Node suite is known to fail after retirement (ISSUE-064) and is outside the active CI command.

## Isolated PostgreSQL integration

From the repository root start only the disposable test service:

```bash
docker compose --profile test up -d db-test --wait
```

Then from `apps/api`:

```bash
PLANNER_ENVIRONMENT=testing PLANNER_DATABASE_URL=postgresql+psycopg://planner_test:isolated-test-only@127.0.0.1:5434/planner_test uv run pytest -q
```

[test fixtures](../../apps/api/tests/conftest.py) check both configured and actual database name `planner_test` before migration/truncation. The test environment disables configured AI/mail/storage providers and uses temporary local storage. Never bypass the guard or target `planner_dev`/Supabase/production. Compose test storage is tmpfs; development uses a separate persistent volume/port.

## Browser checks

From `apps/web`, after API integration completes:

```bash
npm run build:e2e
npx playwright install --with-deps chromium
npm run test:e2e
```

The [harness](../../apps/web/playwright.config.ts) starts API/web at 8101/3100 with `.next-e2e`, isolated private storage and guarded `planner_test`, and tests desktop/mobile Chromium. Do not run pytest concurrently: they share/reset the same disposable database. No development server reuse is allowed. An existing browser can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

Historical logged runs are recorded as historical evidence in [status](../migration/status.md), not a guarantee that the current checkout passes. Real providers, hosted proxies/cold starts, private bucket policies, inbox receipt, backup/file restoration, large datasets and human visual/keyboard/localization acceptance require separate checks.

## Latest focused audit

See the [2026-11-09 CRUD audit](crud-audit-2026-11-09.md) for the current operation matrix, executed checks and unresolved API/UI lifecycle gaps.
