<?php

declare(strict_types=1);

namespace Planner\Application\Notes;

use Planner\Domain\Notes\NoteRecord;
use Planner\Http\ValidationException;
use Planner\Infrastructure\Persistence\Pdo\Notes\PdoNoteRepository;
use Planner\Infrastructure\Persistence\Pdo\Tags\PdoTagRepository;

final readonly class NoteListQuery
{
    public function __construct(
        private PdoNoteRepository $notes,
        private PdoTagRepository $tags,
    ) {}

    /**
     * @param  list<int>  $labelIds
     * @return array{items:list<NoteRecord>,total:int,current_page:int,per_page:int,last_page:int}
     */
    public function paginate(int $userId, string $query, array $labelIds, int $page): array
    {
        if ($labelIds !== [] && $this->tags->ownedIds($userId, $labelIds) !== $labelIds) {
            throw new ValidationException(['label_ids' => ['One or more tags do not exist.']]);
        }

        return $this->notes->paginate($userId, $query, $labelIds, $page);
    }
}
