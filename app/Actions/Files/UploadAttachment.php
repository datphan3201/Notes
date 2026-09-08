<?php

namespace App\Actions\Files;

use App\Models\Attachment;
use App\Models\Note;
use App\Models\User;
use App\Rules\AllowedAttachment;
use App\Support\ApiException;
use App\Support\OwnerMutation;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final class UploadAttachment
{
    /** @return array{attachment:Attachment,replayed:bool} */
    public function handle(User $user, Note $note, string $id, UploadedFile $file): array
    {
        $meta = (new AllowedAttachment)->inspect($file);
        $path = 'attachments/'.Str::uuid()->toString().'.bin';
        $disk = Storage::disk('private');
        $stored = false;

        try {
            $disk->putFileAs('attachments', $file, basename($path));
            $stored = true;

            $result = OwnerMutation::run($user, function (User $locked) use ($note, $id, $meta, $path): array {
                $currentNote = Note::whereKey($note->id)
                    ->where('user_id', $locked->id)
                    ->active()
                    ->lockForUpdate()
                    ->first();
                if ($currentNote === null) {
                    throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
                }

                $existing = Attachment::whereKey($id)->lockForUpdate()->first();
                if ($existing !== null) {
                    if ($existing->note_id !== $currentNote->id) {
                        throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
                    }
                    if ($existing->deleted_at !== null) {
                        throw new ApiException('ATTACHMENT_DELETED', 'Tệp đã bị xóa.', 410);
                    }
                    if ($existing->sha256 === $meta['sha256'] && $existing->original_name === $meta['original_name']) {
                        return ['attachment' => $existing, 'replayed' => true];
                    }
                    throw new ApiException('UPLOAD_ID_REUSED', 'Mã tải tệp này đã được dùng cho nội dung khác.', 409);
                }

                $active = Attachment::where('note_id', $currentNote->id)->active()->lockForUpdate()->get();
                if ($active->count() >= 20 || $active->sum('size_bytes') + $meta['size'] > 209_715_200) {
                    throw new ApiException('VALIDATION_FAILED', 'Ghi chú có tối đa 20 tệp và 200 MB.', 422, [
                        'errors' => ['file' => ['Đã vượt giới hạn tệp của ghi chú.']],
                    ]);
                }

                $now = now();
                $attachment = Attachment::create([
                    'id' => $id,
                    'note_id' => $currentNote->id,
                    'original_name' => $meta['original_name'],
                    'path' => $path,
                    'mime_type' => $meta['mime_type'],
                    'kind' => $meta['kind'],
                    'size_bytes' => $meta['size'],
                    'sha256' => $meta['sha256'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                return ['attachment' => $attachment, 'replayed' => false];
            });

            if ($result['replayed']) {
                $disk->delete($path);
            }

            return [
                'attachment' => $result['attachment']->fresh(),
                'replayed' => $result['replayed'],
            ];
        } catch (\Throwable $exception) {
            if ($stored) {
                try {
                    $disk->delete($path);
                } catch (\Throwable) {
                    // A future prune pass handles a path left by a failed request.
                }
            }
            throw $exception;
        }
    }
}
