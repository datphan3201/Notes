# Authentication and sessions

[Documentation home](../../README.md) · [Route inventory](../../reference/routes.md)

FastAPI owns authentication. Login/register issue an opaque HttpOnly cookie; only its hash is stored in PostgreSQL. Cookies use SameSite=Lax and Secure in production or an HTTPS public development origin. Passwords use Argon2 with legacy bcrypt verification/rehash compatibility.

Registration shows a success state with a link to sign-in. The verification notice and resend/status/account-switch controls appear only after a successful sign-in attempt with an unverified account, never solely because an unverified session already exists; workspace verification failures return there instead of a generic Retry page. Production requires verified email before workspace access. MFA pending challenges do not establish a session. Locking, password/reset/email-change operations revoke sessions according to their endpoint. Writes enforce exact origin and CSRF. See [recovery](recovery.md), [MFA](two-factor.md) and [email links](email.md). The server controls registration policy and administrator roles.

<!-- BEGIN GENERATED TRACE -->

## Source and verification map

Trace ID: `auth`. Test references identify coverage to inspect; they are not execution results.

| Role | Current source |
| --- | --- |
| UI | [apps/web/src/components/auth-form.tsx](../../../apps/web/src/components/auth-form.tsx#L23) — `export default function AuthForm({` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L157) — `def login(` |
| API / domain | [apps/api/planner/main.py](../../../apps/api/planner/main.py#L120) — `def register(` |
| API / domain | [apps/api/planner/auth.py](../../../apps/api/planner/auth.py#L79) — `def identity(` |
| Related tests | [apps/api/tests/test_accounts.py](../../../apps/api/tests/test_accounts.py) |
| Related tests | [apps/api/tests/test_auth_refinement.py](../../../apps/api/tests/test_auth_refinement.py) |
| Related tests | [apps/api/tests/test_boundaries.py](../../../apps/api/tests/test_boundaries.py) |
| Related tests | [apps/web/tests/e2e/authentication.spec.ts](../../../apps/web/tests/e2e/authentication.spec.ts) |

<!-- END GENERATED TRACE -->
