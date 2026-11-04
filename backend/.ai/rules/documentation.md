---
paths:
  - 'docs/**'
  - 'tools/docs/**'
  - 'AGENTS.md'
  - 'README.md'
  - 'CLAUDE.md'
---

# UI-driven documentation

Write English. Consolidate docs once at completion with one brief CHANGELOG.md entry; do not maintain per-step work logs. Organize around actual route and visible component. Trace template/DOM → client → named HTTP route → service/domain → PDO → tests. Keep implementation descriptions distinct from intended decisions and evidence of executed checks.

Record unresolved problems in [the open-issue list](../../../docs/issues.md) during the same task. Use stable IDs, status, affected UI/source links and a next step; distinguish reproduced failures from source-inspected findings. Delete an entry when it is fixed and note the fix in CHANGELOG.md. Do not duplicate issue details across pages or infer authorization to implement a fix.

The [trace registry](../../../docs/traceability.json) owns generated component tables and lookup indexes. References must match one useful source location: prefer actual method/query and named-test declarations over repeated strings or generic class headers. Record helper-versus-browser coverage limits explicitly. Update the registry, regenerate with php tools/docs/sync.php --write and run php tools/docs/check.php. Run php tools/docs/tests/run.php after documentation-tool changes. Preserve manual narrative outside generated blocks. Use [maintenance](../../../docs/maintenance.md) for source/diagram updates.

Use Archify for diagrams under docs/diagrams, with source JSON and final receipts. Do not recreate .archify, completed phase plans or verification/status diaries; test evidence belongs in commit or pull-request descriptions. Never put credentials, live tokens or unsupported test-success claims in documentation.
