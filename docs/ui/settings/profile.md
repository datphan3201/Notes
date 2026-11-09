# Profile and account files

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Profile saves name, biography and account timezone/locale through validated APIs. Private avatar/background uploads use account-file metadata and authenticated streaming; image decoding/normalization is server-side. Foreign account files are inaccessible, with narrowly authorized report-evidence access for moderation.

Email change is a separate password/code/link workflow, not a direct profile-field edit. It invalidates sessions on confirmation. Account deletion requires explicit credentials/confirmation; administrator protection and file cleanup remain server-controlled.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.profile`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/preview/settings.tsx](../../../apps/web/src/components/preview/settings.tsx#L51) — `export default function SettingsPreview({` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L64) — `def update_profile(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L102) — `def upload_account_file(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L144) — `def account_file(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/api/tests/test_render_supabase.py](../../../apps/api/tests/test_render_supabase.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
