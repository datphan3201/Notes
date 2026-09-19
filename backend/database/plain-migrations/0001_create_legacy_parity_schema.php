<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0001_create_legacy_parity_schema';
    }

    public function up(PDO $pdo): void
    {
        $statements = [
            <<<'SQL'
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
    display_name VARCHAR(80) NOT NULL,
    email_verified_at DATETIME(6) NULL,
    password VARCHAR(255) NOT NULL,
    avatar_path VARCHAR(255) NULL,
    auth_version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY users_email_unique (email),
    CONSTRAINT users_auth_version_check CHECK (auth_version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS sessions (
    id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    payload MEDIUMBLOB NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    last_activity DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    KEY sessions_user_id_index (user_id),
    KEY sessions_expires_at_index (expires_at),
    CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    theme VARCHAR(8) NOT NULL DEFAULT 'light',
    note_font_size TINYINT UNSIGNED NOT NULL DEFAULT 16,
    default_note_color VARCHAR(16) NOT NULL DEFAULT 'neutral',
    notes_view VARCHAR(8) NOT NULL DEFAULT 'grid',
    timezone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'UTC',
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT user_preferences_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT user_preferences_theme_check CHECK (theme IN ('light', 'dark')),
    CONSTRAINT user_preferences_font_size_check CHECK (note_font_size IN (14, 16, 18)),
    CONSTRAINT user_preferences_color_check CHECK (default_note_color IN ('neutral', 'lemon', 'mint', 'sky', 'rose')),
    CONSTRAINT user_preferences_view_check CHECK (notes_view IN ('grid', 'list'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS notes (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    content MEDIUMTEXT NOT NULL,
    color VARCHAR(16) NOT NULL DEFAULT 'neutral',
    pinned_at DATETIME(6) NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    deleted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY notes_owner_id_unique (user_id, id),
    KEY notes_owner_order_index (user_id, deleted_at, pinned_at, updated_at, id),
    KEY notes_owner_updated_index (user_id, deleted_at, updated_at, id),
    CONSTRAINT notes_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT notes_version_check CHECK (version >= 1),
    CONSTRAINT notes_color_check CHECK (color IN ('neutral', 'lemon', 'mint', 'sky', 'rose'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS labels (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(40) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_ci NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY labels_owner_id_unique (user_id, id),
    UNIQUE KEY labels_owner_name_unique (user_id, name),
    KEY labels_owner_name_index (user_id, name, id),
    CONSTRAINT labels_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT labels_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS label_note (
    user_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    label_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (user_id, note_id, label_id),
    KEY label_note_label_index (user_id, label_id, note_id),
    CONSTRAINT label_note_note_fk FOREIGN KEY (user_id, note_id) REFERENCES notes (user_id, id) ON DELETE CASCADE,
    CONSTRAINT label_note_label_fk FOREIGN KEY (user_id, label_id) REFERENCES labels (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS attachments (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NULL,
    mime_type VARCHAR(127) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    kind VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL DEFAULT 0,
    sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    deleted_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY attachments_owner_id_unique (user_id, id),
    UNIQUE KEY attachments_path_unique (path),
    KEY attachments_note_index (user_id, note_id, deleted_at, created_at, id),
    CONSTRAINT attachments_note_fk FOREIGN KEY (user_id, note_id) REFERENCES notes (user_id, id) ON DELETE RESTRICT,
    CONSTRAINT attachments_kind_check CHECK (kind IN ('image', 'video', 'file'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS pending_file_deletions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    path VARCHAR(255) NOT NULL,
    attempts INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY pending_file_deletions_path_unique (path),
    KEY pending_file_deletions_attempts_index (attempts, created_at),
    CONSTRAINT pending_file_deletions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
            <<<'SQL'
CREATE TABLE IF NOT EXISTS rate_limit_buckets (
    bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    attempts INT UNSIGNED NOT NULL,
    window_started_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    KEY rate_limit_buckets_expires_at_index (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL,
        ];

        foreach ($statements as $statement) {
            $pdo->exec($statement);
        }
    }
};
