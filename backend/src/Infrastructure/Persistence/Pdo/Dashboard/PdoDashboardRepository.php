<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Dashboard;

use PDO;

final readonly class PdoDashboardRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<array<string, mixed>> */
    public function activity(int $userId, string $from, string $to): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT completion.effective_date, completion.source_type, COUNT(*) AS count
FROM activities completion
WHERE completion.user_id = :user_id
  AND completion.action = 'completed'
  AND completion.source_type IN ('task', 'checklist', 'habit', 'milestone')
  AND completion.effective_date BETWEEN :from_date AND :to_date
  AND NOT EXISTS (
      SELECT 1 FROM activities reversal
      WHERE reversal.user_id = completion.user_id AND reversal.reversal_of_id = completion.id
  )
GROUP BY completion.effective_date, completion.source_type
ORDER BY completion.effective_date, completion.source_type
SQL);
        $statement->execute(['user_id' => $userId, 'from_date' => $from, 'to_date' => $to]);

        return $statement->fetchAll();
    }

    /** The earliest year with any activity or the account's creation year. */
    public function firstActivityYear(int $userId): ?int
    {
        $statement = $this->pdo->prepare('SELECT LEAST(COALESCE((SELECT YEAR(MIN(effective_date)) FROM activities WHERE user_id = :activity_user), 9999), (SELECT YEAR(created_at) FROM users WHERE id = :user))');
        $statement->execute(['activity_user' => $userId, 'user' => $userId]);
        $year = $statement->fetchColumn();

        return $year === false || $year === null ? null : (int) $year;
    }

    /** @return list<array<string, mixed>> */
    public function todayTasks(int $userId, string $today, string $utcStart, string $utcEnd): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT DISTINCT task.* FROM tasks task
WHERE task.user_id = :user_id AND task.archived_at IS NULL AND task.status <> 'Done'
  AND (task.deadline = :deadline_today OR task.start_date = :start_today OR task.occurrence_date = :occurrence_today
    OR (task.scheduled_start < :utc_end AND COALESCE(task.scheduled_end, task.scheduled_start) >= :utc_start))
ORDER BY COALESCE(task.scheduled_start, CONCAT(task.deadline, ' 23:59:59')), task.position, task.id
SQL);
        $statement->execute(['user_id' => $userId, 'deadline_today' => $today, 'start_today' => $today, 'occurrence_today' => $today, 'utc_start' => $utcStart, 'utc_end' => $utcEnd]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function overdueTasks(int $userId, string $today): array
    {
        $statement = $this->pdo->prepare("SELECT * FROM tasks WHERE user_id = :user_id AND archived_at IS NULL AND status <> 'Done' AND deadline < :today ORDER BY deadline, importance DESC, id");
        $statement->execute(['user_id' => $userId, 'today' => $today]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function selections(string $type, int $userId, string $weekStart): array
    {
        [$selection, $entity, $idColumn] = $this->selectionTables($type);
        $statement = $this->pdo->prepare("SELECT entity.*, selected.position AS selection_position FROM $selection selected JOIN $entity entity ON entity.user_id = selected.user_id AND entity.id = selected.$idColumn WHERE selected.user_id = :user_id AND selected.week_start = :week_start AND entity.archived_at IS NULL ORDER BY selected.position, entity.id");
        $statement->execute(['user_id' => $userId, 'week_start' => $weekStart]);

        return $statement->fetchAll();
    }

    public function selectionExists(string $type, int $userId, string $weekStart, string $id): bool
    {
        [$table, , $column] = $this->selectionTables($type);
        $statement = $this->pdo->prepare("SELECT 1 FROM $table WHERE user_id = :user_id AND week_start = :week_start AND $column = :id");
        $statement->execute(['user_id' => $userId, 'week_start' => $weekStart, 'id' => $id]);
        return $statement->fetchColumn() !== false;
    }

    public function addSelection(string $type, int $userId, string $weekStart, string $id, int $position, string $timestamp): void
    {
        [$table, , $column] = $this->selectionTables($type);
        $statement = $this->pdo->prepare("INSERT INTO $table (user_id, week_start, $column, position, created_at) VALUES (:user_id, :week_start, :id, :position, :created_at)");
        $statement->execute(['user_id' => $userId, 'week_start' => $weekStart, 'id' => $id, 'position' => $position, 'created_at' => $timestamp]);
    }

    public function removeSelection(string $type, int $userId, string $weekStart, string $id): void
    {
        [$table, , $column] = $this->selectionTables($type);
        $statement = $this->pdo->prepare("DELETE FROM $table WHERE user_id = :user_id AND week_start = :week_start AND $column = :id");
        $statement->execute(['user_id' => $userId, 'week_start' => $weekStart, 'id' => $id]);
    }

    /** @param list<string> $ids */
    public function reorderSelections(string $type, int $userId, string $weekStart, array $ids): void
    {
        [$table, , $column] = $this->selectionTables($type);
        $statement = $this->pdo->prepare("UPDATE $table SET position = :position WHERE user_id = :user_id AND week_start = :week_start AND $column = :id");
        foreach ($ids as $position => $id) {
            $statement->execute(['position' => $position, 'user_id' => $userId, 'week_start' => $weekStart, 'id' => $id]);
        }
    }

    /** @return array{0:string,1:string,2:string} */
    private function selectionTables(string $type): array
    {
        return match ($type) {
            'task' => ['weekly_task_selections', 'tasks', 'task_id'],
            'milestone' => ['weekly_milestone_selections', 'milestones', 'milestone_id'],
            default => throw new \LogicException('Unsupported weekly selection type.'),
        };
    }
}
