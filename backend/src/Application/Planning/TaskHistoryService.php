<?php

declare(strict_types=1);

namespace Planner\Application\Planning;

use DateTimeZone;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Admin\PdoSystemSettingRepository;
use Planner\Infrastructure\Persistence\Pdo\Planning\PdoTaskHistoryRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

/**
 * Applies the user's history retention and the administrator's history limit.
 * Tasks leaving history are archived (hidden everywhere), never hard-deleted.
 */
final readonly class TaskHistoryService
{
    public function __construct(
        private PdoTaskHistoryRepository $history,
        private PdoSystemSettingRepository $settings,
        private TransactionManager $transactions,
        private Clock $clock,
    ) {
    }

    /** @return array{users:int,archived:int} */
    public function prune(): array
    {
        $limit = $this->settings->historyLimit();
        $users = $this->history->preferences();
        $archived = 0;
        foreach ($users as $preferences) {
            $archived += $this->transactions->run(fn (): int => $this->pruneUser($preferences, $limit));
        }

        return ['users' => count($users), 'archived' => $archived];
    }

    /** @param array<string, mixed> $preferences */
    private function pruneUser(array $preferences, int $limit): int
    {
        $userId = (int) $preferences['user_id'];
        $this->history->lockOwner($userId);
        $now = $this->clock->now();
        $today = $now->setTimezone(new DateTimeZone((string) $preferences['timezone']))->setTime(0, 0);
        $doneCutoff = $now->modify('-'.(int) $preferences['history_completed_hours'].' hours');
        $overdueCutoff = $today->modify('-'.(int) $preferences['history_overdue_days'].' days');
        $retention = $preferences['history_retention_days'] === null ? null : (int) $preferences['history_retention_days'];
        $remove = [];
        // Retention counts from the moment a Task entered history.
        foreach ($this->history->historyTasks($userId, Timestamp::database($doneCutoff), $overdueCutoff->format('Y-m-d')) as $index => $task) {
            $expired = $retention !== null && ($task['status'] === 'Done'
                ? (string) $task['completed_at'] <= Timestamp::database($doneCutoff->modify("-$retention days"))
                : (string) $task['deadline'] <= $overdueCutoff->modify("-$retention days")->format('Y-m-d'));
            if ($expired || $index >= $limit) {
                $remove[] = (string) $task['id'];
            }
        }
        if ($remove === []) {
            return 0;
        }
        sort($remove);
        $this->history->archive($userId, $remove, Timestamp::database($now));

        return count($remove);
    }
}
