<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Account;

use PDO;
use Planner\Domain\Account\UserRecord;

final readonly class PdoAccountRepository
{
    public function __construct(private PDO $pdo)
    {
    }

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

    /** @return array<string, string|int|bool> */
    public function preferences(int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT theme, note_font_size, default_note_color, notes_view, timezone, visual_theme, show_background, show_illustrations, show_quote, custom_quote, background_color, notifications_enabled, email_notifications, background_path, locale, history_completed_hours, history_overdue_days, history_retention_days FROM user_preferences WHERE user_id = :user_id',
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
            'visual_theme' => (string) $row['visual_theme'],
            'show_background' => (bool) $row['show_background'],
            'show_illustrations' => (bool) $row['show_illustrations'],
            'show_quote' => (bool) $row['show_quote'],
            'custom_quote' => (string) $row['custom_quote'],
            'locale' => (string) $row['locale'],
            'background_color' => (string) $row['background_color'],
            'background_url' => $row['background_path'] === null ? '' : '/files/background?v='.substr(hash('sha256', (string) $row['background_path']), 0, 16),
            'notifications_enabled' => (bool) $row['notifications_enabled'],
            'email_notifications' => (bool) $row['email_notifications'],
            'history_completed_hours' => (int) $row['history_completed_hours'],
            'history_overdue_days' => (int) $row['history_overdue_days'],
            'history_retention_days' => $row['history_retention_days'] === null ? null : (int) $row['history_retention_days'],
        ];
    }

    public function walkthroughDismissed(int $userId): bool
    {
        $statement = $this->pdo->prepare(
            'SELECT walkthrough_dismissed_at FROM user_preferences WHERE user_id = :user_id',
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch();

        if (! is_array($row)) {
            throw new \RuntimeException('User preferences are missing.');
        }

        return $row['walkthrough_dismissed_at'] !== null;
    }

    public function dismissWalkthrough(int $userId, string $timestamp): void
    {
        // Replays preserve the first acknowledgement, including across devices.
        $statement = $this->pdo->prepare(<<<'SQL'
UPDATE user_preferences SET walkthrough_dismissed_at = :dismissed_at, updated_at = :updated_at
WHERE user_id = :user_id AND walkthrough_dismissed_at IS NULL
SQL);
        $statement->execute([
            'user_id' => $userId,
            'dismissed_at' => $timestamp,
            'updated_at' => $timestamp,
        ]);
    }

    public function updateDisplayName(int $userId, string $displayName, string $timestamp): UserRecord
    {
        $statement = $this->pdo->prepare(
            'UPDATE users SET display_name = :display_name, updated_at = :updated_at WHERE id = :id',
        );
        $statement->execute(['display_name' => $displayName, 'updated_at' => $timestamp, 'id' => $userId]);

        return $this->findById($userId) ?? throw new \RuntimeException('Updated user could not be reloaded.');
    }

    /** @param array<string, string|int|bool> $changes */
    public function updatePreferences(int $userId, array $changes, string $timestamp): array
    {
        $allowed = ['theme', 'note_font_size', 'default_note_color', 'notes_view', 'timezone', 'visual_theme', 'show_background', 'show_illustrations', 'show_quote', 'custom_quote', 'background_color', 'notifications_enabled', 'email_notifications', 'locale', 'history_completed_hours', 'history_overdue_days', 'history_retention_days'];
        $assignments = [];
        $bindings = ['user_id' => $userId, 'updated_at' => $timestamp];

        foreach ($changes as $field => $value) {
            if (! in_array($field, $allowed, true)) {
                throw new \LogicException('Unexpected preference field.');
            }

            $assignments[] = "$field = :$field";
            $bindings[$field] = is_bool($value) ? (int) $value : $value;
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

    public function backgroundPath(int $userId): ?string
    {
        $statement = $this->pdo->prepare('SELECT background_path FROM user_preferences WHERE user_id = :user');
        $statement->execute(['user' => $userId]);
        $path = $statement->fetchColumn();
        return is_string($path) ? $path : null;
    }

    public function setBackgroundPath(int $userId, ?string $path, string $now): void
    {
        $statement = $this->pdo->prepare('UPDATE user_preferences SET background_path = :path, background_color = :color, updated_at = :now WHERE user_id = :user');
        $statement->execute(['path' => $path, 'color' => '', 'now' => $now, 'user' => $userId]);
    }

    /** @return list<string> */
    public function backgroundPaths(): array
    {
        return $this->pdo->query('SELECT background_path FROM user_preferences WHERE background_path IS NOT NULL')->fetchAll(PDO::FETCH_COLUMN);
    }

    public function updateBiography(int $userId, string $biography): void
    {
        $statement = $this->pdo->prepare('UPDATE users SET biography = :biography WHERE id = :user');
        $statement->execute(['biography' => $biography, 'user' => $userId]);
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

    public function setRole(int $userId, string $role, string $timestamp): void
    {
        $statement = $this->pdo->prepare('UPDATE users SET role = :role, updated_at = :now WHERE id = :id');
        $statement->execute(['role' => $role, 'now' => $timestamp, 'id' => $userId]);
    }

    /** Locking bumps auth_version so every existing session is rejected. */
    public function setLocked(int $userId, ?string $lockedAt, ?string $reason, string $timestamp): void
    {
        $statement = $this->pdo->prepare('UPDATE users SET locked_at = :locked_at, locked_reason = :reason, auth_version = auth_version + IF(:locking = 1, 1, 0), updated_at = :now WHERE id = :id');
        $statement->execute(['locked_at' => $lockedAt, 'reason' => $reason, 'locking' => $lockedAt === null ? 0 : 1, 'now' => $timestamp, 'id' => $userId]);
    }

    public function setTwoFactor(int $userId, ?string $method, ?string $secret, string $timestamp): void
    {
        $statement = $this->pdo->prepare('UPDATE users SET two_factor_method = :method, two_factor_secret = :secret, updated_at = :now WHERE id = :id');
        $statement->execute(['method' => $method, 'secret' => $secret, 'now' => $timestamp, 'id' => $userId]);
    }

    /** @return list<int> */
    public function adminIds(): array
    {
        return array_map('intval', $this->pdo->query("SELECT id FROM users WHERE role = 'admin' AND locked_at IS NULL ORDER BY id")->fetchAll(PDO::FETCH_COLUMN));
    }

    /** @return array<string, mixed>|null id, display name, email and avatar of an account by exact email */
    public function publicByEmail(string $email): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, email, display_name, avatar_path FROM users WHERE email = :email AND locked_at IS NULL LIMIT 1');
        $statement->execute(['email' => strtolower(trim($email))]);
        $row = $statement->fetch();

        return is_array($row) ? $row : null;
    }

    /**
     * @param list<int> $userIds
     * @return array<int, array{id:string,display_name:string,email:string}>
     */
    public function publicProfiles(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }
        $userIds = array_values(array_unique($userIds));
        $statement = $this->pdo->prepare('SELECT id, email, display_name FROM users WHERE id IN ('.implode(',', array_fill(0, count($userIds), '?')).')');
        $statement->execute($userIds);
        $profiles = [];
        foreach ($statement->fetchAll() as $row) {
            $profiles[(int) $row['id']] = ['id' => (string) $row['id'], 'display_name' => (string) $row['display_name'], 'email' => (string) $row['email']];
        }

        return $profiles;
    }

    /** @return list<array<string, mixed>> */
    public function adminUserList(string $query): array
    {
        $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query);
        $statement = $this->pdo->prepare("SELECT id, email, display_name, role, locked_at, locked_reason, created_at FROM users WHERE email LIKE :q_email ESCAPE '!' OR display_name LIKE :q_name ESCAPE '!' ORDER BY (locked_at IS NULL), id LIMIT 100");
        $statement->execute(['q_email' => '%'.$escaped.'%', 'q_name' => '%'.$escaped.'%']);

        return $statement->fetchAll();
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
            (string) ($row['biography'] ?? ''),
            (string) ($row['role'] ?? 'user'),
            isset($row['locked_at']) ? (string) $row['locked_at'] : null,
            isset($row['two_factor_method']) ? (string) $row['two_factor_method'] : null,
            isset($row['two_factor_secret']) ? (string) $row['two_factor_secret'] : null,
        );
    }
}
