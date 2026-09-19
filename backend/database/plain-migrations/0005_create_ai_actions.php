<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string { return '0005_create_ai_actions'; }
    public function up(PDO $pdo): void
    {
        $pdo->exec('ALTER TABLE user_preferences ADD COLUMN ai_consent_at DATETIME(6) NULL AFTER timezone');
        $pdo->exec(<<<'SQL'
CREATE TABLE ai_actions (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    capability VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'Proposed',
    provider VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    model VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    proposal MEDIUMTEXT NOT NULL,
    proposal_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    context_versions JSON NOT NULL,
    created_ids JSON NULL,
    expires_at DATETIME(6) NOT NULL,
    version INT UNSIGNED NOT NULL DEFAULT 1,
    safe_error_code VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY ai_actions_owner_id_unique (user_id, id),
    KEY ai_actions_owner_status_expiry_index (user_id, status, expires_at, id),
    CONSTRAINT ai_actions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT ai_actions_status_check CHECK (status IN ('Proposed', 'Applied', 'Rejected', 'Expired', 'Failed')),
    CONSTRAINT ai_actions_version_check CHECK (version >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
