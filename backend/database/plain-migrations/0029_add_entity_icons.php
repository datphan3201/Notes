<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0029_add_entity_icons';
    }

    public function up(PDO $pdo): void
    {
        // Optional user-chosen icon and accent; NULL keeps the automatic default. Values are
        // validated against Planner\Domain\Planning\EntityIcon so the catalog can grow freely.
        foreach (['areas', 'goals', 'milestones', 'habits'] as $table) {
            $pdo->exec("ALTER TABLE $table ADD COLUMN icon VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NULL, ADD COLUMN icon_color VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NULL");
        }
        // Importance now exists at every planning level, Areas included (1-5 stars, default 3).
        $pdo->exec('ALTER TABLE areas ADD COLUMN importance TINYINT UNSIGNED NOT NULL DEFAULT 3, ADD CONSTRAINT areas_importance_check CHECK (importance BETWEEN 1 AND 5)');
    }
};
