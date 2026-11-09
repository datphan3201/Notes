# Password and MFA settings

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Password changes validate the current password and revoke sessions. Authenticator setup returns a private enrollment secret only to the authorized flow; enabling/disabling requires proof and uses encrypted storage. Email MFA setup sends a real worker-delivered code and confirms it before activation.

Display status comes from the server; mock codes/passwords exist only on explicit preview routes. Do not log or commit enrollment secrets, recovery capabilities or email codes. See the dedicated [challenge flow](../auth/two-factor.md).

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `settings.password`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| Live UI view (via WorkspaceView) | [apps/web/src/components/live-security.tsx](../../../apps/web/src/components/live-security.tsx#L10) — `export default function LiveSecurity({ text }: { text: Text }) {` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L350) — `def change_password(` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L408) — `def setup_mfa(` |
| API / domain | [apps/api/planner/personal.py](../../../apps/api/planner/personal.py#L279) — `def setup_email_mfa(` |
| Related tests | [apps/api/tests/test_accounts.py](../../../apps/api/tests/test_accounts.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/complete-features.spec.ts](../../../apps/web/tests/e2e/complete-features.spec.ts) |

<!-- END GENERATED TRACE -->
