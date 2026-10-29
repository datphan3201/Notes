<?php

declare(strict_types=1);
use Planner\Infrastructure\Database\Migration;
return new class implements Migration {
    public function name(): string { return '0013_add_background_upload'; }
    public function up(PDO $pdo): void { $pdo->exec('ALTER TABLE user_preferences ADD COLUMN background_path VARCHAR(255) NULL'); }
};
