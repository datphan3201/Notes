<?php

declare(strict_types=1);
use Planner\Infrastructure\Database\Migration;
return new class implements Migration {
    public function name(): string { return '0015_add_interface_locale'; }
    public function up(PDO $pdo): void { $pdo->exec("ALTER TABLE user_preferences ADD COLUMN locale VARCHAR(2) NOT NULL DEFAULT 'en', ADD CONSTRAINT user_preferences_locale_check CHECK (locale IN ('en', 'vi'))"); }
};
