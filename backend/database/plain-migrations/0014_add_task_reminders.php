<?php

declare(strict_types=1);
use Planner\Infrastructure\Database\Migration;
return new class implements Migration {
    public function name(): string { return '0014_add_task_reminders'; }
    public function up(PDO $pdo): void
    {
        $pdo->exec('ALTER TABLE tasks ADD COLUMN reminder_at DATETIME(6) NULL, ADD COLUMN reminder_sent_at DATETIME(6) NULL, ADD KEY tasks_reminders_index (reminder_at, reminder_sent_at, user_id)');
    }
};
