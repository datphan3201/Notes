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

    /**
     * Due reminders still waiting in the in-app bell. Reading or dismissing a
     * reminder hides it; the email copy is tracked separately.
     *
     * @return list<array<string,mixed>>
     */
    public function due(int $userId, string $now): array
    {
        $statement = $this->pdo->prepare("SELECT id, name, reminder_at FROM tasks WHERE user_id = :user AND reminder_at <= :now AND reminder_read_at IS NULL AND archived_at IS NULL AND status <> 'Done' ORDER BY reminder_at, id LIMIT 100");
        $statement->execute(['user' => $userId, 'now' => $now]);
        return $statement->fetchAll();
    }

    /** @return list<array<string,mixed>> */
    public function dueForEmail(int $userId, string $now): array
    {
        $statement = $this->pdo->prepare("SELECT id, name, reminder_at FROM tasks WHERE user_id = :user AND reminder_at <= :now AND reminder_sent_at IS NULL AND archived_at IS NULL AND status <> 'Done' ORDER BY id LIMIT 100 FOR UPDATE");
        $statement->execute(['user' => $userId, 'now' => $now]);
        return $statement->fetchAll();
    }

    /**
     * Due team-task reminders for tasks assigned to the user in teams they joined.
     *
     * @return list<array<string,mixed>>
     */
    public function teamDue(int $userId, string $now): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT task.id, task.name, task.reminder_at, task.team_goal_id
FROM team_tasks task
JOIN team_members member ON member.team_goal_id = task.team_goal_id AND member.user_id = task.assignee_id AND member.status = 'accepted'
JOIN team_goals goal ON goal.id = task.team_goal_id AND goal.archived_at IS NULL
WHERE task.assignee_id = :user AND task.reminder_at <= :now AND task.reminder_read_at IS NULL AND task.archived_at IS NULL AND task.status <> 'done'
ORDER BY task.reminder_at, task.id LIMIT 100
SQL);
        $statement->execute(['user' => $userId, 'now' => $now]);
        return $statement->fetchAll();
    }

    public function sent(int $userId, string $taskId, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE tasks SET reminder_sent_at = :now WHERE user_id = :user AND id = :task');
        $statement->execute(['now' => $now, 'user' => $userId, 'task' => $taskId]);
    }

    /** Marks one due reminder (personal or assigned team task), or all of them, as read. */
    public function markRead(int $userId, ?string $taskId, string $now): void
    {
        $only = $taskId === null ? '' : ' AND id = :task';
        // Native prepares cannot reuse a named placeholder, so the time is bound twice.
        $bindings = ['read_at' => $now, 'now' => $now, 'user' => $userId, ...($taskId === null ? [] : ['task' => $taskId])];
        $this->pdo->prepare('UPDATE tasks SET reminder_read_at = :read_at WHERE user_id = :user AND reminder_at <= :now AND reminder_read_at IS NULL'.$only)
            ->execute($bindings);
        $this->pdo->prepare('UPDATE team_tasks SET reminder_read_at = :read_at WHERE assignee_id = :user AND reminder_at <= :now AND reminder_read_at IS NULL'.$only)
            ->execute($bindings);
    }
}
