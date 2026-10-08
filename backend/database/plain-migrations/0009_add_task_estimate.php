<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0009_add_task_estimate';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
ALTER TABLE tasks ADD COLUMN estimated_minutes SMALLINT UNSIGNED NULL DEFAULT NULL,
ADD CONSTRAINT task_estimated_minutes_check CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 1440)
SQL);
    }
};
