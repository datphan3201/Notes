<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

final readonly class PdoSystemSettingRepository
{
    public const HISTORY_LIMIT = 'history_limit';
    public const HISTORY_LIMIT_DEFAULT = 1000;
    public const REGISTRATION_MODE = 'registration_mode';
    /** open: anyone may register; invite: only invited emails; closed: nobody. */
    public const REGISTRATION_MODES = ['open', 'invite', 'closed'];
    public const REGISTRATION_MODE_DEFAULT = 'open';

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
        $this->set(self::HISTORY_LIMIT, (string) $limit, $now);
    }

    public function registrationMode(): string
    {
        $statement = $this->pdo->prepare('SELECT value FROM system_settings WHERE name = :name');
        $statement->execute(['name' => self::REGISTRATION_MODE]);
        $value = $statement->fetchColumn();

        return is_string($value) && in_array($value, self::REGISTRATION_MODES, true) ? $value : self::REGISTRATION_MODE_DEFAULT;
    }

    public function setRegistrationMode(string $mode, string $now): void
    {
        $this->set(self::REGISTRATION_MODE, $mode, $now);
    }

    private function set(string $name, string $value, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO system_settings (name, value, updated_at) VALUES (:name, :value, :now) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)');
        $statement->execute(['name' => $name, 'value' => $value, 'now' => $now]);
    }
}
