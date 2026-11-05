<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string
    {
        return '0032_add_password_reset_codes';
    }

    public function up(PDO $pdo): void
    {
        // Password recovery by a 6-digit code as well as by link. Only a SHA-256 hash of the
        // code is stored; wrong guesses are counted so a code dies after a few attempts.
        $pdo->exec(<<<'SQL'
ALTER TABLE password_resets
    ADD COLUMN otp_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER token_hash,
    ADD COLUMN otp_attempts TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER otp_hash
SQL);
    }
};
