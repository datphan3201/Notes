# Autosave, Concurrency, and Draft Recovery Contract

This is a required implementation contract, not optional polish. Implement the state machine as a plain JavaScript module with injected transport, clock, and recovery storage so race cases can be tested without a browser.

## State owned by one editor

```text
editorGeneration       increments on opening a different editor instance
userId                 immutable authenticated owner of this draft
noteId                 stable UUID for this draft, even before creation
persisted              false until acknowledged/reconciled with server
baseVersion            last acknowledged/reconciled server version, or null
acknowledgedSnapshot   canonical editable fields known persisted, or null
draftSnapshot          current title/content/color/pin/label IDs
pendingRequest         immutable {kind, sentSnapshot, baseVersion, noteId,
                                 editorGeneration, attempt, startedAt}, or null
phase                  one of the states below
composing              true during IME composition
validationErrors       field map
conflictCurrent        authorized current server detail, or null
firstDirtyAt           clock value for max-wait deadline, or null
lastInputAt            clock value for debounce
recoveryAvailable      storage health flag
```

Canonical snapshots follow document 03. UI input text remains untouched while typing, even if the canonical comparison trims the title. Normalize on dispatch/comparison; never replace a textarea value from a server response while it has newer local edits. Passwords and attachment File objects never belong in this state.

## States and allowed behavior

| State | Meaning | Allowed next actions |
| --- | --- | --- |
| `loading` | Fetching existing detail | Read retry or close; editing disabled |
| `pristine` | New empty editor | Input; clean close creates nothing |
| `incomplete` | Draft fails required/length rules | Input/correct, recovery, explicit discard; no write |
| `dirty` | Valid draft differs from acknowledgment | Debounce/flush, continue input |
| `saving` | One logical write is outstanding | Continue input locally; do not dispatch another logical write |
| `saved` | Current canonical draft matches acknowledged snapshot | Input, metadata changes, clean close |
| `retry_wait` | Network/5xx/429 response not acknowledged | Preserve exact pending request; bounded retry |
| `error` | Retry exhausted or nonretryable failure | Explicit retry/correct/discard; no false saved status |
| `conflict` | Server has different content at another version | Explicit resolution; automatic writes paused |
| `auth_expired` | Authentication/CSRF cannot be used | Re-authenticate same account, then reconcile |
| `unavailable` | Existing identity missing/deleted | Preserve local text for reading/copying; no automatic recreation |
| `closing` | Guard draining/reconciling work | No new UI input; close only under rules below |

“Đã lưu” is valid **only** when `persisted`, no pending request, no unresolved error/conflict, and canonical draft equals acknowledged snapshot. A successful older request cannot mark a newer draft saved.

## Input scheduling

1. On each input/change, update the draft and its recovery record immediately; run local validation without prematurely displaying errors on untouched fields.
2. If composing, record input but schedule no new write. On `compositionend`, revalidate and schedule.
3. Invalid/incomplete snapshots are retained but not sent. Previously saved content remains unchanged on the server.
4. For a valid dirty draft with no outstanding logical request, debounce **500 ms** after the latest input, with a **2,000 ms max wait** after the first valid dirty input. Max wait prevents continuous typing from postponing saving indefinitely.
5. Capture an immutable snapshot when dispatch begins. Create uses POST with stable noteId, title/body/color. Update uses PATCH with complete snapshot and baseVersion.
6. If input occurs while saving, update only the draft/recovery. When the request is acknowledged, immediately dispatch the latest valid changed draft (unless composing), without an additional debounce. If latest draft is invalid, stay incomplete and retain the acknowledgment.
7. Metadata changes in an existing editor use the same queue. Never send concurrent text, pin, color, and label PATCHes from separate handlers.
8. Blur/close can request a flush; IME completion and valid input rules still apply. Do not make blur the only save trigger.

## Dispatch/acknowledgment algorithm

```text
dispatch(snapshot):
  require pendingRequest is null, snapshot valid, not composing, not paused
  freeze kind/id/version/canonical snapshot/generation into pendingRequest
  persist recovery containing that exact pendingRequest (without timer handles)
  send the request; mark saving

onAcknowledged(response, request):
  ignore UI changes if request's generation/id no longer match this editor
  validate response status, JSON resource identity, version and schema
  update persisted, baseVersion, acknowledgedSnapshot from canonical response
  clear this pendingRequest and retry timers
  retain newer draft inputs; never wholesale assign response into the form
  if canonical draft equals acknowledgedSnapshot:
    mark saved; clear recovery record
  else if draft is valid and not composing:
    dispatch latest draft once
  else:
    retain draft/recovery; mark incomplete or wait for compositionend
```

Normal create/update acknowledgment must agree with the sent snapshot (create defaults included), otherwise treat it as conflict/unexpected response rather than silently losing local intent. A response may contain fresh label names and attachment metadata, but those are not permission to replace a newer editable snapshot.

On success, update the corresponding list summary through a fresh list query. Refetches have their own generation guard. Never make editor state depend on whether the current filter includes the newly saved note.

## Failure and retry

- HTTP timeout: 15 seconds. A timeout/transport abort means the outcome is **unknown**, not that the server rolled back.
- For network errors, timeout, malformed/non-JSON success, and 500/503: retry the **same frozen request** up to three automatic times after 1s, 2s, and 4s. Explicit Retry starts a fresh retry budget for that pending request, not a new UUID or latest snapshot.
- If `navigator.onLine === false`, pause retry timers. An `online` event may resume reconciliation/retry; it is only a hint, not proof the server works.
- 429: use numeric/date Retry-After when valid, otherwise 5 seconds; count attempts against the same bounded budget. Show waiting status, not rapid polling.
- 422: preserve draft, show field errors, stop automatic retries. Clear the failed logical request because it was explicitly rejected. A corrected snapshot can start a new request using the same known base version.
- 401/419: stop writing, keep draft and pending request; enter re-authentication flow.
- 409: keep local draft, store `current`, clear rejected pending request, stop automatic writes; resolve explicitly.
- 404/410: stop retrying that note identity, retain any unsaved draft, show unavailable. Never POST a new UUID automatically to replace a deleted note.
- After a network error do not advance to newer queued edits until the frozen request is resolved by replay, current-server reconciliation, or conflict handling. This prevents out-of-order writes.

Server create replay and update no-op rules are necessary partners to this algorithm. Aborting a write because search changed or a modal closed is not a substitute for them. Aborting **read** requests is safe and encouraged.

## Conflict resolution

When 409 includes `current`, preserve the entire local draft and show the comparison dialog. No retry with a freshly copied version until the user chooses.

- **Use server version:** explicit choice discards the local snapshot, adopts `current` as draft/acknowledgment/baseVersion, refreshes labels/attachments, clears recovery, marks saved. If the user closes the conflict dialog instead, remain paused.
- **Keep local draft:** explain replacement, then keep the user's draft, set baseVersion/acknowledgment to the displayed `current`, validate selected labels against fresh owned labels, and send one PATCH with that base version. Remove labels that no longer exist only after showing which selections were removed and asking the user to confirm the resulting snapshot. A second race returns another 409; never loop through conflicts automatically.
- For CREATE_CONFLICT, the note already exists. Set `persisted = true` and use the same existing ID; keeping local becomes a versioned PATCH, not another create.
- A foreign-ID 404 contains no `current`; never turn it into a merge/replacement option.
- Pin/color card conflicts only refresh the card and show a retry message. The richer editor conflict UI applies when there is an actual user draft to preserve.

Label deletion changes the parent note revision. A clean open editor may adopt refreshed detail. A dirty editor keeps its snapshot and follows the same conflict procedure; never silently drop draft text while updating labels.

## Closing, switching, deletion, and navigation

Implement a single `requestLeave(intent)` guard for Close, Escape, backdrop, opening another note, navigating to settings, and logout.

1. Empty pristine new editor: close immediately without POST.
2. Saved/clean editor: close immediately and remove the optional note query parameter.
3. Valid dirty editor: attempt an immediate flush, keep dialog open while awaiting acknowledgment, then leave if clean. If further input was allowed before closing starts, include it in the queue.
4. Invalid/error/conflict/auth-expired editor: remain open and show “Tiếp tục chỉnh sửa”, applicable retry/resolution action, or explicit “Bỏ thay đổi và rời đi”. Discard clears only local pending/recovery state and does not roll back content already acknowledged by the server.
5. If a timed-out write has unknown outcome, first attempt a GET reconciliation/replay. If the server remains unreachable, explain that discarding the draft cannot undo data already sent; allow explicit local discard and leave without claiming remote rollback.
6. Do not allow a stale late response to update a subsequently opened note. Increment editorGeneration only after disposing listeners/timers and applying the leave decision.
7. Uploads must finish or be explicitly canceled/discarded before leaving. A canceled upload may have reached the server; refresh attachments on next open to reconcile. File objects are not recoverable after navigation.

Deletion from the editor pauses new autosave dispatch, resolves an active request where possible, and fetches current detail before presenting the destructive confirmation. Unsaved text is included in the discard warning. Confirm sends DELETE with the **displayed** current version. 409 requires a new comparison/confirmation; 204 clears draft/recovery and closes. Cancel resumes the draft's autosave state. If network uncertainty prevents getting a current version, keep the note open with retry rather than guessing a version or losing the draft. Tombstones protect against late requests after a committed deletion.

Register `beforeunload` only while unsaved text/upload activity needs protection. Browser-native warnings are a best effort and can be skipped by browsers, particularly on mobile; do not promise custom unload text or reliable saving during unload. Never rely on `sendBeacon`, `pagehide` network writes, or synchronous requests for correctness.

## Per-tab recovery (not PWA)

- Use `sessionStorage`, key `notes:r1:<userId>:editor`, one editor record per tab/account. Store schema version 1, userId, noteId, persisted flag, baseVersion, acknowledgedSnapshot, draftSnapshot, frozen pending request if any, and `recordedAt`.
- Keep only a dirty/incomplete/pending/error draft, not the whole note library. Expire records older than 24 hours. No password, token, uploaded file bytes, or full profile in storage.
- Read/write/remove defensively: catch quota/security errors, validate schema/owner/field types, and remove corrupted/expired records. Fall back to in-memory draft with a visible recovery-unavailable notice; ordinary server saving still works.
- Bootstrap with authenticated user identity before loading any recovery. Discard records for other user IDs in this tab; never render their contents. Successful explicit logout/password change removes all application recovery keys in this tab.
- On reload, offer recover/discard. On recover, fetch the current server note if it was persisted or creation outcome was unknown. If the pending snapshot matches current server data, acknowledge it and then resume later edits. If version/snapshot differs, show conflict. If create was never acknowledged and GET returns 404, replay the original create with its original ID; a tombstone then yields 410, never resurrection.
- If neither a create was sent nor a server note exists, restore the local incomplete/new draft; send nothing until valid. Never restore attachments as if their File objects survived.
- A currently saved editor clears its recovery record; a normal reload of a clean deep link fetches the server detail.

`sessionStorage` is chosen for tab-scoped reload recovery; its [documented lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) does not provide permanent offline storage. Closing the tab, clearing browser data, or storage failure can remove the draft. Do not call R1 offline-capable.

## Re-authentication and cross-account protection

- On 401/419, retain text but pause edits/mutations; offer login in another tab with `rel="noopener"` and a “Kiểm tra lại” button.
- “Kiểm tra lại” calls GET `/api/v1/session`. If still unauthorized, remain paused. If same user, replace the CSRF token and reconcile current note/pending request before resuming.
- If the returned user differs, hide the old editor content, clear its storage, and navigate to a fresh homepage for the new account. Never send the old account's draft with the new account's session.
- Use a `BroadcastChannel('notes-r1-session')` to announce logout/password-change events with userId only. Other tabs of that user clear recovery and lock/hide the editor. Also recheck session on window focus/visibility return before resuming a paused editor. Broadcast payloads contain no credentials or note text.
- A page cannot guarantee erasure from a suspended browser tab; server authorization remains the security boundary. Do not use browser messages as proof of authenticated identity.

## List request race rules

- Keep a monotonically increasing read sequence and AbortController for list queries. Search debounce is 300ms; labels/page changes dispatch immediately and cancel obsolete debounce/read work.
- Apply a response only if its sequence and canonical query match the newest request. Older success/error responses must not change current results/loading/error state.
- Query failure preserves previous visible results with an explicit stale/error message and retry. It never replaces them with a fake empty success.
- Editor detail fetches use editorGeneration plus noteId guards. Late results for note A never populate note B's fields.
