# Appearance and preferences

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Preferences control the illustrated theme, independent appearance/scenery settings, quote, colors, locale and supported background selection. The server validates allowed fields/values; previews and saved preferences remain distinct. Selected settings survive reload.

Under Appearance settings, users can configure and save visible item count limits for the Dashboard: Tasks, Habits, and Completed tasks (default 3 each, range 1–20). These preferences are persisted in `User.preferences["dashboard"]` and validated by the `DashboardPreferences` schema on FastAPI. List items beyond the configured limit are accessible via in-card "Show more" controls without altering stored preferences.

## Style file ownership

`app/globals.css` and `styles/baseline/` provide the retained visual foundation. `styles/parity.css` and feature styles extend the React surface. The live workspace also imports reviewed preview styles/components. Their directory names do not mean live routes use synthetic data. Private backgrounds use account-file authorization.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.preferences`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L52) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L218) — `def preferences(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L90) — `def account_files(` |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/parity.spec.ts](../../../apps/web/tests/e2e/parity.spec.ts) |

<!-- END GENERATED TRACE -->
