<?php

declare(strict_types=1);

namespace Planner\Application\Admin;

use Planner\Infrastructure\Persistence\Pdo\Admin\PdoAdminActionRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/** Who did what in administration, and when. A NULL actor is the server console. */
final readonly class AdminActionLog
{
    public function __construct(private PdoAdminActionRepository $actions, private Clock $clock)
    {
    }

    public function record(?int $actorId, string $action, string $targetType, string $targetId, string $summary): void
    {
        $this->actions->record($actorId, $action, $targetType, $targetId, $summary, Timestamp::database($this->clock->now()));
    }

    /** @return list<array<string, mixed>> */
    public function recent(): array
    {
        return array_map(static fn (array $row): array => [
            'id' => (string) $row['id'],
            'action' => (string) $row['action'],
            'target_type' => (string) $row['target_type'],
            'target_id' => (string) $row['target_id'],
            'summary' => (string) $row['summary'],
            'actor' => $row['actor_id'] === null
                ? null
                : ['id' => (string) $row['actor_id'], 'display_name' => (string) ($row['actor_name'] ?? ''), 'email' => (string) ($row['actor_email'] ?? '')],
            'created_at' => Timestamp::api((string) $row['created_at']),
        ], $this->actions->recent());
    }
}
