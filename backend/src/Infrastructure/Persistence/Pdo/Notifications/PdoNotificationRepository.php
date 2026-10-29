<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Notifications;

use PDO;

final readonly class PdoNotificationRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    /** @param array<string, mixed> $payload */
    public function insert(string $id, int $userId, string $type, ?string $subjectId, array $payload, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO notifications (id, user_id, type, subject_id, payload, created_at) VALUES (:id, :user, :type, :subject, :payload, :now)');
        $statement->execute(['id' => $id, 'user' => $userId, 'type' => $type, 'subject' => $subjectId, 'payload' => json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), 'now' => $now]);
    }

    public function hasUnread(int $userId, string $type, string $subjectId): bool
    {
        $statement = $this->pdo->prepare('SELECT 1 FROM notifications WHERE user_id = :user AND type = :type AND subject_id = :subject AND read_at IS NULL LIMIT 1');
        $statement->execute(['user' => $userId, 'type' => $type, 'subject' => $subjectId]);

        return $statement->fetchColumn() !== false;
    }

    /** @return list<array{id:string,type:string,subject_id:?string,payload:array<string,mixed>,read_at:?string,created_at:string}> */
    public function latest(int $userId, int $limit = 50): array
    {
        $statement = $this->pdo->prepare('SELECT id, type, subject_id, payload, read_at, created_at FROM notifications WHERE user_id = :user ORDER BY created_at DESC, id DESC LIMIT :limit');
        $statement->bindValue(':user', $userId, PDO::PARAM_INT);
        $statement->bindValue(':limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'type' => (string) $row['type'],
            'subject_id' => $row['subject_id'] === null ? null : (string) $row['subject_id'],
            'payload' => json_decode((string) $row['payload'], true, flags: JSON_THROW_ON_ERROR),
            'read_at' => $row['read_at'] === null ? null : (string) $row['read_at'],
            'created_at' => (string) $row['created_at'],
        ], $statement->fetchAll());
    }

    public function unreadCount(int $userId): int
    {
        $statement = $this->pdo->prepare('SELECT COUNT(*) FROM notifications WHERE user_id = :user AND read_at IS NULL');
        $statement->execute(['user' => $userId]);

        return (int) $statement->fetchColumn();
    }

    public function markRead(int $userId, ?string $id, string $now): void
    {
        $sql = 'UPDATE notifications SET read_at = :now WHERE user_id = :user AND read_at IS NULL'.($id === null ? '' : ' AND id = :id');
        $bindings = ['now' => $now, 'user' => $userId];
        if ($id !== null) {
            $bindings['id'] = $id;
        }
        $this->pdo->prepare($sql)->execute($bindings);
    }

    /** Invitations that were answered or withdrawn no longer need attention. */
    public function markSubjectRead(int $userId, string $type, string $subjectId, string $now): void
    {
        $this->pdo->prepare('UPDATE notifications SET read_at = :now WHERE user_id = :user AND type = :type AND subject_id = :subject AND read_at IS NULL')
            ->execute(['now' => $now, 'user' => $userId, 'type' => $type, 'subject' => $subjectId]);
    }
}
