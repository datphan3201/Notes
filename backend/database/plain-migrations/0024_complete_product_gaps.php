<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0024_complete_product_gaps'; }

    public function up(PDO $pdo): void
    {
        // In-app reminders are dismissed independently of the email copy.
        $pdo->exec('ALTER TABLE tasks ADD COLUMN reminder_read_at DATETIME(6) NULL AFTER reminder_sent_at');
        $pdo->exec('ALTER TABLE team_tasks ADD COLUMN reminder_read_at DATETIME(6) NULL AFTER reminder_at');
        // Each generated occurrence of a repeating Task gets a reminder at this local time.
        $pdo->exec('ALTER TABLE task_series ADD COLUMN reminder_time TIME NULL AFTER local_time');
        // One pending email verification and one pending email change per account.
        $pdo->exec(<<<'SQL'
CREATE TABLE email_tokens (
    user_id BIGINT UNSIGNED NOT NULL,
    purpose VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    email VARCHAR(254) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, purpose),
    UNIQUE KEY email_tokens_hash_unique (token_hash),
    CONSTRAINT email_tokens_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT email_tokens_purpose_check CHECK (purpose IN ('verify', 'change'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
        // Last run of each periodic job, shared by `schedule:run` and `schedule:work`.
        $pdo->exec(<<<'SQL'
CREATE TABLE scheduled_jobs (
    name VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    last_run_at DATETIME(6) NULL,
    last_status VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
