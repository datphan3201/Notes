<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Planning;

use PDO;

final readonly class PdoPlanningRepository
{
    private const TABLES = [
        'area' => 'areas',
        'goal' => 'goals',
        'milestone' => 'milestones',
        'task' => 'tasks',
        'checklist' => 'checklist_items',
    ];

    private const COLUMNS = [
        'area' => ['name', 'description', 'position'],
        'goal' => ['area_id', 'parent_goal_id', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'status', 'deadline', 'position', 'completed_at'],
        'milestone' => ['goal_id', 'name', 'description', 'completion_criteria', 'importance', 'status', 'deadline', 'position', 'completed_at'],
        'task' => ['goal_id', 'milestone_id', 'name', 'description', 'expected_result', 'completion_criteria', 'importance', 'status', 'start_date', 'deadline', 'scheduled_start', 'scheduled_end', 'position', 'completed_at'],
        'checklist' => ['task_id', 'title', 'checked', 'position', 'checked_at'],
    ];

    public function __construct(private PDO $pdo) {}

    public function lockOwner(int $userId): void
    {
        $statement = $this->pdo->prepare('SELECT id FROM users WHERE id = :id FOR UPDATE');
        $statement->execute(['id' => $userId]);

        if ($statement->fetchColumn() === false) {
            throw new \RuntimeException('Owner disappeared during planning mutation.');
        }
    }

    public function ownerTimezone(int $userId): string
    {
        $statement = $this->pdo->prepare('SELECT timezone FROM user_preferences WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
        $timezone = $statement->fetchColumn();

        return is_string($timezone) && $timezone !== '' ? $timezone : 'UTC';
    }

    /** @return list<array<string, mixed>> */
    public function list(string $type, int $userId, bool $includeArchived = false): array
    {
        $table = $this->table($type);
        $deletedColumn = $type === 'checklist' ? 'deleted_at' : 'archived_at';
        $where = $includeArchived ? '' : " AND $deletedColumn IS NULL";
        $statement = $this->pdo->prepare("SELECT * FROM $table WHERE user_id = :user_id$where ORDER BY position, id");
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(string $type, int $userId, string $id, bool $forUpdate = false, bool $includeArchived = false): ?array
    {
        $table = $this->table($type);
        $deletedColumn = $type === 'checklist' ? 'deleted_at' : 'archived_at';
        $active = $includeArchived ? '' : " AND $deletedColumn IS NULL";
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $statement = $this->pdo->prepare("SELECT * FROM $table WHERE user_id = :user_id AND id = :id$active LIMIT 1$lock");
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(string $type, int $userId, string $id, array $values, string $timestamp): array
    {
        $table = $this->table($type);
        $values = $this->allowedValues($type, $values);
        $columns = ['id', 'user_id', ...array_keys($values), 'created_at', 'updated_at'];
        $bindings = ['id' => $id, 'user_id' => $userId, ...$values, 'created_at' => $timestamp, 'updated_at' => $timestamp];
        $placeholders = array_map(static fn (string $column): string => ':'.$column, $columns);
        $statement = $this->pdo->prepare(
            "INSERT INTO $table (".implode(', ', $columns).') VALUES ('.implode(', ', $placeholders).')',
        );
        $statement->execute($bindings);

        return $this->find($type, $userId, $id, includeArchived: true)
            ?? throw new \RuntimeException('Created planning record could not be reloaded.');
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(string $type, int $userId, string $id, array $changes, string $timestamp): array
    {
        $table = $this->table($type);
        $changes = $this->allowedValues($type, $changes);
        $assignments = [];

        foreach (array_keys($changes) as $column) {
            $assignments[] = "$column = :$column";
        }

        $assignments[] = 'version = version + 1';
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare(
            "UPDATE $table SET ".implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id',
        );
        $statement->execute([...$changes, 'updated_at' => $timestamp, 'user_id' => $userId, 'id' => $id]);

        return $this->find($type, $userId, $id, includeArchived: true)
            ?? throw new \RuntimeException('Updated planning record could not be reloaded.');
    }

    /** @return array<string, mixed> */
    public function archive(string $type, int $userId, string $id, string $timestamp): array
    {
        $table = $this->table($type);
        $column = $type === 'checklist' ? 'deleted_at' : 'archived_at';
        $statement = $this->pdo->prepare(
            "UPDATE $table SET $column = :timestamp, version = version + 1, updated_at = :timestamp WHERE user_id = :user_id AND id = :id",
        );
        $statement->execute(['timestamp' => $timestamp, 'user_id' => $userId, 'id' => $id]);

        return $this->find($type, $userId, $id, includeArchived: true)
            ?? throw new \RuntimeException('Archived planning record could not be reloaded.');
    }

    public function activeCount(string $type, int $userId, string $foreignColumn, string $foreignId): int
    {
        $table = $this->table($type);

        if (!in_array($foreignColumn, self::COLUMNS[$type], true)) {
            throw new \LogicException('Unsafe planning foreign column.');
        }

        $deletedColumn = $type === 'checklist' ? 'deleted_at' : 'archived_at';
        $statement = $this->pdo->prepare(
            "SELECT COUNT(*) FROM $table WHERE user_id = :user_id AND $foreignColumn = :foreign_id AND $deletedColumn IS NULL",
        );
        $statement->execute(['user_id' => $userId, 'foreign_id' => $foreignId]);

        return (int) $statement->fetchColumn();
    }

    /** @return list<array{0: string, 1: string}> */
    public function goalHierarchyEdges(int $userId): array
    {
        return $this->pairs(
            'SELECT id, parent_goal_id FROM goals WHERE user_id = :user_id AND archived_at IS NULL AND parent_goal_id IS NOT NULL ORDER BY id',
            $userId,
        );
    }

    /** @return list<array<string, mixed>> */
    public function activeGoals(int $userId, bool $forUpdate = false): array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $statement = $this->pdo->prepare(
            'SELECT * FROM goals WHERE user_id = :user_id AND archived_at IS NULL ORDER BY id'.$lock,
        );
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @return list<array{0: string, 1: string}> */
    public function dependencyEdges(int $userId): array
    {
        return $this->pairs(
            'SELECT milestone_id, prerequisite_id FROM milestone_dependencies WHERE user_id = :user_id ORDER BY milestone_id, prerequisite_id',
            $userId,
        );
    }

    public function milestoneDependencyCount(int $userId, string $milestoneId): int
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT COUNT(*) FROM milestone_dependencies
WHERE user_id = :user_id AND (milestone_id = :milestone_id OR prerequisite_id = :milestone_id)
SQL);
        $statement->execute(['user_id' => $userId, 'milestone_id' => $milestoneId]);

        return (int) $statement->fetchColumn();
    }

    /** @return array{completed: int, total: int} */
    public function milestoneTaskProgress(int $userId, string $milestoneId): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT COUNT(*) AS total, COALESCE(SUM(status = 'Done'), 0) AS completed
FROM tasks
WHERE user_id = :user_id AND milestone_id = :milestone_id AND archived_at IS NULL AND series_id IS NULL
SQL);
        $statement->execute(['user_id' => $userId, 'milestone_id' => $milestoneId]);
        $row = $statement->fetch();

        return ['completed' => (int) $row['completed'], 'total' => (int) $row['total']];
    }

    /** @return list<array{0: string, 1: string}> */
    public function goalContributionEdges(int $userId): array
    {
        return $this->pairs(
            'SELECT source_goal_id, target_goal_id FROM goal_contributions WHERE user_id = :user_id ORDER BY source_goal_id, target_goal_id',
            $userId,
        );
    }

    public function edgeExists(string $table, int $userId, string $sourceColumn, string $sourceId, string $targetColumn, string $targetId): bool
    {
        $this->assertEdge($table, $sourceColumn, $targetColumn);
        $statement = $this->pdo->prepare(
            "SELECT 1 FROM $table WHERE user_id = :user_id AND $sourceColumn = :source AND $targetColumn = :target",
        );
        $statement->execute(['user_id' => $userId, 'source' => $sourceId, 'target' => $targetId]);

        return $statement->fetchColumn() !== false;
    }

    public function addEdge(string $table, int $userId, string $sourceColumn, string $sourceId, string $targetColumn, string $targetId, string $timestamp): void
    {
        $this->assertEdge($table, $sourceColumn, $targetColumn);
        $statement = $this->pdo->prepare(
            "INSERT INTO $table (user_id, $sourceColumn, $targetColumn, created_at) VALUES (:user_id, :source, :target, :created_at)",
        );
        $statement->execute(['user_id' => $userId, 'source' => $sourceId, 'target' => $targetId, 'created_at' => $timestamp]);
    }

    public function removeEdge(string $table, int $userId, string $sourceColumn, string $sourceId, string $targetColumn, string $targetId): void
    {
        $this->assertEdge($table, $sourceColumn, $targetColumn);
        $statement = $this->pdo->prepare(
            "DELETE FROM $table WHERE user_id = :user_id AND $sourceColumn = :source AND $targetColumn = :target",
        );
        $statement->execute(['user_id' => $userId, 'source' => $sourceId, 'target' => $targetId]);
    }

    /** @return list<array<string, mixed>> */
    public function prerequisites(int $userId, string $milestoneId, bool $forUpdate = false): array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $statement = $this->pdo->prepare(<<<SQL
SELECT prerequisite.* FROM milestone_dependencies dependency
JOIN milestones prerequisite ON prerequisite.user_id = dependency.user_id AND prerequisite.id = dependency.prerequisite_id
WHERE dependency.user_id = :user_id AND dependency.milestone_id = :milestone_id AND prerequisite.archived_at IS NULL
ORDER BY prerequisite.id$lock
SQL);
        $statement->execute(['user_id' => $userId, 'milestone_id' => $milestoneId]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function completedDependents(int $userId, string $prerequisiteId, bool $forUpdate = false): array
    {
        $lock = $forUpdate ? ' FOR UPDATE' : '';
        $statement = $this->pdo->prepare(<<<SQL
SELECT dependent.* FROM milestone_dependencies dependency
JOIN milestones dependent ON dependent.user_id = dependency.user_id AND dependent.id = dependency.milestone_id
WHERE dependency.user_id = :user_id AND dependency.prerequisite_id = :prerequisite_id
  AND dependent.archived_at IS NULL AND dependent.status = 'Completed'
ORDER BY dependent.id$lock
SQL);
        $statement->execute(['user_id' => $userId, 'prerequisite_id' => $prerequisiteId]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function contributionGoals(string $sourceType, int $userId, string $sourceId): array
    {
        [$table, $sourceColumn] = match ($sourceType) {
            'goal' => ['goal_contributions', 'source_goal_id'],
            'milestone' => ['milestone_contributions', 'milestone_id'],
            'task' => ['task_contributions', 'task_id'],
            default => throw new \LogicException('Unsupported contribution source.'),
        };
        $targetColumn = $sourceType === 'goal' ? 'target_goal_id' : 'goal_id';
        $statement = $this->pdo->prepare(<<<SQL
SELECT goal.* FROM $table edge
JOIN goals goal ON goal.user_id = edge.user_id AND goal.id = edge.$targetColumn
WHERE edge.user_id = :user_id AND edge.$sourceColumn = :source_id
  AND goal.archived_at IS NULL
ORDER BY goal.id
SQL);
        $statement->execute(['user_id' => $userId, 'source_id' => $sourceId]);

        return $statement->fetchAll();
    }

    /** @param list<int> $tagIds @return list<int> */
    public function lockOwnedTagIds(int $userId, array $tagIds): array
    {
        if ($tagIds === []) {
            return [];
        }

        sort($tagIds, SORT_NUMERIC);
        $placeholders = implode(', ', array_fill(0, count($tagIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id FROM labels WHERE user_id = ? AND archived_at IS NULL AND id IN ($placeholders) ORDER BY id FOR UPDATE",
        );
        $statement->execute([$userId, ...$tagIds]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return list<int> */
    public function tagIds(string $type, int $userId, string $id): array
    {
        [$table, $idColumn] = match ($type) {
            'goal' => ['goal_tags', 'goal_id'],
            'milestone' => ['milestone_tags', 'milestone_id'],
            'task' => ['task_tags', 'task_id'],
            default => throw new \LogicException('Unsupported tagged resource.'),
        };
        $statement = $this->pdo->prepare(<<<SQL
SELECT edge.tag_id FROM $table edge
JOIN labels tag ON tag.user_id = edge.user_id AND tag.id = edge.tag_id
WHERE edge.user_id = :user_id AND edge.$idColumn = :id AND tag.archived_at IS NULL
ORDER BY edge.tag_id
SQL);
        $statement->execute(['user_id' => $userId, 'id' => $id]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @param list<int> $tagIds */
    public function syncTags(string $type, int $userId, string $id, array $tagIds): void
    {
        [$table, $idColumn] = match ($type) {
            'goal' => ['goal_tags', 'goal_id'],
            'milestone' => ['milestone_tags', 'milestone_id'],
            'task' => ['task_tags', 'task_id'],
            default => throw new \LogicException('Unsupported tagged resource.'),
        };
        $delete = $this->pdo->prepare("DELETE FROM $table WHERE user_id = :user_id AND $idColumn = :id");
        $delete->execute(['user_id' => $userId, 'id' => $id]);
        $insert = $this->pdo->prepare(
            "INSERT INTO $table (user_id, $idColumn, tag_id) VALUES (:user_id, :id, :tag_id)",
        );

        foreach ($tagIds as $tagId) {
            $insert->execute(['user_id' => $userId, 'id' => $id, 'tag_id' => $tagId]);
        }
    }

    /** @return list<int> */
    public function usersWithoutAreas(): array
    {
        return array_map('intval', $this->pdo->query(<<<'SQL'
SELECT user.id FROM users user
LEFT JOIN areas area ON area.user_id = user.id
GROUP BY user.id
HAVING COUNT(area.id) = 0
ORDER BY user.id
SQL)->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return array{goals: list<array<string, mixed>>, milestones: list<array<string, mixed>>, tasks: list<array<string, mixed>>} */
    public function progressRows(int $userId): array
    {
        return [
            'goals' => $this->queryAll('SELECT id, parent_goal_id, status FROM goals WHERE user_id = :user_id AND archived_at IS NULL ORDER BY id', $userId),
            'milestones' => $this->queryAll('SELECT goal_id, status FROM milestones WHERE user_id = :user_id AND archived_at IS NULL ORDER BY id', $userId),
            'tasks' => $this->queryAll('SELECT goal_id, status FROM tasks WHERE user_id = :user_id AND archived_at IS NULL AND series_id IS NULL AND goal_id IS NOT NULL ORDER BY id', $userId),
        ];
    }

    public function linkOccurrence(int $userId, string $taskId, string $seriesId, string $date, string $timezone): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE tasks SET series_id = :series_id, occurrence_date = :occurrence_date, occurrence_timezone = :occurrence_timezone
WHERE user_id = :user_id AND id = :task_id AND series_id IS NULL
SQL);
        $statement->execute([
            'series_id' => $seriesId,
            'occurrence_date' => $date,
            'occurrence_timezone' => $timezone,
            'user_id' => $userId,
            'task_id' => $taskId,
        ]);
    }

    /** @return array<string, mixed>|null */
    public function taskNote(int $userId, string $taskId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM task_notes WHERE user_id = :user_id AND task_id = :task_id');
        $statement->execute(['user_id' => $userId, 'task_id' => $taskId]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return array<string, mixed> */
    public function saveTaskNote(int $userId, string $taskId, string $body, ?int $baseVersion, string $timestamp): array
    {
        $current = $this->taskNote($userId, $taskId);

        if ($current === null) {
            $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO task_notes (task_id, user_id, body, version, created_at, updated_at)
VALUES (:task_id, :user_id, :body, 1, :created_at, :updated_at)
SQL);
            $statement->execute(['task_id' => $taskId, 'user_id' => $userId, 'body' => $body, 'created_at' => $timestamp, 'updated_at' => $timestamp]);
        } else {
            if ($baseVersion !== (int) $current['version']) {
                throw new \Planner\Http\HttpException(409, 'VERSION_CONFLICT', 'The Task note has changed.', payload: ['current' => $current]);
            }

            $statement = $this->pdo->prepare('UPDATE task_notes SET body = :body, version = version + 1, updated_at = :updated_at WHERE user_id = :user_id AND task_id = :task_id');
            $statement->execute(['body' => $body, 'updated_at' => $timestamp, 'user_id' => $userId, 'task_id' => $taskId]);
        }

        return $this->taskNote($userId, $taskId) ?? throw new \RuntimeException('Task Note could not be reloaded.');
    }

    /** @param list<array{id: string, name: string, position: int}> $areas */
    public function insertDefaultAreas(int $userId, array $areas, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO areas (id, user_id, name, description, position, created_at, updated_at)
VALUES (:id, :user_id, :name, '', :position, :created_at, :updated_at)
SQL);

        foreach ($areas as $area) {
            $statement->execute([
                'id' => $area['id'], 'user_id' => $userId, 'name' => $area['name'], 'position' => $area['position'],
                'created_at' => $timestamp, 'updated_at' => $timestamp,
            ]);
        }
    }

    /** @return list<array{0: string, 1: string}> */
    private function pairs(string $sql, int $userId): array
    {
        $rows = $this->queryAll($sql, $userId);

        return array_map(static fn (array $row): array => [(string) array_values($row)[0], (string) array_values($row)[1]], $rows);
    }

    /** @return list<array<string, mixed>> */
    private function queryAll(string $sql, int $userId): array
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    private function allowedValues(string $type, array $values): array
    {
        $allowed = self::COLUMNS[$type] ?? throw new \LogicException('Unknown planning resource type.');

        if (array_diff(array_keys($values), $allowed) !== []) {
            throw new \LogicException('Unsafe planning persistence column.');
        }

        return $values;
    }

    private function table(string $type): string
    {
        return self::TABLES[$type] ?? throw new \LogicException('Unknown planning resource type.');
    }

    private function assertEdge(string $table, string $source, string $target): void
    {
        $allowed = [
            'milestone_dependencies' => ['milestone_id', 'prerequisite_id'],
            'goal_contributions' => ['source_goal_id', 'target_goal_id'],
            'milestone_contributions' => ['milestone_id', 'goal_id'],
            'task_contributions' => ['task_id', 'goal_id'],
        ];

        if (($allowed[$table] ?? null) !== [$source, $target]) {
            throw new \LogicException('Unsafe planning edge definition.');
        }
    }
}
