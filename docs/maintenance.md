# Maintaining documentation

[Documentation home](README.md) · [Open issues](issues.md)

## Source of truth

User decisions and maintained product boundaries govern intent. Current source under `apps/` establishes implementation. Each feature page owns a concise behavior contract; `traceability.json` owns its stable feature ID, current UI/service symbols and related test files. A test link is not an execution result. Historical designs/previews/receipts must be labeled and must not override current status.

## Change workflow

1. Start from the URL/feature in the index. Inspect the React entry, FastAPI handler/domain, schema/model and relevant tests.
2. Update the owning behavior prose and registry references together. Source symbols must match one line in the referenced file. Keep accepted product intent separate from unverified parity.
3. Regenerate and verify from the repository root:

```bash
python3 tools/docs/check.py --write
python3 tools/docs/check.py
python3 -m unittest discover -s tools/docs/tests -q
```

4. Review the generated diff, route handlers and source maps. Record unresolved source/contract/recovery gaps in `docs/issues.md`; remove fixed entries and describe fixes in `CHANGELOG.md`. Never replace historical test evidence with invented current totals.

## Generator and checks

[tools/docs/check.py](../tools/docs/check.py) uses Python's standard library only. It parses registered FastAPI modules and mounted router declarations via AST without importing the application. It inventories all Next.js page files, requires one registry owner per current feature document, resolves unique source symbols and generates feature trace blocks plus route/component/source indexes and a blank CSV. A newly added mounted router/page file must be documented. Dynamic route handlers constrain accepted values; the inventory preserves their declared patterns.

The checker validates relative local Markdown file links, Markdown heading anchors and source line bounds across docs, root guidance/changelog, agent rules/skills, app AGENTS files and source-tree Markdown. It checks generated output drift, contiguous issue-summary/heading agreement, next issue numbering and duplicate acceptance case IDs. It ignores external URLs, site-root links, fenced examples and non-Markdown artifact internals; it does not certify semantic parity, every prose endpoint, rendered UI, external availability or JSON/HTML diagram provenance. The regression suite exercises real temporary source/registry/link fixtures.

## Historical artifacts

Legacy generated trace blocks/registry were replaced by current source maps; their previous contents remain in Git history. PHP documentation sync/check commands and Archify authoring dependencies are no longer required. Preserved [diagram artifacts](diagrams/README.md) are explicitly historical and keep their original receipts; do not rewrite receipts/hashes to imply a new validation. Current architecture is documented in Markdown/Mermaid. Regenerate a historical diagram only as a deliberate new artifact review, with its actual source revision and evidence.
