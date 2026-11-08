---
paths:
  - 'docs/**'
  - 'tools/docs/**'
  - 'AGENTS.md'
  - 'README.md'
  - 'CLAUDE.md'
---

# UI-driven documentation

Write English in `docs/`. Record unresolved problems and migration items in [the open-issue list](../../../docs/issues.md) with stable IDs, status, affected UI/source links and a next step. Delete an entry when it is fixed and note the fix in [CHANGELOG.md](../../../CHANGELOG.md).

While the legacy PHP/JS trace registry ([traceability.json](../../../docs/traceability.json)) is active, `php tools/docs/sync.php --write` and `php tools/docs/check.php` validate existing route/component trace tables and relative Markdown links. During a tech-stack migration, documentation tools and trace structures may be updated or replaced to match the new stack. Never put credentials, live tokens or unsupported test-success claims in documentation.
