<?php

namespace App\Actions\Labels;

use App\Http\Resources\LabelResource;
use App\Models\Label;
use App\Models\Note;
use App\Models\User;
use App\Support\ApiException;
use App\Support\OwnerMutation;
use Illuminate\Support\Facades\DB;

final class DeleteLabel
{
    public function handle(User $user, Label $label, int $baseVersion): void
    {
        OwnerMutation::run($user, function (User $locked) use ($label, $baseVersion): void {
            $current = Label::whereKey($label->id)->where('user_id', $locked->id)->lockForUpdate()->first();

            if ($current === null) {
                throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
            }

            if ((int) $current->version !== $baseVersion) {
                throw new ApiException(
                    'LABEL_CONFLICT',
                    'Nhãn đã thay đổi ở một cửa sổ khác.',
                    409,
                    ['current' => LabelResource::make($current)->resolve()],
                );
            }

            $noteIds = DB::table('label_note')
                ->where('label_id', $current->id)
                ->orderBy('note_id')
                ->lockForUpdate()
                ->pluck('note_id')
                ->all();

            if ($noteIds !== []) {
                $notes = Note::query()
                    ->where('user_id', $locked->id)
                    ->whereIn('id', $noteIds)
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get();

                DB::table('label_note')->where('label_id', $current->id)->delete();
                foreach ($notes as $note) {
                    if ($note->deleted_at === null) {
                        $note->forceFill([
                            'version' => ((int) $note->version) + 1,
                            'updated_at' => now(),
                        ])->save();
                    }
                }
            }

            $current->delete();
        });
    }
}
