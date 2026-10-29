<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Planning;

use PDO;

final readonly class PdoTaskHistoryRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<array<string, mixed>> */
    public function preferences(): array
    {
        return $this->pdo->query('SELECT user_id, timezone, history_completed_hours, history_overdue_days, history_retention_days FROM user_preferences ORDER BY user_id')->fetchAll();
    }

    public function lockOwner(int $userId): void
    {
        $this->pdo->prepare('SELECT id FROM users WHERE id = :id FOR UPDATE')->execute(['id' => $userId]);
    }

    /**
     * History, newest first. A Task enters history at completion + threshold or
     * deadline + threshold.
     *
     * @return list<array<string, mixed>>
     */
    public function historyTasks(int $userId, string $doneCutoff, string $overdueCutoff): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT id, status, completed_at, deadline FROM tasks
WHERE user_id = :user AND archived_at IS NULL
  AND ((status = 'Done' AND completed_at <= :done_cutoff) OR (status <> 'Done' AND deadline <= :overdue_cutoff))
ORDER BY COALESCE(completed_at, CAST(deadline AS DATETIME(6))) DESC, id
FOR UPDATE
SQL);
        $statement->execute(['user' => $userId, 'done_cutoff' => $doneCutoff, 'overdue_cutoff' => $overdueCutoff]);

        return $statement->fetchAll();
    }

    /** @param list<string> $taskIds sorted ids */
    public function archive(int $userId, array $taskIds, string $now): void
    {
        $placeholders = implode(',', array_fill(0, count($taskIds), '?'));
        $this->pdo->prepare("UPDATE tasks SET archived_at = ?, version = version + 1, updated_at = ? WHERE user_id = ? AND id IN ($placeholders)")
            ->execute([$now, $now, $userId, ...$taskIds]);
    }
}
