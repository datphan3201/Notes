# Archive, restore and permanent deletion

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Archive lists Areas, Goals, Milestones, Tasks, Habits and repeating TaskSeries with filters/paging. Notes/Reviews use direct deletion and reject new archival; legacy archived Notes/Reviews are listed for recovery or authorized deletion. Locked Notes can be restored as metadata without revealing their content; unlock in Notes before permanent deletion. Restore checks required parent state and grouped contents rather than silently recreating missing context. Ordinary archival and confirmed permanent deletion are different actions.

Restore/delete callbacks await server acknowledgement; failed deletion retains the confirmation and retry. With bounded workspace reads enabled, Archive searches and cursor-pages root metadata on the server (including repeating-template titles) and loads no historical bodies at bootstrap. Empty Archive gathers the reviewed root IDs/versions through bounded pages, then submits one atomic archived-only deletion request (at most 20,000 roots); a changed/inaccessible selection aborts without partial commit. The compatibility path retains the existing 200-action workspace batch limit. Pure deletion batches validate the original versions before resource unlinking or cascade changes. Grouped deletion validates affected relationships in one transaction, includes relevant recurrence templates and preserves unrelated work. File removal is queued durably. Account deletion/moderation have separate authority; Archive cannot grant access to foreign records.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.archive`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L52) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/planning.py](../../../apps/api/planner/planning.py#L591) — `def archive(` |
| API / domain | [apps/api/planner/workspace.py](../../../apps/api/planner/workspace.py#L163) — `def remove_record(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |
| Related tests | [apps/api/tests/test_crud_matrix.py](../../../apps/api/tests/test_crud_matrix.py) |
| Related tests | [apps/web/tests/e2e/crud-audit.spec.ts](../../../apps/web/tests/e2e/crud-audit.spec.ts) |

<!-- END GENERATED TRACE -->
