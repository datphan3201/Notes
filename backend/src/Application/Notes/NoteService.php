<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use PDOException;
use Planner\Domain\Notes\NoteRecord;
use Planner\Domain\Notes\NoteSnapshot;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Tags\PdoTagRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class NoteService
{
    public function __construct(
        private PdoNoteRepository $notes,
        private PdoTagRepository $tags,
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private NoteSerializer $serializer,
        private Clock $clock,
    ) {}

    /**
     * @param  array{id:string,title:string,content:string,color?:string}  $input
     * @return array{note:NoteRecord,replayed:bool}
     */
    public function create(int $userId, array $input): array
    {
        $preferences = $this->accounts->preferences($userId);
        $desired = NoteSnapshot::fromInput([
            'title' => $input['title'],
            'content' => $input['content'],
            'color' => $input['color'] ?? $preferences['default_note_color'],
            'is_pinned' => false,
            'label_ids' => [],
        ]);

        try {
            return $this->transactions->run(function () use ($userId, $input, $desired): array {
                $this->lockOwner($userId);
                $current = $this->notes->findById($input['id'], true);

                if ($current !== null && $current->userId !== $userId) {
                    throw new HttpException(409, 'CREATE_CONFLICT', 'This note identifier cannot be used.');
                }

                if ($current?->deletedAt !== null) {
                    throw new HttpException(410, 'NOTE_DELETED', 'The note has been deleted.');
                }

                if ($current !== null) {
                    if (NoteSnapshot::equals(NoteSnapshot::fromRecord($current), $desired)) {
                        return ['note' => $current, 'replayed' => true];
                    }

                    throw new HttpException(
                        409,
                        'CREATE_CONFLICT',
                        'A note with this identifier already exists with different content.',
                        payload: ['current' => $this->serializer->full($current)],
                    );
                }

                return [
                    'note' => $this->notes->insert(
                        $input['id'],
                        $userId,
                        $desired['title'],
                        $desired['content'],
                        $desired['color'],
                        $this->timestamp(),
                    ),
                    'replayed' => false,
                ];
            });
        } catch (PDOException $exception) {
            if ((string) $exception->getCode() === '23000') {
                throw new HttpException(409, 'CREATE_CONFLICT', 'This note identifier cannot be used.');
            }

            throw $exception;
        }
    }

    public function show(int $userId, string $noteId): NoteRecord
    {
        $note = $this->notes->findOwned($userId, $noteId, true);

        if ($note === null) {
            throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
        }

        if ($note->deletedAt !== null) {
            throw new HttpException(410, 'NOTE_DELETED', 'The note has been deleted.');
        }

        return $note;
    }

    /** @param array{base_version:int,title:string,content:string,color:string,is_pinned:bool,label_ids:list<int>} $input */
    public function update(int $userId, string $noteId, array $input): NoteRecord
    {
        $desired = NoteSnapshot::fromInput($input);

        return $this->transactions->run(function () use ($userId, $noteId, $input, $desired): NoteRecord {
            $this->lockOwner($userId);
            $current = $this->notes->findOwned($userId, $noteId, true, true);

            if ($current === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            if ($current->deletedAt !== null) {
                throw new HttpException(410, 'NOTE_DELETED', 'The note has been deleted.');
            }

            // Lost responses are safe to acknowledge even when the retried
            // base_version is stale, because the complete desired state exists.
            if (NoteSnapshot::equals(NoteSnapshot::fromRecord($current), $desired)) {
                return $current;
            }

            if ($input['base_version'] !== $current->version) {
                throw new HttpException(
                    409,
                    'NOTE_CONFLICT',
                    'The note changed in another window.',
                    payload: ['current' => $this->serializer->full($current)],
                );
            }

            if ($this->tags->lockOwnedIds($userId, $desired['label_ids']) !== $desired['label_ids']) {
                throw new ValidationException(['label_ids' => ['One or more tags do not exist.']]);
            }

            $timestamp = $this->timestamp();
            $pinnedAt = $desired['is_pinned']
                ? ($current->pinnedAt ?? $timestamp)
                : null;

            return $this->notes->updateSnapshot(
                $userId,
                $noteId,
                $desired['title'],
                $desired['content'],
                $desired['color'],
                $pinnedAt,
                $current->version + 1,
                $timestamp,
                $desired['label_ids'],
            );
        });
    }

    /** @return list<string> paths queued for private-file cleanup */
    public function delete(int $userId, string $noteId, int $baseVersion): array
    {
        return $this->transactions->run(function () use ($userId, $noteId, $baseVersion): array {
            $this->lockOwner($userId);
            $current = $this->notes->findOwned($userId, $noteId, true, true);

            if ($current === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            if ($current->deletedAt !== null) {
                return [];
            }

            if ($baseVersion !== $current->version) {
                throw new HttpException(
                    409,
                    'NOTE_CONFLICT',
                    'The note changed in another window.',
                    payload: ['current' => $this->serializer->full($current)],
                );
            }

            return $this->notes->tombstone(
                $userId,
                $noteId,
                $current->version + 1,
                $this->timestamp(),
            );
        });
    }

    private function lockOwner(int $userId): void
    {
        $this->accounts->findById($userId, true)
            ?? throw new \RuntimeException('Authenticated user disappeared.');
    }

    private function timestamp(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
