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
    public function todayTasks(int $userId, string $today, string $utcStart, string $utcEnd, string $doneCutoff, string $overdueCutoff): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT task.*, (selected.task_id IS NOT NULL) AS selected_for_today
FROM tasks task
LEFT JOIN daily_task_selections selected ON selected.user_id = task.user_id AND selected.task_id = task.id AND selected.local_date = :selection_date
WHERE task.user_id = :user_id AND task.archived_at IS NULL
  AND (selected.task_id IS NOT NULL OR (
    (task.deadline = :deadline_today OR task.start_date = :start_today OR task.occurrence_date = :occurrence_today
      OR (task.scheduled_start < :utc_end AND COALESCE(task.scheduled_end, task.scheduled_start) >= :utc_start)
      OR (task.status <> 'Done' AND task.deadline < :overdue_today))
    AND ((task.status = 'Done' AND task.completed_at > :done_cutoff)
      OR (task.status <> 'Done' AND (task.deadline IS NULL OR task.deadline > :overdue_cutoff)))
  ))
ORDER BY (task.status = 'Done'), task.importance DESC, task.position, task.id
SQL);
        $statement->execute([
            'user_id' => $userId, 'selection_date' => $today, 'deadline_today' => $today,
            'start_today' => $today, 'occurrence_today' => $today, 'utc_start' => $utcStart,
            'utc_end' => $utcEnd, 'overdue_today' => $today, 'done_cutoff' => $doneCutoff,
            'overdue_cutoff' => $overdueCutoff,
        ]);

        return $statement->fetchAll();
    }

    /** @return list<array<string, mixed>> */
    public function overdueTasks(int $userId, string $today, string $overdueCutoff): array
    {
        $statement = $this->pdo->prepare("SELECT * FROM tasks WHERE user_id = :user_id AND archived_at IS NULL AND status <> 'Done' AND deadline < :today AND deadline > :cutoff ORDER BY deadline, importance DESC, id");
        $statement->execute(['user_id' => $userId, 'today' => $today, 'cutoff' => $overdueCutoff]);

        return $statement->fetchAll();
    }

    public function roadmapGoalId(int $userId): ?string
    {
        // Archived Goals are no longer offered, even when the stored preference remains.
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT goal.id FROM user_preferences preference
JOIN goals goal ON goal.user_id = preference.user_id AND goal.id = preference.dashboard_roadmap_goal_id
WHERE preference.user_id = :user_id AND goal.archived_at IS NULL
SQL);
        $statement->execute(['user_id' => $userId]);
        $id = $statement->fetchColumn();

        return is_string($id) ? $id : null;
    }

    public function setRoadmapGoal(int $userId, ?string $goalId, string $timestamp): void
    {
        $statement = $this->pdo->prepare('UPDATE user_preferences SET dashboard_roadmap_goal_id = :goal_id, updated_at = :updated_at WHERE user_id = :user_id AND NOT (dashboard_roadmap_goal_id <=> :existing_goal_id)');
        $statement->execute(['goal_id' => $goalId, 'updated_at' => $timestamp, 'user_id' => $userId, 'existing_goal_id' => $goalId]);
    }

    /** @return array{history_completed_hours:int,history_overdue_days:int} */
    public function historyThresholds(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT history_completed_hours, history_overdue_days FROM user_preferences WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch();

        return [
            'history_completed_hours' => (int) ($row['history_completed_hours'] ?? 24),
            'history_overdue_days' => (int) ($row['history_overdue_days'] ?? 3),
        ];
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

    /** @return list<array<string, mixed>> */
    public function dailySelections(int $userId, string $date): array
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT task.* FROM daily_task_selections selected
JOIN tasks task ON task.user_id = selected.user_id AND task.id = selected.task_id
WHERE selected.user_id = :user_id AND selected.local_date = :local_date AND task.archived_at IS NULL
ORDER BY selected.created_at, task.id
SQL);
        $statement->execute(['user_id' => $userId, 'local_date' => $date]);

        return $statement->fetchAll();
    }

    public function addDailySelection(int $userId, string $date, string $taskId, string $timestamp): void
    {
        // Owner locking serializes selection writes; duplicate desired state is a no-op.
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO daily_task_selections (user_id, local_date, task_id, created_at)
VALUES (:user_id, :local_date, :task_id, :created_at)
ON DUPLICATE KEY UPDATE task_id = daily_task_selections.task_id
SQL);
        $statement->execute(['user_id' => $userId, 'local_date' => $date, 'task_id' => $taskId, 'created_at' => $timestamp]);
    }

    public function removeDailySelection(int $userId, string $date, string $taskId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM daily_task_selections WHERE user_id = :user_id AND local_date = :local_date AND task_id = :task_id');
        $statement->execute(['user_id' => $userId, 'local_date' => $date, 'task_id' => $taskId]);
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
