<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0016_add_roles_and_reports'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE users ADD COLUMN role VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'user' AFTER auth_version, ADD COLUMN locked_at DATETIME(6) NULL AFTER role, ADD COLUMN locked_reason VARCHAR(500) NULL AFTER locked_at, ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))");
        $pdo->exec(<<<'SQL'
CREATE TABLE note_reports (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    reporter_id BIGINT UNSIGNED NOT NULL,
    note_owner_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    note_title VARCHAR(200) NOT NULL,
    note_excerpt TEXT NOT NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
    response VARCHAR(1000) NULL,
    resolved_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    resolved_at DATETIME(6) NULL,
    KEY note_reports_status_index (status, created_at, id),
    KEY note_reports_reporter_index (reporter_id, created_at),
    CONSTRAINT note_reports_reporter_fk FOREIGN KEY (reporter_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT note_reports_owner_fk FOREIGN KEY (note_owner_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT note_reports_resolver_fk FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT note_reports_status_check CHECK (status IN ('open', 'resolved', 'dismissed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE system_settings (
    name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    value VARCHAR(255) NOT NULL,
    updated_at DATETIME(6) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
