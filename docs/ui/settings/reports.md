# User reports and private evidence

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

The account can submit supported reports and inspect its report status. Shared-Note reports require an authorized accepted share and capture the relevant text snapshot. User reports can include private evidence images uploaded through the account-file flow.

Evidence is visible only to its authorized owner/moderator paths. Reporting does not grant access to another account's live private data. Resolution communicates the actual moderator action; dismissing takes no action. See [administration](../admin/README.md).

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.reports`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L51) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L54) — `def report(` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L128) — `def reports(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L146) — `def account_file(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
