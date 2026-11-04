<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use PDOException;
use Planner\Domain\Account\UserRecord;
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
        private ?NoteShareService $shares = null,
        private ?NoteLockGate $lockGate = null,
    ) {
    }

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
        $this->lockGate?->assertUnlocked($note);

        return $note;
    }

    /** @param list<string> $noteIds @return array<string, int> */
    public function shareCounts(int $userId, array $noteIds): array
    {
        return $this->notes->shareCounts($userId, $noteIds);
    }

    /** Whether this session may read the Note's content (always true for unlocked Notes). */
    public function canRead(NoteRecord $note): bool
    {
        return $this->lockGate?->isUnlocked($note) ?? ! $note->isLocked();
    }

    /** @param array{base_version:int,title:string,content:string,color:string,is_pinned:bool,label_ids:list<int>} $input */
    public function update(int $userId, string $noteId, array $input): NoteRecord
    {
        $desired = NoteSnapshot::fromInput($input);

        return $this->transactions->run(function () use ($userId, $noteId, $input, $desired): NoteRecord {
            $owner = $this->lockOwner($userId);
            $current = $this->notes->findOwned($userId, $noteId, true, true);

            if ($current === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            if ($current->deletedAt !== null) {
                throw new HttpException(410, 'NOTE_DELETED', 'The note has been deleted.');
            }
            $this->lockGate?->assertUnlocked($current);

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

            $updated = $this->notes->updateSnapshot(
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

            if ($current->title !== $updated->title || $current->content !== $updated->content) {
                $this->shares?->noteChangedByOwner($updated, $owner->displayName);
            }

            return $updated;
        });
    }

    /**
     * Uses one of the Note's own active images as its background. This is a
     * display setting outside the versioned autosave snapshot, so it never
     * creates an autosave conflict.
     */
    public function setBackground(int $userId, string $noteId, ?string $attachmentId): NoteRecord
    {
        return $this->transactions->run(function () use ($userId, $noteId, $attachmentId): NoteRecord {
            $this->lockOwner($userId);
            $note = $this->notes->findOwned($userId, $noteId, false, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            $this->lockGate?->assertUnlocked($note);

            if ($attachmentId !== null) {
                $image = array_filter($note->attachments, static fn (array $attachment): bool => $attachment['id'] === $attachmentId && $attachment['kind'] === 'image');
                if ($image === []) {
                    throw new ValidationException(['attachment_id' => ['Choose an image attached to this note.']]);
                }
            }

            $this->notes->setBackground($userId, $noteId, $attachmentId);

            return $this->notes->findOwned($userId, $noteId) ?? throw new \RuntimeException('Note disappeared.');
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
            $this->lockGate?->assertUnlocked($current);

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

    /**
     * Owner-only appearance/organization change (color, pin, tags) that never
     * touches title/content, so it cannot conflict with concurrent text edits
     * (for example a live collaboration session). Fields left out keep their value.
     *
     * @param array{color?:string,is_pinned?:bool,label_ids?:list<int>} $input
     */
    public function updateAttributes(int $userId, string $noteId, array $input): NoteRecord
    {
        return $this->transactions->run(function () use ($userId, $noteId, $input): NoteRecord {
            $this->lockOwner($userId);
            $current = $this->notes->findOwned($userId, $noteId, false, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            $this->lockGate?->assertUnlocked($current);
            $currentLabels = array_map(static fn ($label): int => $label->id, $current->labels);
            sort($currentLabels, SORT_NUMERIC);
            $desired = NoteSnapshot::fromInput([
                'title' => $current->title,
                'content' => $current->content,
                'color' => $input['color'] ?? $current->color,
                'is_pinned' => $input['is_pinned'] ?? ($current->pinnedAt !== null),
                'label_ids' => $input['label_ids'] ?? $currentLabels,
            ]);
            if (NoteSnapshot::equals(NoteSnapshot::fromRecord($current), $desired)) {
                return $current;
            }
            if ($this->tags->lockOwnedIds($userId, $desired['label_ids']) !== $desired['label_ids']) {
                throw new ValidationException(['label_ids' => ['One or more tags do not exist.']]);
            }
            $timestamp = $this->timestamp();

            return $this->notes->updateSnapshot(
                $userId,
                $noteId,
                $current->title,
                $current->content,
                $desired['color'],
                $desired['is_pinned'] ? ($current->pinnedAt ?? $timestamp) : null,
                $current->version + 1,
                $timestamp,
                $desired['label_ids'],
            );
        });
    }

    /**
     * Server-authoritative title/content write from the realtime collaboration
     * server. The realtime server has already merged concurrent edits, so no
     * base version is compared; access is re-checked here because a share can
     * be revoked while a socket is open. Callers validate title/content first
     * (NoteValidator::text).
     */
    public function writeCollaborativeText(int $ownerId, string $noteId, int $actorId, string $title, string $content): NoteRecord
    {
        return $this->transactions->run(function () use ($ownerId, $noteId, $actorId, $title, $content): NoteRecord {
            $owner = $this->lockOwner($ownerId);
            $current = $this->notes->findOwned($ownerId, $noteId, true, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            if ($current->deletedAt !== null) {
                throw new HttpException(410, 'NOTE_DELETED', 'The note has been deleted.');
            }
            if ($actorId !== $ownerId && ($this->shares?->permissionFor($actorId, $noteId) ?? null) !== 'edit') {
                throw new HttpException(403, 'FORBIDDEN', 'You can view this note but not edit it.');
            }
            if ($current->title === $title && $current->content === $content) {
                return $current;
            }
            $labels = array_map(static fn ($label): int => $label->id, $current->labels);
            sort($labels, SORT_NUMERIC);
            $updated = $this->notes->updateSnapshot(
                $ownerId,
                $noteId,
                $title,
                $content,
                $current->color,
                $current->pinnedAt,
                $current->version + 1,
                $this->timestamp(),
                $labels,
            );
            $actorName = $actorId === $ownerId ? $owner->displayName : ($this->accounts->findById($actorId)?->displayName ?? '');
            $this->shares?->noteChangedBy($updated, $actorId, $actorName);

            return $updated;
        });
    }

    private function lockOwner(int $userId): UserRecord
    {
        return $this->accounts->findById($userId, true)
            ?? throw new \RuntimeException('Authenticated user disappeared.');
    }

    private function timestamp(): string
    {
        return Timestamp::database($this->clock->now());
    }
}
