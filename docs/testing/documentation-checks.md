# Executed verification scope

[Testing](README.md) · [Audit history](../audit-history.md) · [Issue report](../issues.md)

Checked on 2026-11-02 (Asia/Saigon), against committed baseline 31947eb plus the local daily/weekly planning and Dashboard overview worktree. This is scoped execution evidence, not universal application acceptance.

| Check actually executed | Result |
| --- | --- |
| `php vendor/bin/phpunit -c phpunit.xml` from backend | Passed: 141 tests, 1222 assertions; 4m 28.683s on PHP 8.5.0 and guarded real goals_test |
| `npm run test:unit` from frontend | Passed: 83 tests |
| `npm run format:check` / `npm run build` | Passed |
| PHP lint for touched PHP runtime/routes/bootstrap/tests/migrations/views | Final scoped result below |
| Documentation checker / isolated CLI fixtures | Final regenerated results below |
| Archify Dashboard composition contract | Final automated receipt under the linked diagram folder |
| Migration 0026 on the live local app | Verified goals_dev and exact pending migration before applying; migration check passes; no Goal/Task rewrite or automatic roadmap selection |

Backend coverage includes the daily-selection/overdue policies from ISSUE-008 and the new Today denominator, 30-day window across year boundaries, zero/reversed facts and persisted owner-scoped roadmap choice. The new PATCH checks authentication/CSRF, malformed/unknown fields, foreign/archived IDs, unchanged Goal versions and explicit preference clearing. Integration cleanup verified the testing environment, configured goals_test and actual SELECT DATABASE()=goals_test; live goals_dev was never a cleanup target.

Browser QA used an isolated account. It verified empty invitations despite available Goals, selection/reload persistence, correct owned preview links and preservation of a newer choice when a deliberately held old Dashboard response arrives. Completing one of three Tasks produced 33% in both checklist summaries and one recent Activity contribution; filtering Week to Done left both summaries at 33%. Day details and View activity opened the full-year tab. Header → roadmap placement and responsive desktop/mobile layouts were inspected; global horizontal overflow was absent. Existing demo/roadmap records were not modified by these checks. Screenshots remain ignored local artifacts.

The existing illustrated panels, progress rings, native selects, activity colours and checklist/dialog controls were reused. Four-row previews and no automatic daily carry-forward remain. Live SMTP/AI, deployment, full concurrency/failure injection and all-feature browser acceptance are outside this scope. The source-trace checker certifies registered links/routes/receipts, not business correctness.

[ISSUE-007](../issues.md#issue-007--staged-generated-documents-contain-cosmetic-whitespace) remains open for cosmetic whitespace in generated diagram HTML. Preserve delivered bytes and valid receipts rather than hand-editing generated HTML. Prior executed totals belong to their audit/issue scopes; they do not independently certify this worktree.
