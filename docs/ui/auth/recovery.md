# Password recovery

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

Recovery accepts email and responds generically for unknown accounts. The worker delivers a single-use reset link/code; no development outbox or token-log fallback is implemented. Email-code exchange produces a reset capability, then reset changes the password and revokes sessions without silently signing in.

Attempts and expiry are enforced server-side. Link capabilities are removed from the visible URL and retained only for the intended browser flow; language changes/reload preserve the active recovery state. Never put tokens, codes or passwords in documentation/evidence.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `auth.recovery`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/account-action.tsx](../../../apps/web/src/components/account-action.tsx#L27) — `export default function AccountAction({` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L254) — `def recover(` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L285) — `def recover_code(` |
| API / domain | [apps/api/planner/accounts.py](../../../apps/api/planner/accounts.py#L269) — `def reset(` |
| Related tests | [apps/api/tests/test_accounts.py](../../../apps/api/tests/test_accounts.py) |
| Related tests | [apps/api/tests/test_auth_refinement.py](../../../apps/api/tests/test_auth_refinement.py) |
| Related tests | [apps/web/tests/e2e/authentication.spec.ts](../../../apps/web/tests/e2e/authentication.spec.ts) |

<!-- END GENERATED TRACE -->
