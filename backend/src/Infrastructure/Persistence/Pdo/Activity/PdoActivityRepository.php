<?php

declare(strict_types=1);

namespace Planner\Infrastructure\Persistence\Pdo\Activity;

use PDO;

final readonly class PdoActivityRepository
{
    public function __construct(private PDO $pdo) {}

    /** @param array<string, mixed> $metadata */
    public function insert(
        string $id,
        int $userId,
        string $sourceType,
        string $sourceId,
        int $sourceVersion,
        string $action,
        string $occurredAt,
        string $effectiveDate,
        string $timezone,
        ?string $reversalOfId = null,
        array $metadata = [],
    ): void {
        $statement = $this->pdo->prepare(<<<'SQL'
INSERT INTO activities
    (id, user_id, source_type, source_id, source_version, action, occurred_at, effective_date, timezone, reversal_of_id, metadata)
VALUES
    (:id, :user_id, :source_type, :source_id, :source_version, :action, :occurred_at, :effective_date, :timezone, :reversal_of_id, :metadata)
SQL);
        $statement->execute([
            'id' => $id,
            'user_id' => $userId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
            'source_version' => $sourceVersion,
            'action' => $action,
            'occurred_at' => $occurredAt,
            'effective_date' => $effectiveDate,
            'timezone' => $timezone,
            'reversal_of_id' => $reversalOfId,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
        ]);
    }

    public function completionId(int $userId, string $sourceType, string $sourceId, string $effectiveDate): ?string
    {
        $statement = $this->pdo->prepare(<<<'SQL'
SELECT id FROM activities
WHERE user_id = :user_id AND source_type = :source_type AND source_id = :source_id
  AND action = 'completed'
  AND NOT EXISTS (SELECT 1 FROM activities reversal WHERE reversal.user_id = activities.user_id AND reversal.reversal_of_id = activities.id)
ORDER BY occurred_at DESC, id DESC LIMIT 1
SQL);
        $statement->execute([
            'user_id' => $userId,
            'source_type' => $sourceType,
            'source_id' => $sourceId,
        ]);
        $id = $statement->fetchColumn();

        return $id === false ? null : (string) $id;
    }
}
