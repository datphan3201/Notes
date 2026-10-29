<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0022_create_user_backgrounds'; }

    public function up(PDO $pdo): void
    {
        // Personal backgrounds become a private per-account list; background_id
        // selects one of them, and NULL means the preset visual theme is shown.
        $pdo->exec(<<<'SQL'
CREATE TABLE user_backgrounds (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    path VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    UNIQUE KEY user_backgrounds_owner_id_unique (user_id, id),
    KEY user_backgrounds_owner_created_index (user_id, created_at, id),
    CONSTRAINT user_backgrounds_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec('ALTER TABLE user_preferences ADD COLUMN background_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER background_path, ADD CONSTRAINT user_preferences_background_fk FOREIGN KEY (user_id, background_id) REFERENCES user_backgrounds (user_id, id)');
        // Carry each existing single upload into the list and keep it selected.
        $pdo->exec('INSERT INTO user_backgrounds (id, user_id, path, created_at) SELECT LOWER(UUID()), user_id, background_path, updated_at FROM user_preferences WHERE background_path IS NOT NULL');
        $pdo->exec('UPDATE user_preferences preference JOIN user_backgrounds background ON background.user_id = preference.user_id AND background.path = preference.background_path SET preference.background_id = background.id, preference.background_path = NULL');
    }
};
