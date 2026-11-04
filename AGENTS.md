# Repository instructions

## Read before work

1. Start at [the UI/route documentation index](docs/README.md) and [current decisions](docs/architecture/decisions.md).
2. Read [the rule index](.ai/rules/index.md) and rules matching the paths in scope.
3. Locate the visible route/component; follow its template/DOM, browser symbol, HTTP, service/domain, repository and test links. Read relevant shared architecture/operations guidance.
4. Inspect sibling source/tests before choosing structure or names. Documentation describes current source; report discrepancies explicitly instead of silently changing behavior.

## Runtime

The canonical runtime is framework-free PHP 8.5 under [backend/src](backend/src/) with namespace `Planner\`. No Laravel, application framework, ORM, Blade or Artisan. Use focused Composer utilities and explicit constructor/bootstrap wiring; no automatic container or service locator.

Keep frontend sources/PHP views in [frontend](frontend/), deployable public files in [backend/public](backend/public/), uploads in private storage and backend tests in [backend/tests](backend/tests/). Only backend/public is exposed by a web server.

## Implementation

- Preserve existing HTTP/browser contracts and unrelated uncommitted work until an approved change replaces behavior. Do not edit attached read-only snapshots.
- Controllers parse/serialize HTTP. Application services own transactions, domain services own invariants, repositories own prepared PDO SQL.
- Owned reads/writes take user_id; membership features authorize explicitly. Return 404 for inaccessible identifiers.
- Lock the owner first, aggregates in stable ID order, then relationship/activity rows. Keep graph validation and writes atomic.
- Use UTC DATETIME(6), explicit serialization, separate user-facing DATE values and DateTimeImmutable. Inject a Clock when time affects behavior.
- Reject unknown fields and keep backend validation authoritative. Preserve endpoint-specific version/replay/acknowledgement behavior.
- Use strict types, explicit parameter/return types, curly braces and TitleCase enum cases. Use constructor promotion where clear and PHPDoc for array shapes/non-obvious contracts. Comments explain invariants/boundaries/tricky SQL.

## Verification

Use PHPUnit for backend tests, Node's test runner for pure browser modules and Playwright for critical browser flows. Real MySQL integration tests must verify the actual database is goals_test before cleanup. Never run destructive tests against the running app database. Do not rewrite tests to accept incorrect behavior.

Run the narrowest relevant checks, then broader checks when their scope warrants it. [Testing](docs/testing/README.md) and [operations/CLI](docs/reference/cli.md) give actual commands. Never report a command/result without current evidence. Keep fake-provider tests separate from live SMTP/AI checks.

## Documentation

Record every newly discovered, still-unresolved bug, inconsistency, operational defect or requirement ambiguity in [the open-issue list](docs/issues.md) during the same task (affected UI/source, observed versus expected behavior, impact, evidence limits, next step). Recording an issue is not authorization to change behavior; ask when intent is unclear. When an issue is fixed, delete its entry and describe the fix in [CHANGELOG.md](CHANGELOG.md); Git history keeps the old report.

Confirm intended behavior before implementing an approved change. At completion, consolidate the relevant route/component docs and one concise user-facing entry in [CHANGELOG.md](CHANGELOG.md); do not continuously document intermediate steps. Update [traceability.json](docs/traceability.json) when code hooks/symbols/routes move, run `php tools/docs/sync.php --write` and `php tools/docs/check.php`, and update relevant Archify candidates/receipts. Keep docs in English and maintain source links. New APIs need explicit documentation owners; in-page components do not invent browser routes.

Use Archify for diagrams and put source JSON, final HTML and receipts under [docs/diagrams](docs/diagrams/); do not create .archify or a historical docs archive. Diagrams cite committed source at their pinned revision; do not misrepresent local changes as that revision. See [maintenance](docs/maintenance.md).

Keep open issues in [docs/issues.md](docs/issues.md) and what each kind of evidence proves in [the verification guide](docs/testing/verification-limits.md). Put test/verification evidence for a change in its commit or pull-request description, not in docs; do not recreate phase plans, evidence logs or status diaries. Never commit credentials, tokens, fabricated results or generated browser screenshots unless specifically requested.
