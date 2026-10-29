<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0021_extend_team_tasks'; }

    public function up(PDO $pdo): void
    {
        // Team tasks capture the same planning fields as personal Tasks.
        $pdo->exec('ALTER TABLE team_tasks ADD COLUMN importance TINYINT UNSIGNED NOT NULL DEFAULT 3 AFTER description, ADD COLUMN start_date DATE NULL AFTER status, ADD COLUMN estimated_minutes SMALLINT UNSIGNED NULL AFTER due_date, ADD COLUMN reminder_at DATETIME(6) NULL AFTER estimated_minutes, ADD COLUMN repeat_rule JSON NULL AFTER reminder_at, ADD KEY team_tasks_reminder_index (assignee_id, reminder_at), ADD CONSTRAINT team_tasks_planning_check CHECK (importance BETWEEN 1 AND 5 AND (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 1440))');
    }
};
