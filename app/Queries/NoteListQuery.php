<?php

namespace App\Queries;

use App\Models\Note;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class NoteListQuery
{
    public function paginate(User $user, string $query, array $labelIds, int $page): LengthAwarePaginator
    {
        $notes = Note::query()
            ->ownedBy($user)
            ->active()
            ->with(['labels' => static fn ($labels) => $labels->orderBy('name')->orderBy('id')])
            ->withCount(['attachments as attachment_count' => static fn ($attachments) => $attachments->whereNull('deleted_at')]);

        if ($query !== '') {
            // Escape all LIKE metacharacters so search remains literal, including
            // “%”, “_”, and the chosen escape character itself.
            $escaped = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $query);
            $needle = "%{$escaped}%";
            $notes->where(static function ($builder) use ($needle): void {
                $builder->whereRaw("title LIKE ? ESCAPE '!'", [$needle])
                    ->orWhereRaw("content LIKE ? ESCAPE '!'", [$needle]);
            });
        }

        if ($labelIds !== []) {
            $notes->whereHas('labels', static fn ($labels) => $labels->whereIn('labels.id', $labelIds));
        }

        return $notes
            ->orderByRaw('pinned_at IS NULL ASC')
            ->orderByDesc('pinned_at')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->paginate(30, ['*'], 'page', $page);
    }
}
