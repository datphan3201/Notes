<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Recurrence;

use PDO;

final readonly class PdoTaskSeriesRepository
{
    private const COLUMNS = [
        'goal_id', 'milestone_id', 'name', 'description', 'expected_result',
        'completion_criteria', 'importance', 'frequency', 'interval_count',
        'weekday_mask', 'start_date', 'end_date', 'timezone', 'local_time',
        'duration_minutes', 'deadline_offset_days', 'state', 'cursor_date',
        'paused_at', 'last_error_code',
    ];

    public function __construct(private PDO $pdo) {}

    /** @return list<array<string, mixed>> */
    public function list(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM task_series WHERE user_id = :user_id AND archived_at IS NULL ORDER BY created_at, id');
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $id, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM task_series WHERE user_id = :user_id AND id = :id AND archived_at IS NULL'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return list<array<string, mixed>> */
    public function active(): array
    {
        return $this->pdo->query("SELECT * FROM task_series WHERE state = 'Active' AND archived_at IS NULL ORDER BY id")->fetchAll();
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(int $userId, string $id, array $values, string $timestamp): array
    {
        $values = $this->safe($values);
        $columns = ['id', 'user_id', ...array_keys($values), 'created_at', 'updated_at'];
        $bindings = ['id' => $id, 'user_id' => $userId, ...$values, 'created_at' => $timestamp, 'updated_at' => $timestamp];
        $statement = $this->pdo->prepare('INSERT INTO task_series ('.implode(', ', $columns).') VALUES ('.implode(', ', array_map(static fn (string $column): string => ':'.$column, $columns)).')');
        $statement->execute($bindings);

        return $this->find($userId, $id) ?? throw new \RuntimeException('Created Task Series could not be reloaded.');
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(int $userId, string $id, array $changes, string $timestamp, bool $incrementVersion = true): array
    {
        $changes = $this->safe($changes);
        $assignments = array_map(static fn (string $column): string => "$column = :$column", array_keys($changes));
        if ($incrementVersion) {
            $assignments[] = 'version = version + 1';
        }
        $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare('UPDATE task_series SET '.implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id AND archived_at IS NULL');
        $statement->execute([...$changes, 'updated_at' => $timestamp, 'user_id' => $userId, 'id' => $id]);

        return $this->find($userId, $id) ?? throw new \RuntimeException('Updated Task Series could not be reloaded.');
    }

    public function occurrenceCount(int $userId, string $seriesId): int
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM tasks WHERE user_id = :user_id AND series_id = :series_id');
        $statement->execute(['user_id' => $userId, 'series_id' => $seriesId]);

        return (int) $statement->fetchColumn();
    }

    /** @return array<string, mixed>|null */
    public function occurrence(int $userId, string $seriesId, string $date): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM tasks WHERE user_id = :user_id AND series_id = :series_id AND occurrence_date = :occurrence_date');
        $statement->execute(['user_id' => $userId, 'series_id' => $seriesId, 'occurrence_date' => $date]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** @return list<array{id:string,title:string,position:int}> */
    public function checklistTemplate(int $userId, string $seriesId): array
    {
        $statement = $this->pdo->prepare('SELECT id, title, position FROM task_series_checklist_items WHERE user_id = :user_id AND series_id = :series_id ORDER BY position, id');
        $statement->execute(['user_id' => $userId, 'series_id' => $seriesId]);

        return $statement->fetchAll();
    }

    /** @param list<array{title:string,position:int}> $items */
    public function setChecklistTemplate(int $userId, string $seriesId, array $items, callable $newId): void
    {
        $delete = $this->pdo->prepare('DELETE FROM task_series_checklist_items WHERE user_id = :user_id AND series_id = :series_id');
        $delete->execute(['user_id' => $userId, 'series_id' => $seriesId]);
        $insert = $this->pdo->prepare('INSERT INTO task_series_checklist_items (id, user_id, series_id, title, position) VALUES (:id, :user_id, :series_id, :title, :position)');
        foreach ($items as $item) {
            $insert->execute(['id' => $newId(), 'user_id' => $userId, 'series_id' => $seriesId, ...$item]);
        }
    }

    /** @return list<int> */
    public function tagIds(int $userId, string $seriesId): array
    {
        $statement = $this->pdo->prepare('SELECT tag_id FROM task_series_tags WHERE user_id = :user_id AND series_id = :series_id ORDER BY tag_id');
        $statement->execute(['user_id' => $userId, 'series_id' => $seriesId]);

        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @param list<int> $tagIds */
    public function setTags(int $userId, string $seriesId, array $tagIds): void
    {
        $this->replaceIds('task_series_tags', 'tag_id', $userId, $seriesId, $tagIds);
    }

    /** @return list<string> */
    public function contributionIds(int $userId, string $seriesId): array
    {
        $statement = $this->pdo->prepare('SELECT goal_id FROM task_series_contributions WHERE user_id = :user_id AND series_id = :series_id ORDER BY goal_id');
        $statement->execute(['user_id' => $userId, 'series_id' => $seriesId]);

        return array_map('strval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @param list<string> $goalIds */
    public function setContributions(int $userId, string $seriesId, array $goalIds): void
    {
        $this->replaceIds('task_series_contributions', 'goal_id', $userId, $seriesId, $goalIds);
    }

    public function archiveFutureNotStarted(int $userId, string $seriesId, string $afterDate, string $timestamp): int
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE tasks SET archived_at = :archived_at, version = version + 1, updated_at = :updated_at
WHERE user_id = :user_id AND series_id = :series_id AND occurrence_date > :after_date
  AND status = 'NotStarted' AND archived_at IS NULL
SQL);
        $statement->execute([
            'archived_at' => $timestamp,
            'updated_at' => $timestamp,
            'user_id' => $userId,
            'series_id' => $seriesId,
            'after_date' => $afterDate,
        ]);

        return $statement->rowCount();
    }

    /** @param list<int|string> $ids */
    private function replaceIds(string $table, string $column, int $userId, string $seriesId, array $ids): void
    {
        $delete = $this->pdo->prepare("DELETE FROM $table WHERE user_id = :user_id AND series_id = :series_id");
        $delete->execute(['user_id' => $userId, 'series_id' => $seriesId]);
        $insert = $this->pdo->prepare("INSERT INTO $table (user_id, series_id, $column) VALUES (:user_id, :series_id, :value)");
        foreach ($ids as $id) {
            $insert->execute(['user_id' => $userId, 'series_id' => $seriesId, 'value' => $id]);
        }
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    private function safe(array $values): array
    {
        if (array_diff(array_keys($values), self::COLUMNS) !== []) {
            throw new \LogicException('Unsafe Task Series persistence column.');
        }

        return $values;
    }
}
