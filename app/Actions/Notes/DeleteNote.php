<?php

namespace App\Actions\Notes;

use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Models\PendingFileDeletion;
use App\Models\User;
use App\Support\ApiException;
use App\Support\OwnerMutation;

final class DeleteNote
{
    /** @return array{paths:array<int,string>,already_deleted:bool} */
    public function handle(User $user, Note $note, int $baseVersion): array
    {
        return OwnerMutation::run($user, function (User $locked) use ($note, $baseVersion): array {
            $current = Note::query()
                ->whereKey($note->id)
                ->where('user_id', $locked->id)
                ->with(['attachments' => static fn ($query) => $query->lockForUpdate()])
                ->lockForUpdate()
                ->first();

            if ($current === null) {
                throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
            }

            if ($current->deleted_at !== null) {
                return ['paths' => [], 'already_deleted' => true];
            }

            if ((int) $current->version !== $baseVersion) {
                throw new ApiException(
                    'NOTE_CONFLICT',
                    'Ghi chú đã thay đổi ở một cửa sổ khác.',
                    409,
                    ['current' => NoteResource::make($current)->resolve()],
                );
            }

            $paths = [];
            foreach ($current->attachments->whereNull('deleted_at') as $attachment) {
                if ($attachment->path) {
                    $paths[] = $attachment->path;
                    PendingFileDeletion::firstOrCreate(['path' => $attachment->path], [
                        'attempts' => 0,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $attachment->forceFill([
                    'original_name' => '',
                    'path' => null,
                    'mime_type' => '',
                    'kind' => 'file',
                    'size_bytes' => 0,
                    'sha256' => null,
                    'deleted_at' => now(),
                    'updated_at' => now(),
                ])->save();
            }

            $current->labels()->detach();
            $current->forceFill([
                'title' => '',
                'content' => '',
                'color' => 'neutral',
                'pinned_at' => null,
                'version' => ((int) $current->version) + 1,
                'deleted_at' => now(),
                'updated_at' => now(),
            ])->save();

            return ['paths' => $paths, 'already_deleted' => false];
        });
    }
}
