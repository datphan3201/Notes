<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0018_add_two_factor'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE users ADD COLUMN two_factor_method VARCHAR(5) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER locked_reason, ADD COLUMN two_factor_secret VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER two_factor_method, ADD CONSTRAINT users_two_factor_check CHECK (two_factor_method IS NULL OR two_factor_method IN ('email', 'totp'))");
        $pdo->exec(<<<'SQL'
CREATE TABLE two_factor_codes (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    CONSTRAINT two_factor_codes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
