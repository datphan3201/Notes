# Verification Evidence

Verification date: 2026-09-10

## Runtime and database

- PHP 8.5.0 CLI with `pdo_mysql`, `mbstring`, `intl`, `fileinfo`, `xml`,
  `dom`, `gd`, and `zip`.
- Composer 2.8.12; Laravel 13.30.1; Node v22.22.2; npm 10.9.7; Vite 8.2.2.
- MySQL 8.4.11, databases `notes_dev` and `notes_test`, both
  `utf8mb4_0900_ai_ci`; transaction isolation `REPEATABLE-READ`.
- Database credentials remain in ignored local environment files. No password
  is stored in the repository; `phpunit.xml` only forces MySQL and
  `notes_test`.
- MySQL is installed and running on the host. The application uses its scoped
  `notes_dev`/`notes_test` accounts rather than the MySQL root account.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Fresh `notes_test` migration | Pass | `php artisan migrate:fresh --force --env=testing`; all 7 application migrations completed. |
| PHPUnit/MySQL suite | Pass | From `backend/`: 9 tests, 76 assertions after the architecture refactor. Includes registration field count, auth/session invalidation, note replay/conflict/tombstone, label ANY/ownership, private attachment replay/serving/tombstone, HTML spoof rejection, and avatar re-encoding. |
| JavaScript unit suite | Pass | From `frontend/`, `npm run test:unit`: 15 unit cases across 3 files covering debounce, max wait, immutable acknowledgements, retries, conflicts, normalization, and recovery storage. |
| Composer metadata | Pass | From `backend/`: `composer validate --strict`. |
| Composer platform | Pass | From `backend/`: `composer check-platform-reqs`; PHP 8.5 and required extensions reported successful. |
| PHP formatting | Pass | From `backend/`: `vendor/bin/pint --dirty --format agent`. |
| JS/CSS formatting | Pass | From `frontend/`: `npm run format:check`. |
| Production assets | Pass | From `frontend/`: `npm run build`; Vite emitted `backend/public/build/manifest.json` and hashed JS/CSS/font assets. |
| Configuration/routes/views | Pass | From `backend/`: config clear, 32 application routes, and Blade view cache pass while templates reside in `frontend/src/views`. |
| Real CSRF rejection | Pass | HTTP registration with a valid session/CSRF, then authenticated `PATCH /api/v1/profile` without token/origin: HTTP 419, `SESSION_EXPIRED`. |

For the extracted PHP runtime, the actual Laravel test invocation inherited a
temporary INI outside the project so `artisan test` could pass its PHP binary
and extensions to the child PHPUnit process. A normal PHP installation with
extensions enabled uses the commands in `Readme.txt` directly.

## Personal workload check

On a disposable account with 1,000 notes containing approximately 1 KiB-scale
text, 20 warm authenticated alternating list/search requests were measured
against the local built application:

| Metric | Observed |
| --- | ---: |
| Requests | 20 |
| Median | 0.017 s |
| p95 | 0.019 s |

The disposable account and its notes were deleted after measurement.

## Browser walkthroughs

The Playwright skill CLI ran the built application against real PHP/MySQL using
Firefox (the configured Chromium executable was unavailable, so the skill's
Firefox install was used). Normal-flow console checks reported zero errors.

| ID | Result | Observed evidence |
| --- | --- | --- |
| B01 | Pass for exercised path | Registration exposed four user inputs, auto-login and unverified banner worked, protected/login flow worked, and the real HTTP CSRF negative request returned 419. |
| B02 | Pass | Vietnamese/emoji/indentation/literal HTML was saved, closed, reopened, and displayed as literal text. Evidence: [B02-editor-saved.png](../output/playwright/B02-editor-saved.png). |
| B03 | Partial | Label creation/assignment, color, pin, grid/list switch and escaped card rendering passed. Full 31-note pagination and every literal search/filter variant were not walked manually. |
| B04 | Partial | Offline edit showed `Mất kết nối · sẽ thử lại`; reconnect saved the latest body as the next version with no console errors. Full delayed-response and reload-recovery matrix remains unrun. |
| B05 | Partial | Two tabs produced an explicit server/local conflict chooser; choosing server worked. Deleting in one tab made a stale save show `Ghi chú không còn khả dụng` without recreation. Evidence: [B05-conflict.png](../output/playwright/B05-conflict.png). The separate keep-local browser trial remains unrun. |
| B06 | Partial | Real UI upload of `Readme.txt` completed, card count updated, editor showed name/size/download link. Backend covers private serving/spoof/replay; browser video/Office/ZIP/byte-compare/avatar-failure cases remain unwalked. |
| B07 | Pass for exercised path | Theme/font/default-color/view persistence passed; password change logged out the other tab, new password login succeeded, and same-account recovery draft was surfaced then explicitly discarded. Evidence: [B07-preferences-dark.png](../output/playwright/B07-preferences-dark.png), [B07-password-session.png](../output/playwright/B07-password-session.png). |
| B08 | Partial | 360×800, 768×1024 and 1440×900 captures were inspected in dark/light states with no normal-flow console errors. Evidence: [B08-mobile.png](../output/playwright/B08-mobile.png), [B08-tablet.png](../output/playwright/B08-tablet.png), [B08-desktop.png](../output/playwright/B08-desktop.png), [B08-light-desktop.png](../output/playwright/B08-light-desktop.png). Full keyboard/focus-trap, 200% zoom and reduced-motion assertions remain. |
| B09 | Partial | Note deletion confirmation and label-delete cancellation were exercised; canceled label remained. Failure injection/retry coverage is backend/unit-tested but not fully walked through browser UI. |
| B10 | Partial | Built assets worked without Vite dev server; a second PHP server on port 8001 returned login 200, built manifest 200, and guest root 302. Fresh HTTP disposable accounts were used for CSRF/workload checks. A complete fresh-account search/file walkthrough on the alternate port remains unrun. |

## Security and integrity evidence

- Feature tests use an early guard that checks `APP_ENV=testing`, MySQL driver,
  configured `notes_test`, and actual `SELECT DATABASE()` before truncation.
- Owner scoping is applied to note, label, attachment, avatar and private file
  reads; resources do not expose password, private path or SHA-256 storage
  fields.
- Note create UUID replay, stale version conflict, tombstone 410, literal SQL
  wildcard search, attachment replay/delete, private download authorization,
  renamed HTML rejection and database-session invalidation are covered by
  MySQL feature tests.
- Code comments explain the non-obvious safety/lifecycle decisions in the
  owner lock, snapshot/normalization, test database guard, upload progress,
  recovery and stale-response paths.

## Remaining checks

The full matrix in [`docs/plan/08-verification.md`](plan/08-verification.md)
still has unrun exhaustive cases for label/file quotas and races, DB/storage
failure injection, cross-account browser file access, native video seeking,
all J01–J16 controlled event orders, all D/F/S/Q cases, and every B08
accessibility assertion. These are evidence gaps, not silently marked passes.

Intentional R1 exclusions are documented in
[`docs/plan/09-deferred.md`](plan/09-deferred.md): email verification/reset,
note-specific passwords, sharing/collaboration, WebSocket, email delivery,
PWA/offline service worker, AI, Docker Compose and public deployment.
