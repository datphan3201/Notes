<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\AttachmentRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Psr\Log\LoggerInterface;

final readonly class PruneFiles
{
    public function __construct(
        private ProcessFileDeletion $cleanup,
        private AttachmentRepository $attachments,
        private PdoAccountRepository $accounts,
        private LocalPrivateStorage $storage,
        private Clock $clock,
        private LoggerInterface $logger,
    ) {}

    /** @return array{pending_completed:int,pending_failed:int,orphans_deleted:int,orphans_failed:int} */
    public function run(): array
    {
        $pending = $this->cleanup->handle();
        $referenced = array_fill_keys([
            ...$this->attachments->referencedPaths(),
            ...$this->accounts->avatarPaths(),
        ], true);
        $cutoff = $this->clock->now()->getTimestamp() - 3600;
        $deleted = 0;
        $failed = 0;

        foreach ($this->storage->managedFiles() as $file) {
            if (isset($referenced[$file['path']]) || $file['modified_at'] >= $cutoff) {
                continue;
            }

            try {
                $this->storage->delete($file['path']);
                $deleted++;
            } catch (\Throwable) {
                $failed++;
                $this->logger->warning('Private orphan cleanup failed.', [
                    'file_name' => basename($file['path']),
                ]);
            }
        }

        return [
            'pending_completed' => $pending['completed'],
            'pending_failed' => $pending['failed'],
            'orphans_deleted' => $deleted,
            'orphans_failed' => $failed,
        ];
    }
}
