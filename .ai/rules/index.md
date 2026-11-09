# Project rule index

Read the rule matching the paths in scope and [AGENTS.md](../../AGENTS.md). Activate the canonical [Karpathy Guidelines](../../.agents/skills/karpathy-guidelines/SKILL.md). Active runtime is under `apps/` on `main`; PHP/JS source was retired.

| Scope | Rule |
| --- | --- |
| Current runtime, Compose and CI | [Modern runtime](modern.md) |
| FastAPI, persistence, jobs and tests | [Backend](app.md), [source ownership](src.md) |
| Next.js/React/TypeScript, styling and browser checks | [Frontend](frontend.md) |
| Documentation, source maps and docs tooling | [Documentation](documentation.md) |

Common entry points: [UI documentation](../../docs/README.md), [decisions](../../docs/architecture/decisions.md), [issues](../../docs/issues.md). Framework/ORM restrictions are lifted; preserve domain/security boundaries and make changes only within the user's scope.
