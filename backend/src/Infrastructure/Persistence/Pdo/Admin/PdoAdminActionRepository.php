<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Admin;

use PDO;

/** Append-only administrator activity; a NULL actor is the server console. */
final readonly class PdoAdminActionRepository
{
    public function __construct(private PDO $pdo)
    {
    }

    public function record(?int $actorId, string $action, string $targetType, string $targetId, string $summary, string $now): void
    {
        $statement = $this->pdo->prepare('INSERT INTO admin_actions (actor_id, action, target_type, target_id, summary, created_at) VALUES (:actor, :action, :type, :target, :summary, :now)');
        $statement->execute([
            'actor' => $actorId,
            'action' => $action,
            'type' => $targetType,
            'target' => $targetId,
            'summary' => mb_substr($summary, 0, 500, 'UTF-8'),
            'now' => $now,
        ]);
    }

    /** @return list<array<string, mixed>> newest first */
    public function recent(int $limit = 100): array
    {
        $statement = $this->pdo->prepare('SELECT a.*, u.display_name AS actor_name, u.email AS actor_email FROM admin_actions a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.created_at DESC, a.id DESC LIMIT :limit');
        $statement->bindValue('limit', $limit, PDO::PARAM_INT);
        $statement->execute();

        return $statement->fetchAll();
    }
}
