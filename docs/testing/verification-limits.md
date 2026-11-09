# Verification limits

[Testing](README.md) · [Open issues](../issues.md)

| Evidence | Establishes | Does not establish |
| --- | --- | --- |
| Documentation checker | Local Markdown targets/anchors, unique registered source symbols, UI/page-file ownership, declared API route inventory, issue/case ID consistency and generated freshness | Business correctness, semantic completeness, every inline route claim, hosted health, external URLs or diagram provenance |
| Checker regression fixtures | The actual code accepts/rejects the tested link/symbol/ownership/drift cases | A complete Markdown/TypeScript parser or all possible future input forms |
| Test file/symbol link | A current coverage entry point exists | That it passed, or exercises the full UI flow |
| Ruff/typecheck/unit suite | The executed static/unit contracts for the recorded revision/environment | Database isolation or hosted provider behavior |
| Isolated API tests | Exercised database/authorization/transaction paths on planner_test | Production scale, complete historical parity or browser accessibility |
| Browser tests | Exercised desktop/mobile flows in the stated browser/harness | Every browser, layout, localization or real external service |
| Readiness 200 | API can issue its DB readiness query | Worker progress, mail receipt, storage policy, model quality or backup recovery |
| Historical Archify receipt | Artifact checks against its recorded historical input | Current Next.js/FastAPI architecture or current visual acceptance |
| Repository deployment record | The recorded operator/revision history | A fresh live deployment audit or recovery guarantee |

Record revision, environment, fixture size, command, output and limits for each new run. Keep prompts, tokens, credentials and private data out of reports. Passing local checks do not close ISSUE-045–048 or ISSUE-063 automatically. Production verification is separate from this documentation workflow.
