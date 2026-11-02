# Persistence, relationships and transactions

[Documentation home](../README.md) · [Planning structure diagram](../diagrams/planning-structure/index.html)

## Schema authority

[MySQL migrations](../../backend/database/plain-migrations/) are the physical schema source; [MigrationRunner](../../backend/src/Infrastructure/Database/MigrationRunner.php) records checksums. Do not edit an applied migration. Add a forward migration and run migrate/check against the intended database. Consult [installation](../operations/installation.md) for database setup.

| Concern | Tables / source owner |
| --- | --- |
| Accounts/security | users, user_preferences, sessions, password_resets, email_tokens, two_factor_codes; [account repositories](../../backend/src/Infrastructure/Persistence/Pdo/Account/) |
| Personal planning | areas, goals, milestones, tasks, checklist_items; [Planning repository](../../backend/src/Infrastructure/Persistence/Pdo/Planning/PdoPlanningRepository.php) |
| Classification | labels, label_note, goal_tags/milestone_tags/task_tags/habit_tags; [Tag repository](../../backend/src/Infrastructure/Persistence/Pdo/Tags/PdoTagRepository.php) |
| Distinct graph relations | goal/milestone/task/habit contributions and milestone_dependencies; [Planning service](../../backend/src/Application/Planning/PlanningService.php) |
| Habit | habits, habit_check_ins, habit_rest_days; [Habit repository](../../backend/src/Infrastructure/Persistence/Pdo/Habits/PdoHabitRepository.php) |
| Recurrence | task_series and template relations, tasks.series_id/occurrence_date; [Series repository](../../backend/src/Infrastructure/Persistence/Pdo/Recurrence/PdoTaskSeriesRepository.php) |
| Activity/Review | activities, goal_daily_snapshots, reviews, daily_task_selections, weekly_task_selections, weekly_milestone_selections; [repositories](../../backend/src/Infrastructure/Persistence/Pdo/) |
| Shared Notes / reports | note_shares, note_reports; [sharing](../../backend/src/Infrastructure/Persistence/Pdo/Notes/PdoNoteShareRepository.php), [reports](../../backend/src/Infrastructure/Persistence/Pdo/Admin/PdoReportRepository.php) |
| Teamwork | team_goals, team_members, team_tasks, team_messages; [Team repository](../../backend/src/Infrastructure/Persistence/Pdo/Teamwork/PdoTeamRepository.php) |
| Infrastructure | attachments, pending_file_deletions, user_backgrounds, notifications, ai_actions, rate_limit_buckets, scheduled_jobs, schema_migrations |

Dashboard roadmap selection is stored in user_preferences.dashboard_roadmap_goal_id with a composite owner/Goal foreign key; [migration 0026](../../backend/database/plain-migrations/0026_add_dashboard_roadmap_preference.php) is the DDL source. Archived Goals are excluded on read without silently selecting another Goal.

The table groups above are a navigation index, not a replacement for complete DDL. Read migrations for exact columns, indexes, foreign keys and deletion actions.

## Identity, time and relationships

Owned UUID entities use lowercase UUIDs; users/labels retain integer IDs. UTC DATETIME(6) stores instants; DATE stores user-facing calendar dates. Serializers convert explicitly via [Timestamp](../../backend/src/Support/Timestamp.php). Use DateTimeImmutable and an injected [Clock](../../backend/src/Support/Clock.php) when time controls behavior.

Goal has exactly one Area or parent Goal. Task has at most one Goal/Milestone primary parent; neither means Inbox. Contributions are additional edges, not primary parents. Milestone prerequisites are separate from both. Composite owner foreign keys and unique owner IDs defend application scoping. Cross-owner object references are not valid edges.

## Transaction and locking discipline

Application services own transactions using [TransactionManager](../../backend/src/Infrastructure/Database/TransactionManager.php). Lock the owner first, aggregates in stable ID order, then relationship/checklist rows and Activity/action rows. Validate graph changes under the same owner transaction so concurrent inverse edges cannot both succeed. Traverse arbitrary hierarchy iteratively; do not rely on recursive SQL/stack depth.

Different aggregate changes increment version once; exact desired-state replay may be a no-op before stale-version rejection where that endpoint supports it. Archive/delete and relationship APIs have their own exact preconditions; do not invent a universal base_version requirement for check-ins, invitation responses or preferences.

Files are written before metadata transactions with compensation on failure. Record deletion intent transactionally; perform actual byte deletion after commit. Provider calls do not belong inside write transactions.

## Archive versus deletion

Personal planning normally archives. Goal/Milestone include_contents is an explicit bulk archive. Retention archives history. Notes, attachments and Reviews have their documented deletion behavior. Never apply a SQL cascade or a cleanup procedure to compensate for unknown application behavior. Activity and Review facts survive normal planning archival.
