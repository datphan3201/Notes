# CRUD audit — 2026-11-09

[Documentation home](../README.md) · [Open issues](../issues.md) · [Testing procedures](README.md)

## Result and scope

The eight core planning collections implement create, list/detail read, versioned update and permanent deletion. Follow-up fixes below resolve ISSUE-073–075 locally: acknowledged Archive mutations, visible TaskSeries/legacy recovery and authoritative Area name uniqueness. Notes/Reviews intentionally use direct deletion and reject new archival. This does not establish every broader product acceptance criterion.

This audit covers the local checkout based on `4992c02` plus the current working changes (rich Notes, inline Task Note editing, solid Note cards and revision `0007`). It is not a new audit/deployment of the hosted release. The initial audit only added tests; the authorized follow-up changes runtime behavior and advances the prepared schema to `0008`. Initial test counts below remain historical.

## Core operation matrix

C = create; R = list/detail read; U = update; D = permanent deletion. All eight API lifecycle cases check stale-version rejection, foreign-owner rejection and the final 404 after deletion. Six archive-capable kinds also cover archive/list/restore; Notes/Reviews check rejection of new archival and separately exercise legacy recovery.

| Entity | C | R | U | D | Active UI path and caveats |
| --- | --- | --- | --- | --- | --- |
| Area | Yes | Yes | Yes | Yes, after archive | Goals / Area management → Archive. Case-insensitive, whitespace-normalized owner name uniqueness is enforced in the service and database, including archives. |
| Goal / child Goal | Yes | Yes | Yes | Yes, after archive | Goals / roadmap / shared editor → Archive; parent/descendant and completion checks remain authoritative. |
| Milestone | Yes | Yes | Yes | Yes, after archive | Goal roadmap / shared editor → Archive; prerequisite/parent permissions are enforced. |
| Task / checklist | Yes | Yes | Yes | Yes, after archive | Tasks / Dashboard / Calendar → Archive. Archive restore/delete awaits the actual mutation; deletion failure retains confirmation. |
| Habit / daily state | Yes | Yes | Yes | Yes, after archive | Habits → Archive; done/rest/clear use date-scoped operations. Frequency/timezone freezes after history are intentional. |
| Note / attached Task Note | Yes | Yes | Yes | Yes, direct confirmation | Notes and Task embed the same canonical editor. One attached Note per Task is enforced. Inline Task view exposes creation/read/edit; full Note deletion remains in Notes. New archival is rejected; legacy archived Notes are listed for recovery. |
| Review | Yes | Yes | Yes, after reopening if finalized | Yes, direct confirmation | Reviews supports explicit reflection Save, refresh/finalize/reopen/delete. New archival is rejected; legacy archived Reviews are listed for recovery. |
| TaskSeries | Yes | Yes | Yes, subject to Ended terminal state | UI/API deletion after archive | Task repeating view supports templates, pause/resume/end/archive. Archive lists standalone series and preserves grouped restoration. |

API operations are declared in [main.py](../../apps/api/planner/main.py), validated in [planning.py](../../apps/api/planner/planning.py), and permanent deletion is coordinated by [workspace.py](../../apps/api/planner/workspace.py). Deletion uses a versioned workspace action rather than a generic HTTP DELETE route; absence of that HTTP method alone is not missing CRUD.

## Other system surfaces

| Surface | Supported lifecycle / completeness boundary |
| --- | --- |
| Note Resources | Multiple owned Note references per Task; read/open in shared Note dialog, link/unlink independently of Note content. One resource can be reused by several Tasks. Deleting a Note clears owned references atomically. |
| Note attachments | Authorized upload, list/download and delete; file bytes are immutable and updates use replacement uploads. No in-place file-content editor or attachment rename is implemented. |
| Avatar / backgrounds / evidence | Private upload/read/delete; profile/background selection is updated separately. Tests use isolated local storage or mocked provider adapters. |
| Note sharing | Invite/list/accept/decline; owner can change recipient edit permission or revoke access, recipient can leave. Share permissions do not grant Task/Goal ownership. |
| Tags | Preference-backed catalogue with add/rename/remove controls in Notes; owned Note assignments are reconciled there. This audit does not assert global taxonomy renaming across every entity. |
| Accounts / preferences | Register/read/update profile/preferences, change/verify email, password/MFA/recovery and confirmed self/admin deletion. Admin role promotion is an audited operator action, not an unrestricted CRUD form. |
| Reports / administration | User creates/reads reports; authorized administrators resolve/dismiss and perform permitted account actions. Evidence/audit history is intentionally not arbitrary user-editable CRUD. |
| Notifications | System-created, user-readable and mark-read. No per-notification edit/delete endpoint or UI is implemented. Whether users need deletion/clear-all requires a product decision. |
| Activity | Append-only domain transitions and reversals; read/filter/retention policy. Lack of manual edit/delete is intentional. |
| Assistant | Ask/read/history, confirmed Apply or Reject, clear history. Proposal execution delegates to ordinary validated services. Tests do not establish real hosted AI quality. |
| Dashboard / Calendar / plans | Derived views and projections of the same entities, not separate duplicate records. Date/selection/state mutations use the underlying Task/Goal/Habit services. |

## Initial audit checks (before fixes)

All database-mutating checks used the guarded disposable `planner_test` database on `127.0.0.1:5434`, isolated file storage, and disabled real mail/AI/storage providers. Pytest and browser database checks were run sequentially. Development and production data were not used for destructive testing.

| Check | Current execution result |
| --- | --- |
| Existing complete API suite, `pytest -q` | 158 passed; one dependency deprecation warning. |
| Added core lifecycle matrix, `pytest tests/test_crud_matrix.py -q -rx` | 8 passed; 2 expected failures confirm Area create/rename validation gap (ISSUE-075). |
| Web typecheck / Node tests / production-style E2E build | Typecheck and build passed; 28 Node tests passed. |
| Existing full browser suite, desktop/mobile Chromium | 92 passed, 6.1 minutes. This successful-path suite alone did not detect the new findings. |
| Added delayed-delete and archived-kind browser regressions | 8 intended assertions failed as expected across desktop/mobile, confirming ISSUE-073–074. The Playwright list reporter counts these annotated cases in its “8 passed” summary; they are unresolved expected failures, not passing CRUD behavior. |

The added [API matrix](../../apps/api/tests/test_crud_matrix.py) and [browser regressions](../../apps/web/tests/e2e/crud-audit.spec.ts) intentionally distinguish successful tests from expected failures. An expected failure is evidence of an unresolved defect, not a passing feature. Failure artifacts were inspected: both delayed-delete cases fail because the confirmation is already absent while the request is pending; all six archived-kind cases fail because the matching Archive row is absent.

## Initial priorities and limits

1. Fix ISSUE-073 so confirmation and retry follow actual mutation acknowledgement, including failed/stale/bulk actions.
2. Resolve ISSUE-074 by aligning the Archive API and UI-supported lifecycle categories.
3. Resolve ISSUE-075 with consistent per-owner Area name rules and non-destructive reconciliation of existing duplicates.

Passing this matrix does not prove every cross-entity graph, concurrency interleaving, input combination, physical mobile browser or production provider behavior. It does not close the broader parity/recovery/provider/capacity gates in ISSUE-045–048. Cloud deployment, inbox delivery and real AI/provider behavior were not exercised by this local CRUD audit.

## Authorized follow-up fixes

ISSUE-073–075 are resolved in the local working tree. Deletion confirmations remain pending through acknowledgement and retain retry on failure. Empty Archive uses one atomic batch; original versions are validated before cascading/unlinking other selected records. TaskSeries has standalone Archive/restore/delete controls. New Note/Review archival returns 422; existing archived records remain recoverable. Locked Note restore returns masked content. Area create/update and a unique index enforce the same owner-scoped name rule; migration aborts on duplicates with IDs for deliberate renaming.

Fresh follow-up checks are recorded below after execution. The previous expected-failure annotations have been removed. Development schema changes use a private backup and verified local target; destructive automated checks remain restricted to `planner_test`. No cloud deployment was performed.

| Follow-up check | Executed result |
| --- | --- |
| Full API suite after service/schema fixes, `pytest -q` | 173 passed; one dependency deprecation warning. |
| Final focused matrix, `pytest tests/test_crud_matrix.py -q` | 17 passed, including two additional locked legacy Note restore cases for the resource and workspace APIs. Covers duplicate migration refusal, database constraint, owner isolation, new archive rejection, legacy recovery and atomic stale-version/resource-unlink deletion. |
| Browser regression: `complete-features.spec.ts` and original four `crud-audit.spec.ts` cases | 34 passed across desktop/mobile, including slow/failed deletion and retry, legacy Note/Review recovery and TaskSeries recovery. |
| Final Archive browser suite, `crud-audit.spec.ts` | 10 passed across desktop/mobile, adding complete standalone series archive/restore/delete through the UI. No expected-failure annotations remain. |
| Final `npm run build:e2e` | Passed, including TypeScript compilation. |
| Ruff for changed CRUD services, migration and test helpers; `git diff --check` | Passed. |
| Local migration `0007` → `0008` | Verified `planner_dev/public`, no duplicate Area groups, private backup first; unique index present and 13 Areas / 120 Notes / 157 Tasks preserved. |

These are local checks; no hosted deployment, real inbox/provider check or physical-device acceptance is implied. Empty Archive retains the existing 200-action workspace request limit and fails without partial deletion if a request exceeds it.
