<?php

namespace App\Actions\Files;

use App\Models\Attachment;
use App\Models\Note;
use App\Models\PendingFileDeletion;
use App\Models\User;
use App\Support\ApiException;
use App\Support\OwnerMutation;

final class DeleteAttachment
{
    /** @return array<int,string> */
    public function handle(User $user, Note $note, string $attachmentId): array
    {
        return OwnerMutation::run($user, function (User $locked) use ($note, $attachmentId): array {
            $currentNote = Note::whereKey($note->id)->where('user_id', $locked->id)->active()->lockForUpdate()->first();
            if ($currentNote === null) {
                throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
            }
            $attachment = Attachment::whereKey($attachmentId)->where('note_id', $currentNote->id)->lockForUpdate()->first();
            if ($attachment === null) {
                throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
            }
            if ($attachment->deleted_at !== null) {
                return [];
            }

            $path = $attachment->path;
            if ($path) {
                PendingFileDeletion::firstOrCreate(['path' => $path], [
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

            return $path ? [$path] : [];
        });
    }
}
