# Verification and email-change links

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Browser link pages consume capabilities through explicit API POSTs, not generic state-changing GET endpoints. Email verification tokens are single-use. Email change requires the current password and confirmation of the latest code/link; successful change revokes existing sessions.

Email destinations derive from the configured exact primary frontend origin. Localhost, Funnel and hosted aliases are distinct browser origins. Link failure remains actionable; changing language must not lose a valid capability. Actual inbox delivery is an operational acceptance check, separate from token tests.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `auth.email`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/confirm-email.tsx](../../../apps/web/src/components/confirm-email.tsx#L7) — `export default function ConfirmEmail() {` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L341) — `def verify_email(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L270) — `def confirm_email_link(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L252) — `def confirm_email_code(` |
| Related tests | [apps/api/tests/test_accounts.py](../../../apps/api/tests/test_accounts.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/authentication.spec.ts](../../../apps/web/tests/e2e/authentication.spec.ts) |

<!-- END GENERATED TRACE -->
