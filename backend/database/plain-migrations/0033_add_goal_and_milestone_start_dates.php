<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0033_add_goal_and_milestone_start_dates';
    }

    public function up(PDO $pdo): void
    {
        // Goals and Milestones get an optional start date so the Calendar's Gantt view can draw
        // them as bars from start to deadline; Tasks already have one.
        $pdo->exec('ALTER TABLE goals ADD COLUMN start_date DATE NULL AFTER status');
        $pdo->exec('ALTER TABLE milestones ADD COLUMN start_date DATE NULL AFTER status');
    }
};
