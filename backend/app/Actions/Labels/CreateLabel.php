<?php

namespace App\Actions\Labels;

use App\Models\Label;
use App\Models\User;
use App\Support\ApiException;
use App\Support\OwnerMutation;
use Illuminate\Database\QueryException;

final class CreateLabel
{
    public function handle(User $user, string $name): Label
    {
        return OwnerMutation::run($user, function (User $locked) use ($name): Label {
            if (Label::where('user_id', $locked->id)->count() >= 100) {
                throw new ApiException('VALIDATION_FAILED', 'Bạn đã đạt tối đa 100 nhãn.', 422, [
                    'errors' => ['name' => ['Không thể tạo thêm nhãn.']],
                ]);
            }

            try {
                $now = now();

                return Label::create([
                    'user_id' => $locked->id,
                    'name' => $name,
                    'version' => 1,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            } catch (QueryException $exception) {
                if ((string) $exception->getCode() === '23000') {
                    throw new ApiException('VALIDATION_FAILED', 'Dữ liệu không hợp lệ.', 422, [
                        'errors' => ['name' => ['Tên nhãn đã tồn tại.']],
                    ]);
                }

                throw $exception;
            }
        });
    }
}
