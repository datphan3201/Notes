# Synthetic two-month demo account

[Operations](README.md) · [CLI](../reference/cli.md) · [Testing](../testing/README.md)

The operator command in [planner.demo_seed](../../apps/api/planner/demo_seed.py) provisions **one new ordinary account** with clearly labeled synthetic history. It never resets an existing email, changes other accounts, migrates schema, uploads files, sends mail or calls an AI provider. A password-protected Note uses the demo login password. Email is preverified only for this explicitly synthetic fixture; no email ownership or inbox receipt is asserted.

## Dataset and dates

`--as-of` is an exclusive end date, defaulting to today in `Asia/Ho_Chi_Minh`. The start is two calendar months earlier, clamped at month-end. For `--as-of 2026-11-08`, history spans **2026-09-08 through 2026-11-07**, inclusive. All dated Tasks/check-ins/Activity are historical; users can create new work normally after login.

The fixture includes three Areas, four Goals (one child Goal), eight ordered roadmap Milestones with prerequisites, dated Tasks/checklists/working text and mixed completion states, Inbox work, archived Tasks, three Habits with done/rest history, ten Notes/tags/colors (one locked), three TaskSeries, daily/weekly/monthly Review snapshots/reflections, manual selections, focus and read/unread notifications. Reviews are derived from the seeded facts. Lexical Document records support owned AI context; no fake AI answers or provider usage are inserted.

The account profile and entity metadata identify the fixture. Synthetic Activity is for demonstration, not evidence of real user productivity. Reminder email is disabled initially, and recurrence cursors/end dates stop automatic generation beyond the seeded history. Attachments, sharing with another account, actual mail delivery, MFA enrollment and provider responses must be exercised through their real workflows; they are not fabricated by this seed.

## Plan and execute

From `apps/api`, inspect the plan without connecting to a database:

```bash
uv run python -m planner.demo_seed --email roadmap.demo@example.com --as-of 2026-11-08
```

For execution, configure the intended database URL/schema privately and supply `PLANNER_DEMO_PASSWORD` through a private environment/secret source. Do not place passwords or connection strings in shell arguments or committed files. Execute only after the intended account/target is authorized:

```bash
uv run python -m planner.demo_seed --email roadmap.demo@example.com --as-of 2026-11-08 --expect-database postgres --expect-schema planner --execute
```

The configured database/schema must match both explicit arguments and the actual connection. The schema must already be revision `0009`; the command performs no upgrades. New account/data/index/audit writes commit in one transaction, with an email advisory lock and existing-account rejection. Failure rolls back the new fixture. The JSON report excludes passwords; retain credentials privately. This command must exist in the checkout/environment from which it is run; adding source locally does not redeploy the hosted image.

## Verification

[Seed regression tests](../../apps/api/tests/test_demo_seed.py) run only under the ordinary guarded `planner_test` fixtures. They cover calendar boundaries, fixture consistency/login/snapshot, foreign access, locked-Note indexing exclusion, no queued jobs, preservation of an existing account, duplicate-email refusal, target mismatch and atomic rollback. Never point pytest at a cloud/development database.

After a real provision, verify login and owned snapshot/Dashboard/Calendar/Review/Archive reads through the intended frontend. Keep the new credentials separate from cloud management keys, never commit them, and do not describe a seeded account as a full provider or recovery acceptance test.

## Provision record — 2026-11-08

The requested cloud demo was provisioned in the existing `postgres` / `planner` target after checking actual identity and revision `0005`. The history is 2026-09-08–2026-11-07, with 3 Areas, 4 Goals, 8 Milestones, 133 Tasks, 10 Notes, 3 Habits, 17 Reviews and 3 TaskSeries; the snapshot also returned 128 Habit days, 209 Activity facts and 7 prerequisite edges. These are synthetic records for the new account only. Credentials are kept in an ignored private file and are not part of this document.

Actual frontend requests returned login 200; workspace, Dashboard, Calendar, archived Tasks, Reviews and notifications 200; locked Note read 423 followed by authorized unlock 200; and verification logout 204. Seven seed regression cases passed on isolated `planner_test`; Ruff, documentation integrity and whitespace checks passed locally. This record does not claim browser visual acceptance, real mail/provider delivery or a deployment of the new seed command to Render. The existing application image was sufficient to read/use the inserted data.
