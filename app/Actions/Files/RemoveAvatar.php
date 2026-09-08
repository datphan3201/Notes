<?php

namespace App\Actions\Files;

use App\Models\PendingFileDeletion;
use App\Models\User;
use App\Support\OwnerMutation;

final class RemoveAvatar
{
    /** @return array<int,string> */
    public function handle(User $user): array
    {
        return OwnerMutation::run($user, function (User $locked): array {
            if (! $locked->avatar_path) {
                return [];
            }
            $path = $locked->avatar_path;
            PendingFileDeletion::firstOrCreate(['path' => $path], [
                'attempts' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $locked->forceFill(['avatar_path' => null, 'updated_at' => now()])->save();

            return [$path];
        });
    }
}
