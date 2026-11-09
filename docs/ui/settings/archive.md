# Archive, restore and permanent deletion

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Archive lists supported archived planning entities with filters/paging. Restore checks required parent state and grouped contents rather than silently recreating missing context. Ordinary archival and confirmed permanent deletion are different actions.

Grouped deletion validates all affected versions/relationships in one transaction, includes relevant recurrence templates and preserves unrelated work. File removal is queued durably. Account deletion/moderation have separate authority; Archive cannot grant access to foreign records.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.archive`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L45) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L549) — `def archive(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L161) — `def remove_record(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
