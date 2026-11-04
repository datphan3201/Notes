<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;

final readonly class PdoPasswordResetRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function replace(int $userId, string $hash, int $authVersion, string $expires, string $created, ?string $otpHash = null): void
    {
        $statement = $this->pdo->prepare('INSERT INTO password_resets (user_id, token_hash, otp_hash, otp_attempts, expires_at, auth_version, created_at) VALUES (:user, :hash, :otp, 0, :expires, :version, :created) ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), otp_hash = VALUES(otp_hash), otp_attempts = 0, expires_at = VALUES(expires_at), auth_version = VALUES(auth_version), created_at = VALUES(created_at)');
        $statement->execute(['user' => $userId, 'hash' => $hash, 'otp' => $otpHash, 'expires' => $expires, 'version' => $authVersion, 'created' => $created]);
    }

    /** @return array{token_hash:string,otp_hash:?string,otp_attempts:int,expires_at:string,auth_version:int}|null */
    public function lock(int $userId): ?array
    {
        $statement = $this->pdo->prepare('SELECT token_hash, otp_hash, otp_attempts, expires_at, auth_version FROM password_resets WHERE user_id = :user FOR UPDATE');
        $statement->execute(['user' => $userId]);
        $row = $statement->fetch();
        return is_array($row) ? [
            'token_hash' => (string) $row['token_hash'],
            'otp_hash' => $row['otp_hash'] === null ? null : (string) $row['otp_hash'],
            'otp_attempts' => (int) $row['otp_attempts'],
            'expires_at' => (string) $row['expires_at'],
            'auth_version' => (int) $row['auth_version'],
        ] : null;
    }

    public function recordOtpFailure(int $userId): void
    {
        $this->pdo->prepare('UPDATE password_resets SET otp_attempts = otp_attempts + 1 WHERE user_id = :user')->execute(['user' => $userId]);
    }

    /** A verified code is spent: it becomes a fresh one-time link token. */
    public function exchangeOtp(int $userId, string $tokenHash): void
    {
        $this->pdo->prepare('UPDATE password_resets SET token_hash = :hash, otp_hash = NULL, otp_attempts = 0 WHERE user_id = :user')->execute(['hash' => $tokenHash, 'user' => $userId]);
    }

    public function delete(int $userId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM password_resets WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
    }
}
