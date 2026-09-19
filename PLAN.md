# Plain-PHP Migration and Goal Management Plan

Status: **implemented and verified on 2026-09-18**. The canonical runtime is the framework-free PHP modular monolith. Historical Laravel behavior remains a regression reference only.

## Source-of-truth order

When documents disagree, use this order:

1. Current user requirements and the frozen decisions in this file.
2. [Migration plan](docs/migration-plan.md).
3. Domain-specific contracts in `docs/plan/`.
4. Phase task specifications in `docs/plan/phases/`.
5. Historical implementation and verification evidence.

Do not infer that a planned feature exists. `docs/implementation-status.md` is the state ledger.

## Frozen decisions

- Replace Laravel with PHP 8.5, Composer, focused libraries, and application-owned routing, HTTP, controllers, services, validation, persistence, and dependency wiring.
- Do not introduce another PHP application framework, ORM, hidden service container, microservices, or generic graph/property system.
- Keep MySQL 8.4, HTML, CSS, JavaScript modules, Alpine.js, Vite, Node/npm, the same-origin deployment, private files, and `/api/v1` compatibility.
- This is a fresh target installation. Preserve behavior and source while migrating, but do not build a legacy data importer or Laravel-session bridge.
- Preserve registration, login/logout, profile, preferences, notes, autosave/recovery, search, Tags/labels, private attachments, avatars, and current security contracts.
- Add configurable Areas, arbitrary-depth single-parent Goals, Milestones, Tasks, Checklist Items, dedicated Habits, Notes, hierarchical Tags, Reviews, Activities, Dashboard, and approved AI actions.
- Keep hierarchy, Goal contributions, and Milestone dependencies as distinct relations.
- Milestone prerequisites block Milestone completion only. Tasks under a locked Milestone remain usable and completable.
- Milestones with unfinished Tasks can be completed after an explicit acknowledgement.
- Completion criteria remain human-readable text. Do not add a core metrics system.
- Goal progress uses finite primary children only. Habits, contributions, and recurring Task occurrences do not affect Goal percentages.
- Recurring Tasks support daily and weekly schedules in v1. Monthly recurrence and timers are deferred.
- AI may read selected context, suggest, and create after explicit approval. It cannot silently modify/delete data or bypass normal use cases.
- Do not add teams, collaboration, shared workspaces, arbitrary custom fields, Task dependency graphs, notification infrastructure, or mobile/microservice architecture.

## Read order for implementation

1. [Repository audit](docs/plan/00-repository-audit.md)
2. [Migration plan](docs/migration-plan.md)
3. [Scope](docs/plan/01-scope.md)
4. [Architecture](docs/plan/02-architecture.md)
5. [Database](docs/plan/03-database.md)
6. [HTTP contract](docs/plan/04-http-contract.md)
7. [UI/UX](docs/plan/05-ui-ux.md)
8. [Autosave](docs/plan/06-autosave.md)
9. [Domain contract](docs/plan/10-domain-contract.md)
10. [Habits and recurrence](docs/plan/11-habits-recurrence.md)
11. [Dashboard and Reviews](docs/plan/12-dashboard-reviews.md)
12. [AI contract](docs/plan/13-ai-contract.md)
13. [Security/runtime](docs/plan/14-security-runtime.md)
14. [Operations](docs/plan/15-operations.md)
15. [Hosting and startup runbook](docs/hosting.md)
16. [File-by-file map](docs/plan/18-file-map.md)
17. [Task index](docs/plan/07-tasks.md) and the current file in `docs/plan/phases/`
18. [Verification](docs/plan/08-verification.md) and [traceability](docs/plan/16-traceability.md)

## Execution order and gates

| Phase | Outcome | Gate |
| --- | --- | --- |
| M00 | Freeze current contracts | Existing PHP/JS/build baseline recorded and reproducible |
| M01 | Plain bootstrap, PDO, migrations, test harness | Target infrastructure runs without Laravel lifecycle |
| M02 | HTTP, session, auth, validation, errors | Auth/settings contracts pass on plain PHP |
| M03 | Notes and Tags parity | Existing Note/Label contracts pass on plain PHP |
| M04 | Private-file parity | Upload/serve/delete/avatar/prune contracts pass |
| M05 | Template/Vite cutover and Laravel removal | Existing app starts and passes with no Laravel package |
| M06 | Planning core | Areas/Goals/Milestones/Tasks/relationships/progress pass |
| M07 | Habits and daily/weekly recurrence | Check-ins and idempotent occurrence materialization pass |
| M08 | Dashboard and Reviews | Required widgets and stable Review snapshots pass |
| M09 | AI proposals | Selected-context proposal and atomic approved create pass |
| M10 | Final hardening | Fresh install, full tests/build/browser/operations pass |

Dependent work does not start until the prior gate passes. Work inside a phase may run in parallel only when its task specification says so and it does not share a destructive test database.

## Implementation rules

1. Inspect named current files before editing them. Existing uncommitted work belongs to the user.
2. If a task is already implemented, skip it only when its behavior and required verification evidence satisfy the task. Record the evidence.
3. Implement through the application layer. Controllers and AI adapters do not write domain tables directly.
4. All owned queries require an authenticated owner ID. Relationship mutations validate both endpoints under the same owner.
5. Use real MySQL for persistence and concurrency tests. SQLite is not an acceptable substitute.
6. Reject unknown input fields, use prepared statements, and keep frontend validation advisory.
7. Run the narrowest required checks after each task and the phase gate before continuing.
8. Never weaken a test to accommodate incorrect behavior. Update contracts first when a deliberate behavior change is approved.
9. Keep planned commands and paths labeled until implemented. Never report an unrun check as passed.
10. Update `docs/implementation-status.md` with actual changes, commands, results, and blockers.

## Handoff

Use [Luna Max handoff](docs/plan/17-luna-handoff.md). It tells an implementation agent exactly what to read, how to detect completed work, how to execute one task, and what evidence is required before proceeding.
