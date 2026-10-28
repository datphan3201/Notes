<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

final readonly class PdoSystemSettingRepository
{
    public const HISTORY_LIMIT = 'history_limit';
    public const HISTORY_LIMIT_DEFAULT = 1000;

    public function __construct(private PDO $pdo)
    {
    }

    public function historyLimit(): int
    {
        $statement = $this->pdo->prepare('SELECT value FROM system_settings WHERE name = :name');
        $statement->execute(['name' => self::HISTORY_LIMIT]);
        $value = $statement->fetchColumn();

        return is_string($value) ? (int) $value : self::HISTORY_LIMIT_DEFAULT;
    }

    public function setHistoryLimit(int $limit, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO system_settings (name, value, updated_at) VALUES (:name, :value, :now) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)');
        $statement->execute(['name' => self::HISTORY_LIMIT, 'value' => (string) $limit, 'now' => $now]);
    }
}
