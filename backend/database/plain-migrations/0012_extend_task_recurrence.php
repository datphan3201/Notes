<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0012_extend_task_recurrence'; }
    public function up(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE task_series DROP CHECK task_series_frequency_check, DROP CHECK task_series_weekday_check, ADD CONSTRAINT task_series_frequency_check CHECK (frequency IN ('daily', 'weekly', 'monthly', 'yearly')), ADD CONSTRAINT task_series_weekday_check CHECK ((frequency IN ('daily', 'monthly', 'yearly') AND weekday_mask = 0) OR (frequency = 'weekly' AND weekday_mask BETWEEN 1 AND 127))");
    }
};
