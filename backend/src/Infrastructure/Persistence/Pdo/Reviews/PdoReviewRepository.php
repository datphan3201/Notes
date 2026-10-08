<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Reviews;

use PDO;

final readonly class PdoReviewRepository
{
    public function __construct(private PDO $pdo) {}

    /** @return list<array<string, mixed>> */
    public function list(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM reviews WHERE user_id = :user_id ORDER BY period_start DESC, kind, id');
        $statement->execute(['user_id' => $userId]);
        return $statement->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(int $userId, string $id, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM reviews WHERE user_id = :user_id AND id = :id'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['user_id' => $userId, 'id' => $id]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    /** @param array<string, mixed> $values @return array<string, mixed> */
    public function insert(int $userId, string $id, array $values, string $timestamp): array
    {
        $columns = ['id', 'user_id', ...array_keys($values), 'created_at', 'updated_at'];
        $statement = $this->pdo->prepare('INSERT INTO reviews ('.implode(', ', $columns).') VALUES ('.implode(', ', array_map(static fn (string $column): string => ':'.$column, $columns)).')');
        $statement->execute(['id' => $id, 'user_id' => $userId, ...$values, 'created_at' => $timestamp, 'updated_at' => $timestamp]);
        return $this->find($userId, $id) ?? throw new \RuntimeException('Review could not be reloaded.');
    }

    /** @param array<string, mixed> $changes @return array<string, mixed> */
    public function update(int $userId, string $id, array $changes, string $timestamp): array
    {
        $assignments = array_map(static fn (string $column): string => "$column = :$column", array_keys($changes));
        $assignments[] = 'version = version + 1'; $assignments[] = 'updated_at = :updated_at';
        $statement = $this->pdo->prepare('UPDATE reviews SET '.implode(', ', $assignments).' WHERE user_id = :user_id AND id = :id');
        $statement->execute([...$changes, 'updated_at' => $timestamp, 'user_id' => $userId, 'id' => $id]);
        return $this->find($userId, $id) ?? throw new \RuntimeException('Review could not be reloaded.');
    }

    /** @return array<string, mixed> */
    public function facts(int $userId, string $from, string $to, string $kind = 'Daily'): array
    {
        $activity = $this->query(<<<'SQL'
SELECT completion.source_type, completion.source_id, completion.action, completion.effective_date, completion.occurred_at, completion.metadata
FROM activities completion
WHERE completion.user_id = :user_id AND completion.action = 'completed'
  AND completion.effective_date BETWEEN :from_date AND :to_date
  AND NOT EXISTS (SELECT 1 FROM activities reversal WHERE reversal.user_id = completion.user_id AND reversal.reversal_of_id = completion.id)
ORDER BY completion.effective_date, completion.occurred_at, completion.id
SQL, ['user_id' => $userId, 'from_date' => $from, 'to_date' => $to]);
        $overdue = $this->query("SELECT id, name, deadline, status FROM tasks WHERE user_id = :user_id AND archived_at IS NULL AND status <> 'Done' AND deadline <= :to_date ORDER BY deadline, id", ['user_id' => $userId, 'to_date' => $to]);
        $goals = $this->query('SELECT goal_id, local_date, progress, checksum FROM goal_daily_snapshots WHERE user_id = :user_id AND local_date BETWEEN :from_date AND :to_date ORDER BY local_date, goal_id', ['user_id' => $userId, 'from_date' => $from, 'to_date' => $to]);
        // A saved denominator describes state at capture, not retroactive state.
        $tasks = $this->query(<<<'SQL'
SELECT task.id, task.status FROM tasks task
WHERE task.user_id = :user_id AND task.archived_at IS NULL AND task.series_id IS NULL
AND (task.deadline BETWEEN :from_date AND :to_date OR (
    :is_weekly = 1 AND EXISTS (
        SELECT 1 FROM weekly_task_selections selection
        WHERE selection.user_id = task.user_id AND selection.task_id = task.id AND selection.week_start = :week_start
    )
))
SQL, ['user_id' => $userId, 'from_date' => $from, 'to_date' => $to, 'is_weekly' => $kind === 'Weekly' ? 1 : 0, 'week_start' => $from]);
        $start = new \DateTimeImmutable($from);
        $previousStart = match ($kind) {
            'Monthly' => $start->modify('first day of previous month'),
            'Weekly' => $start->modify('-7 days'),
            default => $start->modify('-1 day'),
        };
        $previousEnd = $start->modify('-1 day')->format('Y-m-d');
        $previous = $this->query(<<<'SQL'
SELECT COUNT(*) AS total FROM activities completion
WHERE completion.user_id = :user_id AND completion.action = 'completed'
AND completion.source_type IN ('task', 'checklist', 'habit', 'milestone')
AND completion.effective_date BETWEEN :from_date AND :to_date
AND NOT EXISTS (SELECT 1 FROM activities reversal WHERE reversal.user_id = completion.user_id AND reversal.reversal_of_id = completion.id)
SQL, ['user_id' => $userId, 'from_date' => $previousStart->format('Y-m-d'), 'to_date' => $previousEnd]);
        return ['activities' => $activity, 'overdue_tasks' => $overdue, 'goal_snapshots' => $goals,
            'task_summary' => ['total' => count($tasks), 'completed' => count(array_filter($tasks, static fn (array $task): bool => $task['status'] === 'Done'))],
            'previous_activity_count' => (int) $previous[0]['total']];
    }

    /** @return list<array{user_id:int,timezone:string}> */
    public function users(): array
    {
        return $this->pdo->query("SELECT user.id AS user_id, COALESCE(preference.timezone, 'UTC') AS timezone FROM users user LEFT JOIN user_preferences preference ON preference.user_id = user.id ORDER BY user.id")->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function goalSnapshot(int $userId, string $goalId, string $date): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM goal_daily_snapshots WHERE user_id = :user_id AND goal_id = :goal_id AND local_date = :local_date');
        $statement->execute(['user_id' => $userId, 'goal_id' => $goalId, 'local_date' => $date]);
        $row = $statement->fetch();
        return is_array($row) ? $row : null;
    }

    public function insertGoalSnapshot(string $id, int $userId, string $goalId, string $date, string $timezone, float $progress, string $checksum, string $capturedAt): void
    {
        $statement = $this->pdo->prepare('INSERT INTO goal_daily_snapshots (id, user_id, goal_id, local_date, timezone, progress, checksum, captured_at) VALUES (:id, :user_id, :goal_id, :local_date, :timezone, :progress, :checksum, :captured_at)');
        $statement->execute([
            'id' => $id, 'user_id' => $userId, 'goal_id' => $goalId,
            'local_date' => $date, 'timezone' => $timezone, 'progress' => $progress,
            'checksum' => $checksum, 'captured_at' => $capturedAt,
        ]);
    }

    /** @return list<array<string, mixed>> */
    private function query(string $sql, array $bindings): array
    {
        $statement = $this->pdo->prepare($sql); $statement->execute($bindings); return $statement->fetchAll();
    }
}
