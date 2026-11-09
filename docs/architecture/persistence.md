# Persistence and transactions

[Documentation home](../README.md) · [Security](http-security.md)

## Schema authority

[SQLAlchemy models](../../apps/api/planner/models.py) describe mappings; [Alembic revisions](../../apps/api/migrations/versions/) and the initial SQL define deployed DDL. The current chain ends at `0005` (private assets). Add forward migrations for changes; do not silently edit applied schema. [Alembic environment](../../apps/api/migrations/env.py) selects the configured application schema and version table.

| Concern | Current model groups |
| --- | --- |
| Accounts | User, LoginSession, AuthToken, RateBucket; profile/preferences on User |
| Planning | Area, Goal, Milestone, Task, TaskSeries, TaskSelection, Dependency, Focus |
| Habits / Reviews | Habit, HabitDay, Review, Activity |
| Notes / files | Note, NoteShare, NoteUnlock, Attachment, AccountFile |
| AI / jobs | Document, AIRun, Job |
| Moderation / migration | Report, AdminAction, SystemSetting, ImportReceipt, LegacyRecord |

Read models/migrations for exact table names, columns, constraints/indexes and deletion actions. The current runtime does not retain the old label/checklist/preference pivot schema as active API contracts: checklist/extra metadata use typed JSON fields where defined. Application queries must still enforce `user_id`; database constraints are defense in depth, not a substitute.

## Identity and time

Current accounts and owned entities use string UUID identifiers. Instants are timezone-aware PostgreSQL timestamps stored/operated in UTC; user-facing calendar dates use DATE. Account/Habit/series timezones control day boundaries. Legacy integer identifiers and unsupported fields survive through explicit importer mappings/raw archive, not implicit compatibility.

A Goal has exactly one Area or parent Goal; a Task has at most one primary Goal/Milestone, or neither for Inbox. Contributions/related work and Milestone prerequisites are separate edges. Validate ownership, reference types and acyclicity inside the same transaction as graph writes.

## Write boundaries

[Workspace apply_changes](../../apps/api/planner/workspace.py) applies a batch inside the caller's transaction; the HTTP handler commits. [Planning services](../../apps/api/planner/planning.py) validate versions, parent/graph state and acknowledgements. Owner locking serializes related writes. A stale version returns 409; explicit client keys deduplicate identical creation retries. No universal version precondition is implied for preferences, check-ins or invitation decisions: inspect each schema/handler.

[AI Apply](../../apps/api/planner/ai.py) checks the exact reviewed hash, current source versions/access and proposal state, then commits domain writes, jobs and applied marker atomically. Provider calls are outside those write transactions. Durable jobs use keys, leases and retry state; delivery is at least once.

Uploads store bytes with compensation for metadata failures; deletion queues private-byte cleanup. Normal planning archival and timed History retention preserve Activity/Review facts. Confirmed permanent deletion and account removal have separate grouped rules.

## Migration limitations

The guarded [legacy importer](../../apps/api/planner/migrate_legacy.py) is distinct from the [cloud COPY helper](../../tools/deploy/migrate_to_supabase.py). The latter is not a complete reconciliation/backup/file migration system; see ISSUE-065. Raw archival preservation does not imply that unsupported settings, relations or legacy MFA are active or accepted. Database plus private-file recovery must be rehearsed together (ISSUE-046).
