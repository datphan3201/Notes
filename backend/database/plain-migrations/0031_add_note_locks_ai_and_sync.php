<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0031_add_note_locks_ai_and_sync';
    }

    public function up(PDO $pdo): void
    {
        // A per-Note password: a bcrypt hash of a password that only this note uses. NULL means
        // unlocked. The hash never leaves the server; unlock grants live in the session.
        $pdo->exec(<<<'SQL'
ALTER TABLE notes
    ADD COLUMN lock_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER background_attachment_id,
    ADD COLUMN locked_at DATETIME(6) NULL AFTER lock_hash,
    ADD KEY notes_owner_sync_index (user_id, updated_at, id)
SQL);

        // The latest AI summary per Note. source_hash is the SHA-256 of the title and content it
        // summarized, so the UI can say when the text changed since (pinning or recoloring does not).
        $pdo->exec(<<<'SQL'
CREATE TABLE note_summaries (
    user_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    summary TEXT NOT NULL,
    source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    model VARCHAR(80) NOT NULL,
    generated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, note_id),
    CONSTRAINT note_summaries_note_fk FOREIGN KEY (user_id, note_id) REFERENCES notes (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);

        // Semantic retrieval for AI Q&A: one embedding per Note text (source_hash), packed as float32.
        $pdo->exec(<<<'SQL'
CREATE TABLE note_embeddings (
    user_id BIGINT UNSIGNED NOT NULL,
    note_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    source_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    model VARCHAR(80) NOT NULL,
    vector BLOB NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (user_id, note_id),
    CONSTRAINT note_embeddings_note_fk FOREIGN KEY (user_id, note_id) REFERENCES notes (user_id, id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
SQL);
    }
};
