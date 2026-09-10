# Verification and Acceptance Gates

All checks below are planned. Mark a check passed only after executing it against the implementation. No coverage percentage substitutes for these observable behaviors.

## Test architecture and safety

- PHPUnit feature tests use actual MySQL `notes_test` and a dedicated SQL account that cannot access `notes_dev`. Unit tests cover normalization/snapshot rules where a database is unnecessary.
- Before `RefreshDatabase`/migration/reset hooks run, assert `app()->environment('testing')`, configured driver `mysql`, configured database `notes_test`, and the actual `SELECT DATABASE()` value equals `notes_test`. Fail before any destructive command if these differ. A test that merely checks the name after a reset is insufficient.
- Force `DB_CONNECTION=mysql` and `DB_DATABASE=notes_test` in PHPUnit environment configuration; supply the separate test credentials through ignored `.env.testing`. Clear cached configuration before running the suite. Never commit credentials, and never point tests at the owner's populated database.
- Tests use separate temporary/fake private storage except the controlled browser fixtures. Reset rate limiter/session/cache state between scenarios. Reduce bcrypt rounds only in the testing environment, never in the development app.
- Avoid outer uncommitted test transactions for tests involving multiple DB connections. Use committed fixtures on the dedicated test DB and explicit cleanup so the second connection can see them.
- `node:test` covers pure JS modules with injected fake clock/transport/storage. Control promise resolution order; do not rely on arbitrary real sleeps for race tests.
- Laravel normally bypasses CSRF checks during framework HTTP tests. Verify CSRF behavior through a real HTTP/browser request to the running application, or an explicitly configured full-middleware test that proves the bypass is not active. Never cite a bypassed middleware assertion as evidence.
- Laravel 13 accepts valid `Sec-Fetch-Site: same-origin` before token validation. For a negative CSRF test, use a real HTTP request with the session cookie but omit both the valid origin signal and all CSRF token sources. Expect 419; a normal same-origin browser request accepted without a token is not itself a vulnerability or failed framework configuration.
- Browser review uses the installed Playwright skill CLI against the local running app. Use fresh snapshots, safe test accounts, and `output/playwright/` screenshots. Do not add a second browser-testing stack just to execute the checklist.

## Fixtures

Use factory-generated IDs; do not assume database auto-increment values. Two users A/B with separate notes/labels/avatars are required. Credentials exist only for tests and must not become default personal-login credentials.

For A, create:

- N-A: title `Cơ sở dữ liệu`, body `Khóa ngoại\n  Giữ nguyên khoảng trắng.`, label `Học tập`.
- N-B: title `Work checklist`, body containing literal `100%`, `_todo`, `!important`, `<script>alert(1)</script>`, and emoji, labels `Work` and `Học tập`.
- N-C: a title/body without those search phrases, initially no labels.
- Enough additional notes (at least 31 total) for pagination; assigned server timestamps for deterministic ordering.

B owns an unrelated note with a unique secret marker and a label also named `Work`. Use a valid tiny PNG, valid PDF/plain text, short playable MP4/WebM, renamed HTML/PHP, oversized bytes, and a Unicode filename for file scenarios. Generate or use openly licensed fixtures; do not download unrelated project code.

## Account checks

| ID | Scenario | Expected result |
| --- | --- | --- |
| A01 | Register valid email/name/password/confirmation | User/preferences persist, bcrypt verifies, automatic login redirects `/` |
| A02 | Inspect registration DOM/payload; submit extra ownership/role field | Exactly four user-input fields (hidden CSRF metadata excluded); extra ownership/role fields rejected; no extra required inputs |
| A03 | Duplicate email with changed case/outer spaces | Validation error; one user only |
| A04 | Mismatch, NUL, short password, multi-byte password >72 bytes | 422/form errors as appropriate; no truncation/hash creation; no plaintext in logs/session old input |
| A05 | Wrong email vs wrong password | Same credential error, no authenticated session; throttle after specified attempts |
| A06 | Guest HTML vs JSON read | HTML redirects login, JSON 401; authenticated auth-page visit redirects homepage |
| A07 | Logout then reuse session cookie; check unverified access | Old session cannot access notes; unverified user can use every R1 feature; no mail dispatch |
| A08 | Rename profile, valid/invalid/removed avatar | Name persists; valid image processed/private; invalid input keeps prior avatar; remove shows default |
| A09 | Change password with wrong current/mismatch | No hash change; useful error; no password reflected in response/HTML |
| A10 | Successful password change with two active sessions | Both sessions invalidated; old password fails; new password manual login succeeds |
| A11 | Change each preference, reload/login, create new note | Preferences persist; correct new default color; existing note colors unchanged; body font only changes |

## Notes, search, and labels

| ID | Scenario | Expected result |
| --- | --- | --- |
| N01 | Create with valid title/body and stable UUID | One note version 1, server ownership/times, correct color, no labels/pin |
| N02 | Empty/incomplete/oversized/control-character fields | No active invalid row; 422 with correct fields; body indentation preserved for valid content |
| N03 | Create replay with same UUID and same snapshot | 200 replay, still one row/version, no duplicate |
| N04 | Create replay after original note was modified | 409 with current owned detail; original changes retained |
| N05 | Update current version with changed title/body/color/pin/labels | All fields atomic; version increments once; old pin time retained if already pinned |
| N06 | Repeat exact successful update with older base_version | 200 unchanged; no second increment or updated_at bump |
| N07 | Stale version and different snapshot | 409, no overwritten fields; current contains only owned data |
| N08 | Pin two notes at different times, edit ordinary note | Pinned block first in pin-time-desc order; ordinary block newest update first; deterministic ID tie-break |
| N09 | Search title, body, accent/case variants | Correct owner-scoped results; `co so du lieu` matches accented title; body searched beyond preview |
| N10 | Search `%`, `_`, `!`, SQL-looking text | Literal substring matching; no wildcard expansion, query error, or cross-user results |
| N11 | Page through >30 notes; delete last note on last page | All notes reachable; counts/order correct; UI loads previous available page |
| N12 | Cancel/confirm/delete with stale version | Cancel changes nothing; valid delete 204; stale delete409 requires reconfirmation; no restore endpoint |
| L01 | Create same-case/case-variant/accent-variant labels | Per-user uniqueness rules exactly match specified collation |
| L02 | Assign none/one/multiple labels | Correct set with no duplicate pivot rows |
| L03 | Assign missing/foreign label ID | Rejected without foreign name leak; no partial update |
| L04 | Select two labels where one note has both | ANY union, note appears once; query combines with search using AND |
| L05 | Rename label used by several notes | All returned/displayed names update; note title/body/ID unchanged |
| L06 | Delete label used by several notes | Notes/files remain; associations removed; each affected note version increments once |
| L07 | Stale rename/delete and duplicate-key race | 409 or specified 422; no silent replacement of newer name |
| L08 | Exceed 100 labels/user or 20 labels/note | 422; no partial association/create; first 100/20 remain valid |

## Files

| ID | Scenario | Expected result |
| --- | --- | --- |
| F01 | Upload allowed image/video/document/archive | Correct metadata, actual digest/size/type, randomized private path |
| F02 | Renamed PHP/HTML/SVG, corrupt image/archive, unsupported extension, empty file | 422; no accessible file/metadata remains |
| F03 | >20 MiB file, >20 files/note, >200 MiB aggregate | 413 or documented 422 according to rejection layer; no quota bypass |
| F04 | Two uploads compete for final quota slot | At most one accepted; quotas remain valid under owner lock |
| F05 | Retry same UUID/file then same UUID/different bytes | Safe replay200 once; different bytes409; no extra active file |
| F06 | Delete attachment and replay upload/delete | Delete204; upload410; repeat delete204; parent text revision/time unchanged |
| F07 | Download/preview owned vs foreign vs wrong nested note | Only correct owner/parent succeeds; others404, no path disclosure |
| F08 | Probe `/storage/...`, raw private path, deleted parent/file | No public file access; all revoked/deleted accesses404 |
| F09 | Unicode filename, path/control characters | Safe display/disposition; no traversal/header injection |
| F10 | Replace avatar with upload failure or DB failure | Old avatar remains usable; no half-updated metadata |
| F11 | Disk cleanup failure, retry prune, >1h unreferenced file | Metadata inaccessible immediately; cleanup retry succeeds; active/recent/unmanaged files retained |
| F12 | Sequential upload with valid, rejected, valid items | Two successes retained; failed item has reason/retry; note draft is intact |

## JavaScript state tests

| ID | Controlled event order | Required assertion |
| --- | --- | --- |
| J01 | Open empty → type title only → advance timers → add body | No POST before both valid; first POST after500ms with one UUID |
| J02 | Continuous valid input faster than500ms | A dispatch by2s; no endless debounce starvation |
| J03 | Send snapshot A → type B → resolve A | Form still B; status never says saved for B until its own acknowledgment |
| J04 | Several inputs while request pending | Only one logical request; latest snapshot sent once after acknowledgment |
| J05 | Server commits create but response lost → retry | Same UUID/body replayed; acknowledgment followed by queued edits; one note |
| J06 | Server commits update but response lost → retry | Same baseVersion/snapshot reused; server no-op response resolves it |
| J07 | Network errors/500/429 then exhaustion | 1/2/4s bounded retries or Retry-After; recovery retained; no busy loop |
| J08 | 422 then input correction | No automatic same-invalid-data retry; corrected data can save |
| J09 | Conflict → choose server / choose local / new conflict | Exact specified adoption/replacement; no silent merge or auto-conflict loop |
| J10 | Open A; switch safely to B; late read/write response for A | B's fields/status/identity unchanged by A's response |
| J11 | Close saved / close dirty / close invalid / cancel deletion | Correct guard and flush/discard behavior; no accidental data loss |
| J12 | Reload recovery same owner; expired/corrupt/quota-denied storage | Valid draft offered; invalid records discarded; storage failure doesn't fake successful recovery |
| J13 | 401/419 → login same account → new CSRF; then different-account case | Same account reconciles safely; different account never receives prior draft |
| J14 | compositionstart → Vietnamese IME input → compositionend | No partial composition send; final characters preserved; older ack doesn't move caret |
| J15 | Delete succeeds while a stale create/update is retried | No recreation; 404/410 becomes unavailable with local draft preserved |
| J16 | Existing body temporarily empty/too long, then corrected | Last valid server body remains; invalid draft retained; corrected draft saves |

Use fake clocks that expose elapsed time/queued tasks. Use deferred promises to control response ordering. Assertions must inspect sent payloads, visible phase, retained draft, and resulting server revision where relevant; a test asserting only that a callback ran is insufficient.

## Read races, UI and integrity

| ID | Scenario | Expected result |
| --- | --- | --- |
| Q01 | Slow old search returns after new search | Only newest query controls results/loading/errors |
| Q02 | Search debounce pending, then label/page changes | Obsolete timer/read canceled; correct current query/page |
| Q03 | New query fails while previous results visible | Prior results explicitly stale; error/retry shown; not fake empty success |
| U01 | Grid/list/reload preference, pinned indicator | Correct default/persistence/order and accessible status in both views |
| U02 | Keyboard through editor/dialogs/settings | Visible focus, correct labels, focus trap/restore, Escape uses guard |
| U03 | Narrow layouts/200% zoom/long Unicode content | No overlapping controls or significant horizontal overflow |
| U04 | Empty/search/loading/error states | Distinct useful copy/actions, no dead deferred-feature controls |
| U05 | Both themes/font sizes/note colors | Readable text/contrast, identifiable selected state, local font loaded |
| D01 | Attempt to re-create a deleted note UUID | Owned tombstone410, content scrubbed, no active duplicate |
| D02 | Race note update vs label removal | Valid final associations/revision; stale writer conflicts rather than reattaching deleted label |
| D03 | Race note deletion vs file upload | No accessible file on deleted parent; orphan/pending cleanup accounts for stored bytes |
| D04 | Two independent writes with same base_version | One different update accepted; the other409; no lost update |
| D05 | Inject DB failure during note/pivot/file metadata transaction | No partial note/pivot changes; stored unreferenced bytes cleanup is tracked/attempted |
| D06 | Bypass quotas with concurrent writes | Serialized owner mutations keep active file and label limits valid |
| S01 | Session fixation/login/logout checks | Rotation/invalidation enforced, HttpOnly/SameSite settings present |
| S02 | Real authenticated mutation with neither valid origin signal nor valid token | Rejected419; valid same-origin/token-protected request works; middleware bypass not used as evidence |
| S03 | Password hashes/old input/logs/resources | bcrypt stored; no plaintext/hash/token leakage to client/logs |
| S04 | Guess every note read/write/list/deep-link endpoint as B | No A content, count leak through unscoped OR, or unauthorized mutation |
| S05 | Render script/HTML-looking note, title and label text | Literal text; no script execution/HTML injection |
| S06 | Try to set user_id/version/timestamps/deleted_at/storage path | Unknown fields rejected; no mass-assignment privilege change |
| S07 | Private serving/cache/header/path checks | Owner authorization, no-store/nosniff, safe disposition; non-media never inline |
| S08 | DB down, oversized requests, expired session, malformed response | Honest errors; draft retained where possible; no success state from HTML/empty response |

For D04/D06, use committed fixtures and independent connections/processes. Coordinate start with a test barrier if needed; do not leave destructive/concurrency helpers reachable through application routes. Version tests must verify final DB contents in addition to HTTP status.

## Browser walkthroughs

Run against the actual built application and database. Each result record includes date, browser/runtime, viewport/theme, relevant scenario IDs, observed result, and screenshot/trace path when useful.

1. **B01 — First use and access:** register A with exactly four user-input fields; verify unverified banner and automatic login; logout; check login and protected pages; send a real authenticated HTTP mutation with no valid fetch-origin header/token and observe 419.
2. **B02 — Write/reload:** create a note with Vietnamese, emoji, indentation and literal HTML; observe pending/saved status; close/reload/reopen; compare complete content. Update through the same editor.
3. **B03 — Organize/find:** create/rename/delete labels, assign two, pin two notes, change note color, search title/body/literal `%`, filter ANY, switch list/grid, navigate multiple pages.
4. **B04 — Interrupted save:** delay a save response, continue typing, then release it; toggle network offline, edit, inspect unsaved state, restore connection, verify latest body. Reload a dirty draft and exercise recovery.
5. **B05 — Two tabs:** open same note in two tabs, save different text in both, resolve conflict each way in separate trials; delete from one tab and try saving the other; never silently recreate.
6. **B06 — Files/profile:** upload image/video/text/Office or ZIP fixture, play/seek video, download and compare bytes, reject renamed HTML, remove file, replace/remove avatar, change display name. Try file URL as B.
7. **B07 — Preferences/session:** change theme/font/default color/view, reload; open two sessions, change password, verify logout of both and manual re-login. Login as B after A draft and verify no A recovery is rendered/submitted.
8. **B08 — Responsive/accessibility:** workspace/editor/conflict/label manager/settings at 360×800, 768×1024, 1440×900 in both themes; keyboard-only navigation, focus restoration, zoom200%, reduced-motion setting.
9. **B09 — Destructive/failed actions:** cancel note/label/file deletion then confirm; stale deletion conflicts; inject failed upload/save without erasing valid content; retry; inspect console/network errors.
10. **B10 — Reproducibility:** stop Vite, run built assets; run app on a different configured port; create a fresh account; execute essential capture/search/file workflow with no AI/email/Redis/Docker service.

## Personal-workload check

On a disposable test account with 1,000 notes of about 1 KiB bodies, measure 20 warm authenticated list/search requests and record median/p95 with environment details. Target p95 under 500ms on the local environment; if exceeded, inspect query plans, eager loading and payload sizes before adding infrastructure. This target is an engineering check, not a promised cross-device SLA or instructor score.

Verify no N+1 query growth proportional to cards (use query count instrumentation in tests/local debugging, never a public debug endpoint). Text input must remain responsive during an injected 2-second save response delay. Include at least one 50,000-code-point note to test editor behavior/limits.

## Final commands and evidence

Once the implementation provides these commands/configs:

```bash
cd backend
composer validate --strict
composer check-platform-reqs
php artisan config:clear
php artisan test --compact
vendor/bin/pint --test

cd ../frontend
npm run test:unit
npm run format:check
npm run build
```

Run against the dedicated test configuration. Record actual exit status and failures, not just the command names. `docs/verification.md` should contain:

- Runtime/dependency/database versions and run date.
- Automated suite results and the requirement/scenario IDs they cover.
- Browser walkthrough results and artifact paths.
- Workload measurements and configuration.
- Remaining known defects or unrun checks with reasons.
- Explicit R1 exclusions, linked to document 09.

## R1 completion mapping

| Requirements | Minimum evidence |
| --- | --- |
| R1-A01–A05 | A01–A11, B01/B07 |
| R1-N01–N02 | N01–N07/N12, J01–J16, B02/B04/B05 |
| R1-N03–N06 | N08–N11, L01–L08, Q01–Q03, B03 |
| R1-N07 | F01–F12, B06 |
| R1-U01–U02 | U01–U05, B08 |
| R1-D01 | D01–D06, S01–S08, B09 |
| R1-D02 | Final command results, B10, accurate Readme.txt |

A task/requirement remains incomplete if its only evidence is a mock response, static screenshot, SQLite test for MySQL behavior, or an unexecuted test file.
