---
paths:
  - 'docs/**'
  - 'tools/docs/**'
  - 'AGENTS.md'
  - 'README.md'
  - 'CLAUDE.md'
---

# Current documentation and source maps

Write English in `docs/`. Keep [decisions](../../docs/architecture/decisions.md), source behavior, historical reports and fresh execution evidence distinct. Record unresolved problems in [issues](../../docs/issues.md); remove resolved entries and note fixes/retirements in [CHANGELOG.md](../../CHANGELOG.md).

[traceability.json](../../docs/traceability.json) owns current feature/source references. Follow [maintenance](../../docs/maintenance.md): run `python3 tools/docs/check.py --write`, then the checker and docs regression suite. No PHP documentation tool remains. Preserve historical diagram receipts as historical; do not fabricate current provenance or test results. Never commit credentials, private content or tokens.
