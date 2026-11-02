<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0026_add_dashboard_roadmap_preference';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
ALTER TABLE user_preferences
    ADD COLUMN dashboard_roadmap_goal_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    ADD CONSTRAINT preferences_dashboard_roadmap_fk
        FOREIGN KEY (user_id, dashboard_roadmap_goal_id) REFERENCES goals (user_id, id) ON DELETE RESTRICT
SQL);
    }
};
