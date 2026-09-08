<?php

namespace App\Actions\Notes;

use App\Http\Resources\NoteResource;
use App\Models\Label;
use App\Models\Note;
use App\Models\User;
use App\Support\ApiException;
use App\Support\NoteSnapshot;
use App\Support\OwnerMutation;

final class UpdateNote
{
    public function handle(User $user, Note $note, array $input): Note
    {
        $desired = NoteSnapshot::fromInput($input);
        $baseVersion = (int) $input['base_version'];

        $updated = OwnerMutation::run($user, function (User $locked) use ($note, $desired, $baseVersion): Note {
            $current = Note::query()
                ->whereKey($note->id)
                ->where('user_id', $locked->id)
                ->active()
                ->with('labels')
                ->lockForUpdate()
                ->first();

            if ($current === null) {
                $tombstone = Note::query()
                    ->whereKey($note->id)
                    ->where('user_id', $locked->id)
                    ->lockForUpdate()
                    ->first();

                throw new ApiException(
                    $tombstone ? 'NOTE_DELETED' : 'NOT_FOUND',
                    $tombstone ? 'Ghi chú đã bị xóa.' : 'Không tìm thấy dữ liệu.',
                    $tombstone ? 410 : 404,
                );
            }

            $currentSnapshot = NoteSnapshot::fromNote($current);

            // A lost response can be safely acknowledged when the desired
            // complete snapshot already exists, even if its base is old.
            if (NoteSnapshot::equals($currentSnapshot, $desired)) {
                return $current;
            }

            if ($baseVersion !== (int) $current->version) {
                throw new ApiException(
                    'NOTE_CONFLICT',
                    'Ghi chú đã thay đổi ở một cửa sổ khác.',
                    409,
                    ['current' => NoteResource::make($current)->resolve()],
                );
            }

            $labelIds = array_map('intval', $desired['label_ids']);
            $labels = Label::query()
                ->where('user_id', $locked->id)
                ->whereIn('id', $labelIds)
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($labels->count() !== count($labelIds)) {
                throw new ApiException('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
                    'errors' => ['label_ids' => ['Một hoặc nhiều nhãn không tồn tại.']],
                ]);
            }

            $wasPinned = $current->pinned_at !== null;
            $current->forceFill([
                'title' => $desired['title'],
                'content' => $desired['content'],
                'color' => $desired['color'],
                'pinned_at' => $desired['is_pinned']
                    ? ($wasPinned ? $current->pinned_at : now())
                    : null,
                'version' => ((int) $current->version) + 1,
                'updated_at' => now(),
            ])->save();
            $current->labels()->sync($labelIds);

            return $current->fresh(['labels', 'attachments']);
        });

        return $updated->fresh(['labels', 'attachments']);
    }
}
