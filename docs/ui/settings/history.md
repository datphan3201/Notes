# Task History and retention

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

History preferences define completion/overdue thresholds and optional timed retention. The system also has an administrator-controlled count cap (default 1000). The worker periodically archives eligible Tasks; it never hard-deletes them as retention.

History membership changes presentation and quiets obsolete overdue reminders. Reopen uses ordinary versioned domain rules and explicit deadline/ancestor choices where required. Activity facts and persisted Review snapshots survive retention. A stopped/sleeping worker delays retention; settings alone do not execute it.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.history`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L51) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/jobs.py](../../../apps/api/planner/jobs.py#L341) — `def retain_history(` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L351) — `def history_limit(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_workspace_ui.py](../../../apps/api/tests/test_workspace_ui.py) |

<!-- END GENERATED TRACE -->
