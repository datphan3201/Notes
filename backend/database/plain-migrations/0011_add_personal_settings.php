<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration {
    public function name(): string { return '0011_add_personal_settings'; }

    public function up(PDO $pdo): void
    {
        $pdo->exec("ALTER TABLE users ADD COLUMN biography TEXT NULL AFTER display_name");
        $pdo->exec("ALTER TABLE user_preferences ADD COLUMN background_color VARCHAR(7) NOT NULL DEFAULT '', ADD COLUMN notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN email_notifications BOOLEAN NOT NULL DEFAULT FALSE");
    }
};
