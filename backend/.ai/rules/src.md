---
paths:
  - 'backend/src/**'
---

# Src

## Keep target backend framework-free
New backend behavior belongs in the Planner\\ namespace under backend/src and may use focused Composer libraries only. Do not add Laravel, Illuminate, Symfony HTTP/kernel, another PHP framework, an ORM, or a container with hidden autowiring; routing, controllers, use cases, domain rules, PDO persistence, and wiring stay explicit.

## Use the frozen layer-first target tree
Use backend/src/{Config,Support,Domain,Application,Infrastructure,Http,Console}. Put module names below Domain/Application and below Infrastructure/Persistence/Pdo. Do not create parallel roots such as src/Notes, src/Files, or src/Auth; controllers own HTTP, application services own transactions, domain owns invariants, and repositories own SQL.
