# Repository instructions

The Next.js/FastAPI migration is developed on `feat/personal-ai-planner-v1` under `apps/`. Read [the migration plan](docs/migration/personal-ai-planner.md) and [.ai/rules/modern.md](.ai/rules/modern.md) for those paths. Keep the PHP/JS baseline and private data until the documented cutover gates pass.

## Read before work

1. Start at [the UI/route documentation index](docs/README.md), [current decisions](docs/architecture/decisions.md), and [open issues](docs/issues.md).
2. Read [the rule index](.ai/rules/index.md) and rules matching the paths in scope.
3. Activate and follow the [Karpathy Guidelines skill](.ai/skills/karpathy-guidelines/SKILL.md) (also installed at `.agents/skills/karpathy-guidelines/SKILL.md` and `.claude/skills/karpathy-guidelines/SKILL.md`).
4. Inspect existing source/tests to understand current product behavior before modifying or migrating features.

## Architecture & Tech Stack Policy (Unrestricted Migration)

- **No tech-stack or architecture lock-in:** Previous restrictions mandating framework-free PHP 8.5, raw PDO without an ORM, no dependency-injection container, or vanilla JavaScript/PHP views are **lifted**.
- Agents are explicitly authorized to introduce new frameworks, runtimes, languages, ORMs, build tools, state managers, or directory structures when migrating or refactoring the tech stack as requested by the user.
- The current code under [backend](backend/) and [frontend](frontend/) serves as the functional baseline and reference specification for product features and domain behavior during migration.

## Karpathy Coding Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First
**Minimum code that solves the problem. Nothing speculative.**
- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

### 3. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- When editing existing code, don't "improve" adjacent code, comments, or formatting unrelated to the task.
- Match the style of the target stack/module.
- When your changes create orphans, remove imports/variables/functions that YOUR changes made unused.
- Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution
**Define success criteria. Loop until verified.**
- Transform imperative tasks into verifiable goals with concrete checks.
- For multi-step tasks, state a brief plan (`[Step] → verify: [check]`) and verify each step.

## Domain & Security Invariants

Regardless of the tech stack or framework used:
- Owned reads/writes must scope data to the authenticated user (`user_id`); team/shared features must authorize membership/share permissions explicitly and return `404` for inaccessible identifiers.
- Keep multi-entity graph validation and writes atomic inside database transactions.
- Store timestamps in UTC and keep user-facing `DATE` values separate from instants.
- Keep server-side validation authoritative and never expose private storage files without authorization.

## Verification

Run the narrowest relevant automated checks for the active stack, then broader integration/browser checks when warranted. Never run destructive tests against a live development/production database (verify isolated test database configuration first). Never report a command/result without current execution evidence.

## Documentation

Record newly discovered, unresolved bugs or migration issues in [the open-issue list](docs/issues.md). When an issue is fixed, remove its entry from [docs/issues.md](docs/issues.md) and note the change in [CHANGELOG.md](CHANGELOG.md). Never commit credentials, tokens, or fabricated test results.
