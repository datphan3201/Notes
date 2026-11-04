<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

/** Emails an administrator allowed to register while registration is invitation-only. */
final readonly class PdoRegistrationInviteRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @return list<array<string, mixed>> */
    public function list(): array
    {
        return $this->pdo->query('SELECT i.*, u.display_name AS used_by_name FROM registration_invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY (i.used_at IS NULL) DESC, i.created_at DESC, i.email LIMIT 500')->fetchAll();
    }

    /** @return array<string, mixed>|null */
    public function find(string $email, bool $forUpdate = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM registration_invites WHERE email = :email'.($forUpdate ? ' FOR UPDATE' : ''));
        $statement->execute(['email' => $email]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /** Returns false when the email was already invited. */
    public function add(string $email, int $createdBy, string $now): bool
    {
        $statement = $this->pdo->prepare('INSERT IGNORE INTO registration_invites (email, created_by, created_at) VALUES (:email, :creator, :now)');
        $statement->execute(['email' => $email, 'creator' => $createdBy, 'now' => $now]);

        return $statement->rowCount() === 1;
    }

    public function remove(string $email): bool
    {
        $statement = $this->pdo->prepare('DELETE FROM registration_invites WHERE email = :email');
        $statement->execute(['email' => $email]);

        return $statement->rowCount() === 1;
    }

    public function markUsed(string $email, int $userId, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE registration_invites SET used_by = :user, used_at = :now WHERE email = :email');
        $statement->execute(['user' => $userId, 'now' => $now, 'email' => $email]);
    }
}
