# Implementation Status

Status: R1 implementation is complete for the planned application scope; final
delivery remains evidence-limited for several exhaustive browser/security
scenarios listed in [`docs/plan/08-verification.md`](plan/08-verification.md).

Verification date: 2026-09-07.

| Task | State | Evidence / blocker |
| --- | --- | --- |
| T00 Runtime | Complete | PHP 8.5.4, Composer 2.10.3, MySQL 8.4.11, Node 22.22.2/npm 10.9.7. `notes_dev` and `notes_test` connect over MySQL with `utf8mb4_0900_ai_ci`, `REPEATABLE-READ`. Native package installation was blocked by `sudo: interactive authentication is required`; verification used a user-local extracted runtime under `/tmp` without changing the repo. |
| T01 Scaffold/configuration | Complete | `composer validate --strict`, `composer check-platform-reqs`, `artisan config:clear`, 32-route `route:list`, and `npm run build` pass. MySQL/database sessions, CSRF JSON errors, private disk, Vite 8, Alpine 3, Noto Sans, and ignored local envs are configured. |
| T02 Schema/models | Complete | `notes_test` fresh migration succeeds; seven application tables plus sessions, UUID/tombstone/version fields, MySQL constraints/collations, resources, snapshot normalization, and test database guard are implemented. |
| T03 Authentication | Complete | Registration/login/logout, four-field registration DOM, database sessions, unverified banner, password byte validation, password-change invalidation, and owner-scoped API are implemented and covered by feature/browser checks. |
| T04 Notes API | Complete | Create/replay/update/no-op/conflict/delete/tombstone, owner locks, literal search, pagination contract, and complete snapshots are implemented; `NotesTest` passes. |
| T05 Labels | Complete | CRUD, owner/version checks, normalized uniqueness, ANY filtering, atomic note association, and delete detachment/versioning are implemented; API/browser label flows pass. |
| T06 Private files | Complete | Private upload/serve/delete lifecycle, UUID/digest replay, allowlist/spoof checks, quota checks, avatar re-encoding, pending cleanup, and `files:prune` are implemented; `FilesTest` and browser text upload pass. |
| T07 Workspace UI | Complete | Blade shell, custom responsive CSS, escaped note rendering, grid/list, labels, search/filter/pagination wiring, and stale-read guards are implemented. |
| T08 Autosave/recovery | Complete | 500 ms debounce/2 s max wait, immutable requests, bounded retry, conflict choices, sessionStorage recovery, beforeunload/leave guards, offline resume, and generation guards are implemented; JS unit tests and B02/B04/B05 flows provide evidence. |
| T09 Settings/file UI | Complete | Profile/avatar, serialized preferences, default color semantics, password UI, attachment queue/progress/retry/delete, and navigation guards are implemented; browser settings/password/upload flows pass. |
| T10 Browser review | In progress | Playwright Firefox walkthroughs produced B01/B02/B05/B07/B08 artifacts and exercised B03/B04/B06/B09 partially. B08 responsive captures and normal-flow console checks pass; the exhaustive B01–B10 matrix still has partial/unrun cases recorded in `docs/verification.md`. |
| T11 Integrity review | In progress | Real HTTP CSRF negative test returns 419; MySQL tests cover ownership, literal HTML/search, tombstones, replay, private serving, spoof rejection, and password/session invalidation. Exhaustive race, quota-concurrency, storage-failure, and cross-account browser checks remain unrun. |
| T12 Delivery | In progress | README/Readme.txt, build, fresh test migration, 9 PHPUnit tests/76 assertions, 9 JS tests, Pint, Composer, Prettier, workload measurement, and alternate-port built-asset check are recorded. Delivery is not labeled a complete 32-criterion final assignment while the remaining evidence gaps exist. |

## Decisions changed during implementation

No product or HTTP/database contract was changed. A hardcoded test SQL
password was removed from `phpunit.xml`; test credentials now come only from
ignored `.env.testing`, while the PHPUnit environment still forces MySQL and
the `notes_test` database.

## Known limitations after delivery

- Browser video seeking, Office/ZIP fixtures, Unicode filename download bytes,
  browser cross-account file probing, and full avatar failure recovery were
  not all walked manually; backend allowlist/private-serving tests cover the
  implemented paths.
- The exhaustive J01–J16, N/L/F/D/S/Q matrix and all B08 keyboard/200% zoom/
  reduced-motion assertions are not represented by a one-to-one automated
  test yet.
- R2–R5 exclusions remain intentional and are listed in
  [`docs/plan/09-deferred.md`](plan/09-deferred.md): email verification/reset,
  note passwords/sharing/collaboration, WebSocket, AI, PWA, Docker, and public
  deployment.
