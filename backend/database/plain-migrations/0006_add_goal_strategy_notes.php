<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0006_add_goal_strategy_notes';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE goals ADD COLUMN strategy_notes MEDIUMTEXT NOT NULL DEFAULT ('') AFTER completion_criteria");
    }
};
