<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;
use Planner\Domain\Account\UserRecord;

final readonly class PdoAccountRepository
{
    public function __construct(private PDO $pdo) {}

    public function findByEmail(string $email): ?UserRecord
    {
        $statement = $this->pdo->prepare('SELECT * FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);

        return $this->hydrate($statement->fetch());
    }

    public function findById(int $userId, bool $forUpdate = false): ?UserRecord
    {
        $sql = 'SELECT * FROM users WHERE id = :id LIMIT 1'.($forUpdate ? ' FOR UPDATE' : '');
        $statement = $this->pdo->prepare($sql);
        $statement->execute(['id' => $userId]);

        return $this->hydrate($statement->fetch());
    }

    public function insertUser(string $email, string $displayName, string $passwordHash, string $timestamp): UserRecord
    {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO users (email, display_name, password, auth_version, created_at, updated_at)
VALUES (:email, :display_name, :password, 1, :created_at, :updated_at)
SQL);
        $statement->execute([
            'email' => $email,
            'display_name' => $displayName,
            'password' => $passwordHash,
            'created_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
        $userId = (int) $this->pdo->lastInsertId();

        $preferences = $this->pdo->prepare(<<<'SQL'
INSERT INTO user_preferences (user_id, created_at, updated_at)
VALUES (:user_id, :created_at, :updated_at)
SQL);
        $preferences->execute(['user_id' => $userId, 'created_at' => $timestamp, 'updated_at' => $timestamp]);

        return $this->findById($userId) ?? throw new \RuntimeException('Created user could not be reloaded.');
    }

    /** @return array{theme: string, note_font_size: int, default_note_color: string, notes_view: string, timezone: string} */
    public function preferences(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT theme, note_font_size, default_note_color, notes_view, timezone FROM user_preferences WHERE user_id = :user_id',
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch();

        if (! is_array($row)) {
            throw new \RuntimeException('User preferences are missing.');
        }

        return [
            'theme' => (string) $row['theme'],
            'note_font_size' => (int) $row['note_font_size'],
            'default_note_color' => (string) $row['default_note_color'],
            'notes_view' => (string) $row['notes_view'],
            'timezone' => (string) $row['timezone'],
        ];
    }

    public function updateDisplayName(int $userId, string $displayName, string $timestamp): UserRecord
    {
        $statement = $this->pdo->prepare(
            'UPDATE users SET display_name = :display_name, updated_at = :updated_at WHERE id = :id',
        );
        $statement->execute(['display_name' => $displayName, 'updated_at' => $timestamp, 'id' => $userId]);

        return $this->findById($userId) ?? throw new \RuntimeException('Updated user could not be reloaded.');
    }

    /** @param array<string, string|int> $changes */
    public function updatePreferences(int $userId, array $changes, string $timestamp): array
    {
        $allowed = ['theme', 'note_font_size', 'default_note_color', 'notes_view', 'timezone'];
        $assignments = [];
        $bindings = ['user_id' => $userId, 'updated_at' => $timestamp];

        foreach ($changes as $field => $value) {
            if (! in_array($field, $allowed, true)) {
                throw new \LogicException('Unexpected preference field.');
            }

            $assignments[] = "$field = :$field";
            $bindings[$field] = $value;
        }

        if ($assignments !== []) {
            $assignments[] = 'updated_at = :updated_at';
            $statement = $this->pdo->prepare(
                'UPDATE user_preferences SET '.implode(', ', $assignments).' WHERE user_id = :user_id',
            );
            $statement->execute($bindings);
        }

        return $this->preferences($userId);
    }

    public function updatePasswordAndVersion(int $userId, string $hash, int $authVersion, string $timestamp): void
    {
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE users SET password = :password, auth_version = :auth_version, updated_at = :updated_at WHERE id = :id
SQL);
        $statement->execute([
            'password' => $hash,
            'auth_version' => $authVersion,
            'updated_at' => $timestamp,
            'id' => $userId,
        ]);
    }

    public function updateAvatarPath(int $userId, ?string $path, string $timestamp): UserRecord
    {
        $statement = $this->pdo->prepare(
            'UPDATE users SET avatar_path = :avatar_path, updated_at = :updated_at WHERE id = :id',
        );
        $statement->execute(['avatar_path' => $path, 'updated_at' => $timestamp, 'id' => $userId]);

        return $this->findById($userId)
            ?? throw new \RuntimeException('Updated user could not be reloaded.');
    }

    /** @return list<string> */
    public function avatarPaths(): array
    {
        return array_values(array_map('strval', $this->pdo->query(
            'SELECT avatar_path FROM users WHERE avatar_path IS NOT NULL',
        )->fetchAll(PDO::FETCH_COLUMN)));
    }

    public function deleteSessions(int $userId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM sessions WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
    }

    private function hydrate(mixed $row): ?UserRecord
    {
        if (! is_array($row)) {
            return null;
        }

        return new UserRecord(
            (int) $row['id'],
            (string) $row['email'],
            (string) $row['display_name'],
            (string) $row['password'],
            $row['email_verified_at'] === null ? null : (string) $row['email_verified_at'],
            $row['avatar_path'] === null ? null : (string) $row['avatar_path'],
            (int) $row['auth_version'],
        );
    }
}
