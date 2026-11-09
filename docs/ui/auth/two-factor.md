# Two-factor challenge

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

A valid first factor may return a pending MFA challenge instead of a login cookie. The dedicated page supports authenticator codes and an emailed fallback where allowed. The server preserves the original challenge expiry; requesting another code invalidates the previous code rather than extending the challenge indefinitely.

Successful verification consumes the challenge and establishes the session. TOTP steps reject replay. Setup/enabling/disabling require current credentials and confirmation; encryption keys remain private and stable across restarts. Legacy accounts marked for MFA recovery are not silently downgraded.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `auth.two-factor`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/auth-form.tsx](../../../apps/web/src/components/auth-form.tsx#L23) — `export default function AuthForm({` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L355) — `def complete_login(` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L374) — `def email_login_code(` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L56) — `def verify_totp(` |
| Related tests | [apps/api/tests/test_accounts.py](../../../apps/api/tests/test_accounts.py) |
| Related tests | [apps/api/tests/test_auth_refinement.py](../../../apps/api/tests/test_auth_refinement.py) |
| Related tests | [apps/api/tests/test_complete_workspace.py](../../../apps/api/tests/test_complete_workspace.py) |
| Related tests | [apps/web/tests/e2e/authentication.spec.ts](../../../apps/web/tests/e2e/authentication.spec.ts) |

<!-- END GENERATED TRACE -->
