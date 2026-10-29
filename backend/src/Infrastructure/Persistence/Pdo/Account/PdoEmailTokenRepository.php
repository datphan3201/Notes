<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;

/** Hashed single-use links for email verification ('verify') and email change ('change'). */
final readonly class PdoEmailTokenRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function replace(int $userId, string $purpose, string $hash, string $email, string $expires, string $created): void
    {
        $statement = $this->pdo->prepare('INSERT INTO email_tokens (user_id, purpose, token_hash, email, expires_at, created_at) VALUES (:user, :purpose, :hash, :email, :expires, :created) ON DUPLICATE KEY UPDATE token_hash = VALUES(token_hash), email = VALUES(email), expires_at = VALUES(expires_at), created_at = VALUES(created_at)');
        $statement->execute(['user' => $userId, 'purpose' => $purpose, 'hash' => $hash, 'email' => $email, 'expires' => $expires, 'created' => $created]);
    }

    /** @return array{user_id:int,purpose:string,email:string,expires_at:string}|null */
    public function findByHash(string $hash, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT user_id, purpose, email, expires_at FROM email_tokens WHERE token_hash = :hash'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['hash' => $hash]);
        $row = $statement->fetch();

        return is_array($row) ? ['user_id' => (int) $row['user_id'], 'purpose' => (string) $row['purpose'], 'email' => (string) $row['email'], 'expires_at' => (string) $row['expires_at']] : null;
    }

    public function pendingEmail(int $userId, string $purpose, string $now): ?string
    {
        $statement = $this->pdo->prepare('SELECT email FROM email_tokens WHERE user_id = :user AND purpose = :purpose AND expires_at > :now');
        $statement->execute(['user' => $userId, 'purpose' => $purpose, 'now' => $now]);
        $value = $statement->fetchColumn();

        return $value === false ? null : (string) $value;
    }

    public function delete(int $userId, string $purpose): void
    {
        $statement = $this->pdo->prepare('DELETE FROM email_tokens WHERE user_id = :user AND purpose = :purpose');
        $statement->execute(['user' => $userId, 'purpose' => $purpose]);
    }
}
