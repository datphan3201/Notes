# Target Database and Transaction Contract

## Conventions

- MySQL 8.4, InnoDB, `utf8mb4`, default `utf8mb4_0900_ai_ci`.
- New entity IDs: lowercase UUID in `CHAR(36) CHARACTER SET ascii COLLATE ascii_bin`.
- Users and Tags retain unsigned BIGINT IDs. The physical `labels` table
  becomes the canonical Tag table to preserve Notes compatibility: add nullable
  owner-scoped `parent_id`, position, and version in M06. `/api/v1/labels`
  remains a compatibility route over the same rows; do not create a duplicate
  `tags` table.
- Time: UTC `DATETIME(6)`; user-facing calendar values: `DATE`; public timestamps: ISO 8601 UTC with six fractional digits.
- Every owned entity has `user_id NOT NULL`, `version INT UNSIGNED DEFAULT 1`, timestamps, and where specified `archived_at`.
- Add `UNIQUE(user_id, id)` to owned UUID tables so relationship foreign keys can enforce matching ownership.
- Finite values use `VARCHAR` plus `CHECK` constraints.

## Existing tables

Preserve current `users`, `user_preferences`, `notes`, `labels`, `label_note`, `attachments`, and `pending_file_deletions` behavior in the fresh target schema. Add `users.auth_version` and `user_preferences.timezone`. Remove `remember_token`. Replace Laravel sessions and migration ledger with the target definitions.

## Core planning tables

| Table | Required columns and constraints |
| --- | --- |
| `areas` | UUID, owner, name(80), description(10000), position, version, archived/timestamps; unique owner/name |
| `goals` | UUID, owner, nullable Area, nullable parent Goal, name(200), description, expected_result, completion_criteria, importance 1–5, status, deadline, position, completed/archived/timestamps; exactly one Area/Goal parent |
| `milestones` | UUID, owner, Goal, name, description, completion_criteria, status, deadline, position, completed/archived/timestamps |
| `tasks` | UUID, owner, nullable Goal/Milestone, name, description, expected_result, completion_criteria, importance, status, start/deadline, scheduled UTC interval, nullable Note/series/occurrence date, completed/archived/timestamps; at most one parent; unique Note and series/date |
| `checklist_items` | UUID, owner, Task, title(500), checked, position, checked/deleted/timestamps, version |
| `habits` | UUID, owner, nullable primary Goal, name, description, importance, period daily/weekly, target, timezone, archived/timestamps |
| `habit_check_ins` | UUID, owner, Habit, local date, timezone, recorded timestamp; unique Habit/date |

Text columns use `TEXT` unless the existing Note contract requires `MEDIUMTEXT`. Empty optional text is stored as `''`; nullable is reserved for missing relationships/dates.

## Relationship tables

- `goal_contributions(source_goal_id, target_goal_id)`
- `milestone_contributions(milestone_id, goal_id)`
- `task_contributions(task_id, goal_id)`
- `habit_contributions(habit_id, goal_id)`
- `milestone_dependencies(milestone_id, prerequisite_id)`
- `goal_tags`, `milestone_tags`, `task_tags`, `habit_tags`
- existing `label_note`
- `weekly_task_selections`, `weekly_milestone_selections`

Every table also stores `user_id`, uses a composite primary key over edge endpoints, has reverse indexes, and uses composite owner foreign keys. Self Goal contributions and self Milestone dependencies have checks and application validation.

## Recurrence, history, AI, infrastructure

- `task_series` contains the Task template, parent, daily/weekly rule, interval, weekday bitmask, start/end date, timezone, optional local time/duration/deadline offset, state, cursor, and version.
- `task_series_checklist_items`, `task_series_tags`, and `task_series_contributions` hold templates.
- `activities` stores append-only completion/reversal facts with source type/ID/version, UTC occurrence, local effective date, timezone, and optional reversal reference.
- `goal_daily_snapshots` stores calculated daily progress.
- `reviews` stores kind/period/timezone, immutable summary JSON, reflection fields, status/version/finalized time; unique owner/kind/period.
- `ai_actions` stores request ID, state, provider/model, exact proposal/hash, context versions, created-ID mapping, expiry, version, and safe error code.
- `rate_limit_buckets` stores a hashed key, counter, and expiry.
- `schema_migrations` stores migration name, SHA-256 checksum, and applied timestamp.
- `sessions` stores opaque ID, nullable user ID, encrypted payload, IP/user agent metadata, last activity, and expiry.

## Required indexes

Index every foreign key. Add owner/status/deadline and owner/scheduled-start Task indexes; owner/parent/position Goal indexes; owner/Goal/position Milestone indexes; owner/effective-date/type Activity index; series/date uniqueness; review period uniqueness; rate-limit/session expiry indexes. Verify critical queries with `EXPLAIN` before adding speculative indexes.

## Foreign-key and deletion policy

- User-owned aggregate rows reference `users` with `ON DELETE RESTRICT`; v1 has
  no account hard-delete flow.
- Primary hierarchy references use `ON DELETE RESTRICT`. Normal UI uses archive,
  and a container cannot archive while active children still depend on it.
- Pure junction/template rows (`*_tags`, contributions, dependencies, weekly
  selections, series checklist templates) use `ON DELETE CASCADE` from either
  hard-deleted endpoint solely so test/administrative purge cannot leave edges.
  Application archive never triggers that cascade.
- Checklist Items, Habit check-ins, and Task occurrences use `ON DELETE
  RESTRICT` in production schema because their parent is archived, not purged.
  A future retention/purge feature must define auditable deletion separately.
- Activity, Review snapshots, and AI action audit rows never cascade from an
  archived source. Source identifiers are stored as typed IDs without a foreign
  key where history must survive a future purge; ownership and source type are
  validated on insertion.
- Existing Note/attachment/pending-deletion semantics stay as currently tested;
  M01 schema fixtures freeze their exact foreign-key actions before translation.

Every nullable relationship is explicitly listed in the table definitions;
absence of `nullable` means `NOT NULL`. Database checks cover scalar/XOR/self
constraints; graph cycles and lifecycle conditions remain transactionally
enforced application rules.

## Transaction and lock order

Mutation services own transactions. Standard order:

```text
users row FOR UPDATE
→ aggregate rows ordered by binary ID
→ relationship/checklist rows ordered by key
→ activity/AI action rows
```

Do not perform provider calls or file I/O inside database transactions. File writes occur before metadata transactions and are compensated on failure. File deletions are recorded transactionally and processed afterward.

## Cycle prevention

Goal/Tag reparent and dependency/contribution edge creation:

1. Begin transaction and lock owner.
2. Load the user's active adjacency pairs.
3. Validate endpoints and proposed edge.
4. Walk iteratively with a visited set; reject a path back to the source.
5. Apply the mutation and increment affected aggregate version once.

This serialized validation prevents simultaneous inverse edges. Never depend on MySQL's recursive CTE limit for arbitrary hierarchy depth.

## Migration runner

`schema_migrations(name VARCHAR(190) PRIMARY KEY, checksum CHAR(64), applied_at DATETIME(6))`.

- Acquire a named MySQL advisory lock derived from database name.
- Refuse a migration whose recorded checksum differs.
- Each migration checks required preconditions and executes idempotent inspection before DDL.
- MySQL DDL may auto-commit. On failure, stop, record no ledger row, report completed statements, and require a documented forward-repair or restore of the disposable fresh target database.
- `migrate` refuses database names outside an environment allowlist; tests additionally require exact `goals_test` from both configuration and `SELECT DATABASE()`.
