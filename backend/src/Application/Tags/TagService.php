<?php

declare(strict_types=1);

namespace Planner\Application\Tags;

use PDOException;
use Planner\Domain\Tags\TagRecord;
use Planner\Domain\Planning\GraphGuard;
use Planner\Http\HttpException;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Database\TransactionManager;
use Planner\Infrastructure\Persistence\Pdo\Account\PdoAccountRepository;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Tags\PdoTagRepository;
use Planner\Support\Clock;
use Planner\Support\Timestamp;

final readonly class TagService
{
    public function __construct(
        private PdoTagRepository $tags,
        private PdoNoteRepository $notes,
        private PdoAccountRepository $accounts,
        private TransactionManager $transactions,
        private LabelSerializer $serializer,
        private Clock $clock,
        private GraphGuard $graphs,
    ) {}

    /** @return list<TagRecord> */
    public function list(int $userId): array
    {
        return $this->tags->listForOwner($userId);
    }

    public function find(int $userId, int $tagId): TagRecord
    {
        return $this->tags->findOwned($userId, $tagId)
            ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
    }

    public function create(int $userId, string $name): TagRecord
    {
        try {
            return $this->transactions->run(function () use ($userId, $name): TagRecord {
                $this->lockOwner($userId);

                if ($this->tags->countForOwner($userId) >= 100) {
                    throw new ValidationException(['name' => ['No more tags can be created.']]);
                }

                return $this->tags->insert($userId, $name, $this->timestamp());
            });
        } catch (PDOException $exception) {
            $this->mapDuplicate($exception);
            throw $exception;
        }
    }

    public function rename(int $userId, int $labelId, string $name, int $baseVersion): TagRecord
    {
        try {
            return $this->transactions->run(function () use ($userId, $labelId, $name, $baseVersion): TagRecord {
                $this->lockOwner($userId);
                $current = $this->tags->findOwned($userId, $labelId, true);

                if ($current === null) {
                    throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
                }

                if ($current->name === $name) {
                    return $current;
                }

                if ($current->version !== $baseVersion) {
                    throw new HttpException(
                        409,
                        'LABEL_CONFLICT',
                        'The tag changed in another window.',
                        payload: ['current' => $this->serializer->one($current)],
                    );
                }

                return $this->tags->rename(
                    $userId,
                    $labelId,
                    $name,
                    $current->version + 1,
                    $this->timestamp(),
                );
            });
        } catch (PDOException $exception) {
            $this->mapDuplicate($exception);
            throw $exception;
        }
    }

    public function delete(int $userId, int $labelId, int $baseVersion): void
    {
        $this->transactions->run(function () use ($userId, $labelId, $baseVersion): void {
            $this->lockOwner($userId);
            $current = $this->tags->findOwned($userId, $labelId, true);

            if ($current === null) {
                throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
            }

            if ($current->version !== $baseVersion) {
                throw new HttpException(
                    409,
                    'LABEL_CONFLICT',
                    'The tag changed in another window.',
                    payload: ['current' => $this->serializer->one($current)],
                );
            }

            // Discover relationships while the owner lock serializes all
            // same-account writers, then lock aggregates before pivot rows.
            $noteIds = $this->tags->attachedNoteIds($userId, $labelId);
            $this->notes->lockNotes($userId, $noteIds);
            $lockedNoteIds = $this->tags->lockAttachedNoteIds($userId, $labelId);

            if ($lockedNoteIds !== $noteIds) {
                throw new \RuntimeException('Label relationships changed despite the owner mutation lock.');
            }

            $this->notes->detachLabelAndTouchActiveNotes(
                $userId,
                $labelId,
                $noteIds,
                $this->timestamp(),
            );
            $this->tags->delete($userId, $labelId);
        });
    }

    /** @param array{name:string,parent_id:?int,color:string,position:int} $input */
    public function createTag(int $userId, array $input): TagRecord
    {
        try {
            return $this->transactions->run(function () use ($userId, $input): TagRecord {
                $this->lockOwner($userId);

                if ($this->tags->countForOwner($userId) >= 100) {
                    throw new ValidationException(['name' => ['No more tags can be created.']]);
                }

                if ($input['parent_id'] !== null && $this->tags->findOwned($userId, $input['parent_id'], true) === null) {
                    throw new ValidationException(['parent_id' => ['The parent Tag was not found.']]);
                }

                return $this->tags->insertTag(
                    $userId,
                    $input['name'],
                    $input['parent_id'],
                    $input['color'],
                    $input['position'],
                    $this->timestamp(),
                );
            });
        } catch (PDOException $exception) {
            $this->mapDuplicate($exception);
            throw $exception;
        }
    }

    /** @param array<string, mixed> $changes */
    public function updateTag(int $userId, int $tagId, array $changes): TagRecord
    {
        try {
            return $this->transactions->run(function () use ($userId, $tagId, $changes): TagRecord {
                $this->lockOwner($userId);
                $current = $this->tags->findOwned($userId, $tagId, true)
                    ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');
                $baseVersion = (int) $changes['base_version'];
                unset($changes['base_version']);
                $name = (string) ($changes['name'] ?? $current->name);
                $parentId = array_key_exists('parent_id', $changes) ? $changes['parent_id'] : $current->parentId;
                $color = (string) ($changes['color'] ?? $current->color);
                $position = (int) ($changes['position'] ?? $current->position);

                if ($name === $current->name && $parentId === $current->parentId
                    && $color === $current->color && $position === $current->position) {
                    return $current;
                }

                if ($current->version !== $baseVersion) {
                    throw new HttpException(409, 'TAG_CONFLICT', 'The Tag has changed.', payload: ['current' => $this->serializer->one($current)]);
                }

                if ($parentId !== null) {
                    if ($this->tags->findOwned($userId, (int) $parentId, true) === null) {
                        throw new ValidationException(['parent_id' => ['The parent Tag was not found.']]);
                    }

                    if ($this->graphs->wouldCycle($this->tags->hierarchyEdges($userId), (string) $tagId, (string) $parentId)) {
                        throw new ValidationException(['parent_id' => ['The Tag hierarchy cannot contain a cycle.']]);
                    }
                }

                return $this->tags->updateTag(
                    $userId, $tagId, $name, $parentId, $color, $position,
                    $current->version + 1, $this->timestamp(),
                );
            });
        } catch (PDOException $exception) {
            $this->mapDuplicate($exception);
            throw $exception;
        }
    }

    public function archiveTag(int $userId, int $tagId, int $baseVersion): void
    {
        $this->transactions->run(function () use ($userId, $tagId, $baseVersion): void {
            $this->lockOwner($userId);
            $current = $this->tags->findOwned($userId, $tagId, true)
                ?? throw new HttpException(404, 'NOT_FOUND', 'The requested resource was not found.');

            if ($current->version !== $baseVersion) {
                throw new HttpException(409, 'TAG_CONFLICT', 'The Tag has changed.', payload: ['current' => $this->serializer->one($current)]);
            }

            if ($this->tags->activeChildCount($userId, $tagId) > 0) {
                throw new ValidationException(['archive' => ['The Tag still has active child Tags.']]);
            }

            $this->tags->archiveTag($userId, $tagId, $current->version + 1, $this->timestamp());
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

    private function mapDuplicate(PDOException $exception): void
    {
        if ((string) $exception->getCode() === '23000') {
            throw new ValidationException(['name' => ['A Tag with this name already exists.']]);
        }
    }
}
