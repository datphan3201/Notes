# Administration

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Administrator access is server-enforced; ordinary accounts receive 404 on protected administration APIs. Only the server console can grant/revoke administrator roles. Administrators cannot lock/delete protected administrator accounts through the UI.

The admin surface reads report snapshots/private evidence, resolves reports with explicit actions (warning, locking, share withdrawal or dismissal), manages registration/invitations and sets the History count cap. Concurrent resolution cannot act twice. Actions append audit records; role changes through `planner.admin` are audited too.

The browser shell rendering `/admin` is not proof of authorization; inspect API responses and cross-account tests. Moderator access to report evidence does not confer general private Note/file access.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `admin`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live report/admin view | [apps/web/src/components/preview/support.tsx](../../../apps/web/src/components/preview/support.tsx#L176) — `export default function SupportPreview(` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L30) — `def administrator(` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L199) — `def resolve_report(` |
| API / domain | [apps/api/planner/moderation.py](../../../apps/api/planner/moderation.py#L263) — `def registration(` |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
