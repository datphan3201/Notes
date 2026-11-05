<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0030_add_system_admin_controls';
    }

    public function up(PDO $pdo): void
    {
        // Who locked an account; the lock reason already exists.
        $pdo->exec(<<<'SQL'
ALTER TABLE users
    ADD COLUMN locked_by BIGINT UNSIGNED NULL AFTER locked_reason,
    ADD CONSTRAINT users_locked_by_fk FOREIGN KEY (locked_by) REFERENCES users (id) ON DELETE SET NULL
SQL);
        // The actions an administrator actually took when resolving a report, so the
        // reporter's notification and the report history can say so truthfully.
        $pdo->exec('ALTER TABLE note_reports ADD COLUMN actions JSON NULL AFTER response');
        $pdo->exec('ALTER TABLE user_reports ADD COLUMN actions JSON NULL AFTER response');
        // Append-only record of administrator and console operator actions. actor_id is
        // NULL for the server console.
        $pdo->exec(<<<'SQL'
CREATE TABLE admin_actions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    actor_id BIGINT UNSIGNED NULL,
    action VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_type VARCHAR(20) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    KEY admin_actions_created_index (created_at, id),
    CONSTRAINT admin_actions_actor_fk FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        // Emails allowed to register while registration is invitation-only.
        $pdo->exec(<<<'SQL'
CREATE TABLE registration_invites (
    email VARCHAR(254) NOT NULL PRIMARY KEY,
    created_by BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    used_by BIGINT UNSIGNED NULL,
    used_at DATETIME(6) NULL,
    CONSTRAINT registration_invites_creator_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT registration_invites_user_fk FOREIGN KEY (used_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
