<?php

declare(strict_types=1);

namespace Planner\Application\Files;

use PDOException;
use Planner\Domain\Account\UserRecord;
use Planner\Domain\Files\AttachmentRecord;
use Planner\Domain\Files\InspectedUpload;
use Planner\Domain\Files\UploadedFile;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\AttachmentRepository;
use Planner\Infrastructure\Persistence\Pdo\Files\PendingDeletionRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Storage\LocalPrivateStorage;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class FileService
{
    public function __construct(
        private AttachmentRepository $attachments,
        private PendingDeletionRepository $pending,
        private PdoNoteRepository $notes,
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private LocalPrivateStorage $storage,
        private ProcessFileDeletion $cleanup,
        private AvatarProcessor $avatars,
        private Clock $clock,
    ) {}

    /** @return list<AttachmentRecord> */
    public function listAttachments(int $userId, string $noteId): array
    {
        if ($this->notes->findOwned($userId, $noteId) === null) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return $this->attachments->listForActiveNote($userId, $noteId);
    }

    /** @return array{attachment:AttachmentRecord,replayed:bool} */
    public function uploadAttachment(
        int $userId,
        string $noteId,
        string $attachmentId,
        InspectedUpload $upload,
    ): array {
        // Bytes are durable before metadata becomes visible. Every failure
        // below compensates this newly generated unreferenced path.
        $path = $this->storage->putUploaded('attachments', $upload->upload->temporaryPath, 'bin');

        try {
            $result = $this->transactions->run(function () use (
                $userId,
                $noteId,
                $attachmentId,
                $upload,
                $path,
            ): array {
                $this->lockOwner($userId);
                $note = $this->notes->findOwned($userId, $noteId, false, true);

                if ($note === null) {
                    throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
                }

                $existing = $this->attachments->findById($attachmentId, true);

                if ($existing !== null) {
                    if ($existing->userId !== $userId || $existing->noteId !== $noteId) {
                        throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
                    }

                    if ($existing->deletedAt !== null) {
                        throw new HttpException(410, 'ATTACHMENT_DELETED', 'The attachment has been deleted.');
                    }

                    if ($existing->sha256 === $upload->sha256
                        && $existing->originalName === $upload->originalName) {
                        return ['attachment' => $existing, 'replayed' => true];
                    }

                    throw new HttpException(
                        409,
                        'UPLOAD_ID_REUSED',
                        'This upload identifier was already used for different content.',
                    );
                }

                $quota = $this->attachments->lockActiveQuota($userId, $noteId);

                if ($quota['count'] >= 20 || $quota['size'] + $upload->size > 209_715_200) {
                    throw new ValidationException(['file' => ['The note attachment limit has been reached.']]);
                }

                return [
                    'attachment' => $this->attachments->insert(
                        $attachmentId,
                        $userId,
                        $noteId,
                        $upload,
                        $path,
                        $this->timestamp(),
                    ),
                    'replayed' => false,
                ];
            });
        } catch (PDOException $exception) {
            $this->compensate($path);

            if ((string) $exception->getCode() === '23000') {
                // A global UUID collision must not disclose the owner or
                // parent that already holds the identifier.
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            throw $exception;
        } catch (\Throwable $exception) {
            $this->compensate($path);
            throw $exception;
        }

        if ($result['replayed']) {
            $this->compensate($path);
        }

        return $result;
    }

    public function deleteAttachment(int $userId, string $noteId, string $attachmentId): void
    {
        $paths = $this->transactions->run(function () use ($userId, $noteId, $attachmentId): array {
            $this->lockOwner($userId);

            if ($this->notes->findOwned($userId, $noteId, false, true) === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            $attachment = $this->attachments->findOwnedForNote($userId, $noteId, $attachmentId, true);

            if ($attachment === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            if ($attachment->deletedAt !== null) {
                return [];
            }

            $timestamp = $this->timestamp();

            if ($attachment->path !== null) {
                $this->pending->queue($userId, $attachment->path, $timestamp);
            }

            $this->attachments->tombstone($userId, $attachmentId, $timestamp);

            return $attachment->path === null ? [] : [$attachment->path];
        });

        $this->cleanup->handle($paths);
    }

    /** @return array{attachment:AttachmentRecord,path:string} */
    public function authorizedAttachment(int $userId, string $attachmentId): array
    {
        $attachment = $this->attachments->findAuthorizedActive($userId, $attachmentId);

        if ($attachment === null || $attachment->path === null) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        try {
            $path = $this->storage->resolve($attachment->path);
        } catch (\Throwable) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        return ['attachment' => $attachment, 'path' => $path];
    }

    public function replaceAvatar(int $userId, UploadedFile $file): UserRecord
    {
        $jpeg = $this->avatars->makeJpeg($file);
        $path = $this->storage->putBytes('avatars', $jpeg, 'jpg');

        try {
            $result = $this->transactions->run(function () use ($userId, $path): array {
                $current = $this->lockOwner($userId);
                $timestamp = $this->timestamp();

                if ($current->avatarPath !== null) {
                    $this->pending->queue($userId, $current->avatarPath, $timestamp);
                }

                return [
                    'user' => $this->accounts->updateAvatarPath($userId, $path, $timestamp),
                    'old_path' => $current->avatarPath,
                ];
            });
        } catch (\Throwable $exception) {
            $this->compensate($path);
            throw $exception;
        }

        if ($result['old_path'] !== null) {
            $this->cleanup->handle([$result['old_path']]);
        }

        return $result['user'];
    }

    public function removeAvatar(int $userId): void
    {
        $path = $this->transactions->run(function () use ($userId): ?string {
            $current = $this->lockOwner($userId);

            if ($current->avatarPath === null) {
                return null;
            }

            $timestamp = $this->timestamp();
            $this->pending->queue($userId, $current->avatarPath, $timestamp);
            $this->accounts->updateAvatarPath($userId, null, $timestamp);

            return $current->avatarPath;
        });

        if ($path !== null) {
            $this->cleanup->handle([$path]);
        }
    }

    public function authorizedAvatar(int $userId): string
    {
        $user = $this->accounts->findById($userId);

        if ($user?->avatarPath === null) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        try {
            return $this->storage->resolve($user->avatarPath);
        } catch (\Throwable) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }
    }

    private function lockOwner(int $userId): UserRecord
    {
        return $this->accounts->findById($userId, true)
            ?? throw new \RuntimeException('Authenticated user disappeared.');
    }

    private function compensate(string $path): void
    {
        try {
            $this->storage->delete($path);
        } catch (\Throwable) {
            // The path has no database reference; files:prune removes it after
            // the one-hour safety window instead of obscuring the root error.
        }
    }

    private function timestamp(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
