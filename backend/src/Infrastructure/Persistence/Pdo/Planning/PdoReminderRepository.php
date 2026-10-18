<?php

declare(strict_types=1);
namespace Planner\Infrastructure\Persistence\Pdo\Planning;
use PDO;

final readonly class PdoReminderRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<int> */
    public function owners(string $now): array
    {
        $statement = $this->pdo->prepare("SELECT DISTINCT t.user_id FROM tasks t JOIN user_preferences p ON p.user_id = t.user_id WHERE t.reminder_at <= :now AND t.reminder_sent_at IS NULL AND t.archived_at IS NULL AND t.status <> 'Done' AND p.notifications_enabled = 1 AND p.email_notifications = 1 ORDER BY t.user_id LIMIT 100");
        $statement->execute(['now' => $now]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return list<array<string,mixed>> */
    public function due(int $userId, string $now, bool $lock = false): array
    {
        $statement = $this->pdo->prepare("SELECT id, name, reminder_at FROM tasks WHERE user_id = :user AND reminder_at <= :now AND reminder_sent_at IS NULL AND archived_at IS NULL AND status <> 'Done' ORDER BY id LIMIT 100".($lock ? ' FOR UPDATE' : ''));
        $statement->execute(['user' => $userId, 'now' => $now]);
        return $statement->fetchAll();
    }

    public function sent(int $userId, string $taskId, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE tasks SET reminder_sent_at = :now WHERE user_id = :user AND id = :task');
        $statement->execute(['now' => $now, 'user' => $userId, 'task' => $taskId]);
    }
}
