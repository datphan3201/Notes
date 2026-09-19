<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Psr\Log\LoggerInterface;

final readonly class ProcessFileDeletion
{
    public function __construct(
        private PendingDeletionRepository $pending,
        private LocalPrivateStorage $storage,
        private LoggerInterface $logger,
        private Clock $clock,
    ) {}

    /** @param list<string> $paths @return array{completed:int,failed:int} */
    public function handle(array $paths = []): array
    {
        $completed = 0;
        $failed = 0;

        foreach ($this->pending->pending($paths) as $item) {
            try {
                $this->storage->delete($item['path']);
                $this->pending->completed($item['id']);
                $completed++;
            } catch (\Throwable) {
                $this->pending->failed($item['id'], Timestamp::database($this->clock->now()));
                $failed++;
                $this->logger->warning('Private file cleanup will be retried.', [
                    'pending_deletion_id' => $item['id'],
                    'attempts' => $item['attempts'] + 1,
                ]);
            }
        }

        return ['completed' => $completed, 'failed' => $failed];
    }
}
