<?php

declare(strict_types=1);

namespace Planner\Domain\Notes;

use Planner\Support\TextNormalizer;

final class NoteSnapshot
{
    public const COLORS = ['neutral', 'lemon', 'mint', 'sky', 'rose'];

    /**
     * @param  array<string, mixed>  $input
     * @return array{title:string,content:string,color:string,is_pinned:bool,label_ids:list<int>}
     */
    public static function fromInput(array $input): array
    {
        $labelIds = [];

        foreach (is_array($input['label_ids'] ?? null) ? $input['label_ids'] : [] as $id) {
            $labelIds[] = (int) $id;
        }

        $labelIds = array_values(array_unique($labelIds));
        sort($labelIds, SORT_NUMERIC);

        return [
            'title' => TextNormalizer::title((string) ($input['title'] ?? '')),
            'content' => TextNormalizer::body((string) ($input['content'] ?? '')),
            'color' => (string) ($input['color'] ?? 'neutral'),
            'is_pinned' => (bool) ($input['is_pinned'] ?? false),
            'label_ids' => $labelIds,
        ];
    }

    /** @return array{title:string,content:string,color:string,is_pinned:bool,label_ids:list<int>} */
    public static function fromRecord(NoteRecord $note): array
    {
        $labelIds = array_map(static fn ($label): int => $label->id, $note->labels);
        sort($labelIds, SORT_NUMERIC);

        return [
            'title' => $note->title,
            'content' => $note->content,
            'color' => $note->color,
            'is_pinned' => $note->pinnedAt !== null,
            'label_ids' => array_values($labelIds),
        ];
    }

    /** @param array<string, mixed> $left @param array<string, mixed> $right */
    public static function equals(array $left, array $right): bool
    {
        return $left === $right;
    }
}
