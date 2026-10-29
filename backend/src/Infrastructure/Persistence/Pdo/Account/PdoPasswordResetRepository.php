<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;

final readonly class PdoPasswordResetRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function replace(int $userId, string $hash, int $authVersion, string $expires, string $created): void
    {
        $statement = $this->pdo->prepare('INSERT INTO password_resets (user_id, token_hash, expires_at, auth_version, created_at) VALUES (:user, :hash, :expires, :version, :created) ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), expires_at = VALUES(expires_at), auth_version = VALUES(auth_version), created_at = VALUES(created_at)');
        $statement->execute(['user' => $userId, 'hash' => $hash, 'expires' => $expires, 'version' => $authVersion, 'created' => $created]);
    }

    /** @return array{token_hash:string,expires_at:string,auth_version:int}|null */
    public function lock(int $userId): ?array
    {
        $statement = $this->pdo->prepare('SELECT token_hash, expires_at, auth_version FROM password_resets WHERE user_id = :user FOR UPDATE');
        $statement->execute(['user' => $userId]);
        $row = $statement->fetch();
        return is_array($row) ? ['token_hash' => (string) $row['token_hash'], 'expires_at' => (string) $row['expires_at'], 'auth_version' => (int) $row['auth_version']] : null;
    }

    public function delete(int $userId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM password_resets WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
    }
}
