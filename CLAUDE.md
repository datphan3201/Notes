# CLAUDE.md

Follow [AGENTS.md](AGENTS.md) as the authoritative repository instruction set and use the [Karpathy Guidelines skill](.agents/skills/karpathy-guidelines/SKILL.md) (also discoverable through `.ai/skills/` and `.claude/skills/`).

**Current runtime:** `apps/api` (FastAPI), `apps/web` (Next.js) on `main`; PHP/JS source has been retired. See [status](docs/migration/status.md) and [cloud operations](docs/operations/cloud.md).

**Tech-stack policy:** All previous restrictions locking the repository to framework-free PHP, raw PDO, or vanilla JS have been removed. You may migrate or replace the backend, frontend, database layer, framework, and directory structure as directed by the user while preserving core product behavior documented in [docs/README.md](docs/README.md) and [docs/architecture/decisions.md](docs/architecture/decisions.md).

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.
