# Maintaining UI-to-code documentation

[Documentation home](README.md)

## Starting a UI change

1. Find the exact URL/label in the [route index](README.md). Open its component trace; do not search migration phases.
2. Follow the PHP template/DOM hook and browser symbol. Inspect relevant CSS in the [shared shell map](ui/shared/shell.md#style-file-ownership).
3. Follow named routes to controllers, services/domain and repositories. Confirm actual branches and effects, including shared consumers and permissions.
4. Confirm intended behavior changes with the user when intent is unclear. Collect discrepancies for [the issue report](issues.md) within the same task.
5. Change code/tests through the normal repository rules. Preserve unrelated local work and keep secrets out of examples.
6. At completion, consolidate owning narrative, structured traces and diagrams; regenerate/check them once the implementation is stable. Add one concise [audit entry](audit-history.md) with the final change and evidence. Do not write per-step documentation/status diaries.

## Trace source of truth

[traceability.json](traceability.json) holds route ownership and component IDs/labels/behavior/source references. Each source reference contains a repository-relative path and an exact, unique symbol/DOM-hook substring. Repeated strings such as `test(` or `attachment` are rejected: use the named test, method declaration or complete unique selector. A reference may supply a short `label` for display while keeping the full matching `symbol`.

Components may share files, but link the relevant reader/writer or use case instead of a class header when that operation is known. A pure browser filter or pure preview does not imply a separate SQL query. Optional `styles` references identify concrete CSS rules; the shared shell map explains import order and broader overrides. Optional `test_scope` text records coverage limits, such as shared DraftBuffer helper tests that do not exercise the page DOM. Tests are coverage entry points, not pass claims.

UI Markdown contains a hand-edited introduction/notes plus a generated trace block. Change component data in traceability.json; do not hand-edit the generated block. Run from repository root:

```bash
php tools/docs/sync.php --write
php tools/docs/check.php
```

[The generator](../tools/docs/sync.php) resolves unique symbols to current line numbers and refreshes generated trace blocks, complete route inventory/blank CSV, [component lookup](reference/components.md) and [source-file lookup](reference/source-index.md). These indexes are navigation, not duplicate behavior contracts. [The checker](../tools/docs/check.php) rejects missing/duplicate routes, duplicate page owners, missing/ambiguous symbols, broken files/anchors, orphan UI templates and stale generated output. It reads route declarations without application/database bootstrap.

When changing the documentation tools, run `php tools/docs/tests/run.php`. [The regression runner](../tools/docs/tests/run.php) exercises the real commands against isolated positive/negative fixtures: missing/ambiguous symbols, route/document ownership, broken links/anchors, orphan views, generated drift, diagram hashes and duplicate case IDs. It also verifies that regeneration repairs a legitimate component-label/anchor change. The fixture excludes environment secrets and forbids application bootstrap; no app database or live repository fixture is mutated.

A renamed/moved symbol requires a registry update. A new HTML route needs a route owner and UI component; a new in-page feature needs a component, not an invented route. API-only capabilities are labeled as such. Keep route ownership explicit rather than using a fallback bucket for unknown future endpoints.

## Archify

Use Archify for diagrams; no Mermaid/ASCII duplicate is maintained. Each [diagram folder](diagrams/README.md) contains the authored candidate JSON, final HTML and automated delivery receipts. Output paths live under docs/diagrams, not .archify. Code-backed source evidence is pinned to the committed revision and must be regenerated when cited behavior changes; current uncommitted behavior must not be misrepresented as committed evidence. An approved requirements/contract diagram may omit repository attribution and must clearly state that scope, with live code/test links in the corresponding Markdown trace.

Read the installed Archify skill, relevant schema and repository-authoring guidance. On this machine the tool repo is `~/code/tools/archify`; it is an external authoring tool, not a runtime dependency. Typical invocation from the project root:

```bash
node "$HOME/code/tools/archify/archify/bin/archify.mjs" finalize tree docs/diagrams/task-planning/candidate.json docs/diagrams/task-planning/index.html --repo-root . --quality showcase --json
```

ARCHIFY_CHROME may point to an installed Chromium executable. Keep receipts from failed runs out of the maintained final result; repairs follow the skill's review/output ownership rules. Do not edit generated HTML or receipts by hand. Report a failed diagram as failed, and distinguish automated browser checks from visual inspection.

## Keeping docs current

Report newly discovered problems in [issues.md](issues.md) during the same task, including problems fixed immediately. Search existing IDs first; record observed/expected behavior, affected UI/source, impact, status, evidence limits and resolution criteria. Keep fix/verification evidence when resolved. Ask for missing product intent; issue reporting alone does not authorize a behavior change. Feature docs link to the central report instead of duplicating its contents.

The live docs contain decisions, navigation, operating procedures, tests and unresolved findings. Remove completed phase plans, duplicate status diaries and obsolete feature exclusions after migrating their still-valid constraints. Update AGENTS/CLAUDE/rules and links in the same change. Git history holds historical committed docs; do not recreate a docs/archive or .archify folder.

[Current documentation checks](testing/documentation-checks.md) records only checks actually executed for this refactor. Future changes should replace stale check evidence with their scope/limits, not append an endless diary.
