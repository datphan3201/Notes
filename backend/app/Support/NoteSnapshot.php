<?php

namespace App\Support;

use App\Models\Note;

final class NoteSnapshot
{
    public const COLORS = ['neutral', 'lemon', 'mint', 'sky', 'rose'];

    /**
     * Normalize only editable fields. Server-owned IDs/timestamps/version are
     * intentionally absent so a client cannot mass-assign them.
     *
     * @param  array<string, mixed>  $input
     * @return array{title:string,content:string,color:string,is_pinned:bool,label_ids:array<int,string>}
     */
    public static function fromInput(array $input): array
    {
        $labels = array_map(
            static fn (mixed $id): string => (string) ((int) $id),
            is_array($input['label_ids'] ?? null) ? $input['label_ids'] : [],
        );
        $labels = array_values(array_unique($labels));
        usort($labels, static fn (string $a, string $b): int => (int) $a <=> (int) $b);

        return [
            'title' => TextNormalizer::title((string) ($input['title'] ?? '')),
            'content' => TextNormalizer::body((string) ($input['content'] ?? '')),
            'color' => (string) ($input['color'] ?? 'neutral'),
            'is_pinned' => (bool) ($input['is_pinned'] ?? false),
            'label_ids' => $labels,
        ];
    }

    /** @return array{title:string,content:string,color:string,is_pinned:bool,label_ids:array<int,string>} */
    public static function fromNote(Note $note): array
    {
        $labels = $note->relationLoaded('labels')
            ? $note->labels
            : $note->labels()->get();

        $ids = $labels->pluck('id')->map(static fn (mixed $id): string => (string) $id)->all();
        usort($ids, static fn (string $a, string $b): int => (int) $a <=> (int) $b);

        return [
            'title' => (string) $note->title,
            'content' => (string) $note->content,
            'color' => (string) $note->color,
            'is_pinned' => $note->pinned_at !== null,
            'label_ids' => array_values($ids),
        ];
    }

    public static function equals(array $left, array $right): bool
    {
        return $left === $right;
    }
}
