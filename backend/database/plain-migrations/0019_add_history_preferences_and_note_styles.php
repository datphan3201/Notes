<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0019_add_history_preferences_and_note_styles'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec('ALTER TABLE user_preferences ADD COLUMN history_completed_hours SMALLINT UNSIGNED NOT NULL DEFAULT 24, ADD COLUMN history_overdue_days SMALLINT UNSIGNED NOT NULL DEFAULT 3, ADD COLUMN history_retention_days SMALLINT UNSIGNED NULL, ADD CONSTRAINT user_preferences_history_check CHECK (history_completed_hours BETWEEN 1 AND 720 AND history_overdue_days BETWEEN 1 AND 365 AND (history_retention_days IS NULL OR history_retention_days BETWEEN 1 AND 3650))');
        // Preset names remain valid; any lowercase #rrggbb color is now allowed as well.
        $pdo->exec('ALTER TABLE notes DROP CHECK notes_color_check');
        $pdo->exec("ALTER TABLE notes ADD CONSTRAINT notes_color_check CHECK (color IN ('neutral', 'lemon', 'mint', 'sky', 'rose') OR REGEXP_LIKE(color, '^#[0-9a-f]{6}$', 'c')), ADD COLUMN background_attachment_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER color");
        $pdo->exec('ALTER TABLE user_preferences DROP CHECK user_preferences_color_check');
        $pdo->exec("ALTER TABLE user_preferences ADD CONSTRAINT user_preferences_color_check CHECK (default_note_color IN ('neutral', 'lemon', 'mint', 'sky', 'rose') OR REGEXP_LIKE(default_note_color, '^#[0-9a-f]{6}$', 'c'))");
    }
};
