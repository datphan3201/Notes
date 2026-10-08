<?php

declare(strict_types=1);

use Planner\Infrastructure\Database\Migration;

return new class implements Migration
{
    public function name(): string
    {
        return '0008_add_interface_preferences';
    }

    public function up(PDO $pdo): void
    {
        $pdo->exec(<<<'SQL'
ALTER TABLE user_preferences
ADD COLUMN visual_theme VARCHAR(20) NOT NULL DEFAULT 'mountain',
ADD COLUMN show_background BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN show_illustrations BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN show_quote BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN custom_quote VARCHAR(500) NOT NULL DEFAULT '',
ADD CONSTRAINT preferences_visual_theme_check CHECK (visual_theme IN ('mountain', 'forest', 'ocean', 'pisces', 'stars')),
ADD CONSTRAINT preferences_visual_flags_check CHECK (show_background IN (0,1) AND show_illustrations IN (0,1) AND show_quote IN (0,1))
SQL);
    }
};
