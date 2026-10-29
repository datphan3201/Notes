<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;

final readonly class PdoTwoFactorRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** Replaces any previous code so only the newest one is valid. */
    public function store(int $userId, string $hash, string $expiresAt, string $now): void
    {
        $statement = $this->pdo->prepare('REPLACE INTO two_factor_codes (user_id, code_hash, attempts, expires_at, created_at) VALUES (:user, :hash, 0, :expires, :now)');
        $statement->execute(['user' => $userId, 'hash' => $hash, 'expires' => $expiresAt, 'now' => $now]);
    }

    /** @return array{code_hash:string,attempts:int,expires_at:string}|null */
    public function find(int $userId): ?array
    {
        $statement = $this->pdo->prepare('SELECT code_hash, attempts, expires_at FROM two_factor_codes WHERE user_id = :user FOR UPDATE');
        $statement->execute(['user' => $userId]);
        $row = $statement->fetch();

        return is_array($row) ? ['code_hash' => (string) $row['code_hash'], 'attempts' => (int) $row['attempts'], 'expires_at' => (string) $row['expires_at']] : null;
    }

    public function failedAttempt(int $userId): void
    {
        $this->pdo->prepare('UPDATE two_factor_codes SET attempts = attempts + 1 WHERE user_id = :user')->execute(['user' => $userId]);
    }

    public function delete(int $userId): void
    {
        $this->pdo->prepare('DELETE FROM two_factor_codes WHERE user_id = :user')->execute(['user' => $userId]);
    }
}
