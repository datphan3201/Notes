# Verification Evidence

Updated 2026-10-07. Results below are scoped to the commands and paths actually
exercised. The original M00–M10 acceptance baseline was recorded on 2026-09-18;
phase specifications remain in `docs/plan/phases/`, and superseded execution
logs belong in Git history.

## Current automated checks

All integration cleanup checks the actual database name equals `goals_test`.
An isolated local MySQL 8.4.11 instance on port 33317 supplied test data; the
configured application database and private user files were untouched.

| Check | Executed command | Result |
| --- | --- | --- |
| Full backend | From `backend/`: `PLANNER_DB_PORT=33317 PLANNER_DB_USERNAME=root PLANNER_DB_PASSWORD= php vendor/bin/phpunit -c phpunit.xml` | **90 tests / 715 assertions**, PHP 8.5.0, PHPUnit 12.5.35, 50.883 seconds |
| Planning HTTP | Same environment, with `--filter PlanningHttpTest` | **2 tests / 38 assertions**, 2.129 seconds; owned roadmap, Strategy/version/CSRF/validation/non-disclosure and new Goal-information markup |
| Browser modules | From `frontend/`: `npm run test:unit` | **47 passed**; autosave/recovery, read coordination, capture serialization, date filters, DraftBuffer and transition behavior |
| Formatting | From `frontend/`: `npm run format:check` | Pass |
| Deployment assets | From `frontend/`: `npm run build` | Pass, Vite 8.2.2; current manifest and hashed assets in `backend/public/build` |
| Goal view syntax | `php -l frontend/src/views/planning/goal.php` | Pass |

The backend suite covers strict account/appearance preferences, owned/versioned
Task estimates, streak dates, finite progress/relationships, recurrence,
Review snapshots, files, Notes and AI proposal boundaries. Passing it does not
prove every browser workflow or production environment.

## Browser scope

Real Chromium used the disposable demo database and PHP development server at
port 8017. No example data was inserted into existing user accounts.

The preceding illustrated interface checks exercised all five themes in
light/dark, visibility toggles, private-quote persistence/late-save behavior,
Task filters/edit/create/conflict/notes/resources, Areas/Timeline, Habit streak
and check-ins, and Review facts/navigation. The walkthrough baseline traversed
all 33 steps at desktop/tablet/mobile widths, including keyboard focus,
first-visit dismissal/retry and conflict-dialog priority. Those results retain
their original scope and are not a claim that every feature was rechecked in
this Goal-information follow-up.

Fishbone geometry was checked at widths 1440, 1144, 1001, 1000, 768 and 360:
spine reaches the Goal head, every rib reaches the shared spine, resize redraws
orientation, paging displays 6/2 branches, and Enter/Back preserves Milestone
focus. Eight read-only fixtures (0/1/3/6 branches at desktop/mobile, including
long literal HTML text) checked empty/odd/long-name behavior and no horizontal
page overflow. Diagram branches do not establish domain dependencies.

The Goal-information follow-up passed **28 browser assertions**: named-head
Enter activation, saved content and collapsed secondary sections, mutually
exclusive disclosures, close/reopen draft retention, pending Escape prevention,
late acknowledgement/newer typing, rename synchronization, focus after head
recreation, both explicit 409 choices with a single modal and form focus,
Related work/direct capture, same-page edit hash, completed-Goal inspection,
and dialog/page overflow checks at 1440/768/360. Expected conflict responses
were injected through real disposable-data writes; no unhandled browser errors
were observed. Desktop/mobile captures were inspected before deletion. Six additional checks
passed for a fresh Strategy hash, sticky Goal title/Close at desktop/mobile,
Help dialog priority and Milestone Enter/Back focus. The dark information
dialog was also visually inspected.

## Visual and artifact limits

Original reference graphics are bundled in the application. Responsive layout,
live text, data and intentional workflow changes still differ from the static
reference; no quantified similarity score or 100% pixel match is claimed.

Generated screenshots, comparison galleries, Playwright outputs and test caches
were removed at the user's request. Source theme, reference and placeholder
guide images remain required app assets. Future temporary evidence belongs in
ignored artifact paths and must not be committed.

## Operational and remaining checks

Earlier checks applied migrations through 0009 on disposable `goals_test` and
`goals_ui_review`. The local-startup follow-up below now applies them to the new
persistent development database; the old system `notes_dev` remains untouched.
Operators must migrate and check before deployment using
[the hosting runbook](hosting.md). Older acceptance records covered clean
installation, migration replay/checksums, maintenance commands, framework
retirement, production-mode HTTP and backup/restore; they do not certify the
current production host or a new deployment.

Live Google-provider validation, Apache rewrite execution and production
backup/deployment rehearsal were not rerun here. The full matrix in
[the verification contract](plan/08-verification.md) retains unrun exhaustive
quota/race, failure injection, cross-account browser files, video seeking,
accessibility and controlled event-order cases. Task Note autosave/recovery,
recurrence lifecycle/DST/catch-up, Habit timezone freezing and full AI operation
rendering remain follow-ups in [Implementation status](implementation-status.md).

## Persistent local startup — 2026-10-07

- MySQL 8.4.11 runs on 127.0.0.1:3307 with an owned disk-backed data directory
  at `~/.local/share/planner/mysql/data`. PDO confirms `SELECT DATABASE()` is
  `goals_dev` and `schema_migrations` contains all nine entries. This is actual
  MySQL persistence, separate from the former temporary browser fixtures.
- From `backend/`, `php bin/console migrate` applied 0001–0009; repeat execution
  returned no pending migrations, and `migrate:check` reported healthy.
- `php vendor/bin/phpunit -c phpunit.xml`, using the ignored test environment
  and guarded `goals_test` on port 3307: **90 tests / 715 assertions**, 112.709
  seconds. Test cleanup never targets `goals_dev`.
- Current `npm run test:unit`, `npm run format:check`, `npm run build`,
  `composer validate --strict`, and `composer check-platform-reqs` pass.
  PHP syntax scanning passed all **156** first-party PHP files.
- PHP serves the current build on 127.0.0.1:8000. `curl -fsS .../up` returns
  `{"data":{"status":"ok"}}`; login and registration return HTTP 200.
- Existing `notes_dev` is unchanged. Prior environment files were backed up
  outside Git, and local/test files contain independently generated secrets.
  Staged files were scanned for those exact secret values and common private
  key/API-token patterns with no findings; environment files are not staged.

This is a local development startup with an initially empty Planner database,
not a production deployment or a migration of legacy user content. Register
an account in the browser. Restart instructions are in [Hosting](hosting.md).

## Local CSRF origin correction — 2026-10-07

Before correction, a fresh cookie/form token plus `Origin: http://localhost:8000`
returned 419, while `Origin: http://127.0.0.1:8000` reached login validation.
The local `APP_URL` was corrected to the localhost browser origin. Afterward,
six real HTTP checks passed across login and registration: valid session/token
and the localhost Origin reach normal form validation feedback (redirect then
200); a different Origin and a missing token each remain 419. Invalid probe
credentials/input were intentional; no account or user content was created.
The server remains running and CSRF protection remains enabled.
