# Implementation Plan: Personal Notes, Release R1

Status: R1 implemented; source reorganized into same-origin `frontend/` and
`backend/` roots on 2026-09-10.

This plan turns the assignment and the owner's decisions into a bounded first release. It is written for an implementation agent that should not have to invent product behavior, API contracts, or concurrency rules. It reduces ambiguity; passing the verification gates is still required before claiming correctness.

## Read and execute in this order

| Document | Responsibility |
| --- | --- |
| [Project context](agent.md) | Original assignment, user decisions, complete eventual requirements |
| [01 — Scope and behavior](docs/plan/01-scope.md) | Exactly what R1 includes, business rules, requirement IDs |
| [02 — Architecture and environment](docs/plan/02-architecture.md) | Stack, directories, runtime setup, boundaries, technical decisions |
| [03 — Database and transactions](docs/plan/03-database.md) | Columns, keys, invariants, locking, deletion, file lifecycle |
| [04 — HTTP contract](docs/plan/04-http-contract.md) | Routes, payloads, responses, validation, authorization |
| [05 — UI and interaction specification](docs/plan/05-ui-ux.md) | Vietnamese copy, screens, wireframes, design tokens, responsive behavior |
| [06 — Autosave and recovery](docs/plan/06-autosave.md) | State machine, retry, conflicts, navigation, recovery |
| [07 — Implementation tasks](docs/plan/07-tasks.md) | Ordered, bounded tasks with files, dependencies, completion gates |
| [08 — Verification](docs/plan/08-verification.md) | Acceptance scenarios and evidence required for completion |
| [09 — Deferred work](docs/plan/09-deferred.md) | Route to the complete assignment; explicitly outside R1 |
| [Implementation status](docs/implementation-status.md) | Working checklist; update after each task |

## Frozen decisions

- Build a local application for the owner's personal use with real authentication and real MySQL persistence.
- Use **PHP 8.5, Laravel 13, Blade, Alpine.js 3, plain JavaScript modules, custom CSS, MySQL 8.4, and Vite 8**. Use Composer 2 and the existing Node 22.22.2/npm toolchain. Resolve stable package patches once and commit lockfiles.
- Use one same-origin deployment with separate `frontend/` and `backend/` source roots. Serve `/` from `backend/public/`; authenticated JSON endpoints continue to use Laravel session authentication and CSRF protection.
- R1 includes registration/login/logout, profile/avatar, password change, preferences, notes, autosave, grid/list, search, labels, pinning, colors, and attachments.
- R1 defers email activation/recovery delivery, per-note passwords, sharing, collaboration, AI, PWA, Docker Compose, and public deployment.
- Interface copy is Vietnamese. Code identifiers and technical documentation are English. Notes accept arbitrary Unicode.
- The note body is plain text. One editor handles both creation and editing. No mandatory Save button, extra initial required fields, rich-text toolbar, or unrelated features.
- Do not schedule work by weeks or assign human staffing; the owner excluded those constraints from this planning task.

The Laravel version choice was checked against its [official support table](https://laravel.com/docs/13.x/releases). The build-tool family matches the [Laravel 13 skeleton](https://github.com/laravel/laravel/blob/13.x/package.json). These are implementation decisions for this project, not additional course requirements.

## Execution rules

1. Read the complete plan once, then reopen the relevant contracts for each task. Use the installed skills as task-specific guidance, subject to the user's decisions.
2. Execute T00–T12 in order. Do not mark a task complete until its gate passes. Fix failures before proceeding to a dependent task.
3. Keep requirements and routes named exactly as specified. Small internal helper refactors are allowed; scope, schema semantics, and API changes must be recorded in these documents before dependent work.
4. Keep the original DOCX, `agent.md`, and planning documents. Application code belongs under `frontend/` and `backend/`; do not replace the repository root wholesale.
5. Use real MySQL and private files. Fixtures are for tests or an explicitly requested demo seed; do not present seeded or browser-only data as a working backend.
6. Do not install Docker, call AI/email services, publish, push, or create a remote repository as part of R1.
7. If an environmental prerequisite fails, record the exact failure and continue independent work. Never claim a test passed when it did not run. Do not silently substitute SQLite.
8. Stop the R1 implementation when all R1 gates pass. R2–R5 are a later backlog, not implicit authorization to expand the first release.

## Handoff prompt

```text
Implement release R1 of this project, following PLAN.md and every document it links.
Read agent.md first. Use product-manager-toolkit, senior-architect,
ux-researcher-designer, frontend-design, and playwright where relevant.

Execute T00 through T12 in docs/plan/07-tasks.md in order. Preserve the
assignment document and existing work. Keep the specified PHP/Laravel,
Blade/Alpine/JavaScript/CSS, and MySQL stack. Docker Compose and external
services are deferred. Do not implement R2–R5 or display fake controls for them.

Treat docs/plan/03-database.md, 04-http-contract.md, and 06-autosave.md as
implementation contracts. Run each task's verification gate before marking
it complete, and update docs/implementation-status.md with evidence and
actual blockers. Resolve routine implementation details autonomously.

Deliver a locally runnable app, accurate setup instructions, passing backend
and JavaScript tests, and browser verification of the specified scenarios.
Report any failed or unrun check explicitly; never equate implemented UI
with a verified feature. Continue until R1 is complete or a real prerequisite
prevents further useful progress.
```

## Planning validation

The plan is based on the root DOCX, inspected local skills, the current workspace, and primary technical documentation. Runtime and database commands below are instructions for later implementation, not commands already executed. The current environment has Node/npm and Git, but lacks PHP, Composer, and MySQL. No build, application test, or browser acceptance test can be reported as passed yet.

Completed checks on the planning artifacts: 17 local document links resolve; 31 Markdown tables and all fenced blocks are structurally valid; all 9 JSON examples parse; task IDs run continuously from T00 through T12; 81 acceptance-scenario IDs and 10 browser walkthrough IDs are unique and referenced consistently. Static contrast calculations for the specified body/muted text against the six light/dark surfaces have a minimum ratio of 5.26:1; primary button text ratios are 5.47:1 (light) and 7.71:1 (dark). These calculations do not replace browser/accessibility verification of the eventual implementation.
