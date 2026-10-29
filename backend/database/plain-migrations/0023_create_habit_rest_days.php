<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0023_create_habit_rest_days'; }

    public function up(PDO $pdo): void
    {
        // A planned Rest Day protects one Habit's streak on that local date
        // without counting as a completion.
        $pdo->exec(<<<'SQL'
CREATE TABLE habit_rest_days (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    habit_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    local_date DATE NOT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY habit_rest_days_owner_id_unique (user_id, id),
    UNIQUE KEY habit_rest_days_habit_date_unique (user_id, habit_id, local_date),
    CONSTRAINT habit_rest_days_habit_fk FOREIGN KEY (user_id, habit_id) REFERENCES habits (user_id, id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
