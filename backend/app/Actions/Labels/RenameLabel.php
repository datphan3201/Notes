<?php

namespace App\Actions\Labels;

use App\Http\Resources\LabelResource;
use App\Models\Label;
use App\Models\User;
use App\Support\ApiException;
use App\Support\OwnerMutation;
use Illuminate\Database\QueryException;

final class RenameLabel
{
    public function handle(User $user, Label $label, string $name, int $baseVersion): Label
    {
        return OwnerMutation::run($user, function (User $locked) use ($label, $name, $baseVersion): Label {
            $current = Label::whereKey($label->id)->where('user_id', $locked->id)->lockForUpdate()->first();

            if ($current === null) {
                throw new ApiException('NOT_FOUND', 'Không tìm thấy dữ liệu.', 404);
            }

            if ($current->name === $name) {
                return $current;
            }

            if ((int) $current->version !== $baseVersion) {
                throw new ApiException(
                    'LABEL_CONFLICT',
                    'Nhãn đã thay đổi ở một cửa sổ khác.',
                    409,
                    ['current' => LabelResource::make($current)->resolve()],
                );
            }

            try {
                $current->forceFill([
                    'name' => $name,
                    'version' => ((int) $current->version) + 1,
                    'updated_at' => now(),
                ])->save();
            } catch (QueryException $exception) {
                if ((string) $exception->getCode() === '23000') {
                    throw new ApiException('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
                        'errors' => ['name' => ['Tên nhãn đã tồn tại.']],
                    ]);
                }

                throw $exception;
            }

            return $current;
        });
    }
}
