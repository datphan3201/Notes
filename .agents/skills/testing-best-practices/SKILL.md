---
name: testing-best-practices
description: Design or review tests for this framework-free Planner repository using PHPUnit, guarded real MySQL, Node tests and Playwright. Use when choosing coverage, testing HTTP/ownership/transactions or browser state, and evaluating test value. Do not use Laravel, Artisan, SQLite substitutes or framework-specific test helpers.
---

# Planner testing

Start at [the UI/component map](../../../docs/README.md) and [testing guide](../../../docs/testing/README.md). Follow the affected component to actual source and sibling tests before selecting a test boundary. This repository has no application framework; use its existing request harness/services/PDO and installed runners.

- Test observable behavior and meaningful failure modes, not a mirror of implementation.
- Use pure PHPUnit cases for graph/progress/recurrence/streak/TOTP; inject Clock/provider/UUID dependencies when relevant.
- Use real MySQL for SQL, constraints, collations, ownership, transactions and concurrency. Before cleanup verify testing environment, configured goals_test and actual SELECT DATABASE()=goals_test. Keep the running app database untouched.
- Use HTTP tests for authentication, CSRF/origin, validation, authorization, versions and private-file behavior. Inaccessible IDs must not disclose ownership. Use the established plain-PHP harness.
- Use Node tests for pure browser filtering, retry/draft/read coordination and checkable text. Fake time and transport where needed.
- Use Playwright for critical real-browser flow/focus/responsiveness. An HTTP 200 alone is not browser verification.
- Keep live SMTP/AI checks separate and explicitly scoped; deterministic tests use fakes, not paid/live services.
- Preserve failing expectations that expose incorrect behavior. Do not change tests only to obtain a pass.
- Run the narrowest relevant checks and report exactly what ran, results and remaining limits. Documentation-only checks do not certify backend behavior.

Keep test ownership, names and assertions consistent with sibling tests. See [the issue report](../../../docs/issues.md) and [verification limits](../../../docs/testing/verification-limits.md) before making pass claims. Update affected component/test pointers through [the documentation maintenance workflow](../../../docs/maintenance.md).
