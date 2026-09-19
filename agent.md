# Project Context and Boundaries

## Current objective

Migrate the existing Laravel notes application to framework-free PHP, preserve its verified behavior, and add the planning domain defined in `PLAN.md` and `docs/plan/`.

The application is a personal goal/task system, not a generic Notion clone. It supports independent user accounts but no collaboration.

## Authoritative product boundaries

- Areas organize Goals and remain configurable.
- Goals form an arbitrary-depth, single-parent tree.
- Contributions are additional many-to-many links to Goals.
- Milestone dependencies form a separate acyclic graph.
- Tasks have status, checklist, completion criteria, optional Note, dates, schedule, and daily/weekly recurrence.
- Habits are dedicated entities with completion history.
- Tags classify major entities and may have a parent Tag.
- Reviews and Activity are persisted subsystems.
- AI proposes structured changes and applies approved creates through normal domain services.
- Excluded: teams, sharing, real-time collaboration, arbitrary custom properties, Task dependencies, graph databases, microservices, advanced notifications, mobile applications, and gamification.

## Technology boundary

The target backend is PHP 8.5 without Laravel, Symfony as an application framework, Slim, CodeIgniter, CakePHP, or another web framework. Composer packages are allowed only for focused infrastructure concerns.

Keep MySQL, frontend JavaScript, Alpine.js, CSS, Vite, and the same-origin browser/session model. Do not replace working browser code without a demonstrated incompatibility.

## Current source

`backend/src/` contains the canonical framework-free runtime, `backend/database/plain-migrations/` contains MySQL migrations, and `backend/tests/Plain/` contains PHP tests. `frontend/` contains PHP templates, JavaScript, CSS, Vite, and JavaScript tests. Laravel source has been retired.

## Historical assignment

`503073-FinalProject-V1.docx` and earlier R1 planning documents originated from a course notes-project assignment. They explain why the existing Notes features exist. The current user requirements and `PLAN.md` supersede that assignment when product scope or technology conflicts. In particular, collaboration, PWA, note passwords, email workflows, and the former Laravel mandate are not part of this migration.

## Engineering rules

- Preserve unrelated and uncommitted work.
- Read `.ai/rules/index.md` and matching rules before edits.
- Scope every owned read/write by the authenticated user.
- Keep domain rules in use cases/domain services, not only controllers or JavaScript.
- Use prepared PDO statements, explicit transactions, stable lock order, and database constraints.
- Test every code change at the highest useful boundary and cover important failure modes.
- Never use SQLite as evidence for MySQL behavior.
- Keep secrets outside source control and avoid sensitive log context.
- Do not claim planned or unverified behavior is complete.
