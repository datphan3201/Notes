<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;

final class OwnerMutation
{
    /**
     * Every note/label/file mutation takes this lock first. It serializes the
     * small personal aggregate so quota and pivot changes cannot interleave.
     */
    public static function run(User $user, callable $callback): mixed
    {
        return DB::transaction(function () use ($user, $callback): mixed {
            $locked = User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            return $callback($locked);
        });
    }
}
