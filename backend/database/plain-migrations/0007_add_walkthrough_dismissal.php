<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0007_add_walkthrough_dismissal';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec('ALTER TABLE user_preferences ADD COLUMN walkthrough_dismissed_at DATETIME(6) NULL DEFAULT NULL');
    }
};
