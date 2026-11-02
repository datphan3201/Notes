<?php

declare(strict_types=1);
namespace Planner\Application\Files;

use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Planner\Support\Timestamp;
use Planner\Support\UuidGenerator;

final readonly class BackgroundService
{
    /** Upper bound on private uploads kept per account. */
    public const MAX_BACKGROUNDS = 12;

    public function __construct(private PdoAccountRepository $accounts, private TransactionManager $transactions, private LocalPrivateStorage $storage, private PendingDeletionRepository $pending, private Clock $clock, private UuidGenerator $uuids, private ProcessFileDeletion $cleanup)
    {
    }

    /** Adds an uploaded image to the account's list and selects it. @return array{id:string,url:string,created_at:?string} */
    public function add(int $userId, UploadedFile $file): array
    {
        $path = $this->storage->putBytes('backgrounds', $this->jpeg($file), 'jpg');
        $id = $this->uuids->generate();
        $now = Timestamp::database($this->clock->now());
        try {
            $this->transactions->run(function () use ($userId, $path, $id, $now): void {
                $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
                if ($this->accounts->backgroundCount($userId) >= self::MAX_BACKGROUNDS) {
                    throw new ValidationException(['background' => ['Remove one of your '.self::MAX_BACKGROUNDS.' backgrounds before adding another.']]);
                }
                $this->accounts->insertBackground($userId, $id, $path, $now);
                $this->accounts->selectBackground($userId, $id, $now);
            });
        } catch (\Throwable $error) {
            $this->storage->delete($path);
            throw $error;
        }

        return $this->serialize(['id' => $id, 'created_at' => $now]);
    }

    /** @return list<array{id:string,url:string,created_at:?string}> */
    public function list(int $userId): array
    {
        return array_map($this->serialize(...), $this->accounts->backgrounds($userId));
    }

    /** Removes one uploaded image; if it was selected, the preset theme shows again. */
    public function delete(int $userId, string $backgroundId): void
    {
        $path = $this->transactions->run(function () use ($userId, $backgroundId): string {
            $this->accounts->findById($userId, true) ?? throw new HttpException(404, 'NOT_FOUND', 'Account not found.');
            $path = $this->accounts->backgroundPath($userId, $backgroundId) ?? throw new HttpException(404, 'NOT_FOUND', 'Background not found.');
            $now = Timestamp::database($this->clock->now());
            if ($this->accounts->selectedBackgroundId($userId) === $backgroundId) {
                $this->accounts->selectBackground($userId, null, $now);
            }
            $this->accounts->deleteBackground($userId, $backgroundId);
            $this->pending->queue($userId, $path, $now);
            return $path;
        });
        // Bytes go only after commit; a failed attempt stays queued for prune.
        $this->cleanup->handle([$path]);
    }

    /** Deletes the selected image (the original single-background contract). */
    public function remove(int $userId): void
    {
        $selected = $this->accounts->selectedBackgroundId($userId);
        if ($selected !== null) {
            $this->delete($userId, $selected);
        }
    }

    public function authorized(int $userId, ?string $backgroundId = null): string
    {
        $backgroundId ??= $this->accounts->selectedBackgroundId($userId);
        $path = $backgroundId === null ? null : $this->accounts->backgroundPath($userId, $backgroundId);
        if ($path === null) {
            throw new HttpException(404, 'NOT_FOUND', 'No background image.');
        }
        return $this->storage->resolve($path);
    }

    /** @param array{id:string,created_at:string} $row @return array{id:string,url:string,created_at:?string} */
    private function serialize(array $row): array
    {
        return ['id' => (string) $row['id'], 'url' => PdoAccountRepository::backgroundUrl((string) $row['id']), 'created_at' => Timestamp::api((string) $row['created_at'])];
    }

    private function jpeg(UploadedFile $file): string
    {
        return (new ImageNormalizer)->jpeg($file, 'background', 2_097_152, 1920);
    }
}
