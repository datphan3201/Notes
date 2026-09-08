<?php

namespace App\Actions\Notes;

use App\Http\Resources\NoteResource;
use App\Models\Note;
use App\Models\User;
use App\Support\ApiException;
use App\Support\NoteSnapshot;
use App\Support\OwnerMutation;
use Illuminate\Support\Str;

final class CreateNote
{
    /** @return array{note:Note,replayed:bool} */
    public function handle(User $user, array $input): array
    {
        $id = strtolower((string) $input['id']);
        $requested = NoteSnapshot::fromInput([
            'title' => $input['title'],
            'content' => $input['content'],
            'color' => $input['color'] ?? $user->preferences()->value('default_note_color') ?? 'neutral',
            'is_pinned' => false,
            'label_ids' => [],
        ]);

        if (! Str::isUuid($id)) {
            throw new ApiException('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
                'errors' => ['id' => ['UUID ghi chú không hợp lệ.']],
            ]);
        }

        $result = OwnerMutation::run($user, function (User $locked) use ($id, $requested): array {
            $note = Note::query()
                ->whereKey($id)
                ->lockForUpdate()
                ->first();

            if ($note !== null && (int) $note->user_id !== (int) $locked->id) {
                // A UUID collision with another account must not reveal the
                // foreign note; it is still rejected before the PK insert can
                // turn into a database error or an information leak.
                throw new ApiException('CREATE_CONFLICT', 'Không thể dùng mã ghi chú này.', 409);
            }

            $note?->load('labels');

            if ($note?->deleted_at !== null) {
                throw new ApiException('NOTE_DELETED', 'Ghi chú đã bị xóa.', 410);
            }

            if ($note !== null) {
                $current = NoteSnapshot::fromNote($note);

                if (NoteSnapshot::equals($current, $requested)) {
                    return ['note' => $note, 'replayed' => true];
                }

                throw new ApiException(
                    'CREATE_CONFLICT',
                    'Ghi chú đã tồn tại với nội dung khác.',
                    409,
                    ['current' => NoteResource::make($note)->resolve()],
                );
            }

            $now = now();
            $note = Note::create([
                'id' => $id,
                'user_id' => $locked->id,
                'title' => $requested['title'],
                'content' => $requested['content'],
                'color' => $requested['color'],
                'version' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            return ['note' => $note, 'replayed' => false];
        });

        $note = $result['note']->fresh(['labels', 'attachments']);

        return ['note' => $note, 'replayed' => $result['replayed']];
    }
}
