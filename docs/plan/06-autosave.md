# Notes Autosave and Recovery Contract

The existing Notes autosave behavior is a preserved compatibility contract.

## State and timing

- One editor handles create and update.
- Valid edits dispatch after 500 ms of inactivity and no later than 2 seconds of continuous valid input.
- At most one logical write is in flight.
- A request freezes its UUID, kind, base version, complete snapshot, attempt, and editor generation.
- Input during a request remains local and dispatches after the acknowledgement when still different and valid.
- `saved` means the current draft exactly matches an acknowledged server snapshot.
- IME composition never dispatches partial text.

## Create/update contract

- Browser-generated lowercase UUID is stable across create retries.
- The fallback must generate a valid RFC 4122 v4 UUID using secure random bytes; if secure randomness is unavailable, block creation with an honest error.
- Create replay with the same UUID/snapshot returns the existing Note; different content conflicts; a tombstoned UUID returns 410.
- Update uses a complete editable snapshot and `base_version`.
- Desired state equal to current is a safe no-op before stale-version rejection.
- Different stale state returns current owned representation with 409.

## Recovery

Store one account-scoped record in `sessionStorage` containing Note ID, persisted flag, base version, acknowledged snapshot, draft snapshot, and frozen pending/failed request. Validate schema, account, age, and size before offering recovery. Corrupt/expired records are deleted. Logout/account change clears records without touching unrelated storage.

The New note control remains disabled until initial labels, Notes, and the recovery check finish. A newly opened editor must not be mistaken for a recovered draft by a late startup check.

Retries use the exact frozen request. Transient network/5xx requests retry at 1/2/4 seconds; 429 respects valid `Retry-After`; validation and conflict do not auto-retry. Offline pauses retry until an online signal.

## Task Note integration

A Task's optional Note uses the same Note entity/editor/API. `tasks.note_id` is unique and nullable. Opening through a Task supplies navigation context only; it does not change Note ownership/version rules. An empty Task Note area creates no Note. Deleting a linked Note unlinks the Task in the same owner transaction; archiving a Task does not delete its Note.

## Cutover requirement

The framework-free Notes endpoints must pass existing JavaScript tests unchanged except the valid-UUID correction. The `/api/v1/session`, CSRF token, error codes, resource shapes, and retry status behavior remain compatible.
