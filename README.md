# Planner

Framework-free PHP 8.5 / MySQL planning and Notes application, with JavaScript modules, Alpine.js and Vite. It supports personal Goals/Tasks/Habits, shared Notes, Teamwork, Reviews, notifications and account security. The UI supports English and Vietnamese; project documentation is English.

**Start with [the UI documentation map](docs/README.md).** Choose the route you see, then the component label to reach its template/DOM hook, browser module, HTTP endpoint, business logic, persistence and tests.

| Need | Entry |
| --- | --- |
| Change Today / Next / This week / Backlog | [Task filters](docs/ui/tasks/filters.md) |
| Change a Goal fishbone or Milestone panel | [Goal roadmap](docs/ui/goals/roadmap.md) |
| Understand autosave/recovery | [Notes save behavior](docs/ui/notes/autosave.md) |
| Run with hot reload | [Local development](docs/operations/local-development.md) |
| Install / deploy / back up | [Operations](docs/operations/README.md) |
| Explore visual system/behavior maps | [Archify diagrams](docs/diagrams/README.md) |
| Work as an agent | [Repository instructions](AGENTS.md) |
| Report a discovered problem or pending decision | [Issue report](docs/issues.md) |
| Check or update documentation | [Maintenance workflow](docs/maintenance.md) |

Only [backend/public](backend/public/) is a public document root. Source lives in [backend/src](backend/src/) and [frontend/src](frontend/src/). Services use explicit constructor/bootstrap wiring and owned PDO repositories; there is no application framework or ORM. Keep secrets and uploaded files outside Git and the public root.
