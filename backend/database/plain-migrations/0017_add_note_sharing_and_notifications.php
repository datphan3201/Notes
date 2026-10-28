<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0017_add_note_sharing_and_notifications'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
CREATE TABLE note_shares (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    recipient_id BIGINT UNSIGNED NOT NULL,
    permission VARCHAR(4) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    status VARCHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'pending',
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY note_shares_note_recipient_unique (note_id, recipient_id),
    KEY note_shares_recipient_index (recipient_id, status, updated_at),
    CONSTRAINT note_shares_note_fk FOREIGN KEY (owner_id, note_id) REFERENCES notes (user_id, id) ON DELETE CASCADE,
    CONSTRAINT note_shares_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT note_shares_permission_check CHECK (permission IN ('view', 'edit')),
    CONSTRAINT note_shares_status_check CHECK (status IN ('pending', 'accepted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        $pdo->exec(<<<'SQL'
CREATE TABLE notifications (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    subject_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
    payload JSON NOT NULL,
    read_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL,
    KEY notifications_user_index (user_id, read_at, created_at),
    KEY notifications_subject_index (user_id, type, subject_id, read_at),
    CONSTRAINT notifications_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
